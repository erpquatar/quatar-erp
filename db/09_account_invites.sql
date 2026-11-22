-- Chặn tự đăng ký bằng "phiếu mời": Edge Function admin-users (service_role) ghi phiếu trước khi tạo user.
-- (Cách cũ dựa vào app_metadata không dùng được: Supabase Auth INSERT user trước rồi mới gắn app_metadata.)
create table if not exists account_invites (email text primary key, created_at timestamptz not null default now());
alter table account_invites enable row level security;
revoke all on account_invites from anon, authenticated;
grant select, insert, update, delete on account_invites to service_role;

create or replace function public.block_self_signup() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  delete from account_invites where email = lower(new.email) and created_at > now() - interval '10 minutes';
  if not found then
    raise exception 'ERP Quatar không cho tự đăng ký. Liên hệ Admin để được cấp tài khoản.';
  end if;
  return new;
end $$;
