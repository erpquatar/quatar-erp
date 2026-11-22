-- Migration 13: kế hoạch doanh thu tháng (toàn công ty: ma = 'ALL'; theo NVKD: ma = id người dùng)
create table sales_targets (
  thang     text not null check (thang ~ '^\d{4}-\d{2}$'),
  ma        text not null,
  doanh_thu numeric(16,0) not null check (doanh_thu >= 0),
  primary key (thang, ma)
);
alter table sales_targets enable row level security;
create policy r_all on sales_targets for select to authenticated using (my_role() in ('ceo','gsv','ke_toan') or ma = auth.uid()::text);
create policy w_ceo on sales_targets for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
grant select, insert, update, delete on sales_targets to authenticated, service_role;
revoke all on sales_targets from anon;
create trigger audit_sales_targets after insert or update or delete on sales_targets for each row execute function audit();
