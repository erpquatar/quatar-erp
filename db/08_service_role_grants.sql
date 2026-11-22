-- Edge Function admin-users chạy bằng service_role: cần đủ quyền trên schema public
-- (các migration trước thu quyền rộng tay nên service_role mất quyền đọc/ghi bảng → tạo tài khoản báo 403)
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select, update on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
