-- Tách CEO và Admin thành 2 tài khoản riêng, cùng vai trò 'ceo' (toàn quyền).
-- Phân biệt bằng chức danh hiển thị; quyền vẫn theo cột role.
alter table profiles add column if not exists chuc_danh text;
comment on column profiles.chuc_danh is 'Chức danh hiển thị (vd CEO, Admin hệ thống). Quyền vẫn theo cột role.';
update profiles set chuc_danh = 'Admin hệ thống' where username = 'trinh.admin';
