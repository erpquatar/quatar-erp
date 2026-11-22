-- Migration 14: bổ sung cho Sản xuất – QC, Mua hàng, Bảo trì
-- 1) Lập lệnh SX thủ công (sản xuất để tồn); 2) Chốt mẻ: lô thành phẩm vào vị trí mặc định + giá vốn thực tế;
-- 3) Lập PO mua hàng; 4) Phiếu yêu cầu sửa chữa; 5) Ghi nhận đã bảo trì; 6) IQC không đạt gắn với phiếu hàng lỗi.

create or replace function create_lsx(p_sku text, p_qty numeric, p_ghi_chu text default null) returns text
language plpgsql security definer set search_path = public as
$$ declare f formulas; pr products; kg numeric; id text; begin
  perform need_role('to_truong','ceo');
  if p_qty is null or p_qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  select * into pr from products where sku = p_sku and active;
  if pr.sku is null then raise exception 'Không tìm thấy sản phẩm %', p_sku; end if;
  select * into f from formulas where sku = p_sku and active order by version desc limit 1;
  if f.id is null then raise exception 'Sản phẩm % chưa có công thức phối trộn đang dùng', pr.ten; end if;
  kg := p_qty * pr.kg_moi_dv * (1 + coalesce(f.hao_hut_pct,0) / 100);
  id := next_no('LSX-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
  insert into production_orders(id, sku, formula_id, so_luong, kg_ke_hoach, so_me, from_order)
  values (id, p_sku, f.id, p_qty, round(kg, 3), ceil(kg / f.co_me_kg)::int, null);
  return id;
end $$;

create or replace function cancel_lsx(p_lsx text) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('ceo');
  update production_orders set status = 'huy' where id = p_lsx and status in ('cho_ceo','cho_can');
  if not found then raise exception 'Chỉ hủy được lệnh chưa cân mẻ nào'; end if;
end $$;

create or replace function close_batch(p_lsx text, p_w jsonb, p_tu text default null, p_qty_thuc numeric default null) returns text
language plpgsql security definer set search_path = public as
$$ declare x production_orders; f formulas; fl record; w jsonb; kg numeric; me int; b bigint; used jsonb; lot text; pr products; tp jsonb; out_qty numeric; cost numeric; doc text; begin
  perform need_role('to_truong','ceo');
  select * into x from production_orders where id = p_lsx for update;
  if x.status not in ('cho_can','dang_can') then raise exception 'Lệnh % chưa được duyệt hoặc đã xong', p_lsx; end if;
  select * into f from formulas where id = x.formula_id;
  select coalesce(max(me_so),0) + 1 into me from batches where lsx_id = p_lsx;
  insert into batches(lsx_id, me_so, user_id, chot_luc) values (p_lsx, me, auth.uid(), now()) returning id into b;
  doc := start_doc('Xuất NVL cho SX', p_lsx || ' · mẻ ' || me);
  update stock_docs set ngay = current_date, doi_tuong_loai = 'bp', doi_tuong_id = 'BP-SX', doi_tuong_ten = 'Xưởng sản xuất', dien_giai = 'Cân mẻ ' || me || '/' || x.so_me || ' lệnh ' || p_lsx where id = doc;
  for fl in select l.*, m.loai from formula_lines l join materials m on m.ma = l.material_ma where l.formula_id = f.id loop
    if fl.loai = 'Bao bì' then
      perform fifo_issue('Bao bì', fl.material_ma, fl.kg_moi_me, 'xuat_sx', 'lsx', p_lsx);
      continue;
    end if;
    select e into w from jsonb_array_elements(p_w) e where e->>'material' = fl.material_ma;
    if w is null then raise exception 'Thiếu số cân của %', fl.material_ma; end if;
    if upper(trim(w->>'ma_quet')) <> upper(fl.material_ma) then raise exception 'Sai mã nguyên liệu: quét % nhưng công thức cần %', w->>'ma_quet', fl.material_ma; end if;
    kg := (w->>'kg')::numeric;
    if abs(kg - fl.kg_moi_me) > fl.kg_moi_me * 0.01 + 0.05 then raise exception 'Lệch cân % : % kg so định mức % kg (cho phép ±1%%)', fl.material_ma, kg, fl.kg_moi_me; end if;
    used := fifo_issue('NVL', fl.material_ma, kg, 'xuat_sx', 'lsx', p_lsx);
    insert into batch_weighings values (b, fl.material_ma, (used->0->>'lot_id')::bigint, w->>'ma_quet', fl.kg_moi_me, kg);
  end loop;
  if me < x.so_me then
    update production_orders set status = 'dang_can' where id = p_lsx;
    return format('Đã chốt mẻ %s/%s', me, x.so_me);
  end if;
  select * into pr from products where sku = x.sku;
  out_qty := coalesce(p_qty_thuc, x.so_luong);
  select coalesce(sum(-sm.qty * sl.don_gia), 0) into cost from stock_moves sm join stock_lots sl on sl.id = sm.lot_id where sm.ref_type = 'lsx' and sm.ref_id = p_lsx and sm.loai = 'xuat_sx';
  doc := start_doc('Nhập thành phẩm', p_lsx);
  update stock_docs set ngay = current_date, kho = 'KHO-TP', doi_tuong_loai = 'bp', doi_tuong_id = 'BP-SX', doi_tuong_ten = 'Xưởng sản xuất', dien_giai = 'Hoàn thành lệnh ' || p_lsx where id = doc;
  lot := next_no(pr.ma_lo_prefix || '-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD'), 2);
  insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia, han_dung)
  values ('Thành phẩm', x.sku, lot, pr.vi_tri_mac_dinh, out_qty, case when out_qty > 0 then round(cost / out_qty, 2) else 0 end,
          case when pr.han_dung_thang is not null then current_date + (pr.han_dung_thang || ' months')::interval end);
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id, don_gia)
  select 'nhap_sx', id, out_qty, 'lsx', p_lsx, auth.uid(), don_gia from stock_lots where kind = 'Thành phẩm' and item_code = x.sku and lot_code = lot;
  update production_orders set status = 'hoan_thanh', lot_code = lot, so_luong_thuc = out_qty where id = p_lsx;
  select coalesce(jsonb_agg(jsonb_build_object('material', sl.item_code, 'lot', sl.lot_code, 'kg', -sm.qty) order by sl.item_code, sl.ngay_nhap), '[]') into tp
  from (select lot_id, sum(qty) qty from stock_moves where ref_type = 'lsx' and ref_id = p_lsx and loai = 'xuat_sx' group by lot_id) sm
  join stock_lots sl on sl.id = sm.lot_id;
  insert into retained_samples(order_id, lot_code, sku, vi_tri_tu, luu_den, thanh_phan)
  values (x.from_order, lot, x.sku, coalesce(p_tu, 'Chưa xếp tủ'), current_date + interval '6 months', tp);
  if x.from_order is not null and not exists (select 1 from production_orders where from_order = x.from_order and status not in ('hoan_thanh','huy')) then
    update orders set status = 'cho_xuat' where id = x.from_order and status = 'cho_sx';
    perform order_event(x.from_order, 'Lệnh SX xong, lô ' || lot || ' nhập kho → chờ xếp xe');
  end if;
  return 'Hoàn thành lệnh, tạo lô ' || lot;
end $$;

create or replace function create_po(p_material text, p_qty numeric, p_supplier text, p_gia numeric default null, p_eta date default null) returns text
language plpgsql security definer set search_path = public as
$$ declare id text; m materials; begin
  perform need_role('ke_toan','ceo');
  select * into m from materials where ma = p_material;
  if m.ma is null then raise exception 'Không tìm thấy vật tư %', p_material; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  id := next_no('PO-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
  insert into purchase_orders(id, material_ma, qty, supplier_id, don_gia, eta, created_by)
  values (id, p_material, p_qty, coalesce(p_supplier, m.ncc_chinh), coalesce(p_gia, m.gia_chuan), p_eta, auth.uid());
  return id;
end $$;

create or replace function create_repair(p_machine text, p_mo_ta text, p_phu_tung text default null) returns text
language plpgsql security definer set search_path = public as
$$ declare id text; begin
  perform need_role('to_truong','ceo');
  if coalesce(trim(p_mo_ta),'') = '' then raise exception 'Mô tả hư hỏng'; end if;
  id := next_no('SC-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
  insert into repair_requests(id, machine_id, mo_ta, phu_tung, user_id) values (id, p_machine, p_mo_ta, p_phu_tung, auth.uid());
  return id;
end $$;

-- IQC không đạt → cập nhật trạng thái theo quyết định xử lý hàng lỗi của CEO
create or replace function iqc_sync_defect() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  if new.status = 'da_xu_ly' and new.nguon = 'IQC không đạt' then
    update iqc_checks q set status = case when new.de_xuat = 'Trả NCC' then 'khong_dat_tra_ncc'::iqc_status else 'khong_dat_ceo_cho_dung' end
     where q.status = 'khong_dat_cho_ceo' and q.lot_code = (select lot_code from stock_lots where id = new.lot_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_iqc_sync_defect on defects;
create trigger trg_iqc_sync_defect after update of status on defects for each row execute function iqc_sync_defect();

revoke execute on function create_lsx(text, numeric, text), cancel_lsx(text), create_po(text, numeric, text, numeric, date), create_repair(text, text, text), iqc_sync_defect() from public, anon;
grant execute on function create_lsx(text, numeric, text), cancel_lsx(text), create_po(text, numeric, text, numeric, date), create_repair(text, text, text) to authenticated, service_role;
