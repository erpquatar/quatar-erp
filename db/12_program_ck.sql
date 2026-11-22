-- Migration 12: chiết khấu của chương trình đạt điều kiện được tính là hợp lệ (không chuyển CEO)
create or replace function program_ck_max(p_order text) returns numeric
language sql stable security definer set search_path = public as
$$ select max(pp.ck_pct)
   from orders o join dealers d on d.id = o.dealer_id
   join policy_programs pp on pp.loai_dai_ly = d.loai and pp.active and pp.ck_pct is not null
   join policy_periods per on per.id = pp.period_id and per.active
  where o.id = p_order
    and coalesce(pp.dk_sl, 0) <= (
      select coalesce(sum(case when lower(coalesce(pp.dk_dvt,'')) = 'tấn' then ol.qty * p.kg_moi_dv / 1000
                               when lower(coalesce(pp.dk_dvt,'')) in ('kg','lít') then ol.qty * p.kg_moi_dv
                               else ol.qty end), 0)
        from order_lines ol join products p on p.sku = ol.sku
       where ol.order_id = o.id and (pp.dk_sku is null or ol.sku = pp.dk_sku)) $$;
revoke execute on function program_ck_max(text) from public, anon;
grant execute on function program_ck_max(text) to authenticated, service_role;

create or replace function order_violations(p_order text) returns text[]
language plpgsql stable security definer set search_path = public as
$$ declare o orders; d dealers; dbt v_dealer_debt; lim numeric; v text[] := '{}'; l record; t numeric; begin
  select * into o from orders where id = p_order;
  select * into d from dealers where id = o.dealer_id;
  select * into dbt from v_dealer_debt where dealer_id = d.id;
  select c.ck_max_pct into lim from ck_levels c join policy_periods p on p.id = c.period_id and p.active where c.loai_dai_ly = d.loai;
  lim := greatest(coalesce(lim, 0), coalesce(program_ck_max(p_order), 0));
  t := order_total(p_order);
  if o.ck_pct > lim then v := v || format('Chiết khấu %s%% vượt mức %s%% của %s', o.ck_pct, lim, d.loai); end if;
  for l in select ol.*, p.ten from order_lines ol join products p on p.sku = ol.sku where ol.order_id = p_order and ol.gia < ol.gia_chung loop
    v := v || format('Giá riêng %s %s thấp hơn giá chung %s', l.ten, l.gia, l.gia_chung);
  end loop;
  if dbt.du_no + t > d.han_muc then v := v || format('Dư nợ sau đơn %s vượt hạn mức %s', dbt.du_no + t, d.han_muc); end if;
  if dbt.qua_han_ngay > d.khoa_qua_han_ngay then v := v || format('Nợ quá hạn %s ngày (khóa khi > %s ngày)', dbt.qua_han_ngay, d.khoa_qua_han_ngay); end if;
  return v;
end $$;
