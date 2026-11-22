-- =====================================================================
-- ERP QUATAR – Migration 01: cấu trúc dữ liệu
-- Căn cứ: claude/quyet-dinh-dac-ta-v2.md (chốt 22/11/2026)
-- Nền tảng: Supabase (Postgres 15+), gói Free
-- =====================================================================

-- ---------- Kiểu dữ liệu dùng chung ----------
create type app_role      as enum ('ceo','gsv','nvkd','ke_toan','to_truong','dai_ly');
create type dealer_type   as enum ('NPP','Cấp 1','Cấp 2','Farm','Nông dân');
create type item_kind     as enum ('NVL','Bao bì','Thành phẩm');
create type order_status  as enum ('cho_dong_bo','cho_gsv','cho_kt','cho_ceo','cho_sx','cho_xuat','xep_xe','da_xuat','da_giao','hoan_tat','tra_lai','huy');
create type lsx_status    as enum ('cho_ceo','cho_can','dang_can','hoan_thanh','huy');
create type po_status     as enum ('de_nghi','da_dat_ncc','cho_iqc','da_nhap_kho','huy');
create type iqc_status    as enum ('cho_lay_mau','dat','khong_dat_cho_ceo','khong_dat_tra_ncc','khong_dat_ceo_cho_dung');
create type move_type     as enum ('nhap_mua','nhap_sx','nhap_tra_ve','nhap_khac','xuat_ban','xuat_sx','xuat_khac','chuyen_kho','kiem_ke','tra_ncc','xuat_huy');
create type defect_status as enum ('cho_de_xuat','cho_ceo','da_xu_ly');
create type count_status  as enum ('dang_dem','cho_ceo','da_duyet');

-- ---------- Người dùng ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  ho_ten      text not null,
  role        app_role not null,
  vung        text,                       -- GSV/NVKD: vùng phụ trách
  dealer_id   text,                       -- tài khoản đại lý gắn với 1 đại lý
  sdt         text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Chính sách theo giai đoạn (quyết định #5, #14) ----------
create table policy_periods (
  id      bigint generated always as identity primary key,
  ten     text not null,                  -- vd: Vụ Đông Xuân 2026–2027
  tu_ngay date not null,
  den_ngay date not null,
  active  boolean not null default false,
  check (den_ngay >= tu_ngay)
);
create unique index one_active_period on policy_periods(active) where active;

create table ck_levels (
  period_id   bigint references policy_periods(id) on delete cascade,
  loai_dai_ly dealer_type not null,
  ck_max_pct  numeric(5,2) not null check (ck_max_pct between 0 and 100),
  primary key (period_id, loai_dai_ly)
);

create table bonus_tiers (
  id        bigint generated always as identity primary key,
  period_id bigint not null references policy_periods(id) on delete cascade,
  tu_tan    numeric(12,2) not null,
  den_tan   numeric(12,2),                -- null = trở lên
  pct_hang  numeric(5,2) not null check (pct_hang >= 0)
);

-- ---------- Đại lý / khách hàng (C1) ----------
create table dealers (
  id              text primary key,       -- DL-TB-001
  ten             text not null,
  loai            dealer_type not null,
  cap_tren_id     text references dealers(id),
  mst             text,
  dai_dien        text,
  sdt             text,
  dia_chi         text,
  tinh            text,
  vung            text,
  kho_nhan        text,
  tai_trong_xe    text,
  nvkd_id         uuid references profiles(id),
  han_muc         numeric(16,0) not null default 0,
  han_no_ngay     int not null default 30,         -- thời hạn nợ
  khoa_qua_han_ngay int not null default 30,       -- quá hạn > N ngày thì đơn lên CEO
  tai_san_bao_dam text,
  cam_ket_tan     numeric(12,2),
  trang_thai      text not null default 'Đang bán' check (trang_thai in ('Đang bán','Tạm khoá','Ngừng')),
  tu_dat_hang     boolean not null default false,  -- quyền đại lý tự đặt (B4)
  created_at      timestamptz not null default now()
);
alter table profiles add constraint profiles_dealer_fk foreign key (dealer_id) references dealers(id);

-- ---------- Thành phẩm (C2) ----------
create table products (
  sku              text primary key,      -- QT-NPK202015-25
  ten              text not null,
  nhan_hieu        text,
  nhom             text,                  -- Vô cơ / Hữu cơ / Sinh học / Bón lá / Lỏng
  dang             text,                  -- Hạt / Bột / Lỏng
  n_pct numeric(5,2), p2o5_pct numeric(5,2), k2o_pct numeric(5,2),
  trung_vi_luong   text,
  quy_cach         text not null,         -- Bao 25 kg / Chai 1 lít
  dvt              text not null,         -- bao / chai / gói / can
  kg_moi_dv        numeric(10,3) not null,-- khối lượng 1 đơn vị (lỏng = lít × tỷ trọng)
  ma_lo_prefix     text not null,         -- quyết định #11: mã SP trong mã lô
  so_qd_luu_hanh   text,
  het_han_luu_hanh date,
  tieu_chuan       text,
  han_dung_thang   int,
  barcode          text,
  gia_ban          numeric(14,0) not null,
  muc_bao_ton      numeric(14,2) default 0,
  active           boolean not null default true
);

-- ---------- NVL, bao bì (C4) và nhà cung cấp (C5) ----------
create table suppliers (
  id          text primary key,
  ten         text not null,
  mst         text,
  quoc_gia    text default 'Việt Nam',
  mat_hang    text,
  dieu_khoan  text,
  xep_hang    text
);

create table materials (
  ma          text primary key,           -- NL-URE46 / BB-BAO25
  ten         text not null,
  loai        item_kind not null check (loai in ('NVL','Bao bì')),
  nhom        text,
  ham_luong   text,
  dvt_kho     text not null,
  dvt_mua     text,
  quy_doi     numeric(12,4) default 1,    -- 1 đv mua = ? đv kho
  nguon       text,
  ncc_chinh   text references suppliers(id),
  lead_time_ngay int,
  moq         numeric(14,2),
  muc_bao_ton numeric(14,2) not null default 0,  -- số cố định (F3)
  ton_toi_da  numeric(14,2),
  bao_quan    text,
  active      boolean not null default true
);

-- ---------- Kho, vị trí (C6) ----------
create table warehouses (
  id      text primary key,               -- KHO-NVL / KHO-TP / CACH-LY
  ten     text not null,
  loai    item_kind,
  cach_ly boolean not null default false  -- hàng ở đây không tính vào tồn khả dụng, không xuất FIFO
);
create table locations (
  id           text primary key,          -- A01-03
  warehouse_id text not null references warehouses(id),
  mo_ta        text
);

-- Lô tồn kho: mọi tồn đều theo lô để xuất FIFO (quyết định #10)
create table stock_lots (
  id          bigint generated always as identity primary key,
  kind        item_kind not null,
  item_code   text not null,              -- materials.ma hoặc products.sku
  lot_code    text not null,
  location_id text references locations(id),
  qty         numeric(14,3) not null default 0 check (qty >= 0),   -- không xuất âm (F2)
  don_gia     numeric(14,2) default 0,    -- giá nhập để tính giá thành theo lô
  ngay_nhap   timestamptz not null default now(),
  han_dung    date,
  unique (kind, item_code, lot_code, location_id)
);
create index stock_lots_fifo on stock_lots(kind, item_code, ngay_nhap) where qty > 0;

-- Phiếu kho: mọi biến động tồn đều thuộc 1 phiếu (tự sinh từ luồng hoặc lập tay)
create table stock_docs (
  id         text primary key,              -- PN-2611-001 / PX / PC / DC
  offline_id uuid unique,
  ts         timestamptz not null default now(),
  loai       text not null,                 -- Nhập mua, Nhập thành phẩm, Nhập hàng trả về, Nhập khác, Xuất bán, Xuất NVL cho SX, Xuất khác, Xuất hủy, Xuất trả NCC, Chuyển vị trí, Chuyển vào cách ly, Điều chỉnh kiểm kê
  ref        text,
  user_id    uuid references profiles(id),
  tu_dong    boolean not null default true
);

create table stock_moves (
  id        bigint generated always as identity primary key,
  doc_id    text references stock_docs(id),
  ts        timestamptz not null default now(),
  loai      move_type not null,
  lot_id    bigint not null references stock_lots(id),
  qty       numeric(14,3) not null,       -- dương = nhập, âm = xuất
  ref_type  text,                         -- order / lsx / po / kiem_ke
  ref_id    text,
  user_id   uuid references profiles(id),
  ghi_chu   text
);

-- ---------- Hàng lỗi, khu cách ly, hủy ----------
create table defects (
  id         text primary key,               -- HL-2611-006
  ts         timestamptz not null default now(),
  nguon      text not null check (nguon in ('Đại lý trả về','IQC không đạt','Hỏng trong kho','Lỗi sản xuất')),
  lot_id     bigint not null references stock_lots(id),   -- lô đang nằm trong khu cách ly
  qty        numeric(14,3) not null check (qty > 0),
  mo_ta      text,
  dealer_id  text references dealers(id),
  de_xuat    text check (de_xuat in ('Tái chế / phối trộn lại','Hạ cấp','Trả NCC','Hủy')),
  status     defect_status not null default 'cho_de_xuat',
  ket_qua    text,
  doc_xu_ly  text references stock_docs(id),
  bien_ban   text,                            -- số biên bản hủy
  da_giam_no numeric(16,0),                   -- hàng đại lý trả: số tiền kế toán đã ghi giảm
  user_id    uuid references profiles(id)
);

-- ---------- Kiểm kê ----------
create table stocktakes (
  id      bigint generated always as identity primary key,
  ky      text not null,                      -- Tháng 11/2026
  status  count_status not null default 'dang_dem',
  mo_luc  timestamptz not null default now(),
  duyet_boi uuid references profiles(id),
  doc_id  text references stock_docs(id)
);
create table stocktake_lines (
  stocktake_id bigint references stocktakes(id) on delete cascade,
  lot_id       bigint references stock_lots(id),
  so_sach      numeric(14,3) not null,
  thuc_te      numeric(14,3),
  nguoi_dem    uuid references profiles(id),
  primary key (stocktake_id, lot_id)
);

-- ---------- Công thức phối trộn (C3, quyết định #8, #9) ----------
create table formulas (
  id          bigint generated always as identity primary key,
  sku         text not null references products(sku),
  version     int not null,
  dang        text not null,
  co_me_kg    numeric(10,2) not null check (co_me_kg > 0),
  ty_trong    numeric(6,3),                -- kg/lít, chỉ hàng lỏng
  hao_hut_pct numeric(5,2) not null default 3,
  routing     text,
  hieu_luc_tu date not null default current_date,
  duyet_boi   uuid references profiles(id),
  active      boolean not null default true,
  unique (sku, version)
);
create unique index one_active_formula on formulas(sku) where active;
create table formula_lines (
  formula_id    bigint not null references formulas(id) on delete cascade,
  material_ma   text not null references materials(ma),
  kg_moi_me     numeric(12,3) not null check (kg_moi_me > 0),  -- bao bì: số cái/mẻ
  thay_the_ma   text references materials(ma),
  he_so_thay_the numeric(8,4),
  primary key (formula_id, material_ma)
);

-- ---------- Đơn hàng (quyết định #4–#7) ----------
create table orders (
  id          text primary key,           -- DH-2611-0001
  offline_id  uuid unique,                -- chống trùng khi đồng bộ offline (#22)
  dealer_id   text not null references dealers(id),
  nvkd_id     uuid references profiles(id),
  nguon       text not null default 'NVKD' check (nguon in ('NVKD','Đại lý tự đặt','Kế toán')),
  ck_pct      numeric(5,2) not null default 0,
  khuyen_mai  text,
  status      order_status not null,
  vi_pham     text[] not null default '{}',   -- lý do lên CEO
  ngay_giao   date,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create table order_lines (
  order_id  text not null references orders(id) on delete cascade,
  sku       text not null references products(sku),
  qty       numeric(12,2) not null check (qty > 0),
  gia       numeric(14,0) not null,        -- giá trên đơn (sửa được, #6)
  gia_chung numeric(14,0) not null,        -- giá chung lúc lên đơn, để so vi phạm
  primary key (order_id, sku)
);
create table order_events (
  id        bigint generated always as identity primary key,
  order_id  text not null references orders(id) on delete cascade,
  ts        timestamptz not null default now(),
  user_id   uuid references profiles(id),
  action    text not null,
  ghi_chu   text
);

-- ---------- Công nợ ----------
create table invoices (
  id        text primary key,              -- số hóa đơn
  order_id  text not null references orders(id),
  dealer_id text not null references dealers(id),
  ngay      date not null default current_date,
  han_tt    date not null,
  so_tien   numeric(16,0) not null,
  da_thu    numeric(16,0) not null default 0,
  misa_xuat_luc timestamptz                  -- #17: đã đưa vào file MISA
);
create table receipts (
  id        bigint generated always as identity primary key,
  dealer_id text not null references dealers(id),
  ngay      date not null default current_date,
  so_tien   numeric(16,0) not null check (so_tien > 0),
  ghi_chu   text,
  user_id   uuid references profiles(id)
);

-- ---------- Sản xuất ----------
create table production_orders (
  id          text primary key,             -- LSX-2611-018
  sku         text not null references products(sku),
  formula_id  bigint not null references formulas(id),
  so_luong    numeric(12,2) not null,       -- theo đơn vị bán
  kg_ke_hoach numeric(14,3) not null,       -- gồm hao hụt của công thức
  so_me       int not null,
  from_order  text references orders(id),
  status      lsx_status not null default 'cho_ceo',
  duyet_boi   uuid references profiles(id),
  duyet_luc   timestamptz,
  lot_code    text,                          -- lô thành phẩm tạo ra
  so_luong_thuc numeric(12,2),               -- thành phẩm thực nhập, để tính hao hụt thực tế
  created_at  timestamptz not null default now()
);
create table batches (
  id        bigint generated always as identity primary key,
  lsx_id    text not null references production_orders(id) on delete cascade,
  me_so     int not null,
  user_id   uuid references profiles(id),
  chot_luc  timestamptz,
  unique (lsx_id, me_so)
);
create table batch_weighings (
  batch_id     bigint not null references batches(id) on delete cascade,
  material_ma  text not null references materials(ma),
  lot_id       bigint references stock_lots(id),
  ma_quet      text not null,
  kg_dinh_muc  numeric(12,3) not null,
  kg_thuc      numeric(12,3) not null,
  primary key (batch_id, material_ma)
);

-- ---------- Mua hàng, IQC (quyết định #3, #13) ----------
create table purchase_orders (
  id          text primary key,             -- PO-2611-031
  material_ma text not null references materials(ma),
  qty         numeric(14,2) not null,
  supplier_id text references suppliers(id),
  don_gia     numeric(14,2),
  eta         date,
  status      po_status not null default 'de_nghi',
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create table iqc_checks (
  id          bigint generated always as identity primary key,
  lot_code    text not null,
  material_ma text not null references materials(ma),
  po_id       text references purchase_orders(id),
  qty         numeric(14,2) not null,
  chi_tieu    text,
  ket_qua     text,
  status      iqc_status not null default 'cho_lay_mau',
  user_id     uuid references profiles(id),
  ts          timestamptz not null default now()
);

-- ---------- Mẫu lưu theo đơn hàng + thành phần (quyết định #12) ----------
create table retained_samples (
  id         bigint generated always as identity primary key,
  order_id   text references orders(id),
  lot_code   text not null,
  sku        text not null references products(sku),
  vi_tri_tu  text not null,                 -- Tủ M-02 · ngăn 4
  luu_den    date not null,
  thanh_phan jsonb not null default '[]',   -- [{material, lot, kg}]
  created_at timestamptz not null default now()
);

-- ---------- Giao vận – xe thuê (quyết định #21) ----------
create table carriers (
  id        bigint generated always as identity primary key,
  ten       text not null,
  tuyen     text,
  don_gia_tan numeric(12,0),
  tai_trong text,
  xe_cong_ty boolean not null default false
);
create table trips (
  id         text primary key,               -- CX-2611-046
  ngay       date not null,
  carrier_id bigint references carriers(id),
  bien_so    text,
  tai_trong  text,
  cuoc       numeric(14,0) default 0,
  status     text not null default 'Chờ xuất kho',
  anh_bien_ban text                          -- đường dẫn ảnh trong Storage
);
create table trip_orders (
  trip_id  text references trips(id) on delete cascade,
  order_id text references orders(id),
  primary key (trip_id, order_id)
);

-- ---------- Đi tuyến (quyết định #16) ----------
create table visits (
  id         bigint generated always as identity primary key,
  offline_id uuid unique,
  nvkd_id    uuid not null references profiles(id),
  dealer_id  text not null references dealers(id),
  ngay       date not null default current_date,
  gio_ke_hoach time,
  anh_path   text,                           -- 1 ảnh Timemark, nén ~100 KB (#23)
  tai_luc    timestamptz,
  ket_qua    text
);

-- ---------- Bảo trì ----------
create table machines (
  id      text primary key,
  ten     text not null,
  viec_dinh_ky text,
  chu_ky_ngay int,
  han_ke_tiep date
);
create table repair_requests (
  id         text primary key,
  machine_id text not null references machines(id),
  mo_ta      text not null,
  phu_tung   text,
  status     text not null default 'Chờ sửa',
  user_id    uuid references profiles(id),
  ts         timestamptz not null default now()
);

-- ---------- Chấm công (quyết định #20) ----------
create table attendance (
  id         bigint generated always as identity primary key,
  offline_id uuid unique,
  user_id    uuid not null references profiles(id),
  ts         timestamptz not null default now(),
  loai       text not null check (loai in ('Vào ca','Ra ca'))
);
create table attendance_locks (
  id       bigint generated always as identity primary key,
  den_ngay date not null,
  user_id  uuid references profiles(id),
  ts       timestamptz not null default now()
);

-- ---------- KPI – khung, chưa vận hành (quyết định #15) ----------
create table kpi_criteria (
  id        bigint generated always as identity primary key,
  role      app_role not null,
  tieu_chi  text not null,
  trong_so  numeric(5,2),
  nguon     text,
  muc_tieu  text,
  active    boolean not null default false
);

-- ---------- Nhật ký sửa đổi (B4: sửa sau duyệt phải có dấu vết) ----------
create table audit_log (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  user_id    uuid,
  bang       text not null,
  khoa       text,
  thao_tac   text not null,
  cu         jsonb,
  moi        jsonb
);

-- ---------- Số thứ tự chứng từ ----------
create table doc_counters (
  prefix text primary key,                   -- DH-2611 / LSX-2611 / TC1-261122
  last   int not null default 0
);

-- ---------- Kho và vị trí mặc định (danh sách vị trí thật nạp từ Excel) ----------
insert into warehouses(id, ten, loai, cach_ly) values
  ('KHO-NVL','Kho nguyên liệu','NVL',false), ('KHO-BB','Kho bao bì','Bao bì',false),
  ('KHO-TP','Kho thành phẩm','Thành phẩm',false), ('CACH-LY','Khu cách ly hàng lỗi',null,true);
insert into locations(id, warehouse_id, mo_ta) values
  ('K1','CACH-LY','Khu cách ly hàng lỗi, hàng trả về'), ('HC','CACH-LY','Hàng hạ cấp chờ bán xử lý');
