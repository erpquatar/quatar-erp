\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
select create_order('DL-ST-010', '[{"sku":"QT-MKP-1","qty":5}]') as o1 \gset
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
select return_order(:'o1', 'Sai số lượng');
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000e';
set my.o1 = :'o1';
do $$ begin perform resubmit_order(current_setting('my.o1'), '[{"sku":"QT-MKP-1","qty":8}]'); exception when others then raise notice 'OK tổ trưởng không sửa đơn: %', sqlerrm; end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
select resubmit_order(:'o1', '[{"sku":"QT-MKP-1","qty":8}]', null, 'tặng nón');
select status, (select qty from order_lines where order_id=:'o1') from orders where id=:'o1';
do $$ begin perform cancel_order(current_setting('my.o1'), ''); exception when others then raise notice 'OK bắt lý do: %', sqlerrm; end $$;
select cancel_order(:'o1', 'Khách đổi ý');
select status from orders where id=:'o1';
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
do $$ begin perform cancel_order('DH-2611-0002', 'thử'); exception when others then raise notice 'OK NVKD không hủy đơn đã duyệt: %', sqlerrm; end $$;
reset role;
select action, ghi_chu from order_events where order_id=:'o1' order by id;
