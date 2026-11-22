-- =====================================================================
-- ERP QUATAR – Migration 03: kho ảnh (chỉ chạy trên Supabase)
-- Ảnh viếng thăm (Timemark) và ảnh biên bản giao hàng. Ảnh nén ~100 KB phía app (#23).
-- Đường dẫn: <user_id>/<yyyy-mm-dd>/<tên file>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anh', 'anh', false, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy anh_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'anh' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anh_read on storage.objects for select to authenticated
  using (bucket_id = 'anh' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role('ceo','gsv','ke_toan')));
create policy anh_delete_ceo on storage.objects for delete to authenticated
  using (bucket_id = 'anh' and public.has_role('ceo'));
