-- =====================================================================
-- ERP QUATAR – Migration 06: danh mục đầy đủ + chứng từ kho chuẩn
-- Danh mục: ĐVT, vùng, nhóm hàng, bộ phận, lý do nhập/xuất; giá chuẩn, vị trí mặc định, ngừng dùng.
-- Chứng từ kho: Nhập kho / Xuất kho / Điều chuyển, nhiều dòng, đối tượng (NCC / khách hàng / bộ phận / khác),
-- đơn giá tự lấy từ danh mục (sửa được), lưu nháp → ghi sổ → hủy (CEO, đảo tồn, giữ lịch sử).
-- =====================================================================

-- ---------- Danh mục chung ----------
create table units        (id text primary key, ten text not null, active boolean not null default true);
create table regions      (id text primary key, ten text not null unique, active boolean not null default true);
create table item_groups  (id text primary key, ten text not null, ap_dung item_kind not null, active boolean not null default true);
create table departments  (id text primary key, ten text not null, active boolean not null default true);
create table stock_reasons(id text primary key, ten text not null, ap_dung text not null check (ap_dung in ('Nhập','Xuất','Chuyển')), active boolean not null default true);

insert into units(id, ten) select x, x from unnest(array['kg','tấn','lít','bao','chai','can','gói','thùng','cái','cuộn']) x;
insert into regions(id, ten) values ('V1','ĐBSCL'),('V2','Đông Nam Bộ'),('V3','Tây Nguyên'),('V4','Miền Trung'),('V5','Miền Bắc');
insert into item_groups(id, ten, ap_dung) values
 ('NH01','Vô cơ','Thành phẩm'),('NH02','Hữu cơ','Thành phẩm'),('NH03','Sinh học','Thành phẩm'),('NH04','Bón lá','Thành phẩm'),('NH05','Lỏng','Thành phẩm'),
 ('NH06','Đạm','NVL'),('NH07','Lân','NVL'),('NH08','Kali','NVL'),('NH09','Trung vi lượng','NVL'),('NH10','Chất mang','NVL'),('NH11','Phụ gia','NVL'),
 ('NH12','Bao','Bao bì'),('NH13','Chai, can','Bao bì'),('NH14','Túi','Bao bì'),('NH15','Thùng','Bao bì');
insert into departments(id, ten) values ('BP-SX','Xưởng sản xuất'),('BP-KD','Phòng kinh doanh'),('BP-KT','Phòng kế toán'),('BP-KHO','Kho'),('BP-BT','Bảo trì'),('BP-BGD','Ban giám đốc');
insert into stock_reasons(id, ten, ap_dung) values
 ('LD01','Nhập mua','Nhập'),('LD02','Nhập hàng trả lại','Nhập'),('LD03','Nhập khác','Nhập'),
 ('LD04','Xuất bán','Xuất'),('LD05','Xuất mẫu / khuyến mãi','Xuất'),('LD06','Xuất nội bộ','Xuất'),('LD07','Xuất bổ sung cho SX','Xuất'),('LD08','Xuất trả NCC','Xuất'),('LD09','Xuất khác','Xuất'),
 ('LD10','Chuyển vị trí','Chuyển'),('LD11','Chuyển kho','Chuyển');

-- ---------- Bổ sung cột cho danh mục có sẵn ----------
alter table suppliers  add column dia_chi text, add column sdt text, add column active boolean not null default true;
alter table carriers   add column ma text unique, add column active boolean not null default true;
alter table machines   add column active boolean not null default true;
alter table warehouses add column active boolean not null default true;
alter table locations  add column active boolean not null default true;
alter table dealers    add column active boolean not null default true;
alter table products   add column gia_von_chuan numeric(14,0) not null default 0,
                       add column vi_tri_mac_dinh text references locations(id);
alter table materials  add column gia_chuan numeric(14,2) not null default 0,
                       add column vi_tri_mac_dinh text references locations(id);

-- ---------- Chứng từ kho: phần đầu phiếu ----------
alter table stock_docs
  add column ngay            date not null default current_date,
  add column doi_tuong_loai  text check (doi_tuong_loai in ('ncc','kh','bp','khac')),
  add column doi_tuong_id    text,
  add column doi_tuong_ten   text,
  add column doi_tuong_dc    text,       -- địa chỉ, SĐT, MST chụp lại lúc lập phiếu (in phiếu đúng thời điểm)
  add column doi_tuong_sdt   text,
  add column doi_tuong_mst   text,
  add column kho             text references warehouses(id),
  add column kho_den         text references warehouses(id),
  add column dien_giai       text,
  add column status          text not null default 'da_ghi' check (status in ('nhap','da_ghi','da_huy')),
  add column ly_do_huy       text,
  add column huy_boi         uuid references profiles(id),
  add column huy_luc         timestamptz;

-- Dòng phiếu (lưu cả khi nháp); khi ghi sổ sinh stock_moves
create table stock_doc_lines (
  doc_id        text not null references stock_docs(id) on delete cascade,
  stt           int not null,
  kind          item_kind not null,
  item_code     text not null,
  lot_code      text,                 -- trống hoặc 'FIFO' = tự lấy lô cũ nhất
  vi_tri        text references locations(id),
  vi_tri_den    text references locations(id),
  qty           numeric(14,3) not null check (qty > 0),
  don_gia       numeric(14,2) not null default 0,
  gia_danh_muc  numeric(14,2),        -- giá gợi ý từ danh mục, để biết dòng nào đã sửa giá
  primary key (doc_id, stt)
);
alter table stock_moves add column don_gia numeric(14,2);
alter table iqc_checks  add column doc_id text references stock_docs(id);

-- ---------- Hàm trợ giúp ----------
create or replace function item_kind_of(p_item text) returns item_kind
language sql stable security definer set search_path = public as
$$ select coalesce((select loai from materials where ma = p_item), (select 'Thành phẩm'::item_kind from products where sku = p_item)) $$;

-- Đơn giá gợi ý theo loại phiếu: xuất bán = giá bán; nhập mua = giá nhập chuẩn; còn lại = giá vốn
create or replace function item_price(p_item text, p_loai text) returns numeric
language sql stable security definer set search_path = public as
$$ select case
    when p_loai = 'Xuất bán' then (select gia_ban from products where sku = p_item)
    when exists (select 1 from materials where ma = p_item) then (select gia_chuan from materials where ma = p_item)
    else (select gia_von_chuan from products where sku = p_item) end $$;

-- ---------- Lưu nháp / sửa nháp ----------
-- p = {id?, offline_id?, loai, ngay, doi_tuong:{loai,id,ten}, kho, kho_den, ref, dien_giai,
--      lines:[{item, lot, vi_tri, vi_tri_den, qty, don_gia?}]}
create or replace function stock_voucher_save(p jsonb) returns text
language plpgsql security definer set search_path = public as
$$ declare v_id text := p->>'id'; v_loai text := p->>'loai'; dir text; pre text; ln jsonb; i int := 0; dt jsonb := p->'doi_tuong';
  v_dc text; v_sdt text; v_mst text; k item_kind; begin
  perform need_role('to_truong','ke_toan','ceo');
  if v_loai not in ('Nhập mua','Nhập hàng trả lại','Nhập khác','Xuất bán','Xuất mẫu / khuyến mãi','Xuất nội bộ','Xuất bổ sung cho SX','Xuất trả NCC','Xuất khác','Chuyển vị trí','Chuyển kho') then
    raise exception 'Loại phiếu % không lập tay được', v_loai; end if;
  if p->>'offline_id' is not null then
    select id into v_id from stock_docs where offline_id = (p->>'offline_id')::uuid;
    if v_id is not null and (select status from stock_docs where id = v_id) <> 'nhap' then return v_id; end if;
  end if;
  dir := case when v_loai like 'Nhập%' then 'N' when v_loai like 'Chuyển%' then 'C' else 'X' end;
  if dt->>'loai' = 'kh' then select dia_chi, sdt, mst into v_dc, v_sdt, v_mst from dealers where id = dt->>'id';
  elsif dt->>'loai' = 'ncc' then select dia_chi, sdt, mst into v_dc, v_sdt, v_mst from suppliers where id = dt->>'id'; end if;
  if v_id is null then
    pre := case dir when 'N' then 'PN' when 'X' then 'PX' else 'PC' end;
    v_id := next_no(pre || '-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
    insert into stock_docs(id, offline_id, loai, ref, user_id, tu_dong, status) values (v_id, (p->>'offline_id')::uuid, v_loai, p->>'ref', auth.uid(), false, 'nhap');
  elsif (select status from stock_docs where id = v_id) <> 'nhap' then
    raise exception 'Phiếu % đã ghi sổ, không sửa được (chỉ hủy)', v_id;
  end if;
  update stock_docs set loai = v_loai, ngay = coalesce((p->>'ngay')::date, current_date), ref = p->>'ref', dien_giai = p->>'dien_giai',
         kho = p->>'kho', kho_den = p->>'kho_den', doi_tuong_loai = dt->>'loai', doi_tuong_id = nullif(dt->>'id',''), doi_tuong_ten = dt->>'ten',
         doi_tuong_dc = v_dc, doi_tuong_sdt = v_sdt, doi_tuong_mst = v_mst, user_id = auth.uid()
   where id = v_id;
  delete from stock_doc_lines where doc_id = v_id;
  for ln in select * from jsonb_array_elements(coalesce(p->'lines','[]')) loop
    k := item_kind_of(ln->>'item');
    if k is null then raise exception 'Mặt hàng % không có trong danh mục', ln->>'item'; end if;
    i := i + 1;
    insert into stock_doc_lines(doc_id, stt, kind, item_code, lot_code, vi_tri, vi_tri_den, qty, don_gia, gia_danh_muc)
    values (v_id, i, k, ln->>'item', nullif(ln->>'lot',''), nullif(ln->>'vi_tri',''), nullif(ln->>'vi_tri_den',''), (ln->>'qty')::numeric,
            coalesce((ln->>'don_gia')::numeric, item_price(ln->>'item', v_loai), 0), item_price(ln->>'item', v_loai));
  end loop;
  return v_id;
end $$;

-- Xuất từ một lô cụ thể (hoặc FIFO nếu không chỉ lô)
create or replace function issue_lot(p_kind item_kind, p_item text, p_lot text, p_loc text, p_qty numeric, p_type move_type, p_doc text, p_gia numeric) returns void
language plpgsql security definer set search_path = public as
$$ declare lt stock_lots; begin
  if p_lot is null or upper(p_lot) = 'FIFO' then
    perform fifo_issue(p_kind, p_item, p_qty, p_type, 'voucher', p_doc);
    update stock_moves set don_gia = p_gia where ref_type = 'voucher' and ref_id = p_doc and don_gia is null;
    return;
  end if;
  select * into lt from stock_lots where kind = p_kind and item_code = p_item and lot_code = p_lot
     and (p_loc is null or location_id = p_loc) and qty > 0 order by qty desc limit 1 for update;
  if lt.id is null then raise exception 'Không tìm thấy lô % của % tại vị trí %', p_lot, p_item, coalesce(p_loc,'bất kỳ'); end if;
  if lt.qty < p_qty then raise exception 'Lô % chỉ còn % (cần %)', p_lot, lt.qty, p_qty; end if;
  update stock_lots set qty = qty - p_qty where id = lt.id;
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id, don_gia) values (p_type, lt.id, -p_qty, 'voucher', p_doc, auth.uid(), p_gia);
end $$;

-- ---------- Ghi sổ ----------
create or replace function stock_voucher_post(p_id text) returns text
language plpgsql security definer set search_path = public as
$$ declare d stock_docs; l record; dir text; lid bigint; dest text; src stock_lots; need numeric; take numeric; begin
  perform need_role('to_truong','ke_toan','ceo');
  select * into d from stock_docs where id = p_id for update;
  if d.id is null then raise exception 'Không tìm thấy phiếu %', p_id; end if;
  if d.status <> 'nhap' then raise exception 'Phiếu % đã ghi sổ hoặc đã hủy', p_id; end if;
  if not exists (select 1 from stock_doc_lines where doc_id = p_id) then raise exception 'Phiếu chưa có mặt hàng'; end if;
  dir := case when d.loai like 'Nhập%' then 'N' when d.loai like 'Chuyển%' then 'C' else 'X' end;
  if d.loai in ('Nhập mua','Xuất trả NCC') and (d.doi_tuong_loai <> 'ncc' or d.doi_tuong_id is null) then raise exception 'Chọn nhà cung cấp từ danh mục'; end if;
  if d.loai in ('Nhập hàng trả lại','Xuất bán','Xuất mẫu / khuyến mãi') and (d.doi_tuong_loai <> 'kh' or d.doi_tuong_id is null) then raise exception 'Chọn khách hàng / đại lý từ danh mục'; end if;
  if d.loai in ('Xuất nội bộ','Xuất bổ sung cho SX') and (d.doi_tuong_loai <> 'bp' or d.doi_tuong_id is null) then raise exception 'Chọn bộ phận nhận'; end if;
  perform set_config('app.doc_id', p_id, true);
  for l in select * from stock_doc_lines where doc_id = p_id order by stt loop
    if dir = 'N' then
      dest := case when d.loai = 'Nhập hàng trả lại' then 'K1' else l.vi_tri end;
      insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia)
      values (l.kind, l.item_code, coalesce(l.lot_code, l.item_code || '-' || to_char(d.ngay,'YYMMDD')), dest, l.qty, l.don_gia)
      on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty returning id into lid;
      insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id, don_gia)
      values (case d.loai when 'Nhập mua' then 'nhap_mua'::move_type when 'Nhập hàng trả lại' then 'nhap_tra_ve' else 'nhap_khac' end, lid, l.qty, 'voucher', p_id, auth.uid(), l.don_gia);
      if d.loai = 'Nhập mua' and l.kind = 'NVL' then
        insert into iqc_checks(lot_code, material_ma, qty, doc_id) values (coalesce(l.lot_code, l.item_code || '-' || to_char(d.ngay,'YYMMDD')), l.item_code, l.qty, p_id);
      end if;
      if d.loai = 'Nhập hàng trả lại' then
        insert into defects(id, nguon, lot_id, qty, mo_ta, dealer_id, user_id)
        values (next_no('HL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3), 'Đại lý trả về', lid, l.qty, coalesce(d.dien_giai, d.doi_tuong_ten), d.doi_tuong_id, auth.uid());
      end if;
    elsif dir = 'X' then
      perform issue_lot(l.kind, l.item_code, l.lot_code, l.vi_tri, l.qty,
        case d.loai when 'Xuất bán' then 'xuat_ban'::move_type when 'Xuất bổ sung cho SX' then 'xuat_sx' when 'Xuất trả NCC' then 'tra_ncc' else 'xuat_khac' end,
        p_id, l.don_gia);
    else
      if l.vi_tri_den is null then raise exception 'Dòng % chưa chọn vị trí đến', l.stt; end if;
      need := l.qty;
      for src in select * from stock_lots where kind = l.kind and item_code = l.item_code and qty > 0
                   and (l.vi_tri is null or location_id = l.vi_tri)
                   and (l.lot_code is null or upper(l.lot_code) = 'FIFO' or lot_code = l.lot_code)
                 order by ngay_nhap, id for update loop
        exit when need <= 0;
        take := least(need, src.qty);
        update stock_lots set qty = qty - take where id = src.id;
        insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id, don_gia) values ('chuyen_kho', src.id, -take, 'voucher', p_id, auth.uid(), src.don_gia);
        insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia, ngay_nhap, han_dung)
        values (src.kind, src.item_code, src.lot_code, l.vi_tri_den, take, src.don_gia, src.ngay_nhap, src.han_dung)
        on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty returning id into lid;
        insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id, don_gia) values ('chuyen_kho', lid, take, 'voucher', p_id, auth.uid(), src.don_gia);
        need := need - take;
      end loop;
      if need > 0 then raise exception 'Không đủ tồn % tại vị trí % để chuyển', l.item_code, coalesce(l.vi_tri,'(mọi vị trí)'); end if;
    end if;
  end loop;
  update stock_docs set status = 'da_ghi', ts = now() where id = p_id;
  return p_id;
end $$;

-- ---------- Hủy phiếu đã ghi sổ (CEO): đảo tồn, giữ lịch sử ----------
create or replace function stock_voucher_cancel(p_id text, p_ly_do text) returns void
language plpgsql security definer set search_path = public as
$$ declare d stock_docs; m record; begin
  perform need_role('ceo');
  select * into d from stock_docs where id = p_id for update;
  if d.status <> 'da_ghi' then raise exception 'Chỉ hủy phiếu đã ghi sổ'; end if;
  if d.tu_dong then raise exception 'Phiếu tự sinh hủy từ nghiệp vụ gốc (đơn hàng, lệnh SX, hàng lỗi…)'; end if;
  if coalesce(trim(p_ly_do),'') = '' then raise exception 'Nhập lý do hủy'; end if;
  perform set_config('app.doc_id', p_id, true);
  for m in select * from stock_moves where doc_id = p_id order by id desc loop
    if m.qty > 0 and (select qty from stock_lots where id = m.lot_id) < m.qty then
      raise exception 'Hàng của phiếu này đã được xuất bớt, không hủy được'; end if;
    update stock_lots set qty = qty - m.qty where id = m.lot_id;
    insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id, don_gia, ghi_chu)
    values (m.loai, m.lot_id, -m.qty, 'huy', p_id, auth.uid(), m.don_gia, 'Đảo do hủy phiếu');
  end loop;
  update stock_docs set status = 'da_huy', ly_do_huy = p_ly_do, huy_boi = auth.uid(), huy_luc = now() where id = p_id;
  update iqc_checks set status = 'khong_dat_tra_ncc', ket_qua = 'Phiếu nhập đã hủy' where doc_id = p_id and status = 'cho_lay_mau';
end $$;

create or replace function stock_voucher_delete_draft(p_id text) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('to_truong','ke_toan','ceo');
  delete from stock_docs where id = p_id and status = 'nhap' and (user_id = auth.uid() or has_role('ceo'));
  if not found then raise exception 'Chỉ xóa được phiếu nháp của mình'; end if;
end $$;

-- IQC cho hàng đã nhập bằng phiếu: không đạt thì chuyển lô vào khu cách ly + tạo phiếu hàng lỗi
create or replace function iqc_result(p_id bigint, p_ket_qua text, p_dat boolean, p_vi_tri text default null) returns void
language plpgsql security definer set search_path = public as
$$ declare q iqc_checks; p purchase_orders; loc text; lid bigint; src stock_lots; begin
  perform need_role('to_truong','ceo');
  select * into q from iqc_checks where id = p_id for update;
  if q.status <> 'cho_lay_mau' then raise exception 'Lô đã có kết quả'; end if;
  update iqc_checks set ket_qua = p_ket_qua, status = case when p_dat then 'dat'::iqc_status else 'khong_dat_cho_ceo' end, user_id = auth.uid(), ts = now() where id = p_id;
  if q.doc_id is not null then
    if not p_dat then
      select * into src from stock_lots where kind = 'NVL' and item_code = q.material_ma and lot_code = q.lot_code and qty > 0 and lot_usable(location_id) order by qty desc limit 1;
      if src.id is not null then
        perform stock_doc_manual('Chuyển vào cách ly', 'NVL', q.material_ma, q.lot_code, least(src.qty, q.qty), src.location_id, null, 'IQC không đạt: ' || coalesce(p_ket_qua,''), null, 'IQC không đạt');
      end if;
    end if;
    return;
  end if;
  select * into p from purchase_orders where id = q.po_id;
  loc := case when p_dat then p_vi_tri else 'K1' end;
  perform start_doc('Nhập mua', coalesce(q.po_id,'') || case when p_dat then ' · IQC đạt' else ' · IQC không đạt → cách ly' end);
  insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia) values ('NVL', q.material_ma, q.lot_code, loc, q.qty, coalesce(p.don_gia,0))
  on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty returning id into lid;
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id) values ('nhap_mua', lid, q.qty, 'po', q.po_id, auth.uid());
  update purchase_orders set status = 'da_nhap_kho' where id = q.po_id;
  if not p_dat then
    insert into defects(id, nguon, lot_id, qty, mo_ta, user_id)
    values (next_no('HL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3), 'IQC không đạt', lid, q.qty, p_ket_qua, auth.uid());
  end if;
end $$;

-- ---------- Phân quyền danh mục ----------
do $$ declare t text; begin
  foreach t in array array['units','regions','item_groups','departments','stock_reasons','stock_doc_lines'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  foreach t in array array['units','regions','item_groups','departments','stock_reasons'] loop
    execute format('create policy r_all on %I for select to authenticated using (my_role() is not null)', t);
    execute format('create policy w_kt on %I for all to authenticated using (has_role(''ceo'',''ke_toan'')) with check (has_role(''ceo'',''ke_toan''))', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit()', t);
  end loop;
end $$;
create policy r_ops on stock_doc_lines for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_kho on warehouses for all to authenticated using (has_role('ceo','to_truong')) with check (has_role('ceo','to_truong'));
create trigger audit_suppliers after insert or update or delete on suppliers for each row execute function audit();
create trigger audit_carriers  after insert or update or delete on carriers  for each row execute function audit();
create trigger audit_warehouses after insert or update or delete on warehouses for each row execute function audit();
create trigger audit_locations after insert or update or delete on locations for each row execute function audit();

-- Menu / quyền theo vai trò: tách Nhập kho, Xuất kho, Điều chuyển; thêm phân hệ Danh mục
delete from role_modules where module = 'docs';
insert into role_modules(role, module, quyen) values
 ('ceo','nhap','X,T,H'),('ceo','xuat','X,T,H'),('ceo','chuyen','X,T,H'),
 ('ke_toan','nhap','X,T'),('ke_toan','xuat','X,T'),('ke_toan','chuyen','X,T'),
 ('to_truong','nhap','X,T'),('to_truong','xuat','X,T'),('to_truong','chuyen','X,T'),
 ('ceo','dm_kh','X,T,S,H'),('ceo','dm_tp','X,T,S,H'),('ceo','dm_nvl','X,T,S,H'),('ceo','dm_bb','X,T,S,H'),('ceo','dm_ncc','X,T,S,H'),('ceo','dm_kho','X,T,S,H'),('ceo','dm_nx','X,T,S,H'),('ceo','dm_may','X,T,S,H'),('ceo','dm_chung','X,T,S,H'),
 ('ke_toan','dm_kh','X,T,S'),('ke_toan','dm_tp','X'),('ke_toan','dm_nvl','X,T,S'),('ke_toan','dm_bb','X,T,S'),('ke_toan','dm_ncc','X,T,S'),('ke_toan','dm_kho','X'),('ke_toan','dm_nx','X,T,S'),('ke_toan','dm_chung','X,T,S'),
 ('to_truong','dm_tp','X'),('to_truong','dm_nvl','X'),('to_truong','dm_bb','X'),('to_truong','dm_kho','X,T,S'),('to_truong','dm_may','X,T,S'),('to_truong','dm_chung','X');

revoke execute on function issue_lot(item_kind, text, text, text, numeric, move_type, text, numeric) from public, anon, authenticated;
revoke execute on function item_kind_of(text) from public, anon;
revoke execute on function item_price(text, text) from public, anon;
grant execute on function stock_voucher_save(jsonb), stock_voucher_post(text), stock_voucher_cancel(text, text), stock_voucher_delete_draft(text), item_price(text, text), item_kind_of(text) to authenticated;
revoke execute on function stock_voucher_save(jsonb), stock_voucher_post(text), stock_voucher_cancel(text, text), stock_voucher_delete_draft(text) from public, anon;
grant select, insert, update, delete on units, regions, item_groups, departments, stock_reasons, stock_doc_lines to authenticated;
revoke all on units, regions, item_groups, departments, stock_reasons, stock_doc_lines from anon;
