-- =====================================================================
-- ERP QUATAR – Migration 05: chặn tự đăng ký ngay ở cơ sở dữ liệu,
-- siết quyền đọc cho tài khoản chưa được cấp vai trò
-- Chỉ tài khoản do Admin tạo (app_metadata.created_by_admin = true — người dùng không tự đặt được cờ này)
-- mới được ghi vào auth.users. Không cần chỉnh cài đặt Auth trên dashboard.
-- =====================================================================
create or replace function public.block_self_signup() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  if coalesce(new.raw_app_meta_data->>'created_by_admin', 'false') <> 'true' then
    raise exception 'ERP Quatar không cho tự đăng ký. Liên hệ Admin để được cấp tài khoản.';
  end if;
  return new;
end $$;
revoke execute on function public.block_self_signup() from public, anon, authenticated;
create trigger block_self_signup before insert on auth.users for each row execute function public.block_self_signup();

alter policy r_all on profiles       using (my_role() is not null);
alter policy r_all on policy_periods using (my_role() is not null);
alter policy r_all on ck_levels      using (my_role() is not null);
alter policy r_all on bonus_tiers    using (my_role() is not null);
alter policy r_all on products       using (my_role() is not null);
alter policy r_all on role_modules   using (my_role() is not null);
alter policy r_all on kpi_criteria   using (my_role() is not null and my_role() <> 'dai_ly');

-- Tài khoản Admin đầu tiên (trinh.admin, vai trò CEO) được tạo trực tiếp ngày 22/11/2026,
-- mật khẩu tạm, bắt đổi ở lần đăng nhập đầu. Các tài khoản sau tạo trong app qua Edge Function admin-users.
