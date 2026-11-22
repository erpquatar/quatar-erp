-- =====================================================================
-- ERP QUATAR – Migration 04: tài khoản, đăng nhập, phân quyền theo vai trò
-- Tài khoản chỉ do CEO / Admin tạo qua Edge Function admin-users (không cho tự đăng ký).
-- Đăng nhập bằng tên đăng nhập; hệ thống quy đổi thành <ten>@erp.quatar.vn (không gửi email).
-- =====================================================================
alter table profiles
  add column username       text unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  add column must_change_pw boolean not null default true,
  add column last_login_at  timestamptz,
  add column created_by     uuid references profiles(id);

-- Ràng buộc phạm vi theo vai trò: GSV, NVKD phải có vùng; Đại lý phải gắn đúng 1 đại lý
alter table profiles add constraint profiles_scope_chk check (
  (role not in ('gsv','nvkd') or vung is not null) and
  (role <> 'dai_ly' or dealer_id is not null) and
  (role = 'dai_ly' or dealer_id is null)
);

-- Người dùng tự đánh dấu đã đổi mật khẩu lần đầu, và ghi giờ đăng nhập
create or replace function password_changed() returns void
language sql security definer set search_path = public as
$$ update profiles set must_change_pw = false where id = auth.uid() $$;

create or replace function touch_login() returns profiles
language sql security definer set search_path = public as
$$ update profiles set last_login_at = now() where id = auth.uid() and active returning * $$;

-- Bảng quyền theo vai trò: nguồn duy nhất cho menu và màn "Người dùng & phân quyền"
create table role_modules (
  role    app_role not null,
  module  text not null,          -- orders, dealers, stock, prod...
  quyen   text not null,          -- X,T,S,D,H ghép chuỗi
  primary key (role, module)
);
alter table role_modules enable row level security;
create policy r_all on role_modules for select to authenticated using (true);
create policy w_ceo on role_modules for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));

insert into role_modules(role, module, quyen) values
 ('ceo','dash','X'),('ceo','inbox','X,D'),('ceo','cost','X'),('ceo','orders','X,T,S,D,H'),('ceo','dealers','X,T,S'),('ceo','route','X'),('ceo','policy','X,T,S'),('ceo','kpi','X,T,S'),
 ('ceo','buy','X,D'),('ceo','ship','X'),('ceo','misa','X'),('ceo','stock','X'),('ceo','docs','X,T'),('ceo','defect','X,D'),('ceo','count','X,D'),('ceo','nxt','X'),
 ('ceo','bom','X,T,S,D'),('ceo','prod','X,D'),('ceo','qc','X'),('ceo','trace','X'),('ceo','maint','X'),('ceo','hr','X,D'),('ceo','perm','X,T,S,H'),
 ('gsv','dash','X'),('gsv','orders','X,D'),('gsv','dealers','X'),('gsv','route','X'),('gsv','policy','X'),('gsv','kpi','X'),('gsv','hr','T'),
 ('nvkd','orders','X,T,S'),('nvkd','dealers','X'),('nvkd','route','X,T'),('nvkd','kpi','X'),('nvkd','hr','T'),
 ('ke_toan','orders','X,T,S,D'),('ke_toan','dealers','X,T,S'),('ke_toan','policy','X'),('ke_toan','kpi','X'),('ke_toan','buy','X,T,S'),('ke_toan','ship','X,T,S'),('ke_toan','misa','X,T'),
 ('ke_toan','stock','X'),('ke_toan','docs','X,T'),('ke_toan','defect','X'),('ke_toan','count','X'),('ke_toan','nxt','X'),('ke_toan','trace','X'),('ke_toan','hr','X,T,D'),
 ('to_truong','orders','X'),('to_truong','stock','X'),('to_truong','docs','X,T'),('to_truong','defect','X,T'),('to_truong','count','X,T'),('to_truong','nxt','X'),
 ('to_truong','bom','X'),('to_truong','prod','X,T,S'),('to_truong','qc','X,T,S'),('to_truong','trace','X'),('to_truong','maint','X,T,S'),('to_truong','hr','T'),
 ('dai_ly','orders','X,T'),('dai_ly','dealers','X');

revoke execute on function password_changed() from public, anon;
revoke execute on function touch_login() from public, anon;
grant execute on function password_changed(), touch_login() to authenticated;
grant select on role_modules to authenticated;
create trigger audit_role_modules after insert or update or delete on role_modules for each row execute function audit();
