-- Migration 11: chương trình bán hàng theo kỳ chính sách và loại đại lý
-- Mỗi loại đại lý có thể có nhiều chương trình; mỗi chương trình: điều kiện đạt + tặng hàng và/hoặc chiết khấu.
create table policy_programs (
  id            bigint generated always as identity primary key,
  period_id     bigint not null references policy_periods(id) on delete cascade,
  loai_dai_ly   dealer_type not null,
  ten           text,                         -- tên chương trình (không bắt buộc)
  dk_sku        text references products(sku),-- sản phẩm áp dụng; trống = mọi sản phẩm
  dk_sl         numeric(14,3),                -- số lượng tối thiểu để đạt
  dk_dvt        text,                         -- đơn vị của điều kiện (bao, tấn, chai…)
  dk_mo_ta      text,                         -- mô tả thêm điều kiện
  tang_ma       text,                         -- mã hàng tặng (thành phẩm / NVL / bao bì) nếu có trong danh mục
  tang_ten      text,                         -- tên hàng tặng (hàng ngoài danh mục: nón, áo…)
  tang_sl       numeric(14,3),
  tang_dvt      text,
  ck_pct        numeric(5,2) check (ck_pct is null or (ck_pct >= 0 and ck_pct <= 100)),
  ghi_chu       text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check (ck_pct is not null or tang_sl is not null)
);
create index on policy_programs(period_id, loai_dai_ly);
alter table policy_programs enable row level security;
create policy r_all on policy_programs for select to authenticated using (my_role() is not null);
create policy w_ceo on policy_programs for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
grant select, insert, update, delete on policy_programs to authenticated;
grant select, insert, update, delete on policy_programs to service_role;
revoke all on policy_programs from anon;
create trigger audit_policy_programs after insert or update or delete on policy_programs for each row execute function audit();
