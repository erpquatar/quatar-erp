-- =====================================================================
-- ERP QUATAR – Migration 02: quy tắc nghiệp vụ, phân quyền (RLS), nhật ký
-- Mọi thao tác duyệt / trừ tồn / chốt mẻ đi qua hàm phía máy chủ,
-- nên luôn cần có mạng (quyết định #22). Tạo mới có offline_id để đồng bộ không trùng.
-- =====================================================================

-- ---------- Hàm trợ giúp về người đang đăng nhập ----------
create or replace function my_role() returns app_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and active $$;

create or replace function my_vung() returns text
language sql stable security definer set search_path = public as
$$ select vung from profiles where id = auth.uid() $$;

create or replace function my_dealer() returns text
language sql stable security definer set search_path = public as
$$ select dealer_id from profiles where id = auth.uid() $$;

create or replace function has_role(variadic r app_role[]) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(my_role() = any(r), false) $$;

-- Ai được thấy đại lý nào: CEO, Kế toán, Tổ trưởng: tất cả; GSV: vùng; NVKD: đại lý mình phụ trách; Đại lý: chính mình
create or replace function can_see_dealer(p_dealer text) returns boolean
language sql stable security definer set search_path = public as
$$
  select case my_role()
    when 'ceo' then true when 'ke_toan' then true when 'to_truong' then true
    when 'gsv' then exists (select 1 from dealers d where d.id = p_dealer and d.vung = my_vung())
    when 'nvkd' then exists (select 1 from dealers d where d.id = p_dealer and d.nvkd_id = auth.uid())
    when 'dai_ly' then p_dealer = my_dealer()
    else false end
$$;

create or replace function need_role(variadic r app_role[]) returns void
language plpgsql stable security definer set search_path = public as
$$ begin
  if not coalesce(my_role() = any(r), false) then
    raise exception 'Không có quyền thực hiện thao tác này' using errcode = '42501';
  end if;
end $$;

-- Số chứng từ tăng dần: DH-2611-0001, LSX-2611-001, TC1-261122-01
create or replace function next_no(p_prefix text, p_width int) returns text
language plpgsql security definer set search_path = public as
$$ declare n int; begin
  insert into doc_counters(prefix, last) values (p_prefix, 1)
  on conflict (prefix) do update set last = doc_counters.last + 1
  returning last into n;
  return p_prefix || '-' || lpad(n::text, p_width, '0');
end $$;

-- Lô có nằm trong khu cách ly không
create or replace function lot_usable(p_location text) returns boolean
language sql stable security definer set search_path = public as
$$ select not coalesce((select w.cach_ly from locations l join warehouses w on w.id = l.warehouse_id where l.id = p_location), false) $$;

-- Mở phiếu kho cho các biến động tồn tiếp theo trong cùng giao dịch
create or replace function start_doc(p_loai text, p_ref text, p_tu_dong boolean default true, p_offline uuid default null) returns text
language plpgsql security definer set search_path = public as
$$ declare id text; pre text; begin
  pre := case when p_loai like 'Nhập%' then 'PN' when p_loai like 'Chuyển%' then 'PC' when p_loai like 'Điều chỉnh%' then 'DC' else 'PX' end;
  id := next_no(pre || '-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
  insert into stock_docs(id, offline_id, loai, ref, user_id, tu_dong) values (id, p_offline, p_loai, p_ref, auth.uid(), p_tu_dong);
  perform set_config('app.doc_id', id, true);
  return id;
end $$;

create or replace function stock_moves_doc() returns trigger language plpgsql set search_path = public as
$$ begin
  new.doc_id := coalesce(new.doc_id, nullif(current_setting('app.doc_id', true), ''));
  if new.doc_id is null then raise exception 'Biến động tồn phải thuộc một phiếu kho'; end if;
  return new;
end $$;
create trigger stock_moves_doc before insert on stock_moves for each row execute function stock_moves_doc();

create or replace function order_event(p_order text, p_action text, p_note text default null) returns void
language sql security definer set search_path = public as
$$ insert into order_events(order_id, user_id, action, ghi_chu) values (p_order, auth.uid(), p_action, p_note) $$;

-- ---------- Công nợ ----------
create or replace view v_dealer_debt with (security_invoker = true) as
select d.id as dealer_id, d.ten, d.han_muc, d.khoa_qua_han_ngay,
       coalesce(sum(i.so_tien - i.da_thu), 0)                                        as du_no,
       coalesce(sum(i.so_tien - i.da_thu) filter (where i.han_tt < current_date), 0)  as qua_han_tien,
       coalesce(max(current_date - i.han_tt) filter (where i.han_tt < current_date and i.so_tien > i.da_thu), 0) as qua_han_ngay
from dealers d left join invoices i on i.dealer_id = d.id
group by d.id;

-- Thu tiền: tự trừ vào hóa đơn đến hạn trước (F1)
create or replace function record_receipt(p_dealer text, p_amount numeric, p_note text default null) returns bigint
language plpgsql security definer set search_path = public as
$$ declare r bigint; left_amt numeric := p_amount; inv record; pay numeric; begin
  perform need_role('ke_toan','ceo');
  insert into receipts(dealer_id, so_tien, ghi_chu, user_id) values (p_dealer, p_amount, p_note, auth.uid()) returning id into r;
  for inv in select * from invoices where dealer_id = p_dealer and da_thu < so_tien order by han_tt, ngay for update loop
    exit when left_amt <= 0;
    pay := least(left_amt, inv.so_tien - inv.da_thu);
    update invoices set da_thu = da_thu + pay where id = inv.id;
    left_amt := left_amt - pay;
  end loop;
  return r;
end $$;

-- ---------- Đơn hàng: tổng tiền và kiểm tra vượt quy định ----------
create or replace function order_total(p_order text) returns numeric
language sql stable security definer set search_path = public as
$$ select coalesce(sum(l.qty * l.gia), 0) * (1 - o.ck_pct / 100)
   from orders o left join order_lines l on l.order_id = o.id where o.id = p_order group by o.ck_pct $$;

create or replace function order_violations(p_order text) returns text[]
language plpgsql stable security definer set search_path = public as
$$ declare o orders; d dealers; dbt v_dealer_debt; lim numeric; v text[] := '{}'; l record; t numeric; begin
  select * into o from orders where id = p_order;
  select * into d from dealers where id = o.dealer_id;
  select * into dbt from v_dealer_debt where dealer_id = d.id;
  select c.ck_max_pct into lim from ck_levels c join policy_periods p on p.id = c.period_id and p.active where c.loai_dai_ly = d.loai;
  t := order_total(p_order);
  if o.ck_pct > coalesce(lim, 0) then v := v || format('Chiết khấu %s%% vượt mức %s%% của %s', o.ck_pct, coalesce(lim,0), d.loai); end if;
  for l in select ol.*, p.ten from order_lines ol join products p on p.sku = ol.sku where ol.order_id = p_order and ol.gia < ol.gia_chung loop
    v := v || format('Giá riêng %s %s thấp hơn giá chung %s', l.ten, l.gia, l.gia_chung);
  end loop;
  if dbt.du_no + t > d.han_muc then v := v || format('Dư nợ sau đơn %s vượt hạn mức %s', dbt.du_no + t, d.han_muc); end if;
  if dbt.qua_han_ngay > d.khoa_qua_han_ngay then v := v || format('Nợ quá hạn %s ngày (khóa khi > %s ngày)', dbt.qua_han_ngay, d.khoa_qua_han_ngay); end if;
  return v;
end $$;

-- Lên đơn. p_lines = [{"sku":"QT-AMINO-1L","qty":100,"gia":85000}] (gia bỏ trống = giá chung)
create or replace function create_order(p_dealer text, p_lines jsonb, p_ck numeric default null,
                                        p_km text default null, p_offline_id uuid default null) returns text
language plpgsql security definer set search_path = public as
$$ declare r app_role := my_role(); d dealers; new_id text; st order_status; ck numeric; ln jsonb; pr products; begin
  if p_offline_id is not null then
    select id into new_id from orders where offline_id = p_offline_id;
    if new_id is not null then return new_id; end if;          -- đã đồng bộ trước đó
  end if;
  select * into d from dealers where id = p_dealer;
  if d.id is null then raise exception 'Không tìm thấy đại lý %', p_dealer; end if;
  if not can_see_dealer(p_dealer) or r = 'to_truong' then raise exception 'Không có quyền lên đơn cho đại lý này' using errcode='42501'; end if;
  if r = 'dai_ly' and not d.tu_dat_hang then raise exception 'Quyền tự đặt hàng của đại lý đang tắt' using errcode='42501'; end if;
  if d.trang_thai <> 'Đang bán' then raise exception 'Đại lý đang %', d.trang_thai; end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Đơn chưa có sản phẩm'; end if;
  select coalesce(p_ck, c.ck_max_pct, 0) into ck
    from (select 1) x left join (ck_levels c join policy_periods p on p.id = c.period_id and p.active) on c.loai_dai_ly = d.loai;
  st := case when r = 'dai_ly' then 'cho_kt' else 'cho_gsv' end;        -- #7 đại lý vào thẳng Kế toán
  new_id := next_no('DH-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 4);
  insert into orders(id, offline_id, dealer_id, nvkd_id, nguon, ck_pct, khuyen_mai, status, created_by)
  values (new_id, p_offline_id, p_dealer, d.nvkd_id,
          case r when 'dai_ly' then 'Đại lý tự đặt' when 'ke_toan' then 'Kế toán' else 'NVKD' end,
          ck, p_km, st, auth.uid());
  for ln in select * from jsonb_array_elements(p_lines) loop
    select * into pr from products where sku = ln->>'sku' and active;
    if pr.sku is null then raise exception 'Sản phẩm % không tồn tại', ln->>'sku'; end if;
    insert into order_lines(order_id, sku, qty, gia, gia_chung)
    values (new_id, pr.sku, (ln->>'qty')::numeric, coalesce((ln->>'gia')::numeric, pr.gia_ban), pr.gia_ban);
  end loop;
  perform order_event(new_id, 'Tạo đơn', p_km);
  return new_id;
end $$;

-- Thiếu tồn → tự tạo lệnh SX chờ CEO duyệt; đủ → chờ xếp xe
create or replace function check_stock_and_route(p_order text) returns order_status
language plpgsql security definer set search_path = public as
$$ declare l record; have numeric; short numeric; f formulas; kg numeric; lsx text; any_short boolean := false; begin
  for l in select ol.*, p.kg_moi_dv from order_lines ol join products p on p.sku = ol.sku where ol.order_id = p_order loop
    -- Tồn khả dụng = tồn kho − hàng đã hứa cho đơn khác đang chờ xếp xe / đã xếp xe
    select coalesce(sum(qty) filter (where lot_usable(location_id)),0)
         - coalesce((select sum(ol.qty) from order_lines ol join orders o on o.id = ol.order_id
                     where ol.sku = l.sku and o.status in ('cho_xuat','xep_xe') and o.id <> p_order), 0)
      into have from stock_lots where kind = 'Thành phẩm' and item_code = l.sku;
    short := l.qty - have;
    if short > 0 then
      any_short := true;
      select * into f from formulas where sku = l.sku and active;
      if f.id is null then raise exception 'Sản phẩm % chưa có công thức phối trộn', l.sku; end if;
      kg := short * l.kg_moi_dv * (1 + f.hao_hut_pct / 100);
      lsx := next_no('LSX-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
      insert into production_orders(id, sku, formula_id, so_luong, kg_ke_hoach, so_me, from_order)
      values (lsx, l.sku, f.id, short, round(kg, 3), ceil(kg / f.co_me_kg)::int, p_order);
      perform order_event(p_order, 'Thiếu tồn → tạo ' || lsx || ', chờ CEO duyệt');
    end if;
  end loop;
  update orders set status = case when any_short then 'cho_sx'::order_status else 'cho_xuat' end where id = p_order;
  if not any_short then perform order_event(p_order, 'Đủ tồn → chờ xếp xe'); end if;
  return case when any_short then 'cho_sx'::order_status else 'cho_xuat' end;
end $$;

create or replace function lock_order(p_order text, p_expect order_status) returns orders
language plpgsql security definer set search_path = public as
$$ declare o orders; begin
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'Không tìm thấy đơn %', p_order; end if;
  if o.status <> p_expect then raise exception 'Đơn % đang ở trạng thái %, không phải %', p_order, o.status, p_expect; end if;
  return o;
end $$;

create or replace function gsv_approve(p_order text) returns order_status
language plpgsql security definer set search_path = public as
$$ declare o orders; begin
  perform need_role('gsv','ceo');
  o := lock_order(p_order, 'cho_gsv');
  if not can_see_dealer(o.dealer_id) then raise exception 'Đơn ngoài vùng phụ trách' using errcode='42501'; end if;
  update orders set status = 'cho_kt' where id = p_order;
  perform order_event(p_order, 'GSV duyệt');
  return 'cho_kt';
end $$;

create or replace function return_order(p_order text, p_note text) returns void
language plpgsql security definer set search_path = public as
$$ declare o orders; begin
  perform need_role('gsv','ke_toan','ceo');
  select * into o from orders where id = p_order for update;
  if o.status not in ('cho_gsv','cho_kt') then raise exception 'Chỉ trả lại đơn đang chờ duyệt'; end if;
  update orders set status = 'tra_lai' where id = p_order;
  perform order_event(p_order, 'Trả lại', p_note);
end $$;

-- Kế toán duyệt cuối: vượt quy định thì lên CEO (#4)
create or replace function kt_approve(p_order text) returns order_status
language plpgsql security definer set search_path = public as
$$ declare v text[]; begin
  perform need_role('ke_toan','ceo');
  perform lock_order(p_order, 'cho_kt');
  v := order_violations(p_order);
  if array_length(v, 1) > 0 then
    update orders set status = 'cho_ceo', vi_pham = v where id = p_order;
    perform order_event(p_order, 'Kế toán kiểm tra: vượt quy định → chuyển CEO', array_to_string(v, '; '));
    return 'cho_ceo';
  end if;
  perform order_event(p_order, 'Kế toán duyệt cuối');
  return check_stock_and_route(p_order);
end $$;

create or replace function ceo_decide(p_order text, p_approve boolean, p_note text default null) returns order_status
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('ceo');
  perform lock_order(p_order, 'cho_ceo');
  if not p_approve then
    update orders set status = 'huy' where id = p_order;
    perform order_event(p_order, 'CEO từ chối', p_note);
    return 'huy';
  end if;
  perform order_event(p_order, 'CEO duyệt ngoại lệ', p_note);
  return check_stock_and_route(p_order);
end $$;

-- ---------- Kho: xuất FIFO, không cho âm (#10, F2) ----------
create or replace function fifo_issue(p_kind item_kind, p_item text, p_qty numeric, p_type move_type,
                                      p_ref_type text, p_ref_id text) returns jsonb
language plpgsql security definer set search_path = public as
$$ declare need numeric := p_qty; lt record; take numeric; used jsonb := '[]'; begin
  if (select coalesce(sum(qty),0) from stock_lots where kind = p_kind and item_code = p_item and lot_usable(location_id)) < p_qty then
    raise exception 'Không đủ tồn % (cần %)', p_item, p_qty;
  end if;
  for lt in select * from stock_lots where kind = p_kind and item_code = p_item and qty > 0 and lot_usable(location_id) order by ngay_nhap, id for update loop
    exit when need <= 0;
    take := least(need, lt.qty);
    update stock_lots set qty = qty - take where id = lt.id;
    insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id) values (p_type, lt.id, -take, p_ref_type, p_ref_id, auth.uid());
    used := used || jsonb_build_object('lot_id', lt.id, 'lot', lt.lot_code, 'qty', take, 'don_gia', lt.don_gia);
    need := need - take;
  end loop;
  return used;
end $$;

-- ---------- Giao hàng ----------
create or replace function assign_trip(p_order text, p_carrier bigint, p_bien_so text, p_tai text, p_cuoc numeric, p_trip text default null) returns text
language plpgsql security definer set search_path = public as
$$ declare t text := p_trip; begin
  perform need_role('ke_toan','ceo');
  perform lock_order(p_order, 'cho_xuat');
  if t is null then
    t := next_no('CX-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3);
    insert into trips(id, ngay, carrier_id, bien_so, tai_trong, cuoc) values (t, current_date + 1, p_carrier, p_bien_so, p_tai, p_cuoc);
  end if;
  insert into trip_orders values (t, p_order);
  update orders set status = 'xep_xe' where id = p_order;
  perform order_event(p_order, 'Xếp chuyến ' || t);
  return t;
end $$;

create or replace function ship_order(p_order text) returns void
language plpgsql security definer set search_path = public as
$$ declare l record; begin
  perform need_role('to_truong','ceo');
  perform lock_order(p_order, 'xep_xe');
  perform start_doc('Xuất bán', p_order);
  for l in select * from order_lines where order_id = p_order loop
    perform fifo_issue('Thành phẩm', l.sku, l.qty, 'xuat_ban', 'order', p_order);
  end loop;
  update orders set status = 'da_xuat' where id = p_order;
  update trips set status = 'Đang giao' where id in (select trip_id from trip_orders where order_id = p_order);
  perform order_event(p_order, 'Xuất kho theo FIFO');
end $$;

create or replace function confirm_delivery(p_order text, p_anh text) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('ke_toan','ceo');
  perform lock_order(p_order, 'da_xuat');
  update orders set status = 'da_giao' where id = p_order;
  update trips set anh_bien_ban = p_anh where id in (select trip_id from trip_orders where order_id = p_order) and anh_bien_ban is null;
  perform order_event(p_order, 'Xác nhận đã giao', p_anh);
end $$;

create or replace function invoice_order(p_order text, p_so_hd text) returns void
language plpgsql security definer set search_path = public as
$$ declare o orders; begin
  perform need_role('ke_toan','ceo');
  o := lock_order(p_order, 'da_giao');
  insert into invoices(id, order_id, dealer_id, han_tt, so_tien)
  select p_so_hd, o.id, o.dealer_id, current_date + d.han_no_ngay, round(order_total(o.id)) from dealers d where d.id = o.dealer_id;
  update orders set status = 'hoan_tat' where id = p_order;
  perform order_event(p_order, 'Ghi công nợ, hóa đơn ' || p_so_hd);
end $$;

-- ---------- Sản xuất ----------
create or replace function approve_lsx(p_lsx text) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('ceo');
  update production_orders set status = 'cho_can', duyet_boi = auth.uid(), duyet_luc = now() where id = p_lsx and status = 'cho_ceo';
  if not found then raise exception 'Lệnh % không ở trạng thái chờ CEO duyệt', p_lsx; end if;
end $$;

-- Chốt 1 mẻ. p_w = [{"material":"NL-TRICHO","ma_quet":"NL-TRICHO","kg":2.01}]
-- Sai mã hoặc lệch > 1% (+0,05 kg) thì từ chối. Mẻ cuối: nhập số thành phẩm thực tế (p_qty_thuc),
-- tạo lô TP, nhập kho, lưu mẫu theo đơn.
create or replace function close_batch(p_lsx text, p_w jsonb, p_tu text default null, p_qty_thuc numeric default null) returns text
language plpgsql security definer set search_path = public as
$$ declare x production_orders; f formulas; fl record; w jsonb; kg numeric; me int; b bigint; used jsonb; lot text; pr products; tp jsonb; out_qty numeric; begin
  perform need_role('to_truong','ceo');
  select * into x from production_orders where id = p_lsx for update;
  if x.status not in ('cho_can','dang_can') then raise exception 'Lệnh % chưa được duyệt hoặc đã xong', p_lsx; end if;
  select * into f from formulas where id = x.formula_id;
  select coalesce(max(me_so),0) + 1 into me from batches where lsx_id = p_lsx;
  insert into batches(lsx_id, me_so, user_id, chot_luc) values (p_lsx, me, auth.uid(), now()) returning id into b;
  perform start_doc('Xuất NVL cho SX', p_lsx || ' · mẻ ' || me);
  for fl in select l.*, m.loai from formula_lines l join materials m on m.ma = l.material_ma where l.formula_id = f.id loop
    if fl.loai = 'Bao bì' then
      perform fifo_issue('Bao bì', fl.material_ma, fl.kg_moi_me, 'xuat_sx', 'lsx', p_lsx);
      continue;
    end if;
    select e into w from jsonb_array_elements(p_w) e where e->>'material' = fl.material_ma;
    if w is null then raise exception 'Thiếu số cân của %', fl.material_ma; end if;
    if upper(w->>'ma_quet') <> fl.material_ma then raise exception 'Sai mã nguyên liệu: quét % nhưng công thức cần %', w->>'ma_quet', fl.material_ma; end if;
    kg := (w->>'kg')::numeric;
    if abs(kg - fl.kg_moi_me) > fl.kg_moi_me * 0.01 + 0.05 then raise exception 'Lệch cân % : % kg so định mức % kg', fl.material_ma, kg, fl.kg_moi_me; end if;
    used := fifo_issue('NVL', fl.material_ma, kg, 'xuat_sx', 'lsx', p_lsx);
    insert into batch_weighings values (b, fl.material_ma, (used->0->>'lot_id')::bigint, w->>'ma_quet', fl.kg_moi_me, kg);
  end loop;
  if me < x.so_me then
    update production_orders set status = 'dang_can' where id = p_lsx;
    return format('Đã chốt mẻ %s/%s', me, x.so_me);
  end if;
  -- Mẻ cuối: tạo lô thành phẩm (mã SP + yymmdd + số thứ tự, #11)
  select * into pr from products where sku = x.sku;
  out_qty := coalesce(p_qty_thuc, x.so_luong);
  perform start_doc('Nhập thành phẩm', p_lsx);
  lot := next_no(pr.ma_lo_prefix || '-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD'), 2);
  insert into stock_lots(kind, item_code, lot_code, qty, han_dung)
  values ('Thành phẩm', x.sku, lot, out_qty, case when pr.han_dung_thang is not null then current_date + (pr.han_dung_thang || ' months')::interval end);
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id)
  select 'nhap_sx', id, out_qty, 'lsx', p_lsx, auth.uid() from stock_lots where kind = 'Thành phẩm' and item_code = x.sku and lot_code = lot;
  update production_orders set status = 'hoan_thanh', lot_code = lot, so_luong_thuc = out_qty where id = p_lsx;
  -- Thành phần phối trộn: mọi lô NVL, bao bì đã xuất cho lệnh này (đủ để truy xuất khi một mã dùng nhiều lô)
  select coalesce(jsonb_agg(jsonb_build_object('material', sl.item_code, 'lot', sl.lot_code, 'kg', -sm.qty) order by sl.item_code, sl.ngay_nhap), '[]') into tp
  from (select lot_id, sum(qty) qty from stock_moves where ref_type = 'lsx' and ref_id = p_lsx and loai = 'xuat_sx' group by lot_id) sm
  join stock_lots sl on sl.id = sm.lot_id;
  insert into retained_samples(order_id, lot_code, sku, vi_tri_tu, luu_den, thanh_phan)
  values (x.from_order, lot, x.sku, coalesce(p_tu, 'Chưa xếp tủ'), current_date + interval '6 months', tp);  -- 6 tháng: số tạm, chờ chốt
  if x.from_order is not null and not exists (select 1 from production_orders where from_order = x.from_order and status <> 'hoan_thanh') then
    update orders set status = 'cho_xuat' where id = x.from_order and status = 'cho_sx';
    perform order_event(x.from_order, 'Lệnh SX xong, lô ' || lot || ' nhập kho → chờ xếp xe');
  end if;
  return 'Hoàn thành lệnh, tạo lô ' || lot;
end $$;

-- ---------- Mua hàng & IQC ----------
create or replace function po_receive(p_po text, p_lot text, p_qty numeric default null) returns bigint
language plpgsql security definer set search_path = public as
$$ declare p purchase_orders; i bigint; begin
  perform need_role('ke_toan','to_truong','ceo');
  select * into p from purchase_orders where id = p_po for update;
  if p.status <> 'da_dat_ncc' then raise exception 'PO % chưa ở trạng thái đã đặt NCC', p_po; end if;
  update purchase_orders set status = 'cho_iqc' where id = p_po;
  insert into iqc_checks(lot_code, material_ma, po_id, qty) values (p_lot, p.material_ma, p_po, coalesce(p_qty, p.qty)) returning id into i;
  return i;
end $$;

create or replace function iqc_result(p_id bigint, p_ket_qua text, p_dat boolean, p_vi_tri text default null) returns void
language plpgsql security definer set search_path = public as
$$ declare q iqc_checks; p purchase_orders; loc text; lid bigint; begin
  perform need_role('to_truong','ceo');
  select * into q from iqc_checks where id = p_id for update;
  if q.status <> 'cho_lay_mau' then raise exception 'Lô đã có kết quả'; end if;
  update iqc_checks set ket_qua = p_ket_qua, status = case when p_dat then 'dat'::iqc_status else 'khong_dat_cho_ceo' end, user_id = auth.uid(), ts = now() where id = p_id;
  select * into p from purchase_orders where id = q.po_id;
  loc := case when p_dat then p_vi_tri else 'K1' end;            -- không đạt: nhập vào khu cách ly
  perform start_doc('Nhập mua', coalesce(q.po_id,'') || case when p_dat then ' · IQC đạt' else ' · IQC không đạt → cách ly' end);
  insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia) values ('NVL', q.material_ma, q.lot_code, loc, q.qty, coalesce(p.don_gia,0))
  on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty
  returning id into lid;
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id) values ('nhap_mua', lid, q.qty, 'po', q.po_id, auth.uid());
  update purchase_orders set status = 'da_nhap_kho' where id = q.po_id;
  if not p_dat then
    insert into defects(id, nguon, lot_id, qty, mo_ta, user_id)
    values (next_no('HL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3), 'IQC không đạt', lid, q.qty, p_ket_qua, auth.uid());
  end if;
end $$;

-- ---------- Phiếu kho lập tay ----------
-- p_loai: Nhập hàng trả về | Nhập khác | Xuất khác | Chuyển vị trí | Chuyển vào cách ly
create or replace function stock_doc_manual(p_loai text, p_kind item_kind, p_item text, p_lot text, p_qty numeric,
       p_vi_tri text default null, p_vi_tri_den text default null, p_ref text default null,
       p_dealer text default null, p_nguon_loi text default null, p_offline uuid default null) returns text
language plpgsql security definer set search_path = public as
$$ declare doc text; src stock_lots; lid bigint; begin
  perform need_role('to_truong','ke_toan','ceo');
  if p_offline is not null then
    select id into doc from stock_docs where offline_id = p_offline;
    if doc is not null then return doc; end if;
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if p_loai not in ('Nhập hàng trả về','Nhập khác','Xuất khác','Chuyển vị trí','Chuyển vào cách ly') then raise exception 'Loại phiếu % không lập tay được', p_loai; end if;
  doc := start_doc(p_loai, p_ref, false, p_offline);
  if p_loai in ('Nhập hàng trả về','Nhập khác') then
    if p_loai = 'Nhập hàng trả về' and (p_kind <> 'Thành phẩm' or p_dealer is null) then raise exception 'Hàng trả về phải là thành phẩm và ghi rõ đại lý'; end if;
    insert into stock_lots(kind, item_code, lot_code, location_id, qty)
    values (p_kind, p_item, p_lot, case when p_loai = 'Nhập hàng trả về' then 'K1' else p_vi_tri end, p_qty)
    on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty returning id into lid;
    insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id)
    values (case when p_loai = 'Nhập khác' then 'nhap_khac'::move_type else 'nhap_tra_ve' end, lid, p_qty, 'manual', doc, auth.uid());
    if p_loai = 'Nhập hàng trả về' then
      insert into defects(id, nguon, lot_id, qty, mo_ta, dealer_id, user_id)
      values (next_no('HL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3), 'Đại lý trả về', lid, p_qty, p_ref, p_dealer, auth.uid());
    end if;
    return doc;
  end if;
  -- các loại còn lại lấy từ một lô cụ thể
  select * into src from stock_lots where kind = p_kind and item_code = p_item and lot_code = p_lot
    and location_id is not distinct from p_vi_tri for update;
  if src.id is null then raise exception 'Không tìm thấy lô % tại vị trí %', p_lot, coalesce(p_vi_tri,'(trống)'); end if;
  if src.qty < p_qty then raise exception 'Lô % chỉ còn %', p_lot, src.qty; end if;
  update stock_lots set qty = qty - p_qty where id = src.id;
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id)
  values (case when p_loai = 'Xuất khác' then 'xuat_khac'::move_type else 'chuyen_kho' end, src.id, -p_qty, 'manual', doc, auth.uid());
  if p_loai in ('Chuyển vị trí','Chuyển vào cách ly') then
    insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia, ngay_nhap, han_dung)
    values (p_kind, p_item, p_lot, case when p_loai = 'Chuyển vào cách ly' then 'K1' else p_vi_tri_den end, p_qty, src.don_gia, src.ngay_nhap, src.han_dung)
    on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty returning id into lid;
    insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id) values ('chuyen_kho', lid, p_qty, 'manual', doc, auth.uid());
    if p_loai = 'Chuyển vào cách ly' then
      insert into defects(id, nguon, lot_id, qty, mo_ta, user_id)
      values (next_no('HL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 3), coalesce(p_nguon_loi, 'Hỏng trong kho'), lid, p_qty, p_ref, auth.uid());
    end if;
  end if;
  return doc;
end $$;

-- ---------- Xử lý hàng lỗi: Tổ trưởng đề xuất → CEO duyệt (F4) ----------
create or replace function defect_propose(p_id text, p_de_xuat text) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('to_truong','ceo');
  update defects set de_xuat = p_de_xuat, status = 'cho_ceo' where id = p_id and status = 'cho_de_xuat';
  if not found then raise exception 'Phiếu % không ở bước chờ đề xuất', p_id; end if;
end $$;

create or replace function defect_decide(p_id text, p_duyet boolean, p_ghi_chu text default null) returns text
language plpgsql security definer set search_path = public as
$$ declare d defects; lt stock_lots; doc text; bb text; lid bigint; begin
  perform need_role('ceo');
  select * into d from defects where id = p_id for update;
  if d.status <> 'cho_ceo' then raise exception 'Phiếu % không chờ CEO duyệt', p_id; end if;
  if not p_duyet then
    update defects set status = 'cho_de_xuat', ket_qua = 'CEO yêu cầu đề xuất lại: ' || coalesce(p_ghi_chu,'') where id = p_id;
    return null;
  end if;
  select * into lt from stock_lots where id = d.lot_id for update;
  if lt.qty < d.qty then raise exception 'Lô cách ly chỉ còn %', lt.qty; end if;
  doc := start_doc(case d.de_xuat when 'Hủy' then 'Xuất hủy' when 'Trả NCC' then 'Xuất trả NCC'
                                  when 'Hạ cấp' then 'Chuyển vị trí' else 'Xuất khác' end, p_id || ' · ' || d.de_xuat);
  update stock_lots set qty = qty - d.qty where id = lt.id;
  insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id)
  values (case d.de_xuat when 'Hủy' then 'xuat_huy'::move_type when 'Trả NCC' then 'tra_ncc' when 'Hạ cấp' then 'chuyen_kho' else 'xuat_khac' end,
          lt.id, -d.qty, 'defect', p_id, auth.uid());
  if d.de_xuat = 'Hạ cấp' then
    insert into stock_lots(kind, item_code, lot_code, location_id, qty, don_gia, ngay_nhap)
    values (lt.kind, lt.item_code, lt.lot_code, 'HC', d.qty, lt.don_gia, lt.ngay_nhap)
    on conflict (kind, item_code, lot_code, location_id) do update set qty = stock_lots.qty + excluded.qty returning id into lid;
    insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id) values ('chuyen_kho', lid, d.qty, 'defect', p_id, auth.uid());
  end if;
  if d.de_xuat = 'Hủy' then bb := next_no('BH-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM'), 2); end if;
  update defects set status = 'da_xu_ly', doc_xu_ly = doc, bien_ban = bb,
         ket_qua = 'CEO duyệt: ' || d.de_xuat || coalesce(' · ' || p_ghi_chu, '') where id = p_id;
  return doc;
end $$;

-- Hàng đại lý trả về: Kế toán ghi giảm công nợ (trừ vào hóa đơn đến hạn trước)
create or replace function defect_credit(p_id text, p_so_tien numeric) returns void
language plpgsql security definer set search_path = public as
$$ declare d defects; begin
  perform need_role('ke_toan','ceo');
  select * into d from defects where id = p_id for update;
  if d.nguon <> 'Đại lý trả về' or d.status <> 'da_xu_ly' then raise exception 'Chỉ ghi giảm nợ cho hàng đại lý trả về đã được CEO duyệt'; end if;
  if d.da_giam_no is not null then raise exception 'Phiếu % đã ghi giảm nợ', p_id; end if;
  perform record_receipt(d.dealer_id, p_so_tien, 'Giảm trừ hàng trả về ' || p_id);
  update defects set da_giam_no = p_so_tien where id = p_id;
end $$;

-- ---------- Kiểm kê cuối tháng (F2) ----------
create or replace function stocktake_open(p_ky text) returns bigint
language plpgsql security definer set search_path = public as
$$ declare i bigint; begin
  perform need_role('to_truong','ceo');
  if exists (select 1 from stocktakes where status <> 'da_duyet') then raise exception 'Đang có đợt kiểm kê chưa duyệt'; end if;
  insert into stocktakes(ky) values (p_ky) returning id into i;
  insert into stocktake_lines(stocktake_id, lot_id, so_sach) select i, id, qty from stock_lots where qty > 0;
  return i;
end $$;

create or replace function stocktake_count(p_st bigint, p_lot bigint, p_thuc numeric) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('to_truong','ceo');
  if (select status from stocktakes where id = p_st) <> 'dang_dem' then raise exception 'Đợt kiểm kê đã khóa'; end if;
  update stocktake_lines set thuc_te = p_thuc, nguoi_dem = auth.uid() where stocktake_id = p_st and lot_id = p_lot;
  if not found then raise exception 'Lô không có trong đợt kiểm kê'; end if;
end $$;

create or replace function stocktake_submit(p_st bigint) returns void
language plpgsql security definer set search_path = public as
$$ begin
  perform need_role('to_truong','ceo');
  if exists (select 1 from stocktake_lines where stocktake_id = p_st and thuc_te is null) then raise exception 'Còn lô chưa đếm'; end if;
  update stocktakes set status = 'cho_ceo' where id = p_st and status = 'dang_dem';
end $$;

-- CEO duyệt: điều chỉnh tồn theo chênh lệch (thực tế − sổ sách lúc mở kiểm kê)
create or replace function stocktake_approve(p_st bigint) returns text
language plpgsql security definer set search_path = public as
$$ declare doc text; l record; begin
  perform need_role('ceo');
  if (select status from stocktakes where id = p_st) <> 'cho_ceo' then raise exception 'Đợt kiểm kê chưa gửi duyệt'; end if;
  doc := start_doc('Điều chỉnh kiểm kê', (select ky from stocktakes where id = p_st));
  for l in select * from stocktake_lines where stocktake_id = p_st and thuc_te <> so_sach loop
    update stock_lots set qty = greatest(qty + (l.thuc_te - l.so_sach), 0) where id = l.lot_id;
    insert into stock_moves(loai, lot_id, qty, ref_type, ref_id, user_id) values ('kiem_ke', l.lot_id, l.thuc_te - l.so_sach, 'stocktake', p_st::text, auth.uid());
  end loop;
  update stocktakes set status = 'da_duyet', duyet_boi = auth.uid(), doc_id = doc where id = p_st;
  return doc;
end $$;

-- ---------- Báo cáo nhập – xuất – tồn theo kỳ ----------
create or replace function nxt(p_tu date, p_den date)
returns table(kind item_kind, item_code text, ton_dau numeric, nhap numeric, xuat numeric, ton_cuoi numeric, gia_tri_cuoi numeric)
language sql stable security definer set search_path = public as
$$
  select s.kind, s.item_code,
         coalesce(sum(m.qty) filter (where m.ts < p_tu), 0),
         coalesce(sum(m.qty) filter (where m.ts >= p_tu and m.ts < p_den + 1 and m.qty > 0 and m.loai <> 'chuyen_kho'), 0),
         coalesce(-sum(m.qty) filter (where m.ts >= p_tu and m.ts < p_den + 1 and m.qty < 0 and m.loai <> 'chuyen_kho'), 0),
         coalesce(sum(m.qty) filter (where m.ts < p_den + 1), 0),
         coalesce(sum(m.qty * s.don_gia) filter (where m.ts < p_den + 1), 0)
  from stock_moves m join stock_lots s on s.id = m.lot_id
  where has_role('ceo','ke_toan','to_truong')
  group by s.kind, s.item_code
$$;

-- ---------- Chấm công: khóa kỳ đã chốt ----------
create or replace function attendance_guard() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  if (new.ts at time zone 'Asia/Ho_Chi_Minh')::date <= coalesce((select max(den_ngay) from attendance_locks), '1900-01-01') then
    raise exception 'Kỳ công đến % đã chốt, không sửa được', (select max(den_ngay) from attendance_locks);
  end if;
  return new;
end $$;
create trigger attendance_guard before insert or update on attendance for each row execute function attendance_guard();

-- ---------- Nhật ký sửa đổi ----------
create or replace function audit() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into audit_log(user_id, bang, khoa, thao_tac, cu, moi)
  values (auth.uid(), tg_table_name,
          coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id', to_jsonb(new)->>'sku', to_jsonb(new)->>'ma', to_jsonb(new)->>'order_id'),
          tg_op, case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['orders','order_lines','invoices','receipts','dealers','products','materials','formulas','formula_lines','stock_lots','stock_docs','defects','stocktakes','stocktake_lines','ck_levels','bonus_tiers','production_orders','profiles'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit()', t);
  end loop;
end $$;

-- ---------- Phân quyền theo dòng (RLS) ----------
do $$ declare t text; begin
  foreach t in array array['profiles','policy_periods','ck_levels','bonus_tiers','dealers','products','suppliers','materials','warehouses','locations','stock_lots','stock_moves','formulas','formula_lines','stock_docs','defects','stocktakes','stocktake_lines','orders','order_lines','order_events','invoices','receipts','production_orders','batches','batch_weighings','purchase_orders','iqc_checks','retained_samples','carriers','trips','trip_orders','visits','machines','repair_requests','attendance','attendance_locks','kpi_criteria','audit_log','doc_counters'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Ai cũng đọc được: tên người dùng, chính sách, sản phẩm, KPI
create policy r_all on profiles       for select to authenticated using (true);
create policy r_all on policy_periods for select to authenticated using (true);
create policy r_all on ck_levels      for select to authenticated using (true);
create policy r_all on bonus_tiers    for select to authenticated using (true);
create policy r_all on products       for select to authenticated using (true);
create policy r_all on kpi_criteria   for select to authenticated using (my_role() <> 'dai_ly');
-- CEO / Admin quản trị
create policy w_ceo on profiles       for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy w_ceo on policy_periods for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy w_ceo on ck_levels      for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy w_ceo on bonus_tiers    for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy w_ceo on products       for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy w_ceo on kpi_criteria   for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy r_ceo on audit_log      for select to authenticated using (has_role('ceo'));
-- Đại lý và công nợ
create policy r_scope on dealers  for select to authenticated using (can_see_dealer(id));
create policy w_kt    on dealers  for all to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_scope on invoices for select to authenticated using (has_role('ceo','ke_toan') or (can_see_dealer(dealer_id) and my_role() in ('gsv','nvkd','dai_ly')));
create policy w_kt    on invoices for update to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_scope on receipts for select to authenticated using (has_role('ceo','ke_toan') or (can_see_dealer(dealer_id) and my_role() in ('gsv','nvkd','dai_ly')));
-- Đơn hàng: đọc theo phạm vi đại lý; ghi chỉ qua hàm
create policy r_scope on orders       for select to authenticated using (can_see_dealer(dealer_id));
create policy r_scope on order_lines  for select to authenticated using (exists (select 1 from orders o where o.id = order_id and can_see_dealer(o.dealer_id)));
create policy r_scope on order_events for select to authenticated using (exists (select 1 from orders o where o.id = order_id and can_see_dealer(o.dealer_id)));
-- Kho, mua hàng, NCC
create policy r_ops on materials       for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_ops on materials       for all to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_ops on suppliers       for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_ops on suppliers       for all to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_ops on warehouses      for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on locations       for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_ops on locations       for all to authenticated using (has_role('ceo','to_truong')) with check (has_role('ceo','to_truong'));
create policy r_ops on stock_lots      for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on stock_docs      for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on defects         for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on stocktakes      for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on stocktake_lines for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on stock_moves     for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy r_ops on purchase_orders for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_ops on purchase_orders for all to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_ops on iqc_checks      for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
-- Công thức: chỉ CEO sửa; Tổ trưởng xem tên NVL + mức cân (B4)
create policy r_f on formulas      for select to authenticated using (has_role('ceo','to_truong'));
create policy w_f on formulas      for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
create policy r_f on formula_lines for select to authenticated using (has_role('ceo','to_truong'));
create policy w_f on formula_lines for all to authenticated using (has_role('ceo')) with check (has_role('ceo'));
-- Sản xuất, mẫu lưu
create policy r_sx on production_orders for select to authenticated using (has_role('ceo','to_truong','ke_toan'));
create policy r_sx on batches           for select to authenticated using (has_role('ceo','to_truong'));
create policy r_sx on batch_weighings   for select to authenticated using (has_role('ceo','to_truong'));
create policy r_sx on retained_samples  for select to authenticated using (has_role('ceo','to_truong','ke_toan'));
create policy w_sx on retained_samples  for update to authenticated using (has_role('ceo','to_truong')) with check (has_role('ceo','to_truong'));
-- Giao vận
create policy r_gv on carriers    for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_gv on carriers    for all to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_gv on trips       for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
create policy w_gv on trips       for update to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));
create policy r_gv on trip_orders for select to authenticated using (has_role('ceo','ke_toan','to_truong'));
-- Đi tuyến: NVKD ghi của mình; GSV xem vùng; CEO tất cả
create policy r_v on visits for select to authenticated using (nvkd_id = auth.uid() or has_role('ceo') or (my_role() = 'gsv' and can_see_dealer(dealer_id)));
create policy i_v on visits for insert to authenticated with check (nvkd_id = auth.uid() and can_see_dealer(dealer_id));
create policy u_v on visits for update to authenticated using (nvkd_id = auth.uid() and ngay = current_date) with check (nvkd_id = auth.uid());
-- Bảo trì
create policy rw_bt on machines        for all to authenticated using (has_role('ceo','to_truong')) with check (has_role('ceo','to_truong'));
create policy rw_bt on repair_requests for all to authenticated using (has_role('ceo','to_truong')) with check (has_role('ceo','to_truong'));
-- Chấm công: tự chấm của mình; CEO, Kế toán xem tổng hợp và chốt
create policy r_cc on attendance for select to authenticated using (user_id = auth.uid() or has_role('ceo','ke_toan'));
create policy i_cc on attendance for insert to authenticated with check (user_id = auth.uid() and my_role() <> 'dai_ly');
create policy rw_lock on attendance_locks for all to authenticated using (has_role('ceo','ke_toan')) with check (has_role('ceo','ke_toan'));

-- Hàm nghiệp vụ: chỉ người đã đăng nhập gọi được
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- Hàm nội bộ (trừ tồn, đánh số, mở phiếu…) không cho gọi trực tiếp qua API
revoke execute on function fifo_issue(item_kind, text, numeric, move_type, text, text) from authenticated;
revoke execute on function start_doc(text, text, boolean, uuid) from authenticated;
revoke execute on function next_no(text, int) from authenticated;
revoke execute on function check_stock_and_route(text) from authenticated;
revoke execute on function lock_order(text, order_status) from authenticated;
revoke execute on function order_event(text, text, text) from authenticated;
revoke execute on function stock_moves_doc() from authenticated;
revoke execute on function audit() from authenticated;
revoke execute on function attendance_guard() from authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant select on v_dealer_debt to authenticated;

-- Hao hụt thực tế theo lệnh SX so với định mức của công thức (F3, #8)
create or replace view v_lsx_hao_hut with (security_invoker = true) as
select x.id, x.sku, x.lot_code, f.hao_hut_pct as dinh_muc_pct,
       (select -sum(m.qty) from stock_moves m join stock_lots s on s.id = m.lot_id
         where m.ref_type = 'lsx' and m.ref_id = x.id and m.loai = 'xuat_sx' and s.kind = 'NVL') as kg_nvl_xuat,
       x.so_luong_thuc * p.kg_moi_dv as kg_thanh_pham,
       round(100 * (1 - x.so_luong_thuc * p.kg_moi_dv /
         nullif((select -sum(m.qty) from stock_moves m join stock_lots s on s.id = m.lot_id
                  where m.ref_type = 'lsx' and m.ref_id = x.id and m.loai = 'xuat_sx' and s.kind = 'NVL'), 0)), 2) as hao_hut_thuc_pct
from production_orders x join formulas f on f.id = x.formula_id join products p on p.sku = x.sku
where x.status = 'hoan_thanh';
grant select on v_lsx_hao_hut to authenticated;
