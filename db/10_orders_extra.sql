-- Migration 10: bổ sung cho phân hệ Đơn hàng
-- 1) Sửa & gửi lại đơn bị trả lại; 2) Hủy đơn; 3) Phiếu xuất bán tự sinh ghi đủ thông tin khách hàng.

create or replace function resubmit_order(p_order text, p_lines jsonb, p_ck numeric default null, p_km text default null) returns order_status
language plpgsql security definer set search_path = public as
$$ declare o orders; ln jsonb; pr products; st order_status; begin
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'Không tìm thấy đơn %', p_order; end if;
  if o.status <> 'tra_lai' then raise exception 'Chỉ sửa được đơn đang bị trả lại'; end if;
  if not (has_role('ceo','ke_toan') or o.created_by = auth.uid() or o.nvkd_id = auth.uid()) then
    raise exception 'Không có quyền sửa đơn này' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_lines,'[]')) = 0 then raise exception 'Đơn chưa có sản phẩm'; end if;
  delete from order_lines where order_id = p_order;
  for ln in select * from jsonb_array_elements(p_lines) loop
    select * into pr from products where sku = ln->>'sku' and active;
    if pr.sku is null then raise exception 'Sản phẩm % không tồn tại', ln->>'sku'; end if;
    insert into order_lines(order_id, sku, qty, gia, gia_chung)
    values (p_order, pr.sku, (ln->>'qty')::numeric, coalesce((ln->>'gia')::numeric, pr.gia_ban), pr.gia_ban);
  end loop;
  st := case when o.nguon = 'Đại lý tự đặt' then 'cho_kt' else 'cho_gsv' end;
  update orders set status = st, ck_pct = coalesce(p_ck, ck_pct), khuyen_mai = p_km, vi_pham = '{}' where id = p_order;
  perform order_event(p_order, 'Sửa và gửi lại', p_km);
  return st;
end $$;

create or replace function cancel_order(p_order text, p_note text) returns void
language plpgsql security definer set search_path = public as
$$ declare o orders; begin
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'Không tìm thấy đơn %', p_order; end if;
  if coalesce(trim(p_note),'') = '' then raise exception 'Nhập lý do hủy đơn'; end if;
  if o.status not in ('cho_gsv','cho_kt','cho_ceo','tra_lai','cho_sx','cho_xuat') then
    raise exception 'Đơn đã xếp xe / xuất kho, không hủy được'; end if;
  if not (has_role('ceo','ke_toan') or ((o.created_by = auth.uid() or o.nvkd_id = auth.uid()) and o.status in ('cho_gsv','tra_lai'))) then
    raise exception 'Không có quyền hủy đơn ở bước này' using errcode = '42501'; end if;
  update production_orders set status = 'huy' where from_order = p_order and status = 'cho_ceo';
  update orders set status = 'huy' where id = p_order;
  perform order_event(p_order, 'Hủy đơn', p_note);
end $$;

create or replace function ship_order(p_order text) returns void
language plpgsql security definer set search_path = public as
$$ declare l record; o orders; d dealers; doc text; begin
  perform need_role('to_truong','ceo');
  o := lock_order(p_order, 'xep_xe');
  select * into d from dealers where id = o.dealer_id;
  doc := start_doc('Xuất bán', p_order);
  update stock_docs set ngay = current_date, kho = 'KHO-TP', doi_tuong_loai = 'kh', doi_tuong_id = d.id, doi_tuong_ten = d.ten,
         doi_tuong_dc = d.dia_chi, doi_tuong_sdt = d.sdt, doi_tuong_mst = d.mst, dien_giai = 'Xuất bán theo đơn ' || p_order
   where id = doc;
  for l in select * from order_lines where order_id = p_order loop
    perform fifo_issue('Thành phẩm', l.sku, l.qty, 'xuat_ban', 'order', p_order);
    update stock_moves set don_gia = l.gia where doc_id = doc and don_gia is null and lot_id in (select id from stock_lots where item_code = l.sku);
  end loop;
  update orders set status = 'da_xuat' where id = p_order;
  update trips set status = 'Đang giao' where id in (select trip_id from trip_orders where order_id = p_order);
  perform order_event(p_order, 'Xuất kho theo FIFO · phiếu ' || doc);
end $$;

revoke execute on function resubmit_order(text, jsonb, numeric, text), cancel_order(text, text) from public, anon;
grant execute on function resubmit_order(text, jsonb, numeric, text), cancel_order(text, text) to authenticated;
