// ERP Quatar – app thật (Supabase). Phase 1: đăng nhập, phân quyền, danh mục, kho (nhập / xuất / điều chuyển / tồn).
const CFG = {
  url: 'https://qfjarxoymmabropgscek.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmamFyeG95bW1hYnJvcGdzY2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMTU1NTgsImV4cCI6MjExMDg5MTU1OH0._ccBX9tTCE_0WxhgkP6hqpmRaTbM3bK5G6L3vExTafo',
  domain: 'erp.quatar.vn',
  version: '0.6 · 22/11/2026'
};
const SB = window.__SB_MOCK || (await import('https://esm.sh/@supabase/supabase-js@2.45.4')).createClient(CFG.url, CFG.key);

// ---------- tiện ích ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => (+v || 0).toLocaleString('vi-VN', { maximumFractionDigits: d });
const vnd = v => num(Math.round(+v || 0)) + ' đ';
const noAcc = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const fdate = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
const ftime = t => t ? new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 3500); }
function errMsg(e) {
  if (!e) return '';
  const m = e.message || String(e);
  if (e.code === '23505') return 'Mã này đã tồn tại';
  if (e.code === '23503') return 'Dữ liệu đang được dùng ở nơi khác (đã phát sinh giao dịch hoặc liên kết). Hãy dùng "Ngừng dùng" thay cho xóa.';
  if (e.code === '42501' || /row-level security|permission denied/i.test(m)) return 'Bạn không có quyền thực hiện thao tác này';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Mất kết nối mạng, thử lại sau';
  return m;
}
const openSheet = (html, wide) => { const s = $('#sheet'); s.classList.toggle('wide', !!wide); s.innerHTML = html; $('#drawer').classList.add('open'); const c = $('#close', s); if (c) c.onclick = closeSheet; };
const closeSheet = () => { $('#drawer').classList.remove('open'); };
$('#drawer').addEventListener('click', e => { if (e.target.id === 'drawer') closeSheet(); });

// ---------- vai trò, bộ phận, phân hệ ----------
const RN = { ceo: 'CEO / Admin', gsv: 'Giám sát vùng', nvkd: 'Nhân viên KD', ke_toan: 'Kế toán', to_truong: 'Tổ trưởng', dai_ly: 'Đại lý' };
const DEPTS = [
  ['dh', 'Điều hành', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ['kd', 'Kinh doanh', '<path d="M3 7h18l-2 11H5z"/><path d="M8 7a4 4 0 0 1 8 0"/>'],
  ['kt', 'Kế toán', '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2"/>'],
  ['kho', 'Kho', '<path d="M3 9l9-5 9 5v11H3z"/><path d="M8 20v-6h8v6"/>'],
  ['sx', 'Sản xuất – QC', '<path d="M12 21c0-6 0-9 0-12M12 9c0-3 2-5 6-5 0 4-2 6-6 6M12 13c0-3-2-5-6-5 0 4 2 6 6 6"/>'],
  ['dm', 'Danh mục', '<path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2"/>'],
  ['ht', 'Nhân sự – Hệ thống', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>']];
const VIEWS = {
  dash: { t: 'Tổng quan điều hành', g: 'dh' }, inbox: { t: 'Chờ CEO duyệt', g: 'dh' }, cost: { t: 'Giá thành & chi phí', g: 'dh' },
  orders: { t: 'Đơn hàng', g: 'kd' }, dealers: { t: 'Đại lý & công nợ', g: 'kd' }, route: { t: 'Đi tuyến & ảnh', g: 'kd' }, policy: { t: 'Chính sách giá, CK, thưởng vụ', g: 'kd' }, kpi: { t: 'KPI', g: 'kd' },
  buy: { t: 'Mua hàng', g: 'kt' }, ship: { t: 'Giao vận – xe thuê', g: 'kt' }, misa: { t: 'Xuất dữ liệu MISA', g: 'kt' },
  stock: { t: 'Tồn kho & vị trí', g: 'kho' }, nhap: { t: 'Nhập kho', g: 'kho' }, xuat: { t: 'Xuất kho', g: 'kho' }, chuyen: { t: 'Điều chuyển kho, vị trí', g: 'kho' },
  defect: { t: 'Hàng lỗi & hủy', g: 'kho' }, count: { t: 'Kiểm kê', g: 'kho' }, nxt: { t: 'Nhập – xuất – tồn', g: 'kho' },
  bom: { t: 'Công thức phối trộn', g: 'sx' }, prod: { t: 'Lệnh SX & phiếu cân', g: 'sx' }, qc: { t: 'IQC & mẫu lưu', g: 'sx' }, trace: { t: 'Truy xuất', g: 'sx' }, maint: { t: 'Bảo trì', g: 'sx' },
  dm_kh: { t: 'Khách hàng / Đại lý', g: 'dm' }, dm_tp: { t: 'Thành phẩm', g: 'dm' }, dm_nvl: { t: 'Nguyên vật liệu', g: 'dm' }, dm_bb: { t: 'Bao bì', g: 'dm' }, dm_ncc: { t: 'Nhà cung cấp', g: 'dm' },
  dm_kho: { t: 'Kho & vị trí', g: 'dm' }, dm_nx: { t: 'Nhà xe', g: 'dm' }, dm_may: { t: 'Máy móc thiết bị', g: 'dm' }, dm_chung: { t: 'Danh mục chung', g: 'dm' },
  hr: { t: 'Chấm công & tổng hợp công', g: 'ht' }, perm: { t: 'Người dùng & phân quyền', g: 'ht' }
};
const HOME_ORDER = ['dash', 'orders', 'stock', 'nhap', 'prod', 'dm_kh'];
let ME = null, PERM = {}, cur = '', D = {}, LOTS = null;
const can = (m, q) => !!PERM[m]?.has(q);
const rl = p => p?.chuc_danh || RN[p?.role] || '';

// ---------- đăng nhập ----------
let loginStep = 1;
function showLogin(step = 1, err = '') {
  loginStep = step; $('#app').hidden = true; $('#login').classList.remove('hide');
  $('#l-step1').hidden = step !== 1; $('#l-step2').hidden = step !== 2;
  $('#l-title').textContent = step === 1 ? 'Đăng nhập ERP' : 'Đặt mật khẩu mới';
  $('#l-go').textContent = step === 1 ? 'Đăng nhập' : 'Lưu mật khẩu và vào ERP';
  $('#l-err').textContent = err; $('#l-go').disabled = false;
  (step === 1 ? $('#l-u') : $('#l-n1')).focus();
}
$('#lform').onsubmit = async e => {
  e.preventDefault(); const go = $('#l-go'), err = t => { $('#l-err').textContent = t; go.disabled = false; };
  go.disabled = true; $('#l-err').textContent = '';
  if (loginStep === 1) {
    const u = $('#l-u').value.trim().toLowerCase(), p = $('#l-p').value;
    if (!u || !p) return err('Nhập tên đăng nhập và mật khẩu');
    const email = u.includes('@') ? u : `${u}@${CFG.domain}`;
    const { error } = await SB.auth.signInWithPassword({ email, password: p });
    if (error) return err(/banned/i.test(error.message) ? 'Tài khoản đã bị khóa. Liên hệ Admin.' : /fetch/i.test(error.message) ? 'Mất kết nối mạng' : 'Sai tên đăng nhập hoặc mật khẩu');
    $('#l-p').value = ''; afterLogin();
  } else {
    const a = $('#l-n1').value, b = $('#l-n2').value;
    if (a.length < 8) return err('Mật khẩu tối thiểu 8 ký tự');
    if (a !== b) return err('Hai lần nhập không khớp');
    const { error } = await SB.auth.updateUser({ password: a });
    if (error) return err(/same/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ' : errMsg(error));
    await SB.rpc('password_changed'); $('#l-n1').value = $('#l-n2').value = '';
    afterLogin();
  }
};
async function afterLogin() {
  const { data, error } = await SB.rpc('touch_login');
  const p = Array.isArray(data) ? data[0] : data;
  if (error || !p) { await SB.auth.signOut(); return showLogin(1, error ? errMsg(error) : 'Tài khoản đã bị khóa hoặc chưa được cấp quyền'); }
  ME = p;
  if (p.must_change_pw) return showLogin(2);
  const { data: rm } = await SB.from('role_modules').select('module,quyen').eq('role', p.role);
  PERM = {}; (rm || []).forEach(r => PERM[r.module] = new Set(r.quyen.split(',').map(s => s.trim())));
  $('#login').classList.add('hide'); $('#app').hidden = false;
  meChip(); $('#view').innerHTML = '<p class="note"><span class="spin"></span> Đang tải dữ liệu…</p>';
  await loadMaster(); route();
}
$('#logout').onclick = async () => { await SB.auth.signOut(); ME = null; D = {}; LOTS = null; location.hash = ''; showLogin(1); };
$('#chpw').onclick = () => {
  openSheet(`<div class="row between"><h2>Đổi mật khẩu</h2><button class="btn sm" id="close">Đóng</button></div>
  <div class="field"><label for="c-1">Mật khẩu mới (tối thiểu 8 ký tự)</label><input id="c-1" type="password" autocomplete="new-password"></div>
  <div class="field"><label for="c-2">Nhập lại</label><input id="c-2" type="password" autocomplete="new-password"></div>
  <div class="err bad" id="c-err" style="min-height:20px"></div><button class="btn pri" id="c-go">Lưu mật khẩu</button>`);
  $('#c-go').onclick = async () => {
    const a = $('#c-1').value, b = $('#c-2').value, e = t => $('#c-err').textContent = t;
    if (a.length < 8) return e('Tối thiểu 8 ký tự'); if (a !== b) return e('Hai lần nhập không khớp');
    const { error } = await SB.auth.updateUser({ password: a }); if (error) return e(errMsg(error));
    closeSheet(); toast('Đã đổi mật khẩu');
  };
};
function meChip() { const ini = (ME.ho_ten || '?').trim().split(/\s+/).pop()[0]; $('#me').innerHTML = `<span class="av">${esc(ini)}</span><span><b>${esc(ME.ho_ten)}</b><br><span class="note">${esc(rl(ME))}${ME.vung ? ' · ' + esc(ME.vung) : ''}</span></span>`; }

// ---------- dữ liệu danh mục ----------
const TABLES = ['ck_levels', 'policy_periods', 'policy_programs', 'units', 'regions', 'item_groups', 'departments', 'stock_reasons', 'warehouses', 'locations', 'products', 'materials', 'suppliers', 'dealers', 'carriers', 'machines', 'profiles'];
async function loadMaster(only) {
  const list = only ? [].concat(only) : TABLES;
  await Promise.all(list.map(async t => { const { data } = await SB.from(t).select('*'); D[t] = data || []; }));
}
async function loadLots() { const { data } = await SB.from('stock_lots').select('*').gt('qty', 0); LOTS = data || []; return LOTS; }
const whOf = loc => D.locations?.find(l => l.id === loc)?.warehouse_id;
const isQuar = loc => !!D.warehouses?.find(w => w.id === whOf(loc))?.cach_ly;
function items() {
  return [...(D.products || []).map(p => ({ code: p.sku, ten: p.ten, dvt: p.dvt, kind: 'Thành phẩm', gia_ban: +p.gia_ban || 0, gia_von: +p.gia_von_chuan || 0, vt: p.vi_tri_mac_dinh, active: p.active !== false })),
  ...(D.materials || []).map(m => ({ code: m.ma, ten: m.ten, dvt: m.dvt_kho, kind: m.loai, gia_von: +m.gia_chuan || 0, vt: m.vi_tri_mac_dinh, active: m.active !== false }))];
}
const item = code => items().find(i => i.code === code);
const ton = code => (LOTS || []).filter(l => l.item_code === code && !isQuar(l.location_id)).reduce((a, l) => a + (+l.qty || 0), 0);
const userName = id => D.profiles?.find(p => p.id === id)?.ho_ten || '';

// ---------- điều hướng ----------
function visible() { return Object.keys(VIEWS).filter(v => PERM[v]); }
function nav() {
  const vis = visible(), cd = VIEWS[cur]?.g; let h = '', sub = '';
  DEPTS.forEach(([k, t, ic]) => {
    const vs = vis.filter(v => VIEWS[v].g === k); if (!vs.length) return; const open = k === cd;
    h += `<button class="dept ${open ? 'open' : ''}" data-dept="${vs[0]}" aria-expanded="${open}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><span>${t}</span><span class="chev">›</span></button>`;
    if (open) { const links = vs.map(v => `<a href="#${v}" class="${v === cur ? 'on' : ''}">${VIEWS[v].t}</a>`).join(''); h += `<div class="sub">${links}</div>`; sub = links; }
  });
  $('#nav').innerHTML = h; $('#subtabs').innerHTML = sub; $('#crumb').textContent = DEPTS.find(d => d[0] === cd)?.[1] || '';
  $$('#nav [data-dept]').forEach(b => b.onclick = () => location.hash = b.dataset.dept);
}
function route() {
  if (!ME) return;
  const h = location.hash.slice(1), vis = visible();
  cur = vis.includes(h) ? h : (HOME_ORDER.find(v => vis.includes(v)) || vis[0] || '');
  if (h !== cur) history.replaceState(null, '', '#' + cur);
  closeSheet(); nav(); $('#title').textContent = VIEWS[cur]?.t || 'ERP';
  const fn = V[cur] || placeholder; $('#view').innerHTML = '';
  Promise.resolve(fn()).catch(e => { $('#view').innerHTML = `<p class="bad">${esc(errMsg(e))}</p>`; });
}
window.addEventListener('hashchange', route);
const V = {};
function placeholder() {
  $('#view').innerHTML = `<div class="empty"><b>${esc(VIEWS[cur]?.t)}</b><br>Phân hệ này đang được xây dựng ở bước tiếp theo. Bản demo đã có giao diện mẫu để tham khảo.</div>`;
}

// ---------- Tổng quan & thiết lập ----------
V.dash = async () => {
  const now = new Date(Date.now() + 7 * 3600e3), ym = now.toISOString().slice(0, 7), d1 = ym + '-01', dToday = +now.toISOString().slice(8, 10), ops = opsRole();
  const q = (p) => Promise.resolve(p).then(r => r.data || [], () => []);
  const [ords, evs, inv, tg, lsx] = await Promise.all([
    q(SB.from('orders').select('*, order_lines(qty,gia)').neq('status', 'huy').order('created_at', { ascending: false }).limit(2000)),
    q(SB.from('order_events').select('order_id,ts,action').like('action', 'Xuất kho%').gte('ts', d1)),
    q(SB.from('invoices').select('*')), q(SB.from('sales_targets').select('*').eq('thang', ym)),
    ME.role === 'ceo' ? q(SB.from('production_orders').select('id,sku,so_luong,status').eq('status', 'cho_ceo')) : []]);
  await Promise.all([loadDebt(), ops ? loadLots() : null]);
  const tot = o => (o.order_lines || []).reduce((a, l) => a + l.qty * l.gia, 0) * (1 - (+o.ck_pct || 0) / 100), OM = Object.fromEntries(ords.map(o => [o.id, o]));
  // Doanh thu = giá trị đơn đã xuất kho trong tháng (theo ngày xuất)
  const ship = {}; evs.forEach(e => { if (OM[e.order_id] && !ship[e.order_id]) ship[e.order_id] = e.ts; });
  const days = Array.from({ length: dToday }, (_, i) => ({ d: i + 1, v: 0 })), byNv = {};
  let rev = 0; Object.entries(ship).forEach(([id, ts]) => { const o = OM[id], v = tot(o), dd = +new Date(new Date(ts).getTime() + 7 * 3600e3).toISOString().slice(8, 10); rev += v; if (days[dd - 1]) days[dd - 1].v += v; byNv[o.nvkd_id || '-'] = (byNv[o.nvkd_id || '-'] || 0) + v; });
  const newM = ords.filter(o => String(o.created_at) >= d1 && !['tra_lai'].includes(o.status)), booked = newM.reduce((a, o) => a + tot(o), 0);
  const target = +tg.find(t => t.ma === 'ALL')?.doanh_thu || 0, perDay = target ? target / 26 : 0;
  const wait = { gsv: ords.filter(o => o.status === 'cho_gsv').length, kt: ords.filter(o => o.status === 'cho_kt').length, ceo: ords.filter(o => o.status === 'cho_ceo').length };
  const debtRows = Object.values(DEBT), du = debtRows.reduce((a, r) => a + (+r.du_no || 0), 0), qh = debtRows.reduce((a, r) => a + (+r.qua_han_tien || 0), 0);
  const td = today(), ageB = [0, 0, 0]; inv.forEach(i => { const rem = (+i.so_tien || 0) - (+i.da_thu || 0); if (rem <= 0) return; const late = Math.floor((new Date(td) - new Date(i.han_tt)) / 864e5); ageB[late <= 0 ? 0 : late <= 30 ? 1 : 2] += rem; });
  const sv = (LOTS || []).reduce((a, l) => a + (+l.qty || 0) * (+l.don_gia || 0), 0);
  const low = ops ? [...(D.materials || []).map(m => ({ code: m.ma, ten: m.ten, dvt: m.dvt_kho, min: +m.muc_bao_ton || 0, vt: m.vi_tri_mac_dinh })), ...(D.products || []).map(p => ({ code: p.sku, ten: p.ten, dvt: p.dvt, min: +p.muc_bao_ton || 0, vt: p.vi_tri_mac_dinh }))].filter(x => x.min > 0 && ton(x.code) < x.min) : [];
  const tracked = ops ? [...(D.materials || []), ...(D.products || [])].filter(x => +x.muc_bao_ton > 0).length : 0;
  const tr = v => Math.abs(v) >= 1e9 ? num(v / 1e9, 2) + ' tỷ' : Math.abs(v) >= 1e6 ? num(v / 1e6, 1) + ' tr' : vnd(v);
  // Cảnh báo
  const al = [];
  if (ME.role === 'ceo') { if (wait.ceo) al.push(['var(--coral)', `<b>${wait.ceo} đơn</b> vượt chính sách chờ CEO duyệt`, 'orders']); lsx.forEach(l => al.push(['var(--coral)', `Lệnh <b>${esc(l.id)}</b> ${esc(prodName(l.sku))} ${num(l.so_luong)} – chờ CEO duyệt`, 'prod'])); }
  debtRows.filter(r => +r.qua_han_ngay > 0).sort((a, b) => b.qua_han_tien - a.qua_han_tien).slice(0, 6).forEach(r => { const d = dlr(r.dealer_id); al.push([+r.qua_han_ngay > (+d?.khoa_qua_han_ngay || 30) ? 'var(--coral)' : 'var(--amber)', `<b>${esc(r.ten)}</b> nợ quá hạn ${r.qua_han_ngay} ngày (${tr(r.qua_han_tien)})${+r.qua_han_ngay > (+d?.khoa_qua_han_ngay || 30) ? ' – đơn mới sẽ phải chờ CEO' : ''}`, 'dealers']); });
  low.slice(0, 6).forEach(x => al.push(['var(--amber)', `<b>${esc(x.ten)}</b> còn ${num(ton(x.code))} ${esc(x.dvt || '')}, dưới mức báo ${num(x.min)}${x.vt ? ' – vị trí ' + esc(x.vt) : ''}`, 'stock']));
  (D.products || []).filter(p => p.het_han_luu_hanh && p.het_han_luu_hanh <= new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)).forEach(p => al.push(['var(--amber)', `<b>${esc(p.ten)}</b> hết hạn lưu hành ${fdate(p.het_han_luu_hanh)}`, 'dm_tp']));
  (D.machines || []).filter(m => m.active !== false && m.han_ke_tiep && m.han_ke_tiep < td).forEach(m => al.push(['var(--amber)', `Bảo trì <b>${esc(m.ten)}</b> quá hạn từ ${fdate(m.han_ke_tiep)}`, 'dm_may']));
  if (wait.kt && ['ke_toan', 'ceo'].includes(ME.role)) al.push(['var(--blue)', `<b>${wait.kt} đơn</b> chờ Kế toán duyệt`, 'orders']);
  if (wait.gsv && ['gsv', 'ceo'].includes(ME.role)) al.push(['var(--blue)', `<b>${wait.gsv} đơn</b> chờ GSV duyệt`, 'orders']);
  // NVKD
  const nvs = (D.profiles || []).filter(p => p.role === 'nvkd' && p.active !== false).map(p => ({ n: p.ho_ten, v: byNv[p.id] || 0, t: +tg.find(t => t.ma === p.id)?.doanh_thu || 0 }));
  const mxNv = Math.max(1, ...nvs.map(n => n.t || n.v));
  const mx = Math.max(perDay, ...days.map(x => x.v)) * 1.12 || 1, under = perDay ? days.filter(x => x.v < perDay).length : 0;
  // Thiết lập
  const steps = [['dm_kho', 'Kho & vị trí lưu', (D.locations || []).filter(l => !isQuar(l.id)).length], ['dm_ncc', 'Nhà cung cấp', (D.suppliers || []).length], ['dm_nvl', 'Nguyên vật liệu', (D.materials || []).filter(m => m.loai === 'NVL').length], ['dm_bb', 'Bao bì', (D.materials || []).filter(m => m.loai === 'Bao bì').length], ['dm_tp', 'Thành phẩm', (D.products || []).length], ['dm_kh', 'Khách hàng / đại lý', (D.dealers || []).length], ['policy', 'Chính sách chiết khấu', (D.policy_periods || []).length], ['perm', 'Tài khoản người dùng', Math.max(0, (D.profiles || []).length - 1)], ['nhap', 'Tồn đầu kỳ (Nhập kho → Nhập khác)', ops ? (LOTS || []).length : 1]];
  const left = steps.filter(s => !s[2]);
  const tile = (lbl, val, sub, cls = '', go = '') => `<div class="tile ${cls} ${go ? 'click' : ''}" ${go ? `data-go="${go}"` : ''}><span>${lbl}</span><b>${val}</b><span>${sub}</span></div>`;
  $('#view').innerHTML = `<p class="note" style="margin-top:0">Tháng ${ym.slice(5)}/${ym.slice(0, 4)} · cập nhật ${ftime(new Date())} · ${ME.role === 'gsv' ? 'Vùng ' + esc(ME.vung || '') : 'Toàn công ty'}${ME.role === 'ceo' ? ' · <a href="#" id="set-tg">Đặt kế hoạch doanh thu</a>' : ''}</p>
  <div class="tiles">
   ${tile('Doanh thu tháng (đã xuất)', tr(rev), target ? `${Math.round(rev / target * 100)}% kế hoạch ${tr(target)}` : 'chưa đặt kế hoạch', '', 'orders')}
   ${tile('Đơn mới trong tháng', tr(booked), `${newM.length} đơn`, '', 'orders')}
   ${tile('Nợ quá hạn', tr(qh), du ? `${Math.round(qh / du * 100)}% tổng nợ ${tr(du)}` : 'chưa có công nợ', qh ? 'warn' : '', 'dealers')}
   ${tile('Đơn chờ duyệt', wait.gsv + wait.kt + wait.ceo, `GSV ${wait.gsv} · KT ${wait.kt} · CEO ${wait.ceo}`, wait.ceo ? 'warn' : '', 'orders')}
   ${ops ? tile('Giá trị tồn kho', tr(sv), `${new Set((LOTS || []).map(l => l.item_code)).size} mặt hàng có tồn`, '', 'stock') : ''}
   ${ops ? tile('Dưới mức tồn tối thiểu', low.length + ' mã', `trên ${tracked} mã có đặt mức báo`, low.length ? 'warn' : '', 'stock') : ''}
  </div>
  <div class="grid g2">
   <div class="card"><h3>Doanh thu theo ngày${perDay ? ` – ${under}/${days.length} ngày dưới mức cần đạt` : ''}</h3>
    ${rev || perDay ? `<div class="bars">${days.map(x => `<i class="${perDay && x.v < perDay ? 'low' : ''}" style="height:${Math.max(x.v / mx * 100, x.v ? 2 : 0)}%" title="${x.d}/${ym.slice(5)}: ${vnd(x.v)}"></i>`).join('')}${perDay ? `<div class="tline" style="bottom:${perDay / mx * 100}%"><span>cần ${tr(perDay)}/ngày</span></div>` : ''}</div><div class="xl">${days.map(x => `<span>${x.d % 3 === 1 ? x.d : ''}</span>`).join('')}</div>` : '<p class="note">Chưa có đơn xuất kho trong tháng.</p>'}</div>
   <div class="card"><h3>Doanh số NVKD${nvs.some(n => n.t) ? ' so mục tiêu tháng' : ' trong tháng'}</h3>
    ${nvs.length ? nvs.map(n => { const p = n.t ? n.v / n.t * 100 : n.v / mxNv * 100; return `<div class="hb"><span title="${esc(n.n)}">${esc(n.n)}</span><span class="tr"><i class="${n.t ? (p < 60 ? 'low' : p < 80 ? 'mid' : '') : ''}" style="width:${Math.min(p, 100)}%"></i></span><span style="text-align:right">${n.t ? Math.round(p) + '%' : tr(n.v)}</span></div>`; }).join('') : '<p class="note">Chưa có tài khoản NVKD.</p>'}</div>
   <div class="card"><h3>Tuổi nợ phải thu</h3>${du ? `<div class="stackbar">${[['var(--leaf)'], ['var(--amber)'], ['var(--coral)']].map((c, i) => `<i style="width:${ageB[i] / Math.max(1, ageB[0] + ageB[1] + ageB[2]) * 100}%;background:${c[0]}"></i>`).join('')}</div>${['Trong hạn', 'Quá hạn 1–30 ngày', 'Quá hạn > 30 ngày'].map((t, i) => `<div class="row between" style="font-size:14px"><span><span class="dot" style="display:inline-block;margin:0 6px 0 0;background:${['var(--leaf)', 'var(--amber)', 'var(--coral)'][i]}"></span>${t}</span><b>${tr(ageB[i])}</b></div>`).join('')}` : '<p class="note">Chưa có công nợ.</p>'}</div>
   <div class="card"><h3>Cảnh báo cần xử lý</h3>${al.slice(0, 12).map(a => `<div class="alert ${a[2] ? 'click' : ''}" ${a[2] && PERM[a[2]] ? `data-go="${a[2]}"` : ''}><span class="dot" style="background:${a[0]}"></span><span>${a[1]}</span></div>`).join('') || '<p class="note">Không có cảnh báo.</p>'}</div>
  </div>
  ${left.length ? `<div class="card" style="margin-top:14px"><h3>Còn ${left.length} bước thiết lập ban đầu</h3><p class="note" style="margin-top:-6px">Dashboard sẽ đầy đủ số liệu khi danh mục, tồn đầu kỳ và đơn hàng được nhập.</p>
   <table><tbody>${steps.map(([v, t, n], i) => `<tr class="${PERM[v] ? 'click' : ''}" data-go="${PERM[v] ? v : ''}"><td style="width:28px"><span class="vno">${i + 1}</span></td><td>${t}</td><td class="n">${n ? '<span class="ok">✓ Đã có</span>' : '<span class="pill p-wait">Chưa có</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
  <p class="note">Phiên bản ${CFG.version}. Doanh thu tính theo đơn đã xuất kho trong tháng (sau chiết khấu).</p>`;
  $$('#view [data-go]').forEach(r => r.dataset.go && (r.onclick = () => location.hash = r.dataset.go));
  $('#set-tg') && ($('#set-tg').onclick = e => { e.preventDefault(); targetForm(ym, tg); });
};
function targetForm(ym, tg) {
  const nv = (D.profiles || []).filter(p => p.role === 'nvkd' && p.active !== false), g = ma => tg.find(t => t.ma === ma)?.doanh_thu ?? '';
  openSheet(`<div class="row between"><h2>Kế hoạch doanh thu tháng ${ym.slice(5)}/${ym.slice(0, 4)}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div class="field"><label for="tg-all">Toàn công ty (đ)</label><input id="tg-all" type="number" inputmode="numeric" value="${g('ALL')}"></div>
  ${nv.length ? `<h3 style="font-size:15px">Mục tiêu từng NVKD (đ)</h3><div class="f2">${nv.map(p => `<div class="field"><label for="tg-${p.id}">${esc(p.ho_ten)}</label><input id="tg-${p.id}" data-tg="${p.id}" type="number" inputmode="numeric" value="${g(p.id)}"></div>`).join('')}</div>` : ''}
  <div class="err bad" id="tg-e"></div><button class="btn pri" id="tg-go">Lưu kế hoạch</button>`);
  $('#tg-go').onclick = async () => {
    const rows = [['ALL', $('#tg-all').value], ...$$('[data-tg]').map(i => [i.dataset.tg, i.value])];
    for (const [ma, v] of rows) { const r = v === '' ? await SB.from('sales_targets').delete().eq('thang', ym).eq('ma', ma) : await SB.from('sales_targets').upsert({ thang: ym, ma, doanh_thu: +v }); if (r.error) return $('#tg-e').textContent = errMsg(r.error); }
    closeSheet(); toast('Đã lưu kế hoạch'); V.dash();
  };
}

// ---------- DANH MỤC ----------
const KINDS = ['NVL', 'Bao bì', 'Thành phẩm'];
const DEALER_TYPES = ['NPP', 'Cấp 1', 'Cấp 2', 'Farm', 'Nông dân'];
const F = (k, l, t = 'text', o = {}) => ({ k, l, t, ...o });
const optLoc = () => D.locations.filter(l => l.active !== false).map(l => [l.id, `${l.id} · ${D.warehouses.find(w => w.id === l.warehouse_id)?.ten || l.warehouse_id}`]);
const matTab = (loai, name) => ({
  tb: 'materials', pk: 'ma', name, fixed: { loai }, filter: r => r.loai === loai,
  f: [F('ma', 'Mã', 'text', { req: 1, key: 1 }), F('ten', 'Tên', 'text', { req: 1 }), F('nhom', 'Nhóm', 'sel', { opts: () => D.item_groups.filter(g => g.ap_dung === loai).map(g => g.ten) }),
  F('ham_luong', loai === 'NVL' ? 'Hàm lượng / quy cách' : 'Quy cách'), F('dvt_kho', 'ĐVT kho', 'sel', { req: 1, opts: () => D.units.map(u => u.id) }), F('dvt_mua', 'ĐVT mua', 'sel', { opts: () => D.units.map(u => u.id) }),
  F('quy_doi', 'Quy đổi (1 ĐVT mua = ? ĐVT kho)', 'num'), F('gia_chuan', 'Giá nhập chuẩn (đ / ĐVT kho)', 'num'), F('ncc_chinh', 'NCC chính', 'sel', { opts: () => D.suppliers.map(s => [s.id, s.ten]) }),
  F('nguon', 'Nguồn gốc'), F('lead_time_ngay', 'Thời gian giao (ngày)', 'int'), F('moq', 'Mua tối thiểu (MOQ)', 'num'), F('muc_bao_ton', 'Tồn tối thiểu', 'num'), F('ton_toi_da', 'Tồn tối đa', 'num'),
  F('vi_tri_mac_dinh', 'Vị trí mặc định', 'sel', { opts: optLoc }), F('bao_quan', 'Điều kiện bảo quản', 'text', { full: 1 }), F('active', 'Đang dùng', 'bool', { def: true })],
  list: ['ma', 'ten', 'nhom', 'dvt_kho', 'gia_chuan', 'vi_tri_mac_dinh']
});
const CATS = {
  dm_kh: [{
    tb: 'dealers', pk: 'id', name: 'Khách hàng / Đại lý',
    f: [F('id', 'Mã khách hàng', 'text', { req: 1, key: 1 }), F('ten', 'Tên khách hàng', 'text', { req: 1 }), F('loai', 'Loại', 'sel', { req: 1, opts: () => DEALER_TYPES }),
    F('cap_tren_id', 'Thuộc NPP / cấp trên', 'sel', { opts: () => D.dealers.map(x => [x.id, x.ten]) }), F('dai_dien', 'Người đại diện'), F('sdt', 'Điện thoại'), F('mst', 'Mã số thuế'),
    F('dia_chi', 'Địa chỉ', 'text', { full: 1 }), F('tinh', 'Tỉnh / thành'), F('vung', 'Vùng', 'sel', { opts: () => D.regions.map(r => r.ten) }), F('kho_nhan', 'Kho nhận hàng'),
    F('nvkd_id', 'NVKD phụ trách', 'sel', { opts: () => D.profiles.filter(p => p.role === 'nvkd').map(p => [p.id, p.ho_ten]) }), F('han_muc', 'Hạn mức nợ (đ)', 'num'), F('han_no_ngay', 'Hạn nợ (ngày)', 'int'),
    F('khoa_qua_han_ngay', 'Khóa đặt hàng khi quá hạn (ngày)', 'int'), F('cam_ket_tan', 'Cam kết sản lượng (tấn/năm)', 'num'), F('tai_san_bao_dam', 'Tài sản bảo đảm', 'text', { full: 1 }),
    F('tu_dat_hang', 'Cho đại lý tự đặt hàng trên app', 'bool'), F('active', 'Đang dùng', 'bool', { def: true })],
    list: ['id', 'ten', 'loai', 'sdt', 'dia_chi', 'vung']
  }],
  dm_tp: [{
    tb: 'products', pk: 'sku', name: 'Thành phẩm',
    f: [F('sku', 'Mã SKU', 'text', { req: 1, key: 1 }), F('ten', 'Tên sản phẩm', 'text', { req: 1 }), F('nhan_hieu', 'Nhãn hiệu'), F('nhom', 'Nhóm', 'sel', { opts: () => D.item_groups.filter(g => g.ap_dung === 'Thành phẩm').map(g => g.ten) }),
    F('dang', 'Dạng (hạt, bột, lỏng…)'), F('quy_cach', 'Quy cách', 'text', { req: 1 }), F('dvt', 'ĐVT', 'sel', { req: 1, opts: () => D.units.map(u => u.id) }), F('kg_moi_dv', 'Kg (lít) / ĐVT', 'num', { req: 1 }),
    F('n_pct', 'N (%)', 'num'), F('p2o5_pct', 'P₂O₅ (%)', 'num'), F('k2o_pct', 'K₂O (%)', 'num'), F('trung_vi_luong', 'Trung vi lượng'),
    F('gia_ban', 'Giá bán chung (đ / ĐVT)', 'num', { req: 1 }), F('gia_von_chuan', 'Giá vốn chuẩn (đ / ĐVT)', 'num'), F('ma_lo_prefix', 'Tiền tố mã lô', 'text', { req: 1 }), F('han_dung_thang', 'Hạn dùng (tháng)', 'int'),
    F('so_qd_luu_hanh', 'Số QĐ lưu hành'), F('het_han_luu_hanh', 'Hết hạn lưu hành', 'date'), F('tieu_chuan', 'Tiêu chuẩn công bố'), F('barcode', 'Mã vạch'),
    F('muc_bao_ton', 'Tồn tối thiểu', 'num'), F('vi_tri_mac_dinh', 'Vị trí mặc định', 'sel', { opts: optLoc }), F('active', 'Đang bán', 'bool', { def: true })],
    list: ['sku', 'ten', 'quy_cach', 'dvt', 'gia_ban', 'vi_tri_mac_dinh']
  }],
  dm_nvl: [matTab('NVL', 'Nguyên vật liệu')],
  dm_bb: [matTab('Bao bì', 'Bao bì')],
  dm_ncc: [{
    tb: 'suppliers', pk: 'id', name: 'Nhà cung cấp',
    f: [F('id', 'Mã NCC', 'text', { req: 1, key: 1 }), F('ten', 'Tên NCC', 'text', { req: 1 }), F('mst', 'Mã số thuế'), F('sdt', 'Điện thoại'), F('dia_chi', 'Địa chỉ', 'text', { full: 1 }),
    F('quoc_gia', 'Quốc gia', 'text', { def: 'Việt Nam' }), F('mat_hang', 'Mặt hàng cung cấp'), F('dieu_khoan', 'Điều khoản thanh toán'), F('xep_hang', 'Xếp hạng', 'sel', { opts: () => ['A', 'B', 'C'] }), F('active', 'Đang dùng', 'bool', { def: true })],
    list: ['id', 'ten', 'mat_hang', 'sdt', 'dia_chi']
  }],
  dm_kho: [{
    tb: 'locations', pk: 'id', name: 'Vị trí lưu',
    f: [F('id', 'Mã vị trí', 'text', { req: 1, key: 1, ph: 'vd: A01-02' }), F('warehouse_id', 'Thuộc kho', 'sel', { req: 1, opts: () => D.warehouses.map(w => [w.id, w.ten]) }), F('mo_ta', 'Mô tả', 'text', { full: 1 }), F('active', 'Đang dùng', 'bool', { def: true })],
    list: ['id', 'warehouse_id', 'mo_ta']
  }, {
    tb: 'warehouses', pk: 'id', name: 'Kho',
    f: [F('id', 'Mã kho', 'text', { req: 1, key: 1 }), F('ten', 'Tên kho', 'text', { req: 1 }), F('loai', 'Loại hàng chứa', 'sel', { opts: () => KINDS }), F('cach_ly', 'Kho cách ly (không tính tồn khả dụng)', 'bool'), F('active', 'Đang dùng', 'bool', { def: true })],
    list: ['id', 'ten', 'loai']
  }],
  dm_nx: [{
    tb: 'carriers', pk: 'id', auto: 1, name: 'Nhà xe',
    f: [F('ma', 'Mã nhà xe', 'text', { req: 1 }), F('ten', 'Tên nhà xe / chủ xe', 'text', { req: 1 }), F('tuyen', 'Tuyến chạy'), F('tai_trong', 'Tải trọng'), F('don_gia_tan', 'Đơn giá cước (đ / tấn)', 'num'),
    F('xe_cong_ty', 'Xe của công ty', 'bool'), F('active', 'Đang dùng', 'bool', { def: true })],
    list: ['ma', 'ten', 'tuyen', 'tai_trong', 'don_gia_tan']
  }],
  dm_may: [{
    tb: 'machines', pk: 'id', name: 'Máy móc thiết bị',
    f: [F('id', 'Mã máy', 'text', { req: 1, key: 1 }), F('ten', 'Tên máy', 'text', { req: 1 }), F('viec_dinh_ky', 'Việc bảo trì định kỳ', 'text', { full: 1 }), F('chu_ky_ngay', 'Chu kỳ (ngày)', 'int'), F('han_ke_tiep', 'Hạn bảo trì kế tiếp', 'date'), F('active', 'Đang dùng', 'bool', { def: true })],
    list: ['id', 'ten', 'viec_dinh_ky', 'chu_ky_ngay', 'han_ke_tiep']
  }],
  dm_chung: [
    { tb: 'units', pk: 'id', name: 'Đơn vị tính', f: [F('id', 'Ký hiệu', 'text', { req: 1, key: 1 }), F('ten', 'Tên', 'text', { req: 1 }), F('active', 'Đang dùng', 'bool', { def: true })], list: ['id', 'ten'] },
    { tb: 'regions', pk: 'id', name: 'Vùng bán hàng', f: [F('id', 'Mã vùng', 'text', { req: 1, key: 1 }), F('ten', 'Tên vùng', 'text', { req: 1 }), F('active', 'Đang dùng', 'bool', { def: true })], list: ['id', 'ten'] },
    { tb: 'item_groups', pk: 'id', name: 'Nhóm hàng', f: [F('id', 'Mã nhóm', 'text', { req: 1, key: 1 }), F('ten', 'Tên nhóm', 'text', { req: 1 }), F('ap_dung', 'Áp dụng cho', 'sel', { req: 1, opts: () => KINDS }), F('active', 'Đang dùng', 'bool', { def: true })], list: ['id', 'ten', 'ap_dung'] },
    { tb: 'departments', pk: 'id', name: 'Bộ phận', f: [F('id', 'Mã bộ phận', 'text', { req: 1, key: 1 }), F('ten', 'Tên bộ phận', 'text', { req: 1 }), F('active', 'Đang dùng', 'bool', { def: true })], list: ['id', 'ten'] },
    { tb: 'stock_reasons', pk: 'id', name: 'Lý do nhập / xuất', f: [F('id', 'Mã', 'text', { req: 1, key: 1 }), F('ten', 'Lý do', 'text', { req: 1 }), F('ap_dung', 'Áp dụng', 'sel', { req: 1, opts: () => ['Nhập', 'Xuất', 'Chuyển'] }), F('active', 'Đang dùng', 'bool', { def: true })], list: ['id', 'ten', 'ap_dung'] }
  ]
};
const catState = {};
const optList = o => o.map(x => Array.isArray(x) ? x : [x, x]);
function cellVal(c, f, r) {
  const v = r[c]; if (v == null || v === '') return '';
  if (f?.t === 'num') return num(v, 2); if (f?.t === 'date') return fdate(v); if (f?.t === 'bool') return v ? '✓' : '';
  if (f?.t === 'sel') { const o = optList(f.opts()).find(x => String(x[0]) === String(v)); return esc(o ? o[1] : v); }
  return esc(v);
}
for (const m of Object.keys(CATS)) V[m] = () => catView(m);
function catView(m) {
  const tabs = CATS[m], st = catState[m] ||= { tab: 0, q: '', act: 'on' }, c = tabs[st.tab], canT = can(m, 'T'), canS = can(m, 'S');
  let rows = (D[c.tb] || []).filter(r => !c.filter || c.filter(r));
  const nOn = rows.filter(r => r.active !== false).length, nOff = rows.length - nOn;
  if (st.act !== 'all') rows = rows.filter(r => (r.active !== false) === (st.act === 'on'));
  if (st.q) { const q = noAcc(st.q); rows = rows.filter(r => noAcc(Object.values(r).join(' ')).includes(q)); }
  rows.sort((a, b) => String(a[c.list[0]]).localeCompare(String(b[c.list[0]]), 'vi', { numeric: true }));
  const fm = Object.fromEntries(c.f.map(f => [f.k, f]));
  $('#view').innerHTML = `${tabs.length > 1 ? `<div class="chips" style="margin-bottom:10px">${tabs.map((t, i) => `<span class="chip ${i === st.tab ? 'on' : ''}" data-tab="${i}">${t.name}</span>`).join('')}</div>` : ''}
  <div class="row between" style="margin-bottom:10px"><div class="row"><input id="cq" placeholder="Tìm mã, tên, SĐT…" value="${esc(st.q)}" style="min-width:220px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px">
   <div class="chips">${[['on', 'Đang dùng ' + nOn], ['off', 'Ngừng dùng ' + nOff], ['all', 'Tất cả']].map(([k, t]) => `<span class="chip ${st.act === k ? 'on' : ''}" data-act="${k}">${t}</span>`).join('')}</div></div>
   ${canT ? `<button class="btn pri" id="cadd">+ Thêm ${c.name.toLowerCase()}</button>` : ''}</div>
  <div class="scroll"><table class="stack"><thead><tr>${c.list.map(k => `<th>${fm[k]?.l || k}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map(r => `<tr class="click ${r.active === false ? 'off' : ''}" data-pk="${esc(r[c.pk])}">${c.list.map(k => `<td data-l="${esc(fm[k]?.l || k)}">${cellVal(k, fm[k], r)}</td>`).join('')}<td>${r.active === false ? '<span class="pill p-bad">Ngừng dùng</span>' : ''}</td></tr>`).join('') || `<tr><td colspan="${c.list.length + 1}" class="note">Chưa có dữ liệu.${canT ? ' Bấm "+ Thêm" để nhập.' : ''}</td></tr>`}
  </tbody></table></div><p class="note">${rows.length} dòng. ${canS ? 'Bấm vào một dòng để sửa.' : 'Bạn chỉ có quyền xem danh mục này.'}</p>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { st.tab = +b.dataset.tab; catView(m); });
  $$('[data-act]').forEach(b => b.onclick = () => { st.act = b.dataset.act; catView(m); });
  const q = $('#cq'); q.oninput = () => { st.q = q.value; const p = q.selectionStart; catView(m); const n = $('#cq'); n.focus(); n.setSelectionRange(p, p); };
  if ($('#cadd')) $('#cadd').onclick = () => catForm(m, c, null);
  $$('tr[data-pk]').forEach(tr => tr.onclick = () => catForm(m, c, (D[c.tb] || []).find(r => String(r[c.pk]) === tr.dataset.pk)));
}
function catForm(m, c, r) {
  const isNew = !r, ed = isNew ? can(m, 'T') : can(m, 'S'), v = r || {};
  const fld = f => {
    const val = v[f.k] ?? (isNew ? f.def ?? '' : ''), dis = !ed || (f.key && !isNew) ? 'disabled' : '', id = 'cf-' + f.k, req = f.req ? ' *' : '';
    if (f.t === 'bool') return `<div class="field ${f.full ? 'full' : ''}"><label class="chk"><input type="checkbox" id="${id}" ${val === true || (isNew && f.def) ? 'checked' : ''} ${dis}> ${f.l}</label></div>`;
    if (f.t === 'sel') return `<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.l}${req}</label><select id="${id}" ${dis}><option value="">—</option>${optList(f.opts()).map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(val) ? 'selected' : ''}>${esc(b)}</option>`).join('')}${val && !optList(f.opts()).some(o => String(o[0]) === String(val)) ? `<option value="${esc(val)}" selected>${esc(val)}</option>` : ''}</select></div>`;
    const ty = f.t === 'num' || f.t === 'int' ? 'number' : f.t === 'date' ? 'date' : 'text';
    return `<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.l}${req}</label><input id="${id}" type="${ty}" ${ty === 'number' ? `inputmode="decimal" step="${f.t === 'int' ? 1 : 'any'}"` : ''} value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${dis}></div>`;
  };
  openSheet(`<div class="row between"><h2>${isNew ? 'Thêm ' + c.name.toLowerCase() : esc(v[c.f[0].k] ?? '') + ' · ' + esc(v.ten || v.id || '')}</h2><button class="btn sm" id="close">Đóng</button></div>
  <p class="note">${c.name}${isNew ? '' : v.active === false ? ' · <span class="bad">Ngừng dùng</span>' : ' · Đang dùng'}</p>
  <div class="f2">${c.f.map(fld).join('')}</div>
  <div class="err bad" id="cf-err" style="min-height:20px"></div>
  ${ed ? `<div class="row"><button class="btn pri" id="cf-save">${isNew ? 'Thêm vào danh mục' : 'Lưu thay đổi'}</button>${!isNew ? `<button class="btn" id="cf-act">${v.active === false ? 'Dùng lại' : 'Ngừng dùng'}</button><button class="btn bad" id="cf-del">Xóa</button>` : ''}</div>` : ''}
  ${!isNew ? '<p class="note">Mã đã phát sinh giao dịch thì không xóa được, chỉ "Ngừng dùng" (giữ lịch sử, không cho chọn mới).</p>' : ''}`, true);
  if (!ed) return;
  const e = t => $('#cf-err').textContent = t;
  $('#cf-save').onclick = async () => {
    const o = { ...(c.fixed || {}) };
    for (const f of c.f) {
      if (f.key && !isNew) continue; const el = $('#cf-' + f.k);
      let x = f.t === 'bool' ? el.checked : el.value.trim();
      if (f.t === 'num' || f.t === 'int') x = x === '' ? null : +x;
      else if (x === '' && f.t !== 'bool') x = null;
      if (f.req && (x == null || x === '')) return e('Thiếu: ' + f.l);
      if (f.key && x && !/^[A-Za-z0-9._\-\/]+$/.test(x)) return e(f.l + ': chỉ dùng chữ không dấu, số, dấu chấm, gạch');
      o[f.k] = x;
    }
    $('#cf-save').disabled = true;
    const q = isNew ? SB.from(c.tb).insert(o) : SB.from(c.tb).update(o).eq(c.pk, v[c.pk]);
    const { error } = await q; $('#cf-save').disabled = false;
    if (error) return e(errMsg(error));
    await loadMaster(c.tb); closeSheet(); toast(isNew ? 'Đã thêm' : 'Đã lưu'); catView(m);
  };
  $('#cf-act') && ($('#cf-act').onclick = async () => {
    const { error } = await SB.from(c.tb).update({ active: v.active === false }).eq(c.pk, v[c.pk]);
    if (error) return e(errMsg(error)); await loadMaster(c.tb); closeSheet(); toast(v.active === false ? 'Đã dùng lại' : 'Đã ngừng dùng'); catView(m);
  });
  $('#cf-del') && ($('#cf-del').onclick = async b => {
    const btn = $('#cf-del'); if (!btn.dataset.ok) { btn.dataset.ok = 1; btn.textContent = 'Bấm lần nữa để xóa hẳn'; return; }
    const { error } = await SB.from(c.tb).delete().eq(c.pk, v[c.pk]);
    if (error) return e(errMsg(error)); await loadMaster(c.tb); closeSheet(); toast('Đã xóa'); catView(m);
  });
}

// ---------- NGƯỜI DÙNG & PHÂN QUYỀN ----------
let permTab = 'u';
async function callAdmin(body) {
  const { data, error } = await SB.functions.invoke('admin-users', { body });
  if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch { } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
const scopeOf = p => p.role === 'gsv' || p.role === 'nvkd' ? `Vùng ${p.vung || '—'}${p.role === 'nvkd' ? ` · ${D.dealers.filter(d => d.nvkd_id === p.id).length} đại lý` : ''}` : p.role === 'dai_ly' ? (D.dealers.find(d => d.id === p.dealer_id)?.ten || p.dealer_id || '') : 'Toàn công ty';
V.perm = async () => {
  await loadMaster('profiles');
  const tabs = `<div class="chips" style="margin-bottom:12px"><span class="chip ${permTab === 'u' ? 'on' : ''}" data-pt="u">Người dùng</span><span class="chip ${permTab === 'm' ? 'on' : ''}" data-pt="m">Ma trận quyền theo vai trò</span></div>`;
  if (permTab === 'm') {
    const { data } = await SB.from('role_modules').select('*'); const roles = Object.keys(RN);
    const QN = { X: 'Xem', T: 'Tạo', S: 'Sửa', D: 'Duyệt', H: 'Hủy' };
    $('#view').innerHTML = tabs + `<div class="scroll"><table class="mx"><thead><tr><th>Bộ phận · phân hệ</th>${roles.map(r => `<th>${RN[r]}</th>`).join('')}</tr></thead><tbody>${DEPTS.map(([k, t]) => `<tr><td colspan="${roles.length + 1}" style="background:var(--panel);font-weight:600">${t}</td></tr>` + Object.keys(VIEWS).filter(v => VIEWS[v].g === k).map(v => `<tr><td>${VIEWS[v].t}</td>${roles.map(r => { const q = data?.find(x => x.role === r && x.module === v)?.quyen; return `<td>${q ? q.split(',').map(s => QN[s] || s).join(', ') : '<span class="note">—</span>'}</td>`; }).join('')}</tr>`).join('')).join('')}</tbody></table></div>
    <p class="note">CEO và Admin dùng chung vai trò "CEO / Admin" nên có quyền như nhau; phân biệt bằng chức danh và tên đăng nhập riêng. Đổi quyền theo vai trò: báo đội triển khai.</p>`;
  } else {
    const us = [...D.profiles].sort((a, b) => (a.role > b.role) - (a.role < b.role) || a.ho_ten.localeCompare(b.ho_ten, 'vi'));
    $('#view').innerHTML = tabs + `<div class="row between" style="margin-bottom:10px"><p class="note" style="margin:0">${us.filter(u => u.active !== false).length} tài khoản đang hoạt động.</p><button class="btn pri" id="ua">+ Tạo tài khoản</button></div>
    <div class="scroll"><table class="stack"><thead><tr><th>Người dùng</th><th>Tên đăng nhập</th><th>Vai trò / chức danh</th><th>Phạm vi</th><th>Đăng nhập gần nhất</th><th></th></tr></thead><tbody>
    ${us.map(u => `<tr class="click ${u.active === false ? 'off' : ''}" data-uid="${u.id}"><td data-l="Người dùng"><b>${esc(u.ho_ten)}</b><br><span class="note">${esc(u.sdt || '')}</span></td><td data-l="Tên đăng nhập">${esc(u.username || '')}</td><td data-l="Vai trò">${RN[u.role]}${u.chuc_danh ? `<br><span class="note">${esc(u.chuc_danh)}</span>` : ''}</td><td data-l="Phạm vi">${esc(scopeOf(u))}</td><td data-l="Đăng nhập">${u.last_login_at ? ftime(u.last_login_at) : '<span class="note">chưa</span>'}${u.must_change_pw ? '<br><span class="pill p-wait">Chờ đổi mật khẩu</span>' : ''}</td><td>${u.active === false ? '<span class="pill p-bad">Đã khóa</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
    $('#ua').onclick = () => userForm(null);
    $$('[data-uid]').forEach(tr => tr.onclick = () => userForm(D.profiles.find(p => p.id === tr.dataset.uid)));
  }
  $$('[data-pt]').forEach(b => b.onclick = () => { permTab = b.dataset.pt; V.perm(); });
};
const slug = s => noAcc(s).replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/);
function userForm(u) {
  const isNew = !u; u = u || { role: 'nvkd', active: true };
  openSheet(`<div class="row between"><h2>${isNew ? 'Tạo tài khoản' : 'Sửa · ' + esc(u.ho_ten)}</h2><button class="btn sm" id="close">Đóng</button></div>
  <p class="note">Chọn vai trò là người dùng có ngay đúng menu và quyền thao tác. Phạm vi dữ liệu chọn ngay bên dưới.</p>
  <div class="f2"><div class="field"><label for="a-ho">Họ tên *</label><input id="a-ho" value="${esc(u.ho_ten || '')}"></div>
  <div class="field"><label for="a-u">Tên đăng nhập *</label><input id="a-u" value="${esc(u.username || '')}" ${isNew ? '' : 'disabled'} autocapitalize="none" spellcheck="false" placeholder="tự gợi ý từ họ tên"></div>
  <div class="field"><label for="a-sdt">Số điện thoại</label><input id="a-sdt" value="${esc(u.sdt || '')}" inputmode="tel"></div>
  <div class="field"><label for="a-cd">Chức danh hiển thị</label><input id="a-cd" value="${esc(u.chuc_danh || '')}" placeholder="vd: CEO, Admin hệ thống, Trưởng kho"></div>
  <div class="field full"><label for="a-role">Vai trò *</label><select id="a-role">${Object.keys(RN).map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${RN[r]}</option>`).join('')}</select></div></div>
  <div id="a-scope"></div><div class="err bad" id="a-err" style="min-height:20px"></div>
  <div class="row"><button class="btn pri" id="a-go">${isNew ? 'Tạo tài khoản' : 'Lưu'}</button>${!isNew && u.id !== ME.id ? `<button class="btn" id="a-lock">${u.active === false ? 'Mở khóa' : 'Khóa tài khoản'}</button>` : ''}${!isNew ? '<button class="btn" id="a-reset">Đặt lại mật khẩu</button>' : ''}</div>`, true);
  const scope = () => {
    const r = $('#a-role').value; let h = '';
    if (r === 'gsv' || r === 'nvkd') h += `<div class="field"><label for="a-vung">Vùng phụ trách *</label><select id="a-vung"><option value="">—</option>${D.regions.filter(x => x.active !== false).map(x => `<option ${x.ten === u.vung ? 'selected' : ''}>${esc(x.ten)}</option>`).join('')}</select></div>`;
    if (r === 'nvkd') h += `<div class="field"><label>Đại lý phụ trách</label><div class="card" style="max-height:240px;overflow:auto">${D.dealers.filter(d => d.active !== false).map(d => `<label class="chk"><input type="checkbox" data-dsel="${esc(d.id)}" ${d.nvkd_id && d.nvkd_id === u.id ? 'checked' : ''}> ${esc(d.ten)} <span class="note">${esc(d.vung || '')}</span></label>`).join('') || '<span class="note">Chưa có khách hàng trong danh mục.</span>'}</div></div>`;
    if (r === 'dai_ly') { const dd = D.dealers.find(d => d.id === u.dealer_id); h += `<div class="field"><label for="a-dl">Gắn với đại lý *</label><select id="a-dl"><option value="">—</option>${D.dealers.map(d => `<option value="${esc(d.id)}" ${d.id === u.dealer_id ? 'selected' : ''}>${esc(d.ten)}</option>`).join('')}</select></div><label class="chk"><input type="checkbox" id="a-self" ${dd?.tu_dat_hang ? 'checked' : ''}> Cho đại lý tự đặt hàng</label>`; }
    $('#a-scope').innerHTML = h;
  };
  scope(); $('#a-role').onchange = scope;
  if (isNew) $('#a-ho').oninput = () => { const p = slug($('#a-ho').value); if (p[0]) $('#a-u').value = p.at(-1) + (p.length > 1 ? '.' + p.slice(0, -1).map(w => w[0]).join('') : ''); };
  const e = t => $('#a-err').textContent = t;
  $('#a-go').onclick = async () => {
    const r = $('#a-role').value, body = { action: isNew ? 'create' : 'update', id: u.id, ho_ten: $('#a-ho').value.trim(), sdt: $('#a-sdt').value.trim(), chuc_danh: $('#a-cd').value.trim(), role: r };
    if (isNew) body.username = $('#a-u').value.trim().toLowerCase();
    if (!body.ho_ten) return e('Thiếu họ tên');
    if (r === 'gsv' || r === 'nvkd') { body.vung = $('#a-vung').value; if (!body.vung) return e('Chọn vùng phụ trách'); }
    if (r === 'nvkd') body.dealers = $$('[data-dsel]').filter(c => c.checked).map(c => c.dataset.dsel);
    if (r === 'dai_ly') { body.dealer_id = $('#a-dl').value; body.tu_dat_hang = $('#a-self').checked; if (!body.dealer_id) return e('Chọn đại lý'); }
    $('#a-go').disabled = true;
    try {
      const res = await callAdmin(body); await loadMaster(['profiles', 'dealers']);
      if (isNew) showPw(body.ho_ten, res.username, res.password); else { closeSheet(); toast('Đã lưu phân quyền'); }
      V.perm();
    } catch (x) { e(x.message); $('#a-go').disabled = false; }
  };
  $('#a-lock') && ($('#a-lock').onclick = async () => { try { await callAdmin({ action: 'set_active', id: u.id, active: u.active === false }); await loadMaster('profiles'); closeSheet(); toast(u.active === false ? 'Đã mở khóa' : 'Đã khóa tài khoản'); V.perm(); } catch (x) { e(x.message); } });
  $('#a-reset') && ($('#a-reset').onclick = async () => { try { const r = await callAdmin({ action: 'reset_password', id: u.id }); await loadMaster('profiles'); showPw(u.ho_ten, u.username, r.password); V.perm(); } catch (x) { e(x.message); } });
}
function showPw(ho, un, pw) {
  openSheet(`<div class="row between"><h2>Thông tin đăng nhập</h2><button class="btn sm" id="close">Đóng</button></div>
  <p>${esc(ho)}</p><div class="field"><label>Tên đăng nhập</label><div class="pwbox">${esc(un)}</div></div>
  <div class="field"><label>Mật khẩu tạm (chỉ hiện một lần)</label><div class="pwbox">${esc(pw)}</div></div>
  <p class="note">Gửi trực tiếp cho người dùng (Zalo riêng / đưa tận tay). Lần đầu đăng nhập hệ thống bắt đổi mật khẩu. Đóng cửa sổ này là không xem lại được.</p>
  <button class="btn" id="pw-copy">Sao chép</button>`);
  $('#pw-copy').onclick = () => navigator.clipboard?.writeText(`ERP Quatar\nTên đăng nhập: ${un}\nMật khẩu tạm: ${pw}\n${location.origin + location.pathname}`).then(() => toast('Đã sao chép'));
}

// ---------- TỒN KHO ----------
let stState = { q: '', kho: '', mode: 'item' };
V.stock = async () => {
  await loadLots(); const st = stState, its = Object.fromEntries(items().map(i => [i.code, i]));
  let L = LOTS.map(l => ({ ...l, wh: whOf(l.location_id), it: its[l.item_code] }));
  if (st.kho) L = L.filter(l => l.wh === st.kho);
  if (st.q) { const q = noAcc(st.q); L = L.filter(l => noAcc(l.item_code + ' ' + (l.it?.ten || '') + ' ' + l.lot_code + ' ' + l.location_id).includes(q)); }
  let body;
  if (st.mode === 'item') {
    const g = {}; L.forEach(l => { const k = l.item_code; g[k] ||= { code: k, it: l.it, q: 0, v: 0, qq: 0, locs: new Set() }; if (isQuar(l.location_id)) g[k].qq += +l.qty; else { g[k].q += +l.qty; g[k].locs.add(l.location_id); } g[k].v += l.qty * l.don_gia; });
    const rows = Object.values(g).sort((a, b) => a.code.localeCompare(b.code));
    body = `<thead><tr><th>Mã</th><th>Tên hàng</th><th class="n">Tồn khả dụng</th><th class="n">Cách ly</th><th>Vị trí</th><th class="n">Giá trị</th><th>Cảnh báo</th></tr></thead><tbody>${rows.map(r => { const min = D.products.find(p => p.sku === r.code)?.muc_bao_ton ?? D.materials.find(m => m.ma === r.code)?.muc_bao_ton; return `<tr><td data-l="Mã">${esc(r.code)}</td><td data-l="Tên">${esc(r.it?.ten || '')}</td><td class="n" data-l="Tồn">${num(r.q, 2)} ${esc(r.it?.dvt || '')}</td><td class="n" data-l="Cách ly">${r.qq ? num(r.qq, 2) : ''}</td><td data-l="Vị trí">${esc([...r.locs].join(', '))}</td><td class="n" data-l="Giá trị">${vnd(r.v)}</td><td>${min && r.q < min ? `<span class="pill p-bad">Dưới tồn tối thiểu ${num(min)}</span>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Chưa có tồn. Nạp tồn đầu kỳ bằng phiếu Nhập kho → loại "Nhập khác".</td></tr>'}</tbody>`;
  } else {
    L.sort((a, b) => a.item_code.localeCompare(b.item_code) || String(a.ngay_nhap).localeCompare(String(b.ngay_nhap)));
    body = `<thead><tr><th>Mã</th><th>Tên hàng</th><th>Lô</th><th>Vị trí</th><th>Ngày nhập</th><th>Hạn dùng</th><th class="n">Số lượng</th><th class="n">Đơn giá</th></tr></thead><tbody>${L.map(l => `<tr class="${isQuar(l.location_id) ? 'off' : ''}"><td data-l="Mã">${esc(l.item_code)}</td><td data-l="Tên">${esc(l.it?.ten || '')}</td><td data-l="Lô">${esc(l.lot_code)}</td><td data-l="Vị trí">${esc(l.location_id)}${isQuar(l.location_id) ? ' <span class="pill p-bad">cách ly</span>' : ''}</td><td data-l="Ngày nhập">${fdate(l.ngay_nhap)}</td><td data-l="Hạn dùng">${fdate(l.han_dung)}</td><td class="n" data-l="SL">${num(l.qty, 2)} ${esc(l.it?.dvt || '')}</td><td class="n" data-l="Đơn giá">${vnd(l.don_gia)}</td></tr>`).join('') || '<tr><td colspan="8" class="note">Không có lô nào.</td></tr>'}</tbody>`;
  }
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><div class="row"><input id="sq" placeholder="Tìm mã, tên, lô, vị trí…" value="${esc(st.q)}" style="min-width:220px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px">
   <div class="chips">${[['', 'Tất cả kho'], ...D.warehouses.map(w => [w.id, w.ten])].map(([k, t]) => `<span class="chip ${st.kho === k ? 'on' : ''}" data-kho="${k}">${esc(t)}</span>`).join('')}</div></div>
   <div class="chips"><span class="chip ${st.mode === 'item' ? 'on' : ''}" data-mode="item">Theo mặt hàng</span><span class="chip ${st.mode === 'lot' ? 'on' : ''}" data-mode="lot">Chi tiết lô</span></div></div>
   <div class="scroll"><table class="stack">${body}</table></div><p class="note">Hàng trong kho cách ly không tính vào tồn khả dụng và không được xuất FIFO.</p>`;
  $$('[data-kho]').forEach(b => b.onclick = () => { st.kho = b.dataset.kho; V.stock(); });
  $$('[data-mode]').forEach(b => b.onclick = () => { st.mode = b.dataset.mode; V.stock(); });
  const q = $('#sq'); q.onchange = () => { st.q = q.value; V.stock(); };
};

// ---------- PHIẾU KHO: NHẬP / XUẤT / ĐIỀU CHUYỂN ----------
const VTYPES = {
  N: { 'Nhập mua': 'ncc', 'Nhập hàng trả lại': 'kh', 'Nhập khác': 'khac' },
  X: { 'Xuất bán': 'kh', 'Xuất mẫu / khuyến mãi': 'kh', 'Xuất nội bộ': 'bp', 'Xuất bổ sung cho SX': 'bp', 'Xuất trả NCC': 'ncc', 'Xuất khác': 'khac' },
  C: { 'Chuyển vị trí': null, 'Chuyển kho': null }
};
const VNAME = { N: 'Phiếu nhập kho', X: 'Phiếu xuất kho', C: 'Phiếu điều chuyển' };
const DTN = { ncc: 'Nhà cung cấp', kh: 'Khách hàng / đại lý', bp: 'Bộ phận nhận', khac: 'Người giao / nhận' };
const STN = { nhap: ['Nháp', 'p-wait'], da_ghi: ['Đã ghi sổ', 'p-ok'], da_huy: ['Đã hủy', 'p-bad'] };
const dirOf = loai => /^Nhập/.test(loai) ? 'N' : /^Chuyển/.test(loai) ? 'C' : 'X';
const MOD = { N: 'nhap', X: 'xuat', C: 'chuyen' };
let vState = { st: '', q: '' };
V.nhap = () => vList('N'); V.xuat = () => vList('X'); V.chuyen = () => vList('C');
async function vList(dir) {
  const { data, error } = await SB.from('stock_docs').select('*, stock_doc_lines(qty,don_gia)').order('ts', { ascending: false }).limit(400);
  if (error) throw error;
  let ds = (data || []).filter(d => dirOf(d.loai) === dir);
  const st = vState; if (st.st) ds = ds.filter(d => (d.status || 'da_ghi') === st.st);
  if (st.q) { const q = noAcc(st.q); ds = ds.filter(d => noAcc([d.id, d.loai, d.doi_tuong_ten, d.ref, d.dien_giai].join(' ')).includes(q)); }
  const tot = d => (d.stock_doc_lines || []).reduce((a, l) => a + l.qty * l.don_gia, 0);
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><div class="row"><input id="vq" placeholder="Tìm số phiếu, đối tượng, chứng từ…" value="${esc(st.q)}" style="min-width:220px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px">
   <div class="chips">${[['', 'Tất cả'], ['nhap', 'Nháp'], ['da_ghi', 'Đã ghi sổ'], ['da_huy', 'Đã hủy']].map(([k, t]) => `<span class="chip ${st.st === k ? 'on' : ''}" data-vst="${k}">${t}</span>`).join('')}</div></div>
   ${can(MOD[dir], 'T') ? `<button class="btn pri" id="vnew">+ Lập ${VNAME[dir].toLowerCase()}</button>` : ''}</div>
  <div class="scroll"><table class="stack"><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Loại</th><th>${dir === 'C' ? 'Kho' : 'Đối tượng'}</th><th>Chứng từ gốc</th>${dir === 'C' ? '' : '<th class="n">Giá trị</th>'}<th>Trạng thái</th></tr></thead><tbody>
  ${ds.map(d => { const s = STN[d.status || 'da_ghi']; return `<tr class="click" data-doc="${esc(d.id)}"><td data-l="Số phiếu"><b>${esc(d.id)}</b>${d.tu_dong ? '<br><span class="tag">tự sinh</span>' : ''}</td><td data-l="Ngày">${fdate(d.ngay || d.ts)}</td><td data-l="Loại">${esc(d.loai)}</td><td data-l="${dir === 'C' ? 'Kho' : 'Đối tượng'}">${dir === 'C' ? esc((D.warehouses.find(w => w.id === d.kho)?.ten || d.kho || '') + (d.kho_den && d.kho_den !== d.kho ? ' → ' + (D.warehouses.find(w => w.id === d.kho_den)?.ten || d.kho_den) : '')) : esc(d.doi_tuong_ten || '')}</td><td data-l="Chứng từ gốc">${esc(d.ref || '')}</td>${dir === 'C' ? '' : `<td class="n" data-l="Giá trị">${d.stock_doc_lines?.length ? vnd(tot(d)) : ''}</td>`}<td><span class="pill ${s[1]}">${s[0]}</span></td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Chưa có phiếu.</td></tr>'}
  </tbody></table></div><p class="note">${ds.length} phiếu. Phiếu tự sinh (IQC, sản xuất, xuất bán theo đơn, kiểm kê) sẽ xuất hiện ở đây khi các phân hệ đó được bật.</p>`;
  $$('[data-vst]').forEach(b => b.onclick = () => { st.st = b.dataset.vst; vList(dir); });
  const q = $('#vq'); q.onchange = () => { st.q = q.value; vList(dir); };
  $('#vnew') && ($('#vnew').onclick = () => vNew(dir));
  $$('[data-doc]').forEach(tr => tr.onclick = () => vOpen(tr.dataset.doc));
}
const defKho = (dir, loai) => dir === 'X' && /bán|mẫu/.test(loai) ? 'KHO-TP' : dir === 'N' && loai === 'Nhập mua' ? 'KHO-NVL' : D.warehouses.find(w => !w.cach_ly && w.active !== false)?.id;
const newLine = () => ({ it: '', vt: '', vt2: '', q: '', gia: '', edited: false });
let VF = null;
async function vNew(dir, src) {
  await loadLots();
  if (src) VF = src; else { const loai = Object.keys(VTYPES[dir])[0]; VF = { dir, loai, ngay: today(), dt: null, kho: defKho(dir, loai), kho2: defKho(dir, loai), ref: '', dg: '', lines: [newLine()] }; }
  vForm();
}
const dtList = k => k === 'kh' ? D.dealers.filter(x => x.active !== false).map(x => ({ id: x.id, ten: x.ten, dc: x.dia_chi, sdt: x.sdt, mst: x.mst, x }))
  : k === 'ncc' ? D.suppliers.filter(x => x.active !== false).map(x => ({ id: x.id, ten: x.ten, dc: x.dia_chi, sdt: x.sdt, mst: x.mst, x }))
    : k === 'bp' ? D.departments.filter(x => x.active !== false).map(x => ({ id: x.id, ten: x.ten })) : [];
function dtInfo(dt) {
  if (!dt || !dt.id) return dt && dt.ten && VTYPES[VF.dir][VF.loai] !== 'khac' ? '<div class="note bad">Chưa khớp danh mục – chọn trong danh sách gợi ý</div>' : '';
  const x = dt.x || {}, nv = x.nvkd_id ? userName(x.nvkd_id) : '';
  return `<div class="card" style="margin-top:6px;padding:10px 12px;font-size:14px">${dt.dc ? `<div><b>Địa chỉ:</b> ${esc(dt.dc)}</div>` : ''}${dt.sdt || dt.mst ? `<div>${dt.sdt ? `<b>Điện thoại:</b> ${esc(dt.sdt)}` : ''}${dt.mst ? ` · <b>MST:</b> ${esc(dt.mst)}` : ''}</div>` : ''}${nv ? `<div><b>NVKD:</b> ${esc(nv)}</div>` : ''}${x.han_muc ? `<div><b>Hạn mức nợ:</b> ${vnd(x.han_muc)} · hạn ${x.han_no_ngay || 0} ngày</div>` : ''}${!dt.dc && !dt.sdt && !nv ? '<span class="note">Chưa có địa chỉ / SĐT trong danh mục</span>' : ''}</div>`;
}
const priceOf = (code, loai) => { const i = item(code); if (!i) return 0; return loai === 'Xuất bán' ? i.gia_ban || 0 : i.gia_von || 0; };
const khoItems = kho => { const w = D.warehouses.find(x => x.id === kho); return items().filter(i => i.active && (!w?.loai || i.kind === w.loai)); };
const khoLocs = kho => D.locations.filter(l => l.active !== false && (!kho || l.warehouse_id === kho));
function vTonTxt(l) {
  const t = ton(l.it), dv = item(l.it)?.dvt || '', q = +l.q || 0;
  if (VF.dir === 'N') return `Tồn: ${num(t, 2)} ${dv}${q > 0 ? ' → sau nhập ' + num(t + q, 2) + ' ' + dv : ''}`;
  return q > t ? `Tồn: ${num(t, 2)} ${dv} · thiếu ${num(q - t, 2)}` : `Tồn: ${num(t, 2)} ${dv}${q > 0 && VF.dir === 'X' ? ' → còn ' + num(t - q, 2) + ' ' + dv : ''}`;
}
function vRow(l, i) {
  const d = VF, dir = d.dir, it = item(l.it), over = it && dir !== 'N' && +l.q > ton(l.it);
  const locIn = (k, val, lbl) => `<label>${lbl}<div class="vitem"><input class="ac" data-vac="${i}|${k}" value="${esc(val || '')}" placeholder="Gõ để chọn…" autocomplete="off"><div class="acl" id="vacl-${i}-${k}"></div></div></label>`;
  return `<div class="vline"><div class="vhead"><span class="vno">${i + 1}</span><div class="vitem"><input class="ac" data-ac="${i}" value="${esc(it ? it.ten : '')}" placeholder="Gõ tên hoặc mã hàng để chọn…" autocomplete="off" aria-label="Mặt hàng dòng ${i + 1}"><div class="acl" id="acl-${i}"></div>${it ? `<div class="note">${esc(it.code)} · ${esc(it.dvt)}</div>` : ''}</div><button class="btn sm" data-vdel="${i}" aria-label="Xóa dòng">✕</button></div>
  <div class="vgrid">${locIn('vt', l.vt, dir === 'C' ? 'Từ vị trí' : 'Vị trí')}${dir === 'C' ? locIn('vt2', l.vt2, 'Đến vị trí') : ''}
  <label>Số lượng${it ? ' (' + esc(it.dvt) + ')' : ''}<input type="number" inputmode="decimal" step="any" data-vl="${i}|q" value="${l.q}" style="${over ? 'border-color:var(--coral)' : ''}"><span class="vton ${over ? 'bad' : ''}" id="ton-${i}">${it ? vTonTxt(l) : ''}</span></label>
  ${dir === 'C' ? '' : `<label>Đơn giá ${d.loai === 'Xuất bán' ? '(giá bán)' : d.loai === 'Nhập mua' ? '(giá nhập)' : '(giá vốn)'}<input type="number" inputmode="numeric" step="any" data-vl="${i}|gia" value="${l.gia}" style="${l.edited ? 'border-color:var(--amber)' : ''}"></label><label>Thành tiền<span class="vtt" id="tt-${i}">${l.q && l.gia ? vnd(l.q * l.gia) : '—'}</span></label>`}</div>
  ${l.edited ? '<div class="note" style="color:var(--amber)">Đã sửa đơn giá khác danh mục</div>' : ''}</div>`;
}
function vForm() {
  const d = VF, dir = d.dir, dk = VTYPES[dir][d.loai], kh = D.warehouses.filter(w => w.active !== false);
  openSheet(`<div class="row between"><h2>${d.id ? 'Sửa ' + esc(d.id) : 'Lập ' + VNAME[dir].toLowerCase()}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div class="f2">
   <div class="field"><label for="vf-loai">Loại phiếu</label><select id="vf-loai">${Object.keys(VTYPES[dir]).map(t => `<option ${t === d.loai ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
   <div class="field"><label for="vf-ngay">Ngày chứng từ</label><input id="vf-ngay" type="date" value="${d.ngay}"></div>
   ${dk ? `<div class="field full"><label for="vf-dt">${DTN[dk]}${dk !== 'khac' ? ' *' : ''}</label>${dk === 'khac' ? `<input id="vf-dt" value="${esc(d.dt?.ten || '')}" placeholder="Họ tên / đơn vị">` : `<input id="vf-dt" list="dl-dt" value="${esc(d.dt?.ten || '')}" placeholder="Gõ tên hoặc mã để chọn từ danh mục…" autocomplete="off"><datalist id="dl-dt">${dtList(dk).map(o => `<option value="${esc(o.ten)}">${esc(o.id)}</option>`).join('')}</datalist>`}<div id="vf-dtinfo">${dtInfo(d.dt)}</div></div>` : ''}
   <div class="field"><label for="vf-kho">${dir === 'C' ? 'Kho đi' : 'Kho'}</label><select id="vf-kho">${kh.map(w => `<option value="${w.id}" ${w.id === d.kho ? 'selected' : ''}>${esc(w.ten)}</option>`).join('')}</select></div>
   ${dir === 'C' && d.loai === 'Chuyển kho' ? `<div class="field"><label for="vf-kho2">Kho đến</label><select id="vf-kho2">${kh.map(w => `<option value="${w.id}" ${w.id === d.kho2 ? 'selected' : ''}>${esc(w.ten)}</option>`).join('')}</select></div>` : '<div></div>'}
   <div class="field"><label for="vf-ref">Chứng từ gốc</label><input id="vf-ref" value="${esc(d.ref)}" placeholder="${dir === 'N' ? 'vd: HĐ 0001234, PO-2611-031' : dir === 'X' ? 'vd: DH-2611-0140' : 'vd: dồn kho'}"></div>
   <div class="field"><label for="vf-dg">Diễn giải</label><input id="vf-dg" value="${esc(d.dg)}" placeholder="${d.loai === 'Nhập khác' ? 'vd: Tồn đầu kỳ' : ''}"></div>
  </div>
  <div style="margin-top:6px">${d.lines.map(vRow).join('')}</div>
  <button class="btn sm" id="vf-add" style="margin-top:8px">+ Thêm dòng</button>
  <div class="card" style="margin-top:12px" id="vf-sum"></div>
  <div class="err bad" id="vf-err" style="min-height:20px;margin-top:6px"></div>
  <div class="row"><button class="btn pri" id="vf-post">Ghi sổ</button><button class="btn" id="vf-draft">Lưu nháp</button></div>
  <p class="note">${d.loai === 'Nhập mua' ? 'NVL nhập mua tự tạo phiếu IQC chờ lấy mẫu.' : d.loai === 'Nhập hàng trả lại' ? 'Hàng trả lại tự vào khu cách ly và tạo phiếu hàng lỗi.' : dir === 'X' ? 'Xuất tự lấy lô cũ trước (FIFO). Đơn giá tự lấy từ danh mục, sửa được; không xuất quá tồn.' : dir === 'N' ? 'Số lô tự đánh theo mã hàng và ngày nhập.' : 'Điều chuyển không đổi tổng tồn, chỉ đổi kho / vị trí.'}</p>`, true);
  vBind(); vSum();
}
function vSum() { const L = VF.lines.filter(l => l.it), t = L.reduce((a, l) => a + (+l.q || 0) * (+l.gia || 0), 0); $('#vf-sum').innerHTML = `<div class="row between"><span>${L.length} mặt hàng</span>${VF.dir === 'C' ? '' : `<b style="font-size:18px">Tổng tiền: ${vnd(t)}</b>`}</div>`; VF.lines.forEach((l, i) => { const c = $('#tt-' + i); if (c) c.textContent = l.q && l.gia ? vnd(l.q * l.gia) : '—'; }); }
function readHead() {
  const d = VF; d.ngay = $('#vf-ngay').value; d.kho = $('#vf-kho').value; const k2 = $('#vf-kho2'); d.kho2 = k2 ? k2.value : d.kho; d.ref = $('#vf-ref').value.trim(); d.dg = $('#vf-dg').value.trim();
  const dt = $('#vf-dt'), dk = VTYPES[d.dir][d.loai];
  if (dt) { const v = dt.value.trim(), o = dtList(dk).find(o => o.ten === v || o.id === v); d.dt = v ? (o ? { ...o, k: dk } : { k: dk, id: '', ten: v }) : null; } else d.dt = null;
}
function acBox(inp, box, list, render, pick) {
  const show = () => { const q = noAcc(inp.value), ls = list().filter(x => !q || noAcc(x.s).includes(q)).slice(0, 10); box.innerHTML = ls.length ? ls.map((x, j) => `<button type="button" data-j="${j}">${render(x)}</button>`).join('') : '<div class="note" style="padding:8px">Không có trong danh mục.</div>'; box.classList.add('on'); $$('[data-j]', box).forEach(b => b.onmousedown = e => { e.preventDefault(); box.classList.remove('on'); pick(ls[+b.dataset.j]); }); };
  inp.addEventListener('input', show); inp.addEventListener('focus', show); inp.addEventListener('blur', () => setTimeout(() => box.classList.remove('on'), 150));
}
function vBind() {
  $('#vf-loai').onchange = e => { readHead(); VF.loai = e.target.value; VF.kho = defKho(VF.dir, VF.loai) || VF.kho; VF.dt = null; VF.lines.forEach(l => { if (l.it && !l.edited) l.gia = priceOf(l.it, VF.loai); }); vForm(); };
  const dti = $('#vf-dt'); if (dti) dti.oninput = dti.onchange = () => { readHead(); $('#vf-dtinfo').innerHTML = dtInfo(VF.dt); };
  $('#vf-kho').onchange = () => { readHead(); vForm(); }; $('#vf-kho2') && ($('#vf-kho2').onchange = () => { readHead(); vForm(); });
  $('#vf-add').onclick = () => { readHead(); VF.lines.push(newLine()); vForm(); const a = $$('#sheet [data-ac]'); a.at(-1)?.focus(); };
  $$('#sheet [data-vdel]').forEach(b => b.onclick = () => { readHead(); VF.lines.splice(+b.dataset.vdel, 1); if (!VF.lines.length) VF.lines.push(newLine()); vForm(); });
  $$('#sheet [data-vl]').forEach(el => el.oninput = () => {
    const [i, k] = el.dataset.vl.split('|'), l = VF.lines[+i]; l[k] = el.value === '' ? '' : +el.value;
    if (k === 'gia') l.edited = l.gia !== priceOf(l.it, VF.loai);
    if (k === 'q' && l.it) { const t = $('#ton-' + i), ov = VF.dir !== 'N' && +l.q > ton(l.it); t.textContent = vTonTxt(l); t.classList.toggle('bad', ov); el.style.borderColor = ov ? 'var(--coral)' : ''; }
    vSum();
  });
  $$('#sheet [data-ac]').forEach(inp => {
    const i = +inp.dataset.ac;
    acBox(inp, $('#acl-' + i), () => khoItems(VF.kho).map(x => ({ ...x, s: x.code + ' ' + x.ten })), x => `<b>${esc(x.ten)}</b><span>${esc(x.code)} · ${esc(x.dvt)} · tồn ${num(ton(x.code), 2)}</span>`, x => {
      readHead(); const l = VF.lines[i]; l.it = x.code; l.gia = priceOf(x.code, VF.loai); l.edited = false;
      const has = (LOTS || []).filter(z => z.item_code === x.code && whOf(z.location_id) === VF.kho && +z.qty > 0).sort((a, b) => String(a.ngay_nhap).localeCompare(String(b.ngay_nhap)));
      l.vt = VF.dir === 'N' ? (x.vt && whOf(x.vt) === VF.kho ? x.vt : '') : (has.find(z => z.location_id === x.vt)?.location_id || has[0]?.location_id || '');
      vForm(); $(`#sheet [data-vl="${i}|q"]`)?.focus();
    });
  });
  $$('#sheet [data-vac]').forEach(inp => {
    const [i, k] = inp.dataset.vac.split('|'), kho = k === 'vt2' && VF.loai === 'Chuyển kho' ? VF.kho2 : VF.kho;
    inp.addEventListener('input', () => VF.lines[+i][k] = inp.value.trim());
    acBox(inp, $(`#vacl-${i}-${k}`), () => khoLocs(kho).map(x => ({ ...x, s: x.id + ' ' + (x.mo_ta || '') })), x => `<b>${esc(x.id)}</b><span>${esc(D.warehouses.find(w => w.id === x.warehouse_id)?.ten || '')}${x.mo_ta ? ' · ' + esc(x.mo_ta) : ''}</span>`, x => { VF.lines[+i][k] = x.id; inp.value = x.id; });
  });
  $('#vf-draft').onclick = () => vSave(false); $('#vf-post').onclick = () => vSave(true);
}
async function vSave(post) {
  readHead(); const d = VF, dk = VTYPES[d.dir][d.loai], e = t => { $('#vf-err').textContent = t; }, L = d.lines.filter(l => l.it);
  if (!L.length) return e('Chưa có mặt hàng nào');
  if (L.some(l => !(+l.q > 0))) return e('Số lượng phải lớn hơn 0');
  if (post) {
    if (dk && dk !== 'khac' && !d.dt?.id) return e('Chọn ' + DTN[dk].toLowerCase() + ' từ danh mục');
    
    const ids = new Set(D.locations.map(x => x.id)), bad = L.find(l => (l.vt && !ids.has(l.vt)) || (l.vt2 && !ids.has(l.vt2)));
    if (bad) return e(`Vị trí "${bad.vt2 && !ids.has(bad.vt2) ? bad.vt2 : bad.vt}" chưa có trong danh mục`);
    if (d.dir === 'N' && d.loai !== 'Nhập hàng trả lại' && L.some(l => !l.vt)) return e('Chọn vị trí nhập cho từng dòng');
    if (d.dir === 'C' && L.some(l => !l.vt2 || (l.vt2 === l.vt && d.loai === 'Chuyển vị trí'))) return e('Chọn vị trí đến khác vị trí đi');
    if (d.dir !== 'N') { const need = {}; L.forEach(l => need[l.it] = (need[l.it] || 0) + (+l.q)); const over = Object.keys(need).find(c => need[c] > ton(c) + 1e-9); if (over) return e(`Không đủ tồn ${item(over)?.ten}: còn ${num(ton(over), 2)} ${item(over)?.dvt}`); }
  }
  const p = { id: d.id || null, offline_id: d.oid ||= (crypto.randomUUID?.() || null), loai: d.loai, ngay: d.ngay, kho: d.kho, kho_den: d.dir === 'C' ? d.kho2 : null, ref: d.ref || null, dien_giai: d.dg || null,
    doi_tuong: dk ? { loai: dk, id: d.dt?.id || '', ten: d.dt?.ten || '' } : {},
    lines: L.map(l => ({ item: l.it, vi_tri: l.vt || null, vi_tri_den: l.vt2 || null, qty: +l.q, don_gia: l.gia === '' ? null : +l.gia })) };
  $('#vf-post').disabled = $('#vf-draft').disabled = true;
  const r1 = await SB.rpc('stock_voucher_save', { p });
  if (r1.error) { $('#vf-post').disabled = $('#vf-draft').disabled = false; return e(errMsg(r1.error)); }
  d.id = r1.data;
  if (post) { const r2 = await SB.rpc('stock_voucher_post', { p_id: d.id }); if (r2.error) { $('#vf-post').disabled = $('#vf-draft').disabled = false; return e('Đã lưu nháp ' + d.id + ' nhưng chưa ghi sổ được: ' + errMsg(r2.error)); } }
  closeSheet(); toast(`${d.id}: ${post ? 'Đã ghi sổ' : 'Đã lưu nháp'}`); VF = null; LOTS = null; route();
}
async function vOpen(id) {
  const [{ data: d }, { data: L }, { data: M }] = await Promise.all([
    SB.from('stock_docs').select('*').eq('id', id).single(),
    SB.from('stock_doc_lines').select('*').eq('doc_id', id).order('stt'),
    SB.from('stock_moves').select('qty,don_gia,lot_id,stock_lots(item_code,lot_code,location_id)').eq('doc_id', id)]);
  if (!d) return toast('Không mở được phiếu');
  const dir = dirOf(d.loai), st = d.status || 'da_ghi', s = STN[st], dk = VTYPES[dir]?.[d.loai];
  const rows = (L && L.length ? L.map(l => ({ it: l.item_code, lot: '', vt: l.vi_tri, vt2: l.vi_tri_den, q: +l.qty, gia: +l.don_gia, ed: l.gia_danh_muc != null && +l.gia_danh_muc !== +l.don_gia }))
    : (M || []).filter(m => dir === 'C' ? m.qty < 0 : true).map(m => ({ it: m.stock_lots?.item_code, lot: m.stock_lots?.lot_code, vt: m.stock_lots?.location_id, q: Math.abs(+m.qty), gia: +m.don_gia || 0 })));
  const lots = {}; (M || []).forEach(m => { const k = m.stock_lots?.item_code; if (k) (lots[k] ||= new Set()).add(m.stock_lots.lot_code); });
  const tot = rows.reduce((a, r) => a + r.q * r.gia, 0), wn = w => D.warehouses.find(x => x.id === w)?.ten || w || '';
  openSheet(`<div class="row between"><h2>${esc(d.id)}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div><span class="pill ${s[1]}">${s[0]}</span> <span class="note">· ${esc(d.loai)} · ngày ${fdate(d.ngay || d.ts)} · lập bởi ${esc(userName(d.user_id))}${d.tu_dong ? ' · tự sinh' : ''}</span></div>
  <div class="card" style="margin:12px 0">${dir !== 'C' && d.doi_tuong_ten ? `<b>${DTN[d.doi_tuong_loai] || DTN[dk] || 'Đối tượng'}:</b> ${esc(d.doi_tuong_ten)}<br>` : ''}${d.doi_tuong_dc ? `<b>Địa chỉ:</b> ${esc(d.doi_tuong_dc)}<br>` : ''}${d.doi_tuong_sdt || d.doi_tuong_mst ? `${d.doi_tuong_sdt ? '<b>Điện thoại:</b> ' + esc(d.doi_tuong_sdt) : ''}${d.doi_tuong_mst ? ' · <b>MST:</b> ' + esc(d.doi_tuong_mst) : ''}<br>` : ''}<b>Kho:</b> ${esc(wn(d.kho))}${d.kho_den && d.kho_den !== d.kho ? ' → ' + esc(wn(d.kho_den)) : ''}<br><b>Chứng từ gốc:</b> ${esc(d.ref || '—')}${d.dien_giai ? `<br><b>Diễn giải:</b> ${esc(d.dien_giai)}` : ''}${d.ly_do_huy ? `<br><b class="bad">Lý do hủy:</b> ${esc(d.ly_do_huy)} (${esc(userName(d.huy_boi))}, ${ftime(d.huy_luc)})` : ''}</div>
  <div class="scroll"><table><thead><tr><th>#</th><th>Mặt hàng</th><th>Vị trí</th><th>Lô</th><th class="n">SL</th>${dir === 'C' ? '' : '<th class="n">Đơn giá</th><th class="n">Thành tiền</th>'}</tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(item(r.it)?.ten || r.it)}<br><span class="note">${esc(r.it)}</span></td><td>${esc(r.vt || '')}${r.vt2 ? ' → ' + esc(r.vt2) : ''}</td><td>${esc(r.lot || [...(lots[r.it] || [])].join(', '))}</td><td class="n">${num(r.q, 3)} ${esc(item(r.it)?.dvt || '')}</td>${dir === 'C' ? '' : `<td class="n">${vnd(r.gia)}${r.ed ? '<br><span class="note">đã sửa</span>' : ''}</td><td class="n">${vnd(r.q * r.gia)}</td>`}</tr>`).join('')}
  ${dir === 'C' ? '' : `<tr><td colspan="6"><b>Tổng cộng</b></td><td class="n"><b>${vnd(tot)}</b></td></tr>`}</tbody></table></div>
  <div class="err bad" id="vo-err" style="min-height:20px"></div>
  <div class="row" style="margin-top:8px">${st === 'nhap' && can(MOD[dir], 'T') ? '<button class="btn pri" id="vo-edit">Mở để sửa / ghi sổ</button><button class="btn bad" id="vo-del">Xóa nháp</button>' : ''}${st !== 'nhap' ? '<button class="btn" id="vo-print">In phiếu</button>' : ''}${st === 'da_ghi' && !d.tu_dong && ME.role === 'ceo' ? '<input id="vo-reason" placeholder="Lý do hủy phiếu" style="flex:1;min-width:160px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px"><button class="btn bad" id="vo-cancel">Hủy phiếu</button>' : ''}</div>`, true);
  const e = t => $('#vo-err').textContent = t;
  $('#vo-edit') && ($('#vo-edit').onclick = async () => { await loadLots(); VF = { id: d.id, oid: d.offline_id, dir, loai: d.loai, ngay: d.ngay, kho: d.kho, kho2: d.kho_den || d.kho, ref: d.ref || '', dg: d.dien_giai || '', dt: d.doi_tuong_ten ? { k: d.doi_tuong_loai, id: d.doi_tuong_id || '', ten: d.doi_tuong_ten, dc: d.doi_tuong_dc, sdt: d.doi_tuong_sdt, mst: d.doi_tuong_mst } : null, lines: (L || []).map(l => ({ it: l.item_code, vt: l.vi_tri || '', vt2: l.vi_tri_den || '', q: +l.qty, gia: +l.don_gia, edited: l.gia_danh_muc != null && +l.gia_danh_muc !== +l.don_gia })) }; if (!VF.lines.length) VF.lines.push(newLine()); vForm(); });
  $('#vo-del') && ($('#vo-del').onclick = async () => { const b = $('#vo-del'); if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Bấm lần nữa để xóa'; return; } const { error } = await SB.rpc('stock_voucher_delete_draft', { p_id: d.id }); if (error) return e(errMsg(error)); closeSheet(); toast('Đã xóa nháp'); route(); });
  $('#vo-cancel') && ($('#vo-cancel').onclick = async () => { const r = $('#vo-reason').value.trim(); if (!r) return e('Nhập lý do hủy'); const { error } = await SB.rpc('stock_voucher_cancel', { p_id: d.id, p_ly_do: r }); if (error) return e(errMsg(error)); closeSheet(); toast('Đã hủy phiếu, tồn kho đã đảo lại'); LOTS = null; route(); });
  $('#vo-print') && ($('#vo-print').onclick = () => vPrint(d, rows, lots, tot));
}
function vPrint(d, rows, lots, tot) {
  const dir = dirOf(d.loai), w = window.open('', '_blank'); if (!w) return toast('Trình duyệt chặn cửa sổ in');
  const wn = x => D.warehouses.find(y => y.id === x)?.ten || x || '';
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(d.id)}</title><style>body{font:13px/1.45 "Times New Roman",serif;margin:28px;color:#000}h1{text-align:center;font-size:20px;margin:6px 0}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #000;padding:4px 6px}th{background:#eee}.n{text-align:right}.sig{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;margin-top:28px}.sig div{min-height:90px}.top{display:flex;justify-content:space-between}</style></head><body>
  <div class="top"><div><b>CN CÔNG TY CP XNK NÔNG NGHIỆP QUATAR</b><br>Quatar Crop Science</div><div style="text-align:right">Số: <b>${esc(d.id)}</b><br>Ngày: ${fdate(d.ngay || d.ts)}</div></div>
  <h1>${VNAME[dir].toUpperCase()}</h1><p style="text-align:center;margin:0">${esc(d.loai)}</p>
  <p>${d.doi_tuong_ten ? `${DTN[d.doi_tuong_loai] || 'Đối tượng'}: <b>${esc(d.doi_tuong_ten)}</b><br>` : ''}${d.doi_tuong_dc ? `Địa chỉ: ${esc(d.doi_tuong_dc)}<br>` : ''}${d.doi_tuong_sdt ? `Điện thoại: ${esc(d.doi_tuong_sdt)}${d.doi_tuong_mst ? ' – MST: ' + esc(d.doi_tuong_mst) : ''}<br>` : ''}Kho: ${esc(wn(d.kho))}${d.kho_den && d.kho_den !== d.kho ? ' → ' + esc(wn(d.kho_den)) : ''}<br>Chứng từ gốc: ${esc(d.ref || '')}${d.dien_giai ? '<br>Diễn giải: ' + esc(d.dien_giai) : ''}</p>
  <table><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th><th>Vị trí</th><th>Lô</th><th class="n">Số lượng</th>${dir === 'C' ? '' : '<th class="n">Đơn giá</th><th class="n">Thành tiền</th>'}</tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.it)}</td><td>${esc(item(r.it)?.ten || '')}</td><td>${esc(item(r.it)?.dvt || '')}</td><td>${esc(r.vt || '')}${r.vt2 ? ' → ' + esc(r.vt2) : ''}</td><td>${esc(r.lot || [...(lots[r.it] || [])].join(', '))}</td><td class="n">${num(r.q, 3)}</td>${dir === 'C' ? '' : `<td class="n">${num(r.gia)}</td><td class="n">${num(r.q * r.gia)}</td>`}</tr>`).join('')}
  ${dir === 'C' ? '' : `<tr><td colspan="8"><b>Tổng cộng</b></td><td class="n"><b>${num(tot)}</b></td></tr>`}</tbody></table>
  <div class="sig"><div><b>Người lập phiếu</b><br><i>(ký, họ tên)</i><br><br><br>${esc(userName(d.user_id))}</div><div><b>${dir === 'N' ? 'Người giao hàng' : 'Người nhận hàng'}</b><br><i>(ký, họ tên)</i></div><div><b>Thủ kho</b><br><i>(ký, họ tên)</i></div><div><b>Kế toán</b><br><i>(ký, họ tên)</i></div></div>
  ${d.status === 'da_huy' ? '<p style="color:red;font-weight:bold;text-align:center">PHIẾU ĐÃ HỦY</p>' : ''}<script>print()<\/script></body></html>`);
  w.document.close();
}

// ---------- ĐƠN HÀNG ----------
const OST = { cho_dong_bo: ['Chờ đồng bộ', 'p-wait'], cho_gsv: ['Chờ GSV duyệt', 'p-wait'], cho_kt: ['Chờ Kế toán duyệt', 'p-wait'], cho_ceo: ['Chờ CEO duyệt ngoại lệ', 'p-bad'], cho_sx: ['Chờ sản xuất', 'p-info'], cho_xuat: ['Chờ xếp xe', 'p-info'], xep_xe: ['Đã xếp xe – chờ xuất kho', 'p-info'], da_xuat: ['Đang giao', 'p-info'], da_giao: ['Đã giao – chờ ghi công nợ', 'p-wait'], hoan_tat: ['Hoàn tất', 'p-ok'], tra_lai: ['Bị trả lại', 'p-bad'], huy: ['Đã hủy', 'p-bad'] };
const OFLOW = [['cho_gsv', 'GSV duyệt'], ['cho_kt', 'Kế toán duyệt'], ['cho_xuat', 'Xếp xe'], ['xep_xe', 'Xuất kho'], ['da_xuat', 'Giao hàng'], ['da_giao', 'Ghi công nợ'], ['hoan_tat', 'Hoàn tất']];
const OACT = { cho_gsv: ['gsv', 'ceo'], cho_kt: ['ke_toan', 'ceo'], cho_ceo: ['ceo'], cho_xuat: ['ke_toan', 'ceo'], xep_xe: ['to_truong', 'ceo'], da_xuat: ['ke_toan', 'ceo'], da_giao: ['ke_toan', 'ceo'] };
const myTurn = o => OACT[o.status]?.includes(ME.role) || (o.status === 'tra_lai' && (o.created_by === ME.id || o.nvkd_id === ME.id || ['ceo', 'ke_toan'].includes(ME.role)));
const dlr = id => D.dealers?.find(d => d.id === id);
const prod = sku => D.products?.find(p => p.sku === sku);
const ckLimit = loai => { const p = (D.policy_periods || []).find(x => x.active); return +((D.ck_levels || []).find(c => c.period_id === p?.id && c.loai_dai_ly === loai)?.ck_max_pct || 0); };
let DEBT = {};
const opsRole = () => ['ceo', 'ke_toan', 'to_truong'].includes(ME?.role);
async function loadDebt() { const { data } = await SB.from('v_dealer_debt').select('*'); DEBT = Object.fromEntries((data || []).map(r => [r.dealer_id, r])); }
let oState = { tab: 'todo', q: '' };
V.orders = async () => {
  const [{ data, error }] = await Promise.all([SB.from('orders').select('*, order_lines(qty,gia)').order('created_at', { ascending: false }).limit(500), loadDebt(), opsRole() ? loadLots() : null]);
  if (error) throw error;
  const all = (data || []).map(o => ({ ...o, tien: (o.order_lines || []).reduce((a, l) => a + l.qty * l.gia, 0) * (1 - (+o.ck_pct || 0) / 100) }));
  const st = oState, groups = { todo: all.filter(myTurn), dang: all.filter(o => !['hoan_tat', 'huy'].includes(o.status)), xong: all.filter(o => o.status === 'hoan_tat'), huy: all.filter(o => o.status === 'huy'), all };
  let rs = groups[st.tab] || all;
  if (st.q) { const q = noAcc(st.q); rs = rs.filter(o => noAcc([o.id, dlr(o.dealer_id)?.ten, userName(o.nvkd_id), o.khuyen_mai].join(' ')).includes(q)); }
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><div class="row"><input id="oq" placeholder="Tìm số đơn, đại lý, NVKD…" value="${esc(st.q)}" style="min-width:220px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px">
   <div class="chips">${[['todo', 'Cần tôi xử lý'], ['dang', 'Đang xử lý'], ['xong', 'Hoàn tất'], ['huy', 'Đã hủy'], ['all', 'Tất cả']].map(([k, t]) => `<span class="chip ${st.tab === k ? 'on' : ''}" data-ot="${k}">${t} ${groups[k].length}</span>`).join('')}</div></div>
   ${can('orders', 'T') ? '<button class="btn pri" id="onew">+ Lên đơn mới</button>' : ''}</div>
  <div class="scroll"><table class="stack"><thead><tr><th>Số đơn</th><th>Ngày</th><th>Đại lý</th><th>NVKD</th><th class="n">Giá trị</th><th>Trạng thái</th></tr></thead><tbody>
  ${rs.map(o => `<tr class="click" data-oid="${esc(o.id)}"><td data-l="Số đơn"><b>${esc(o.id)}</b><br><span class="note">${esc(o.nguon || '')}</span></td><td data-l="Ngày">${ftime(o.created_at)}</td><td data-l="Đại lý">${esc(dlr(o.dealer_id)?.ten || o.dealer_id)}</td><td data-l="NVKD">${esc(userName(o.nvkd_id))}</td><td class="n" data-l="Giá trị">${vnd(o.tien)}</td><td><span class="pill ${OST[o.status]?.[1]}">${OST[o.status]?.[0] || o.status}</span>${o.vi_pham?.length ? ' <span class="pill p-bad">⚠ ' + o.vi_pham.length + '</span>' : ''}</td></tr>`).join('') || `<tr><td colspan="6" class="note">${st.tab === 'todo' ? 'Không có đơn nào chờ bạn xử lý.' : 'Chưa có đơn.'}</td></tr>`}
  </tbody></table></div><p class="note">${rs.length} đơn. Luồng: NVKD lên đơn → GSV duyệt → Kế toán duyệt cuối (vượt chính sách thì lên CEO) → đủ tồn thì xếp xe, thiếu thì tạo lệnh sản xuất → xuất kho → giao → ghi công nợ.</p>`;
  $$('[data-ot]').forEach(b => b.onclick = () => { st.tab = b.dataset.ot; V.orders(); });
  const q = $('#oq'); q.onchange = () => { st.q = q.value; V.orders(); };
  $('#onew') && ($('#onew').onclick = () => orderForm());
  $$('[data-oid]').forEach(tr => tr.onclick = () => orderOpen(tr.dataset.oid));
};
let OF = null;
function dealerCard(id) {
  const d = dlr(id); if (!d) return '';
  const db = DEBT[id] || {}, nv = userName(d.nvkd_id), lim = +d.han_muc || 0;
  return `<div class="card" style="margin-top:6px;padding:10px 12px;font-size:14px">${d.dia_chi ? `<div><b>Địa chỉ:</b> ${esc(d.dia_chi)}</div>` : ''}<div>${d.sdt ? `<b>Điện thoại:</b> ${esc(d.sdt)}` : '<span class="note">Chưa có SĐT</span>'}${d.mst ? ` · <b>MST:</b> ${esc(d.mst)}` : ''}</div>
  <div><b>Loại:</b> ${esc(d.loai)}${nv ? ` · <b>NVKD:</b> ${esc(nv)}` : ''} · <b>CK tối đa:</b> ${ckLimit(d.loai)}%</div>
  ${activeProgs(d.loai).length ? `<div><b>Chương trình:</b> ${activeProgs(d.loai).map(g => esc(dkText(g) + (tangText(g) ? ' → tặng ' + tangText(g) : '') + (g.ck_pct != null ? ' → CK ' + num(g.ck_pct, 2) + '%' : ''))).join('; ')}</div>` : ''}
  <div><b>Dư nợ:</b> ${vnd(db.du_no)} / hạn mức ${vnd(lim)}${+db.qua_han_ngay > 0 ? ` · <span class="bad">quá hạn ${db.qua_han_ngay} ngày (${vnd(db.qua_han_tien)})</span>` : ''}</div></div>`;
}
function orderForm(edit) {
  const dls = (D.dealers || []).filter(d => d.active !== false);
  if (ME.role === 'dai_ly') OF = edit || { dealer: ME.dealer_id, lines: [{ sku: '', q: '', gia: '' }], ck: null, km: '' };
  else OF = edit || { dealer: '', lines: [{ sku: '', q: '', gia: '' }], ck: null, km: '' };
  if (!OF.oid) OF.oid = crypto.randomUUID?.() || null;
  oRender(dls);
}
function oCalc() {
  const d = dlr(OF.dealer), L = OF.lines.filter(l => l.sku && +l.q > 0), hang = L.reduce((a, l) => a + l.q * l.gia, 0);
  const reached = d ? activeProgs(d.loai).filter(g => progReached(g, L)) : [], lim = d ? Math.max(ckLimit(d.loai), ...reached.map(g => +g.ck_pct || 0)) : 0;
  const ck = OF.ck == null || OF.ck === '' ? lim : +OF.ck, tt = hang * (1 - ck / 100), db = DEBT[OF.dealer] || {}, v = [];
  if (d) {
    if (ck > lim) v.push(`Chiết khấu ${ck}% vượt mức ${lim}% của ${d.loai}`);
    L.forEach(l => { const p = prod(l.sku); if (p && l.gia < +p.gia_ban) v.push(`Giá riêng ${p.ten}: ${vnd(l.gia)} thấp hơn giá chung ${vnd(p.gia_ban)}`); });
    if ((+db.du_no || 0) + tt > (+d.han_muc || 0)) v.push(`Dư nợ sau đơn ${vnd((+db.du_no || 0) + tt)} vượt hạn mức ${vnd(d.han_muc)}`);
    if (+db.qua_han_ngay > (+d.khoa_qua_han_ngay || 0)) v.push(`Nợ quá hạn ${db.qua_han_ngay} ngày (khóa khi > ${d.khoa_qua_han_ngay} ngày)`);
  }
  return { L, hang, ck, lim, tt, v, reached };
}
function oRender(dls) {
  const d = dlr(OF.dealer), c = oCalc(), canPick = ME.role !== 'dai_ly';
  openSheet(`<div class="row between"><h2>${OF.id ? 'Sửa đơn ' + esc(OF.id) : 'Lên đơn mới'}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div class="field"><label for="of-d">Đại lý / khách hàng *</label>${canPick ? `<input id="of-d" list="of-dl" value="${esc(d?.ten || '')}" placeholder="Gõ tên hoặc mã đại lý…" autocomplete="off" ${OF.id ? 'disabled' : ''}><datalist id="of-dl">${dls.map(x => `<option value="${esc(x.ten)}">${esc(x.id)} · ${esc(x.vung || '')}</option>`).join('')}</datalist>` : `<div class="pwbox" style="font-size:16px">${esc(d?.ten || '')}</div>`}<div id="of-info">${dealerCard(OF.dealer)}</div></div>
  <div id="of-lines">${OF.lines.map((l, i) => { const p = prod(l.sku), low = p && l.gia !== '' && +l.gia < +p.gia_ban;
    return `<div class="vline"><div class="vhead"><span class="vno">${i + 1}</span><div class="vitem"><input class="ac" data-oac="${i}" value="${esc(p ? p.ten : '')}" placeholder="Gõ tên hoặc mã sản phẩm…" autocomplete="off"><div class="acl" id="oacl-${i}"></div>${p ? `<div class="note">${esc(p.sku)} · ${esc(p.quy_cach)} · giá chung ${vnd(p.gia_ban)}${LOTS && opsRole() ? ' · tồn ' + num(ton(p.sku)) + ' ' + esc(p.dvt) : ''}</div>` : ''}</div><button class="btn sm" data-odel="${i}" aria-label="Xóa dòng">✕</button></div>
    <div class="vgrid"><label>Số lượng${p ? ' (' + esc(p.dvt) + ')' : ''}<input type="number" inputmode="decimal" step="any" data-ol="${i}|q" value="${l.q}"></label><label>Đơn giá${low ? ' – giá riêng' : ''}<input type="number" inputmode="numeric" step="any" data-ol="${i}|gia" value="${l.gia}" style="${low ? 'border-color:var(--amber)' : ''}"></label><label>Thành tiền<span class="vtt" id="ott-${i}">${l.q && l.gia ? vnd(l.q * l.gia) : '—'}</span></label></div></div>`; }).join('')}</div>
  <button class="btn sm" id="of-add" style="margin-top:6px">+ Thêm sản phẩm</button>
  <div class="f2" style="margin-top:10px"><div class="field"><label for="of-ck">Chiết khấu (%) – mặc định mức tối đa</label><input id="of-ck" type="number" inputmode="decimal" step="any" value="${OF.ck == null ? '' : OF.ck}" placeholder="${c.lim}"></div>
  <div class="field"><label for="of-km">Khuyến mãi / ghi chú</label><input id="of-km" value="${esc(OF.km || '')}"></div></div>
  <div class="card" id="of-sum"></div>
  <div class="err bad" id="of-err" style="min-height:20px;margin-top:6px"></div>
  <button class="btn pri" id="of-go">${OF.id ? 'Gửi lại đơn' : ME.role === 'dai_ly' ? 'Gửi đơn' : 'Gửi GSV duyệt'}</button>`, true);
  oSum(); oBind(dls);
}
function oSum() {
  const c = oCalc();
  $('#of-sum').innerHTML = `<div class="row between"><span>${c.L.length} sản phẩm · tiền hàng ${vnd(c.hang)} · CK ${c.ck}%</span><b style="font-size:18px">Thanh toán: ${vnd(c.tt)}</b></div>${c.reached.length ? `<div style="margin-top:8px">${c.reached.map(g => `<div class="alert"><span class="ok">✓</span><span><b>Đạt:</b> ${esc(g.ten ? g.ten + ' – ' : '')}${esc(dkText(g))}${tangText(g) ? ' → 🎁 tặng ' + esc(tangText(g)) : ''}${g.ck_pct != null ? ' → CK ' + num(g.ck_pct, 2) + '%' : ''}</span></div>`).join('')}</div>` : ''}${c.v.length ? `<div style="margin-top:8px">${c.v.map(x => `<div class="alert"><span class="bad">⚠</span><span>${esc(x)}</span></div>`).join('')}<p class="note" style="margin:6px 0 0">Đơn vẫn gửi được; khi Kế toán duyệt, các điểm vượt chính sách sẽ tự chuyển CEO quyết.</p></div>` : ''}`;
  OF.lines.forEach((l, i) => { const t = $('#ott-' + i); if (t) t.textContent = l.q && l.gia ? vnd(l.q * l.gia) : '—'; });
}
function oBind(dls) {
  const di = $('#of-d');
  if (di) di.oninput = di.onchange = () => { const v = di.value.trim(), x = dls.find(z => z.ten === v || z.id === v); OF.dealer = x?.id || ''; $('#of-info').innerHTML = x ? dealerCard(x.id) : (v ? '<div class="note bad">Chưa khớp – chọn trong danh sách gợi ý</div>' : ''); oSum(); };
  $('#of-ck').oninput = () => { OF.ck = $('#of-ck').value === '' ? null : +$('#of-ck').value; oSum(); };
  $('#of-km').oninput = () => OF.km = $('#of-km').value;
  $('#of-add').onclick = () => { OF.lines.push({ sku: '', q: '', gia: '' }); oRender(dls); $$('#sheet [data-oac]').at(-1)?.focus(); };
  $$('#sheet [data-odel]').forEach(b => b.onclick = () => { OF.lines.splice(+b.dataset.odel, 1); if (!OF.lines.length) OF.lines.push({ sku: '', q: '', gia: '' }); oRender(dls); });
  $$('#sheet [data-ol]').forEach(el => el.oninput = () => { const [i, k] = el.dataset.ol.split('|'); OF.lines[+i][k] = el.value === '' ? '' : +el.value; if (k === 'gia') { const p = prod(OF.lines[+i].sku); el.style.borderColor = p && +el.value < +p.gia_ban ? 'var(--amber)' : ''; } oSum(); });
  $$('#sheet [data-oac]').forEach(inp => { const i = +inp.dataset.oac;
    acBox(inp, $('#oacl-' + i), () => (D.products || []).filter(p => p.active !== false).map(p => ({ ...p, s: p.sku + ' ' + p.ten + ' ' + (p.quy_cach || '') })), p => `<b>${esc(p.ten)}</b><span>${esc(p.sku)} · ${esc(p.quy_cach)} · ${vnd(p.gia_ban)}${LOTS && opsRole() ? ' · tồn ' + num(ton(p.sku)) : ''}</span>`, p => { const l = OF.lines[i]; l.sku = p.sku; l.gia = +p.gia_ban; oRender(dls); $(`#sheet [data-ol="${i}|q"]`)?.focus(); }); });
  $('#of-go').onclick = async () => {
    const e = t => $('#of-err').textContent = t, c = oCalc();
    if (!OF.dealer) return e('Chọn đại lý từ danh sách');
    if (OF.lines.some(l => l.sku && !(+l.q > 0))) return e('Nhập số lượng cho từng sản phẩm');
    if (!c.L.length) return e('Đơn chưa có sản phẩm');
    const lines = c.L.map(l => ({ sku: l.sku, qty: +l.q, gia: +l.gia })), ck = OF.ck == null ? c.lim : +OF.ck;
    const gifts = c.reached.filter(g => tangText(g)).map(g => 'Tặng ' + tangText(g) + ' (' + (g.ten || dkText(g)) + ')');
    if (gifts.length && !(OF.km || '').includes('Tặng ')) OF.km = [OF.km, ...gifts].filter(Boolean).join('; ');
    $('#of-go').disabled = true;
    const r = OF.id ? await SB.rpc('resubmit_order', { p_order: OF.id, p_lines: lines, p_ck: ck, p_km: OF.km || null })
      : await SB.rpc('create_order', { p_dealer: OF.dealer, p_lines: lines, p_ck: ck, p_km: OF.km || null, p_offline_id: OF.oid });
    if (r.error) { $('#of-go').disabled = false; return e(errMsg(r.error)); }
    const id = OF.id || r.data; OF = null; closeSheet(); toast(`${id}: đã gửi`); route();
  };
}
async function orderOpen(id) {
  const [{ data: o }, { data: L }, { data: EV }] = await Promise.all([
    SB.from('orders').select('*').eq('id', id).single(), SB.from('order_lines').select('*').eq('order_id', id), SB.from('order_events').select('*').eq('order_id', id).order('ts')]);
  if (!o) return toast('Không mở được đơn');
  if (!Object.keys(DEBT).length) await loadDebt();
  const hang = (L || []).reduce((a, l) => a + l.qty * l.gia, 0), tt = hang * (1 - (+o.ck_pct || 0) / 100), d = dlr(o.dealer_id);
  const fi = OFLOW.findIndex(f => f[0] === o.status), s = OST[o.status] || [o.status, ''];
  let act = '';
  if (myTurn(o)) {
    if (o.status === 'cho_gsv') act = `<button class="btn pri" data-a="gsv">Duyệt đơn</button><button class="btn" data-a="ret">Trả lại NVKD</button>`;
    if (o.status === 'cho_kt') act = `<button class="btn pri" data-a="kt">Duyệt cuối</button><button class="btn" data-a="ret">Trả lại</button>`;
    if (o.status === 'cho_ceo') act = `<button class="btn pri" data-a="ceo1">Duyệt ngoại lệ</button><button class="btn bad" data-a="ceo0">Từ chối</button>`;
    if (o.status === 'cho_xuat') act = `<button class="btn pri" data-a="trip">Xếp xe</button>`;
    if (o.status === 'xep_xe') act = `<button class="btn pri" data-a="ship">Xuất kho (FIFO)</button>`;
    if (o.status === 'da_xuat') act = `<button class="btn pri" data-a="deliv">Xác nhận đã giao</button>`;
    if (o.status === 'da_giao') act = `<button class="btn pri" data-a="inv">Ghi hóa đơn & công nợ</button>`;
    if (o.status === 'tra_lai') act = `<button class="btn pri" data-a="edit">Sửa và gửi lại</button>`;
  }
  const canCancel = ['cho_gsv', 'cho_kt', 'cho_ceo', 'tra_lai', 'cho_sx', 'cho_xuat'].includes(o.status) && (['ceo', 'ke_toan'].includes(ME.role) || ((o.created_by === ME.id || o.nvkd_id === ME.id) && ['cho_gsv', 'tra_lai'].includes(o.status)));
  openSheet(`<div class="row between"><h2>${esc(o.id)}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div><span class="pill ${s[1]}">${s[0]}</span> <span class="note">· ${esc(o.nguon || '')} · ${ftime(o.created_at)} · lập bởi ${esc(userName(o.created_by))}</span></div>
  ${!['huy', 'tra_lai'].includes(o.status) ? `<div class="steps">${OFLOW.map((f, i) => `<span class="${i < fi || o.status === 'hoan_tat' ? 'done' : i === fi ? 'cur' : ''}">${f[1]}</span>`).join('')}</div>` : ''}
  <div class="card" style="margin:10px 0"><b>${esc(d?.ten || o.dealer_id)}</b> <span class="note">${esc(o.dealer_id)}</span>${dealerCard(o.dealer_id).replace('class="card"', 'class=""')}</div>
  ${o.vi_pham?.length ? `<div class="card" style="border-left:4px solid var(--coral)"><b class="bad">Vượt chính sách – cần CEO quyết</b>${o.vi_pham.map(x => `<div class="alert"><span class="bad">⚠</span><span>${esc(x)}</span></div>`).join('')}</div>` : ''}
  <div class="scroll"><table><thead><tr><th>Sản phẩm</th><th class="n">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th></tr></thead><tbody>
  ${(L || []).map(l => { const p = prod(l.sku); return `<tr><td>${esc(p?.ten || l.sku)}<br><span class="note">${esc(l.sku)}</span></td><td class="n">${num(l.qty, 2)} ${esc(p?.dvt || '')}</td><td class="n">${vnd(l.gia)}${+l.gia < +l.gia_chung ? `<br><span class="note bad">giá chung ${vnd(l.gia_chung)}</span>` : ''}</td><td class="n">${vnd(l.qty * l.gia)}</td></tr>`; }).join('')}
  <tr><td colspan="3">Tiền hàng</td><td class="n">${vnd(hang)}</td></tr><tr><td colspan="3">Chiết khấu ${num(o.ck_pct, 2)}%</td><td class="n">−${vnd(hang - tt)}</td></tr><tr><td colspan="3"><b>Thanh toán</b></td><td class="n"><b>${vnd(tt)}</b></td></tr></tbody></table></div>
  ${o.khuyen_mai ? `<p><b>Khuyến mãi / ghi chú:</b> ${esc(o.khuyen_mai)}</p>` : ''}
  <div id="o-extra"></div><div class="err bad" id="o-err" style="min-height:20px"></div>
  <div class="row">${act}${canCancel ? '<button class="btn" data-a="cancel">Hủy đơn</button>' : ''}</div>
  <h3 style="margin:18px 0 6px;font-size:15px">Lịch sử xử lý</h3>${(EV || []).map(ev => `<div class="alert"><span class="note" style="min-width:92px">${ftime(ev.ts)}</span><span><b>${esc(ev.action)}</b> · ${esc(userName(ev.user_id))}${ev.ghi_chu ? `<br><span class="note">${esc(ev.ghi_chu)}</span>` : ''}</span></div>`).join('')}`, true);
  const e = t => $('#o-err').textContent = t, done = msg => { closeSheet(); toast(msg); LOTS = null; route(); };
  const ask = (lbl, ph, go, extra = '') => { $('#o-extra').innerHTML = `<div class="card"><div class="field"><label for="o-in">${lbl}</label><input id="o-in" placeholder="${esc(ph)}"></div>${extra}<button class="btn pri" id="o-ok">Xác nhận</button></div>`; $('#o-in').focus(); $('#o-ok').onclick = () => go($('#o-in').value.trim()); };
  const call = async (fn, args, msg) => { const { data, error } = await SB.rpc(fn, args); if (error) return e(errMsg(error)); done(typeof msg === 'function' ? msg(data) : msg); };
  $$('#sheet [data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a; e('');
    if (a === 'gsv') return call('gsv_approve', { p_order: id }, 'GSV đã duyệt, chuyển Kế toán');
    if (a === 'kt') return call('kt_approve', { p_order: id }, st => st === 'cho_ceo' ? 'Vượt chính sách → đã chuyển CEO' : st === 'cho_sx' ? 'Thiếu tồn → đã tạo lệnh sản xuất' : 'Đã duyệt, chờ xếp xe');
    if (a === 'ceo1') return ask('Ghi chú của CEO (không bắt buộc)', 'vd: đồng ý CK đặc biệt vụ Đông Xuân', v => call('ceo_decide', { p_order: id, p_approve: true, p_note: v || null }, 'CEO đã duyệt ngoại lệ'));
    if (a === 'ceo0') return ask('Lý do từ chối', '', v => v ? call('ceo_decide', { p_order: id, p_approve: false, p_note: v }, 'Đã từ chối đơn') : e('Nhập lý do'));
    if (a === 'ret') return ask('Lý do trả lại', 'vd: sai số lượng, sai giá', v => v ? call('return_order', { p_order: id, p_note: v }, 'Đã trả lại đơn') : e('Nhập lý do'));
    if (a === 'cancel') return ask('Lý do hủy đơn', '', v => v ? call('cancel_order', { p_order: id, p_note: v }, 'Đã hủy đơn') : e('Nhập lý do'));
    if (a === 'inv') return ask('Số hóa đơn', 'vd: 0001234', v => v ? call('invoice_order', { p_order: id, p_so_hd: v }, 'Đã ghi hóa đơn và công nợ') : e('Nhập số hóa đơn'));
    if (a === 'deliv') return ask('Số biên bản giao / ghi chú', 'vd: BBGN đã ký, đủ hàng', v => call('confirm_delivery', { p_order: id, p_anh: v || null }, 'Đã xác nhận giao hàng'));
    if (a === 'ship') { b.disabled = true; return call('ship_order', { p_order: id }, 'Đã xuất kho, phiếu xuất tự sinh'); }
    if (a === 'edit') { return orderForm({ id, dealer: o.dealer_id, ck: +o.ck_pct, km: o.khuyen_mai || '', lines: (L || []).map(l => ({ sku: l.sku, q: +l.qty, gia: +l.gia })) }); }
    if (a === 'trip') {
      const { data: T } = await SB.from('trips').select('*').eq('status', 'Chờ xuất kho').order('id', { ascending: false });
      const cs = (D.carriers || []).filter(c => c.active !== false);
      $('#o-extra').innerHTML = `<div class="card"><div class="field"><label for="t-old">Ghép vào chuyến có sẵn</label><select id="t-old"><option value="">— Tạo chuyến mới —</option>${(T || []).map(t => `<option value="${esc(t.id)}">${esc(t.id)} · ${esc(t.bien_so || '')} · ${fdate(t.ngay)}</option>`).join('')}</select></div>
       <div id="t-new" class="f2"><div class="field"><label for="t-c">Nhà xe</label><select id="t-c"><option value="">—</option>${cs.map(c => `<option value="${c.id}">${esc(c.ten)}${c.tuyen ? ' · ' + esc(c.tuyen) : ''}</option>`).join('')}</select></div>
       <div class="field"><label for="t-bs">Biển số xe</label><input id="t-bs" placeholder="vd: 65C-301.88"></div><div class="field"><label for="t-tt">Tải trọng</label><input id="t-tt" placeholder="vd: 8 tấn"></div><div class="field"><label for="t-cu">Cước (đ)</label><input id="t-cu" type="number" inputmode="numeric"></div></div>
       <button class="btn pri" id="t-go">Xếp xe</button></div>`;
      $('#t-c').onchange = () => { const c = cs.find(x => String(x.id) === $('#t-c').value); if (c) { $('#t-tt').value ||= c.tai_trong || ''; } };
      $('#t-old').onchange = () => $('#t-new').hidden = !!$('#t-old').value;
      $('#t-go').onclick = () => { const old = $('#t-old').value; if (!old && !$('#t-bs').value.trim()) return e('Nhập biển số xe hoặc chọn chuyến có sẵn');
        call('assign_trip', { p_order: id, p_carrier: old ? null : ($('#t-c').value ? +$('#t-c').value : null), p_bien_so: $('#t-bs').value.trim() || null, p_tai: $('#t-tt').value.trim() || null, p_cuoc: +$('#t-cu').value || 0, p_trip: old || null }, t => 'Đã xếp vào chuyến ' + t); };
    }
  });
}

// ---------- ĐẠI LÝ & CÔNG NỢ ----------
let dState = { q: '', f: 'all' };
V.dealers = async () => {
  await loadDebt(); const st = dState;
  let rs = (D.dealers || []).map(d => ({ ...d, db: DEBT[d.id] || {} }));
  if (st.f === 'no') rs = rs.filter(d => +d.db.du_no > 0); if (st.f === 'qh') rs = rs.filter(d => +d.db.qua_han_ngay > 0);
  if (st.q) { const q = noAcc(st.q); rs = rs.filter(d => noAcc(d.id + ' ' + d.ten + ' ' + (d.sdt || '') + ' ' + (d.vung || '')).includes(q)); }
  rs.sort((a, b) => (+b.db.du_no || 0) - (+a.db.du_no || 0));
  const tot = rs.reduce((a, d) => a + (+d.db.du_no || 0), 0), qh = rs.reduce((a, d) => a + (+d.db.qua_han_tien || 0), 0);
  $('#view').innerHTML = `<div class="grid g3" style="margin-bottom:14px"><div class="card"><div class="note">Tổng dư nợ</div><div style="font-size:22px;font-weight:700">${vnd(tot)}</div></div><div class="card"><div class="note">Nợ quá hạn</div><div style="font-size:22px;font-weight:700" class="${qh ? 'bad' : ''}">${vnd(qh)}</div></div><div class="card"><div class="note">Số đại lý</div><div style="font-size:22px;font-weight:700">${rs.length}</div></div></div>
  <div class="row" style="margin-bottom:10px"><input id="dq" placeholder="Tìm đại lý…" value="${esc(st.q)}" style="min-width:220px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px"><div class="chips">${[['all', 'Tất cả'], ['no', 'Đang nợ'], ['qh', 'Quá hạn']].map(([k, t]) => `<span class="chip ${st.f === k ? 'on' : ''}" data-df="${k}">${t}</span>`).join('')}</div></div>
  <div class="scroll"><table class="stack"><thead><tr><th>Đại lý</th><th>Vùng</th><th>NVKD</th><th class="n">Dư nợ</th><th class="n">Hạn mức</th><th>Quá hạn</th></tr></thead><tbody>
  ${rs.map(d => `<tr class="click" data-did="${esc(d.id)}"><td data-l="Đại lý"><b>${esc(d.ten)}</b><br><span class="note">${esc(d.id)} · ${esc(d.sdt || '')}</span></td><td data-l="Vùng">${esc(d.vung || '')}</td><td data-l="NVKD">${esc(userName(d.nvkd_id))}</td><td class="n" data-l="Dư nợ">${vnd(d.db.du_no)}</td><td class="n" data-l="Hạn mức">${vnd(d.han_muc)}${+d.han_muc && +d.db.du_no > +d.han_muc ? '<br><span class="pill p-bad">vượt</span>' : ''}</td><td data-l="Quá hạn">${+d.db.qua_han_ngay > 0 ? `<span class="pill p-bad">${d.db.qua_han_ngay} ngày · ${vnd(d.db.qua_han_tien)}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="note">Không có đại lý.</td></tr>'}</tbody></table></div>`;
  $$('[data-df]').forEach(b => b.onclick = () => { st.f = b.dataset.df; V.dealers(); });
  const q = $('#dq'); q.onchange = () => { st.q = q.value; V.dealers(); };
  $$('[data-did]').forEach(tr => tr.onclick = () => dealerOpen(tr.dataset.did));
};
async function dealerOpen(id) {
  const d = dlr(id); const [{ data: inv }, { data: rc }, { data: od }] = await Promise.all([
    SB.from('invoices').select('*').eq('dealer_id', id).order('ngay', { ascending: false }).limit(100), SB.from('receipts').select('*').eq('dealer_id', id).order('ngay', { ascending: false }).limit(100),
    SB.from('orders').select('id,status,created_at').eq('dealer_id', id).order('created_at', { ascending: false }).limit(20)]);
  const kt = ['ceo', 'ke_toan'].includes(ME.role);
  openSheet(`<div class="row between"><h2>${esc(d.ten)}</h2><button class="btn sm" id="close">Đóng</button></div>${dealerCard(id)}
  ${kt ? `<div class="card" style="margin-top:10px"><b>Ghi nhận thu tiền</b><div class="f2" style="margin-top:6px"><div class="field"><label for="r-t">Số tiền (đ)</label><input id="r-t" type="number" inputmode="numeric"></div><div class="field"><label for="r-n">Ghi chú</label><input id="r-n" placeholder="vd: CK Vietcombank 22/11"></div></div><div class="err bad" id="r-e"></div><button class="btn pri" id="r-go">Ghi thu – trừ nợ hóa đơn cũ trước</button></div>` : ''}
  <h3 style="margin:16px 0 6px;font-size:15px">Hóa đơn / công nợ</h3><div class="scroll"><table><thead><tr><th>Số HĐ</th><th>Đơn</th><th>Ngày</th><th>Hạn TT</th><th class="n">Số tiền</th><th class="n">Còn nợ</th></tr></thead><tbody>${(inv || []).map(i => `<tr><td>${esc(i.id)}</td><td>${esc(i.order_id || '')}</td><td>${fdate(i.ngay)}</td><td class="${i.han_tt < today() && i.so_tien > i.da_thu ? 'bad' : ''}">${fdate(i.han_tt)}</td><td class="n">${vnd(i.so_tien)}</td><td class="n">${vnd(i.so_tien - i.da_thu)}</td></tr>`).join('') || '<tr><td colspan="6" class="note">Chưa có hóa đơn.</td></tr>'}</tbody></table></div>
  <h3 style="margin:16px 0 6px;font-size:15px">Thu tiền</h3><div class="scroll"><table><tbody>${(rc || []).map(r => `<tr><td>${fdate(r.ngay)}</td><td>${esc(r.ghi_chu || '')}</td><td class="n">${vnd(r.so_tien)}</td></tr>`).join('') || '<tr><td class="note">Chưa có.</td></tr>'}</tbody></table></div>
  <h3 style="margin:16px 0 6px;font-size:15px">Đơn gần đây</h3>${(od || []).map(o => `<div class="alert"><span>${esc(o.id)}</span><span class="note">${ftime(o.created_at)}</span><span class="pill ${OST[o.status]?.[1]}">${OST[o.status]?.[0]}</span></div>`).join('') || '<p class="note">Chưa có đơn.</p>'}`, true);
  $('#r-go') && ($('#r-go').onclick = async () => { const t = +$('#r-t').value; if (!(t > 0)) return $('#r-e').textContent = 'Nhập số tiền'; const { error } = await SB.rpc('record_receipt', { p_dealer: id, p_amount: t, p_note: $('#r-n').value.trim() || null }); if (error) return $('#r-e').textContent = errMsg(error); closeSheet(); toast('Đã ghi thu ' + vnd(t)); V.dealers(); });
}

// ---------- CHÍNH SÁCH: CK TỐI ĐA + CHƯƠNG TRÌNH (điều kiện đạt, tặng hàng, CK) ----------
const prodName = sku => prod(sku)?.ten || sku;
const dkText = g => g.dk_sl ? `Mua ≥ ${num(g.dk_sl, 3)} ${g.dk_dvt || ''} ${g.dk_sku ? prodName(g.dk_sku) : 'tổng các sản phẩm'}`.trim() + (g.dk_mo_ta ? ' · ' + g.dk_mo_ta : '') : (g.dk_mo_ta || 'Không điều kiện');
const tangText = g => g.tang_sl ? `${num(g.tang_sl, 3)} ${g.tang_dvt || ''} ${g.tang_ten || ''}`.replace(/\s+/g, ' ').trim() : '';
const activeProgs = loai => { const p = (D.policy_periods || []).find(x => x.active); return (D.policy_programs || []).filter(g => g.period_id === p?.id && g.loai_dai_ly === loai && g.active !== false); };
function progQty(g, lines) { return lines.filter(l => l.sku && (!g.dk_sku || l.sku === g.dk_sku)).reduce((a, l) => { const p = prod(l.sku), u = (g.dk_dvt || '').toLowerCase(), kg = +p?.kg_moi_dv || 0; return a + (+l.q || 0) * (u === 'tấn' ? kg / 1000 : u === 'kg' || u === 'lít' ? kg : 1); }, 0); }
const progReached = (g, lines) => progQty(g, lines) >= (+g.dk_sl || 0) && lines.some(l => l.sku);
V.policy = async () => {
  await loadMaster(['policy_periods', 'ck_levels', 'policy_programs']);
  const P = [...D.policy_periods].sort((a, b) => (b.active - a.active) || String(b.tu_ngay).localeCompare(String(a.tu_ngay))), ed = can('policy', 'S') || can('policy', 'T');
  const inp = 'width:80px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:6px';
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><p class="note" style="margin:0;max-width:760px">Mỗi loại đại lý có <b>CK tối đa chung</b> và có thể có <b>nhiều chương trình</b>: điều kiện đạt → tặng hàng và/hoặc chiết khấu. Khi lên đơn, app tự báo chương trình đơn đã đạt. Đơn có CK cao hơn mức cho phép (kể cả mức của chương trình đã đạt) sẽ chuyển CEO duyệt.</p>${ed ? '<button class="btn pri" id="pnew">+ Kỳ chính sách mới</button>' : ''}</div>
  ${P.map(p => `<div class="card" style="margin-bottom:14px"><div class="row between"><div><b>${esc(p.ten)}</b> <span class="note">${fdate(p.tu_ngay)} – ${fdate(p.den_ngay)}</span> ${p.active ? '<span class="pill p-ok">Đang áp dụng</span>' : ''}</div>${ed && !p.active ? `<button class="btn sm" data-pact="${p.id}">Áp dụng kỳ này</button>` : ''}</div>
  <div class="scroll"><table style="margin-top:8px"><thead><tr><th style="width:120px">Loại đại lý</th><th>Điều kiện đạt</th><th>Tặng hàng</th><th class="n" style="width:110px">CK tối đa (%)</th>${ed ? '<th style="width:70px"></th>' : ''}</tr></thead><tbody>
  ${DEALER_TYPES.map(t => { const v = D.ck_levels.find(c => c.period_id === p.id && c.loai_dai_ly === t)?.ck_max_pct, gs = D.policy_programs.filter(g => g.period_id === p.id && g.loai_dai_ly === t);
    return `<tr style="background:var(--bg)"><td><b>${t}</b></td><td class="note">Mức chung (mọi đơn)</td><td></td><td class="n">${ed ? `<input type="number" step="any" inputmode="decimal" data-ck="${p.id}|${t}" value="${v ?? ''}" style="${inp}">` : v ?? '—'}</td>${ed ? '<td></td>' : ''}</tr>
    ${gs.map(g => `<tr class="${g.active === false ? 'off' : ''}"><td class="note">↳ ${esc(g.ten || 'Chương trình')}</td><td>${esc(dkText(g))}</td><td>${tangText(g) ? '🎁 ' + esc(tangText(g)) : '<span class="note">—</span>'}</td><td class="n">${g.ck_pct != null ? num(g.ck_pct, 2) : '<span class="note">—</span>'}</td>${ed ? `<td><button class="btn sm" data-pg="${g.id}">Sửa</button></td>` : ''}</tr>`).join('')}
    ${ed ? `<tr><td></td><td colspan="${ed ? 4 : 3}"><button class="btn sm" data-pgnew="${p.id}|${t}">+ Thêm chương trình cho ${t}</button></td></tr>` : ''}`; }).join('')}
  </tbody></table></div></div>`).join('') || '<div class="empty">Chưa có kỳ chính sách. Chưa có kỳ thì mọi đơn có chiết khấu đều chuyển CEO duyệt.</div>'}`;
  $$('[data-ck]').forEach(inp => inp.onchange = async () => { const [pid, t] = inp.dataset.ck.split('|'); const v = inp.value === '' ? null : +inp.value;
    const r = v == null ? await SB.from('ck_levels').delete().eq('period_id', +pid).eq('loai_dai_ly', t) : await SB.from('ck_levels').upsert({ period_id: +pid, loai_dai_ly: t, ck_max_pct: v });
    if (r.error) return toast(errMsg(r.error)); await loadMaster('ck_levels'); toast('Đã lưu CK tối đa ' + t); });
  $$('[data-pact]').forEach(b => b.onclick = async () => { await SB.from('policy_periods').update({ active: false }).eq('active', true); const { error } = await SB.from('policy_periods').update({ active: true }).eq('id', +b.dataset.pact); if (error) return toast(errMsg(error)); toast('Đã áp dụng kỳ chính sách'); V.policy(); });
  $$('[data-pgnew]').forEach(b => b.onclick = () => { const [pid, t] = b.dataset.pgnew.split('|'); progForm({ period_id: +pid, loai_dai_ly: t }); });
  $$('[data-pg]').forEach(b => b.onclick = () => progForm(D.policy_programs.find(g => g.id === +b.dataset.pg)));
  $('#pnew') && ($('#pnew').onclick = () => {
    openSheet(`<div class="row between"><h2>Kỳ chính sách mới</h2><button class="btn sm" id="close">Đóng</button></div><div class="field"><label for="p-t">Tên kỳ</label><input id="p-t" placeholder="vd: Vụ Đông Xuân 2026–2027"></div><div class="f2"><div class="field"><label for="p-a">Từ ngày</label><input id="p-a" type="date" value="${today()}"></div><div class="field"><label for="p-b">Đến ngày</label><input id="p-b" type="date"></div></div>
    ${P.length ? `<label class="chk"><input type="checkbox" id="p-cp" checked> Sao chép CK tối đa và các chương trình từ kỳ "${esc(P[0].ten)}"</label>` : ''}<div class="err bad" id="p-e"></div><button class="btn pri" id="p-go">Tạo kỳ</button>`);
    $('#p-go').onclick = async () => { const t = $('#p-t').value.trim(), a = $('#p-a').value, b = $('#p-b').value; if (!t || !a || !b) return $('#p-e').textContent = 'Nhập đủ tên và thời gian';
      const { data, error } = await SB.from('policy_periods').insert({ ten: t, tu_ngay: a, den_ngay: b, active: !D.policy_periods.some(p => p.active) }).select().single(); if (error) return $('#p-e').textContent = errMsg(error);
      if ($('#p-cp')?.checked && data) { const src = P[0].id;
        const cks = D.ck_levels.filter(c => c.period_id === src).map(c => ({ ...c, period_id: data.id })); if (cks.length) await SB.from('ck_levels').insert(cks);
        const gs = D.policy_programs.filter(g => g.period_id === src).map(({ id, created_at, ...g }) => ({ ...g, period_id: data.id })); if (gs.length) await SB.from('policy_programs').insert(gs); }
      closeSheet(); toast('Đã tạo kỳ chính sách'); V.policy(); };
  });
};
function progForm(g) {
  const isNew = !g.id, units = (D.units || []).map(u => u.id), its = items();
  const uSel = (id, v) => `<select id="${id}"><option value="">—</option>${[...new Set([...units, 'tấn', 'kg'])].map(u => `<option ${u === v ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>`;
  openSheet(`<div class="row between"><h2>${isNew ? 'Thêm chương trình' : 'Sửa chương trình'} · ${esc(g.loai_dai_ly)}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div class="field"><label for="g-ten">Tên chương trình</label><input id="g-ten" value="${esc(g.ten || '')}" placeholder="vd: Mua 100 bao NPK tặng 5 bao"></div>
  <div class="card" style="margin-bottom:10px"><b>Điều kiện đạt</b><div class="f2" style="margin-top:6px">
   <div class="field full"><label for="g-sku">Sản phẩm áp dụng (để trống = tính tổng mọi sản phẩm)</label><div class="vitem"><input class="ac" id="g-sku" value="${esc(g.dk_sku ? prodName(g.dk_sku) : '')}" placeholder="Gõ tên hoặc mã sản phẩm…" autocomplete="off"><div class="acl" id="g-skul"></div></div></div>
   <div class="field"><label for="g-sl">Số lượng tối thiểu</label><input id="g-sl" type="number" step="any" inputmode="decimal" value="${g.dk_sl ?? ''}"></div>
   <div class="field"><label for="g-dvt">Đơn vị</label>${uSel('g-dvt', g.dk_dvt)}</div>
   <div class="field full"><label for="g-mt">Mô tả thêm điều kiện</label><input id="g-mt" value="${esc(g.dk_mo_ta || '')}" placeholder="vd: thanh toán trước 50%, lấy trong 1 lần"></div></div></div>
  <div class="card" style="margin-bottom:10px"><b>🎁 Tặng hàng</b> <span class="note">(để trống nếu chỉ chiết khấu)</span><div class="f2" style="margin-top:6px">
   <div class="field full"><label for="g-tg">Mặt hàng tặng (chọn trong danh mục hoặc gõ tên hàng ngoài danh mục)</label><div class="vitem"><input class="ac" id="g-tg" value="${esc(g.tang_ten || '')}" placeholder="vd: NPK 16-16-16 bao 50kg, Nón Quatar…" autocomplete="off"><div class="acl" id="g-tgl"></div></div></div>
   <div class="field"><label for="g-tsl">Số lượng tặng</label><input id="g-tsl" type="number" step="any" inputmode="decimal" value="${g.tang_sl ?? ''}"></div>
   <div class="field"><label for="g-tdvt">Đơn vị</label>${uSel('g-tdvt', g.tang_dvt)}</div></div></div>
  <div class="f2"><div class="field"><label for="g-ck">Chiết khấu khi đạt (%) <span class="note">(để trống nếu chỉ tặng hàng)</span></label><input id="g-ck" type="number" step="any" inputmode="decimal" value="${g.ck_pct ?? ''}"></div>
   <div class="field"><label for="g-gc">Ghi chú</label><input id="g-gc" value="${esc(g.ghi_chu || '')}"></div></div>
  ${!isNew ? `<label class="chk"><input type="checkbox" id="g-act" ${g.active !== false ? 'checked' : ''}> Đang áp dụng</label>` : ''}
  <div class="card" id="g-prev" style="margin:8px 0"></div><div class="err bad" id="g-e" style="min-height:20px"></div>
  <div class="row"><button class="btn pri" id="g-go">${isNew ? 'Thêm chương trình' : 'Lưu'}</button>${!isNew ? '<button class="btn bad" id="g-del">Xóa</button>' : ''}</div>`, true);
  const st = { dk_sku: g.dk_sku || null, tang_ma: g.tang_ma || null };
  const read = () => ({ ten: $('#g-ten').value.trim() || null, dk_sku: $('#g-sku').value.trim() ? st.dk_sku : null, dk_sl: $('#g-sl').value === '' ? null : +$('#g-sl').value, dk_dvt: $('#g-dvt').value || null, dk_mo_ta: $('#g-mt').value.trim() || null,
    tang_ma: st.tang_ma, tang_ten: $('#g-tg').value.trim() || null, tang_sl: $('#g-tsl').value === '' ? null : +$('#g-tsl').value, tang_dvt: $('#g-tdvt').value || null, ck_pct: $('#g-ck').value === '' ? null : +$('#g-ck').value, ghi_chu: $('#g-gc').value.trim() || null });
  const prev = () => { const x = read(); $('#g-prev').innerHTML = `<b>Tóm tắt:</b> ${esc(dkText(x))}${tangText(x) ? ' → tặng ' + esc(tangText(x)) : ''}${x.ck_pct != null ? ` → chiết khấu ${num(x.ck_pct, 2)}%` : ''}`; };
  $$('#sheet input, #sheet select').forEach(el => el.addEventListener('input', prev)); prev();
  acBox($('#g-sku'), $('#g-skul'), () => (D.products || []).filter(p => p.active !== false).map(p => ({ ...p, s: p.sku + ' ' + p.ten })), p => `<b>${esc(p.ten)}</b><span>${esc(p.sku)} · ${esc(p.dvt)}</span>`, p => { st.dk_sku = p.sku; $('#g-sku').value = p.ten; if (!$('#g-dvt').value) $('#g-dvt').value = p.dvt; prev(); });
  $('#g-sku').addEventListener('input', () => { st.dk_sku = null; });
  acBox($('#g-tg'), $('#g-tgl'), () => its.filter(i => i.active).map(i => ({ ...i, s: i.code + ' ' + i.ten })), i => `<b>${esc(i.ten)}</b><span>${esc(i.code)} · ${esc(i.kind)} · ${esc(i.dvt)}</span>`, i => { st.tang_ma = i.code; $('#g-tg').value = i.ten; if (!$('#g-tdvt').value) $('#g-tdvt').value = i.dvt; prev(); });
  $('#g-tg').addEventListener('input', () => { st.tang_ma = null; });
  const e = t => $('#g-e').textContent = t;
  $('#g-go').onclick = async () => {
    const x = read();
    if ($('#g-sku').value.trim() && !st.dk_sku) return e('Sản phẩm áp dụng chưa khớp danh mục – chọn trong gợi ý hoặc để trống');
    if (x.dk_sl != null && !x.dk_dvt) return e('Chọn đơn vị cho số lượng điều kiện');
    if (x.tang_sl == null && x.ck_pct == null) return e('Nhập ít nhất một ưu đãi: tặng hàng hoặc chiết khấu');
    if (x.tang_sl != null && !x.tang_ten) return e('Nhập mặt hàng tặng');
    if (x.tang_ten && x.tang_sl == null) return e('Nhập số lượng tặng');
    if (!isNew) x.active = $('#g-act').checked;
    const r = isNew ? await SB.from('policy_programs').insert({ ...x, period_id: g.period_id, loai_dai_ly: g.loai_dai_ly }) : await SB.from('policy_programs').update(x).eq('id', g.id);
    if (r.error) return e(errMsg(r.error)); await loadMaster('policy_programs'); closeSheet(); toast(isNew ? 'Đã thêm chương trình' : 'Đã lưu'); V.policy();
  };
  $('#g-del') && ($('#g-del').onclick = async () => { const b = $('#g-del'); if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Bấm lần nữa để xóa'; return; } const { error } = await SB.from('policy_programs').delete().eq('id', g.id); if (error) return e(errMsg(error)); await loadMaster('policy_programs'); closeSheet(); toast('Đã xóa chương trình'); V.policy(); });
}

// =====================================================================
// CÁC PHÂN HỆ CÒN LẠI: Sản xuất – QC, Kho (hàng lỗi, kiểm kê, NXT), Điều hành (chờ CEO, giá thành),
// Kế toán (mua hàng, giao vận, MISA), Kinh doanh (đi tuyến, KPI), Nhân sự (chấm công)
// =====================================================================
const qd = p => Promise.resolve(p).then(r => r.data || [], () => []);
const itName = c => item(c)?.ten || c, itDvt = c => item(c)?.dvt || '';
const chipsHtml = (opts, cur, attr) => `<div class="chips">${opts.map(([k, t]) => `<span class="chip ${cur === k ? 'on' : ''}" data-${attr}="${k}">${t}</span>`).join('')}</div>`;
const searchBox = (id, v, ph) => `<input id="${id}" placeholder="${ph}" value="${esc(v || '')}" style="min-width:200px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:42px">`;
const inputCss = 'border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:40px;background:var(--bg)';
function csvDownload(name, rows) {
  const s = '﻿' + rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

// ---------- CÔNG THỨC PHỐI TRỘN ----------
V.bom = async () => {
  const [F, L] = await Promise.all([qd(SB.from('formulas').select('*').order('sku')), qd(SB.from('formula_lines').select('*'))]);
  const ed = ME.role === 'ceo';
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><p class="note" style="margin:0">Mỗi sản phẩm có thể có nhiều phiên bản công thức; lệnh sản xuất dùng phiên bản mới nhất đang áp dụng. NVL nhập theo kg/mẻ; bao bì nhập số cái/mẻ.</p>${ed ? '<button class="btn pri" id="fnew">+ Công thức mới</button>' : ''}</div>
  <div class="scroll"><table class="stack"><thead><tr><th>Sản phẩm</th><th>Phiên bản</th><th>Dạng</th><th class="n">Cỡ mẻ (kg)</th><th class="n">Hao hụt</th><th>Thành phần</th><th></th></tr></thead><tbody>
  ${F.map(f => { const ls = L.filter(l => l.formula_id === f.id); return `<tr class="click ${f.active ? '' : 'off'}" data-fid="${f.id}"><td data-l="Sản phẩm"><b>${esc(prodName(f.sku))}</b><br><span class="note">${esc(f.sku)}</span></td><td data-l="Phiên bản">v${f.version}${f.hieu_luc_tu ? '<br><span class="note">từ ' + fdate(f.hieu_luc_tu) + '</span>' : ''}</td><td data-l="Dạng">${esc(f.dang)}</td><td class="n" data-l="Cỡ mẻ">${num(f.co_me_kg, 2)}</td><td class="n" data-l="Hao hụt">${num(f.hao_hut_pct, 2)}%</td><td data-l="Thành phần">${ls.map(l => `${esc(itName(l.material_ma))} <b>${num(l.kg_moi_me, 3)}</b>`).join(' · ')}</td><td>${f.active ? '<span class="pill p-ok">Đang dùng</span>' : '<span class="pill p-bad">Ngừng</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Chưa có công thức. Đơn hàng thiếu tồn sẽ không tạo được lệnh sản xuất khi sản phẩm chưa có công thức.</td></tr>'}</tbody></table></div>`;
  $('#fnew') && ($('#fnew').onclick = () => formulaForm(null, [], F));
  $$('[data-fid]').forEach(tr => tr.onclick = () => { const f = F.find(x => x.id === +tr.dataset.fid); formulaForm(f, L.filter(l => l.formula_id === f.id), F); });
};
function formulaForm(f, lines, F) {
  const ed = ME.role === 'ceo', isNew = !f; f = f || { dang: 'Bột', co_me_kg: 100, hao_hut_pct: 3, active: true, hieu_luc_tu: today() };
  const st = { sku: f.sku || '', lines: lines.length ? lines.map(l => ({ ...l })) : [{ material_ma: '', kg_moi_me: '' }] };
  const draw = () => {
    const nvlKg = st.lines.filter(l => item(l.material_ma)?.kind === 'NVL').reduce((a, l) => a + (+l.kg_moi_me || 0), 0);
    openSheet(`<div class="row between"><h2>${isNew ? 'Công thức mới' : 'Công thức ' + esc(prodName(f.sku)) + ' v' + f.version}</h2><button class="btn sm" id="close">Đóng</button></div>
    <div class="f2"><div class="field full"><label for="fm-sku">Sản phẩm *</label><div class="vitem"><input class="ac" id="fm-sku" value="${esc(st.sku ? prodName(st.sku) : '')}" ${isNew && ed ? '' : 'disabled'} placeholder="Gõ tên hoặc mã thành phẩm…" autocomplete="off"><div class="acl" id="fm-skul"></div></div></div>
    <div class="field"><label for="fm-dang">Dạng</label><select id="fm-dang" ${ed ? '' : 'disabled'}>${['Bột', 'Hạt', 'Lỏng', 'Viên'].map(x => `<option ${x === f.dang ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div class="field"><label for="fm-me">Cỡ mẻ (kg) *</label><input id="fm-me" type="number" step="any" value="${f.co_me_kg ?? ''}" ${ed ? '' : 'disabled'}></div>
    <div class="field"><label for="fm-hh">Hao hụt định mức (%)</label><input id="fm-hh" type="number" step="any" value="${f.hao_hut_pct ?? ''}" ${ed ? '' : 'disabled'}></div>
    <div class="field"><label for="fm-tt">Tỷ trọng (dạng lỏng)</label><input id="fm-tt" type="number" step="any" value="${f.ty_trong ?? ''}" ${ed ? '' : 'disabled'}></div>
    <div class="field"><label for="fm-hl">Hiệu lực từ</label><input id="fm-hl" type="date" value="${f.hieu_luc_tu || ''}" ${ed ? '' : 'disabled'}></div>
    <div class="field full"><label for="fm-rt">Quy trình (các bước trộn)</label><input id="fm-rt" value="${esc(f.routing || '')}" ${ed ? '' : 'disabled'} placeholder="vd: Cân → Trộn 15 phút → Đóng gói"></div></div>
    <h3 style="font-size:15px;margin:10px 0 6px">Thành phần cho 1 mẻ</h3>
    ${st.lines.map((l, i) => `<div class="vline"><div class="vhead"><span class="vno">${i + 1}</span><div class="vitem"><input class="ac" data-fl="${i}" value="${esc(l.material_ma ? itName(l.material_ma) : '')}" ${ed ? '' : 'disabled'} placeholder="Gõ tên NVL / bao bì…" autocomplete="off"><div class="acl" id="fll-${i}"></div>${l.material_ma ? `<div class="note">${esc(l.material_ma)} · ${esc(item(l.material_ma)?.kind || '')} · ${esc(itDvt(l.material_ma))}</div>` : ''}</div>${ed ? `<button class="btn sm" data-fdel="${i}">✕</button>` : ''}</div>
     <div class="vgrid"><label>${item(l.material_ma)?.kind === 'Bao bì' ? 'Số cái / mẻ' : 'Kg / mẻ'}<input type="number" step="any" data-fk="${i}|kg_moi_me" value="${l.kg_moi_me ?? ''}" ${ed ? '' : 'disabled'}></label><label>Mã thay thế (nếu có)<input data-fk="${i}|thay_the_ma" value="${esc(l.thay_the_ma || '')}" ${ed ? '' : 'disabled'}></label><label>Hệ số thay thế<input type="number" step="any" data-fk="${i}|he_so_thay_the" value="${l.he_so_thay_the ?? ''}" ${ed ? '' : 'disabled'}></label></div></div>`).join('')}
    ${ed ? '<button class="btn sm" id="fm-add">+ Thêm thành phần</button>' : ''}
    <div class="card" style="margin-top:10px">Tổng NVL: <b>${num(nvlKg, 3)} kg</b> / cỡ mẻ ${num($('#fm-me')?.value || f.co_me_kg, 2)} kg ${Math.abs(nvlKg - (+f.co_me_kg || 0)) > 0.01 && nvlKg ? '<span class="bad">· chưa khớp cỡ mẻ</span>' : ''}</div>
    ${!isNew && ed ? `<label class="chk"><input type="checkbox" id="fm-act" ${f.active ? 'checked' : ''}> Đang áp dụng</label>` : ''}
    <div class="err bad" id="fm-e" style="min-height:20px"></div>${ed ? `<div class="row"><button class="btn pri" id="fm-go">${isNew ? 'Lưu công thức' : 'Lưu thay đổi'}</button>${!isNew ? '<button class="btn" id="fm-ver">Tạo phiên bản mới từ công thức này</button>' : ''}</div>` : '<p class="note">Chỉ CEO sửa công thức.</p>'}`, true);
    if (!ed) return;
    const keep = () => { f.dang = $('#fm-dang').value; f.co_me_kg = $('#fm-me').value; f.hao_hut_pct = $('#fm-hh').value; f.ty_trong = $('#fm-tt').value; f.hieu_luc_tu = $('#fm-hl').value; f.routing = $('#fm-rt').value; };
    if (isNew) acBox($('#fm-sku'), $('#fm-skul'), () => (D.products || []).map(p => ({ ...p, s: p.sku + ' ' + p.ten })), p => `<b>${esc(p.ten)}</b><span>${esc(p.sku)}</span>`, p => { keep(); st.sku = p.sku; draw(); });
    $$('#sheet [data-fl]').forEach(inp => { const i = +inp.dataset.fl; acBox(inp, $('#fll-' + i), () => items().filter(x => x.kind !== 'Thành phẩm').map(x => ({ ...x, s: x.code + ' ' + x.ten })), x => `<b>${esc(x.ten)}</b><span>${esc(x.code)} · ${esc(x.kind)} · ${esc(x.dvt)}</span>`, x => { keep(); st.lines[i].material_ma = x.code; draw(); }); });
    $$('#sheet [data-fk]').forEach(el => el.oninput = () => { const [i, k] = el.dataset.fk.split('|'); st.lines[+i][k] = el.value; });
    $$('#sheet [data-fdel]').forEach(b => b.onclick = () => { keep(); st.lines.splice(+b.dataset.fdel, 1); if (!st.lines.length) st.lines.push({ material_ma: '', kg_moi_me: '' }); draw(); });
    $('#fm-add').onclick = () => { keep(); st.lines.push({ material_ma: '', kg_moi_me: '' }); draw(); };
    const save = async asNew => {
      keep(); const e = t => $('#fm-e').textContent = t, L = st.lines.filter(l => l.material_ma);
      if (!st.sku) return e('Chọn sản phẩm'); if (!(+f.co_me_kg > 0)) return e('Nhập cỡ mẻ');
      if (!L.length) return e('Chưa có thành phần'); if (L.some(l => !(+l.kg_moi_me > 0))) return e('Nhập định mức cho từng thành phần');
      if (new Set(L.map(l => l.material_ma)).size !== L.length) return e('Một thành phần bị nhập 2 lần');
      const head = { sku: st.sku, dang: f.dang, co_me_kg: +f.co_me_kg, hao_hut_pct: f.hao_hut_pct === '' ? 0 : +f.hao_hut_pct, ty_trong: f.ty_trong === '' || f.ty_trong == null ? null : +f.ty_trong, hieu_luc_tu: f.hieu_luc_tu || today(), routing: f.routing || null, active: isNew || asNew ? true : $('#fm-act').checked };
      let fid = f.id;
      if (isNew || asNew) { head.version = Math.max(0, ...F.filter(x => x.sku === st.sku).map(x => x.version)) + 1; const r = await SB.from('formulas').insert(head).select().single(); if (r.error) return e(errMsg(r.error)); fid = r.data.id; if (asNew) await SB.from('formulas').update({ active: false }).eq('id', f.id); }
      else { const r = await SB.from('formulas').update(head).eq('id', fid); if (r.error) return e(errMsg(r.error)); await SB.from('formula_lines').delete().eq('formula_id', fid); }
      const r2 = await SB.from('formula_lines').insert(L.map(l => ({ formula_id: fid, material_ma: l.material_ma, kg_moi_me: +l.kg_moi_me, thay_the_ma: l.thay_the_ma || null, he_so_thay_the: l.he_so_thay_the ? +l.he_so_thay_the : null })));
      if (r2.error) return e(errMsg(r2.error)); closeSheet(); toast('Đã lưu công thức'); V.bom();
    };
    $('#fm-go').onclick = () => save(false); $('#fm-ver') && ($('#fm-ver').onclick = () => save(true));
  };
  draw();
}

// ---------- LỆNH SẢN XUẤT & PHIẾU CÂN ----------
const LST = { cho_ceo: ['Chờ CEO duyệt', 'p-wait'], cho_can: ['Chờ cân', 'p-info'], dang_can: ['Đang cân', 'p-info'], hoan_thanh: ['Hoàn thành', 'p-ok'], huy: ['Đã hủy', 'p-bad'] };
let pState = { st: 'dang' };
V.prod = async () => {
  const [P, B] = await Promise.all([qd(SB.from('production_orders').select('*').order('created_at', { ascending: false }).limit(300)), qd(SB.from('batches').select('lsx_id,me_so'))]);
  const st = pState, done = id => B.filter(b => b.lsx_id === id).length;
  const rs = P.filter(p => st.st === 'all' ? true : st.st === 'dang' ? ['cho_ceo', 'cho_can', 'dang_can'].includes(p.status) : p.status === st.st);
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px">${chipsHtml([['dang', 'Đang mở'], ['hoan_thanh', 'Hoàn thành'], ['huy', 'Đã hủy'], ['all', 'Tất cả']], st.st, 'pst')}${['ceo', 'to_truong'].includes(ME.role) ? '<button class="btn pri" id="lnew">+ Lệnh sản xuất</button>' : ''}</div>
  <div class="scroll"><table class="stack"><thead><tr><th>Lệnh</th><th>Sản phẩm</th><th class="n">Số lượng</th><th class="n">Kg kế hoạch</th><th>Mẻ</th><th>Cho đơn</th><th>Trạng thái</th></tr></thead><tbody>
  ${rs.map(p => `<tr class="click" data-lsx="${esc(p.id)}"><td data-l="Lệnh"><b>${esc(p.id)}</b><br><span class="note">${ftime(p.created_at)}</span></td><td data-l="Sản phẩm">${esc(prodName(p.sku))}</td><td class="n" data-l="SL">${num(p.so_luong_thuc ?? p.so_luong, 2)} ${esc(prod(p.sku)?.dvt || '')}</td><td class="n" data-l="Kg">${num(p.kg_ke_hoach, 1)}</td><td data-l="Mẻ">${done(p.id)}/${p.so_me}</td><td data-l="Đơn">${esc(p.from_order || 'Sản xuất tồn')}</td><td><span class="pill ${LST[p.status]?.[1]}">${LST[p.status]?.[0]}</span>${p.lot_code ? '<br><span class="note">lô ' + esc(p.lot_code) + '</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="note">Không có lệnh.</td></tr>'}</tbody></table></div>
  <p class="note">Lệnh tự tạo khi đơn hàng thiếu tồn, hoặc lập tay để sản xuất tồn kho. CEO duyệt → Tổ trưởng cân từng mẻ (quét mã NVL, lệch quá ±1% bị chặn) → mẻ cuối nhập kho thành phẩm, tạo lô và mẫu lưu.</p>`;
  $$('[data-pst]').forEach(b => b.onclick = () => { st.st = b.dataset.pst; V.prod(); });
  $('#lnew') && ($('#lnew').onclick = () => {
    openSheet(`<div class="row between"><h2>Lệnh sản xuất mới</h2><button class="btn sm" id="close">Đóng</button></div><div class="field"><label for="ln-sku">Sản phẩm</label><div class="vitem"><input class="ac" id="ln-sku" placeholder="Gõ tên thành phẩm…" autocomplete="off"><div class="acl" id="ln-skul"></div></div></div><div class="field"><label for="ln-q">Số lượng (đơn vị bán)</label><input id="ln-q" type="number" step="any"></div><div class="err bad" id="ln-e"></div><button class="btn pri" id="ln-go">Lập lệnh – gửi CEO duyệt</button>`);
    let sku = ''; acBox($('#ln-sku'), $('#ln-skul'), () => (D.products || []).filter(p => p.active !== false).map(p => ({ ...p, s: p.sku + ' ' + p.ten })), p => `<b>${esc(p.ten)}</b><span>${esc(p.sku)} · ${esc(p.dvt)}${LOTS ? ' · tồn ' + num(ton(p.sku)) : ''}</span>`, p => { sku = p.sku; $('#ln-sku').value = p.ten; });
    $('#ln-go').onclick = async () => { if (!sku) return $('#ln-e').textContent = 'Chọn sản phẩm'; const { data, error } = await SB.rpc('create_lsx', { p_sku: sku, p_qty: +$('#ln-q').value, p_ghi_chu: null }); if (error) return $('#ln-e').textContent = errMsg(error); closeSheet(); toast('Đã lập ' + data); V.prod(); };
  });
  $$('[data-lsx]').forEach(tr => tr.onclick = () => lsxOpen(P.find(p => p.id === tr.dataset.lsx), done(tr.dataset.lsx)));
};
async function lsxOpen(x, done) {
  const [[f], L] = await Promise.all([qd(SB.from('formulas').select('*').eq('id', x.formula_id)), qd(SB.from('formula_lines').select('*').eq('formula_id', x.formula_id))]);
  await loadLots();
  const nvl = L.filter(l => item(l.material_ma)?.kind !== 'Bao bì'), bb = L.filter(l => item(l.material_ma)?.kind === 'Bao bì'), last = done + 1 >= x.so_me;
  const need = L.map(l => ({ ...l, tong: l.kg_moi_me * (x.so_me - done), ton: ton(l.material_ma) }));
  const canWeigh = ['cho_can', 'dang_can'].includes(x.status) && ['to_truong', 'ceo'].includes(ME.role);
  openSheet(`<div class="row between"><h2>${esc(x.id)}</h2><button class="btn sm" id="close">Đóng</button></div>
  <div><span class="pill ${LST[x.status]?.[1]}">${LST[x.status]?.[0]}</span> <span class="note">· ${esc(prodName(x.sku))} · ${num(x.so_luong, 2)} ${esc(prod(x.sku)?.dvt || '')} · ${num(x.kg_ke_hoach, 1)} kg · ${x.so_me} mẻ ${f ? num(f.co_me_kg) + ' kg' : ''} · đã cân ${done}/${x.so_me}</span></div>
  <h3 style="font-size:15px;margin:12px 0 6px">Nhu cầu vật tư còn lại</h3><div class="scroll"><table><thead><tr><th>Vật tư</th><th class="n">Định mức/mẻ</th><th class="n">Cần</th><th class="n">Tồn</th></tr></thead><tbody>${need.map(n => `<tr><td>${esc(itName(n.material_ma))}<br><span class="note">${esc(n.material_ma)}</span></td><td class="n">${num(n.kg_moi_me, 3)}</td><td class="n">${num(n.tong, 2)} ${esc(itDvt(n.material_ma))}</td><td class="n ${n.ton < n.tong ? 'bad' : ''}">${num(n.ton, 2)}</td></tr>`).join('')}</tbody></table></div>
  ${canWeigh ? `<div class="card" style="margin-top:12px"><h3>Phiếu cân mẻ ${done + 1}/${x.so_me}</h3><p class="note" style="margin-top:-6px">Quét mã vạch trên bao NVL (hoặc gõ mã), nhập số kg thực cân. Lệch quá ±1% sẽ bị chặn. Bao bì tự trừ theo định mức.</p>
   ${nvl.map((l, i) => `<div class="vline"><div><b>${esc(itName(l.material_ma))}</b> <span class="note">định mức ${num(l.kg_moi_me, 3)} kg</span></div><div class="vgrid"><label>Mã quét<input data-wq="${i}" autocapitalize="characters" placeholder="${esc(l.material_ma)}"></label><label>Kg thực cân<input type="number" step="any" inputmode="decimal" data-wk="${i}"></label><label>Kiểm tra<span class="vtt" id="wc-${i}" style="justify-content:flex-start">—</span></label></div></div>`).join('')}
   ${bb.length ? `<p class="note">Bao bì trừ tự động: ${bb.map(l => esc(itName(l.material_ma)) + ' ' + num(l.kg_moi_me) + ' ' + esc(itDvt(l.material_ma))).join(', ')}</p>` : ''}
   ${last ? `<div class="f2"><div class="field"><label for="w-q">Số lượng thành phẩm thực tế (${esc(prod(x.sku)?.dvt || '')})</label><input id="w-q" type="number" step="any" value="${x.so_luong}"></div><div class="field"><label for="w-tu">Vị trí tủ mẫu lưu</label><input id="w-tu" placeholder="vd: Tủ A – ngăn 3"></div></div>` : ''}
   <div class="err bad" id="w-e" style="min-height:20px"></div><button class="btn pri" id="w-go">${last ? 'Chốt mẻ cuối – nhập kho thành phẩm' : 'Chốt mẻ ' + (done + 1)}</button></div>` : ''}
  <div class="err bad" id="x-e" style="min-height:20px"></div>
  <div class="row">${x.status === 'cho_ceo' && ME.role === 'ceo' ? '<button class="btn pri" id="x-ok">Duyệt lệnh</button>' : ''}${['cho_ceo', 'cho_can'].includes(x.status) && ME.role === 'ceo' ? '<button class="btn bad" id="x-del">Hủy lệnh</button>' : ''}</div>`, true);
  const chk = i => { const l = nvl[i], q = ($(`[data-wq="${i}"]`).value || '').trim().toUpperCase(), k = +$(`[data-wk="${i}"]`).value, c = $('#wc-' + i); if (!q && !k) return c.textContent = '—'; const okc = q === l.material_ma.toUpperCase(), okk = Math.abs(k - l.kg_moi_me) <= l.kg_moi_me * 0.01 + 0.05; c.innerHTML = !okc ? '<span class="bad">Sai mã</span>' : !k ? 'Nhập kg' : okk ? '<span class="ok">✓ Đạt</span>' : `<span class="bad">Lệch ${num(k - l.kg_moi_me, 3)} kg</span>`; };
  $$('#sheet [data-wq],#sheet [data-wk]').forEach(el => el.oninput = () => chk(+(el.dataset.wq ?? el.dataset.wk)));
  $('#w-go') && ($('#w-go').onclick = async () => {
    const w = nvl.map((l, i) => ({ material: l.material_ma, ma_quet: $(`[data-wq="${i}"]`).value.trim(), kg: +$(`[data-wk="${i}"]`).value }));
    if (w.some(x => !x.ma_quet || !(x.kg > 0))) return $('#w-e').textContent = 'Quét mã và nhập kg cho đủ các NVL';
    $('#w-go').disabled = true;
    const { data, error } = await SB.rpc('close_batch', { p_lsx: x.id, p_w: w, p_tu: last ? ($('#w-tu').value.trim() || null) : null, p_qty_thuc: last ? +$('#w-q').value : null });
    if (error) { $('#w-go').disabled = false; return $('#w-e').textContent = errMsg(error); } closeSheet(); toast(data); LOTS = null; V.prod();
  });
  $('#x-ok') && ($('#x-ok').onclick = async () => { const { error } = await SB.rpc('approve_lsx', { p_lsx: x.id }); if (error) return $('#x-e').textContent = errMsg(error); closeSheet(); toast('Đã duyệt lệnh'); route(); });
  $('#x-del') && ($('#x-del').onclick = async () => { const { error } = await SB.rpc('cancel_lsx', { p_lsx: x.id }); if (error) return $('#x-e').textContent = errMsg(error); closeSheet(); toast('Đã hủy lệnh'); route(); });
}

// ---------- IQC & MẪU LƯU ----------
const IQS = { cho_lay_mau: ['Chờ lấy mẫu', 'p-wait'], dat: ['Đạt', 'p-ok'], khong_dat_cho_ceo: ['Không đạt – chờ CEO xử lý', 'p-bad'], khong_dat_tra_ncc: ['Không đạt – trả NCC', 'p-bad'], khong_dat_ceo_cho_dung: ['Không đạt – CEO cho dùng / xử lý khác', 'p-wait'] };
let qcTab = 'iqc';
V.qc = async () => {
  const tabs = chipsHtml([['iqc', 'Kiểm tra đầu vào (IQC)'], ['mau', 'Mẫu lưu thành phẩm']], qcTab, 'qct');
  if (qcTab === 'iqc') {
    const Q = await qd(SB.from('iqc_checks').select('*').order('ts', { ascending: false }).limit(300));
    $('#view').innerHTML = tabs + `<div class="scroll" style="margin-top:10px"><table class="stack"><thead><tr><th>Lô</th><th>NVL</th><th class="n">Số lượng</th><th>Nguồn</th><th>Kết quả</th><th>Trạng thái</th></tr></thead><tbody>${Q.map(q => `<tr class="${q.status === 'cho_lay_mau' && ['to_truong', 'ceo'].includes(ME.role) ? 'click' : ''}" data-iqc="${q.id}"><td data-l="Lô"><b>${esc(q.lot_code)}</b><br><span class="note">${ftime(q.ts)}</span></td><td data-l="NVL">${esc(itName(q.material_ma))}</td><td class="n" data-l="SL">${num(q.qty, 2)} ${esc(itDvt(q.material_ma))}</td><td data-l="Nguồn">${esc(q.po_id || q.doc_id || '')}</td><td data-l="Kết quả">${esc(q.ket_qua || '')}</td><td><span class="pill ${IQS[q.status]?.[1]}">${IQS[q.status]?.[0]}</span></td></tr>`).join('') || '<tr><td colspan="6" class="note">Chưa có lô chờ kiểm. Lô tự tạo khi nhập mua NVL (phiếu nhập hoặc nhận hàng theo PO).</td></tr>'}</tbody></table></div><p class="note">Lô không đạt tự chuyển khu cách ly và tạo phiếu hàng lỗi để CEO quyết định (trả NCC, hạ cấp, hủy…).</p>`;
    $$('[data-iqc]').forEach(tr => tr.classList.contains('click') && (tr.onclick = () => {
      const q = Q.find(x => x.id === +tr.dataset.iqc);
      openSheet(`<div class="row between"><h2>IQC lô ${esc(q.lot_code)}</h2><button class="btn sm" id="close">Đóng</button></div><p>${esc(itName(q.material_ma))} · ${num(q.qty, 2)} ${esc(itDvt(q.material_ma))}</p>
      <div class="field"><label for="iq-kq">Chỉ tiêu và kết quả đo</label><input id="iq-kq" placeholder="vd: Ẩm 1,8% (≤2%), N 46,1% (≥46%)"></div>
      ${q.po_id ? `<div class="field"><label for="iq-vt">Vị trí nhập kho nếu đạt</label><div class="vitem"><input class="ac" id="iq-vt" value="${esc(item(q.material_ma)?.vt || '')}" autocomplete="off"><div class="acl" id="iq-vtl"></div></div></div>` : '<p class="note">Lô đã nhập kho bằng phiếu nhập; không đạt sẽ tự chuyển vào khu cách ly.</p>'}
      <div class="err bad" id="iq-e"></div><div class="row"><button class="btn pri" id="iq-ok">Đạt</button><button class="btn bad" id="iq-ng">Không đạt</button></div>`);
      if ($('#iq-vt')) acBox($('#iq-vt'), $('#iq-vtl'), () => khoLocs(D.locations.find(l => l.id === item(q.material_ma)?.vt)?.warehouse_id || 'KHO-NVL').map(l => ({ ...l, s: l.id })), l => `<b>${esc(l.id)}</b>`, l => $('#iq-vt').value = l.id);
      const go = async dat => { const kq = $('#iq-kq').value.trim(); if (!kq) return $('#iq-e').textContent = 'Nhập kết quả kiểm'; const vt = $('#iq-vt')?.value.trim() || null; if (dat && q.po_id && !vt) return $('#iq-e').textContent = 'Chọn vị trí nhập kho';
        const { error } = await SB.rpc('iqc_result', { p_id: q.id, p_ket_qua: kq, p_dat: dat, p_vi_tri: vt }); if (error) return $('#iq-e').textContent = errMsg(error); closeSheet(); toast(dat ? 'IQC đạt' : 'Không đạt – đã chuyển cách ly'); V.qc(); };
      $('#iq-ok').onclick = () => go(true); $('#iq-ng').onclick = () => go(false);
    }));
  } else {
    const R = await qd(SB.from('retained_samples').select('*').order('created_at', { ascending: false }).limit(300)), td = today();
    $('#view').innerHTML = tabs + `<div class="scroll" style="margin-top:10px"><table class="stack"><thead><tr><th>Lô</th><th>Sản phẩm</th><th>Đơn hàng</th><th>Vị trí tủ</th><th>Lưu đến</th><th>Thành phần (lô NVL)</th></tr></thead><tbody>${R.map(r => `<tr><td data-l="Lô"><b>${esc(r.lot_code)}</b></td><td data-l="Sản phẩm">${esc(prodName(r.sku))}</td><td data-l="Đơn">${esc(r.order_id || '')}</td><td data-l="Tủ">${['to_truong', 'ceo'].includes(ME.role) ? `<input data-tu="${r.id}" value="${esc(r.vi_tri_tu)}" style="${inputCss};width:140px">` : esc(r.vi_tri_tu)}</td><td data-l="Lưu đến" class="${r.luu_den < td ? 'bad' : ''}">${fdate(r.luu_den)}${r.luu_den < td ? ' · hết hạn lưu' : ''}</td><td data-l="Thành phần">${(r.thanh_phan || []).map(t => `${esc(itName(t.material))} lô ${esc(t.lot)} (${num(t.kg, 2)} kg)`).join('; ')}</td></tr>`).join('') || '<tr><td colspan="6" class="note">Chưa có mẫu lưu. Mẫu tự tạo khi hoàn thành lệnh sản xuất.</td></tr>'}</tbody></table></div>`;
    $$('[data-tu]').forEach(i => i.onchange = async () => { const { error } = await SB.from('retained_samples').update({ vi_tri_tu: i.value.trim() }).eq('id', +i.dataset.tu); toast(error ? errMsg(error) : 'Đã lưu vị trí tủ'); });
  }
  $$('[data-qct]').forEach(b => b.onclick = () => { qcTab = b.dataset.qct; V.qc(); });
};

// ---------- TRUY XUẤT ----------
let trQ = '';
V.trace = async () => {
  $('#view').innerHTML = `<div class="row" style="margin-bottom:12px">${searchBox('trq', trQ, 'Nhập mã lô (thành phẩm / NVL) hoặc số đơn hàng…')}<button class="btn pri" id="trgo">Truy xuất</button></div><div id="trout"><p class="note">Ví dụ: lô thành phẩm → biết lô NVL nào đã trộn, lệnh SX, mẫu lưu, giao cho đại lý nào. Lô NVL → biết đã vào những lô thành phẩm và đơn hàng nào. Số đơn → biết lô đã giao.</p></div>`;
  const go = async () => {
    trQ = $('#trq').value.trim(); if (!trQ) return; const out = $('#trout'); out.innerHTML = '<p class="note"><span class="spin"></span> Đang tìm…</p>';
    const blocks = [];
    const fgBlock = async lotCode => {
      const [lots, [rs], [px]] = await Promise.all([qd(SB.from('stock_lots').select('*').eq('lot_code', lotCode)), qd(SB.from('retained_samples').select('*').eq('lot_code', lotCode)), qd(SB.from('production_orders').select('*').eq('lot_code', lotCode))]);
      const ids = lots.map(l => l.id), mv = ids.length ? await qd(SB.from('stock_moves').select('*').in('lot_id', ids).eq('ref_type', 'order')) : [];
      const ords = [...new Set(mv.map(m => m.ref_id))], O = ords.length ? await qd(SB.from('orders').select('id,dealer_id,created_at').in('id', ords)) : [];
      return `<div class="card" style="margin-bottom:12px"><h3>Lô thành phẩm ${esc(lotCode)} · ${esc(prodName(lots[0]?.item_code || rs?.sku || ''))}</h3>
      ${px ? `<p>Lệnh sản xuất <b>${esc(px.id)}</b> · ${num(px.so_luong_thuc ?? px.so_luong, 2)} ${esc(prod(px.sku)?.dvt || '')}${px.from_order ? ' · cho đơn ' + esc(px.from_order) : ''}</p>` : ''}
      ${rs ? `<p><b>Mẫu lưu:</b> ${esc(rs.vi_tri_tu)} · lưu đến ${fdate(rs.luu_den)}</p><p><b>NVL đã dùng:</b> ${(rs.thanh_phan || []).map(t => `${esc(itName(t.material))} lô <b>${esc(t.lot)}</b> ${num(t.kg, 2)} kg`).join('; ') || '—'}</p>` : ''}
      <p><b>Tồn hiện tại:</b> ${lots.map(l => `${num(l.qty, 2)} tại ${esc(l.location_id || '—')}`).join('; ') || '0'}</p>
      <p><b>Đã giao cho:</b> ${O.map(o => `${esc(dlr(o.dealer_id)?.ten || o.dealer_id)} (đơn ${esc(o.id)}, ${num(-mv.filter(m => m.ref_id === o.id).reduce((a, m) => a + +m.qty, 0), 2)})`).join('; ') || 'chưa xuất bán'}</p></div>`;
    };
    if (/^DH-/i.test(trQ)) {
      const mv = await qd(SB.from('stock_moves').select('lot_id,qty').eq('ref_type', 'order').eq('ref_id', trQ.toUpperCase()));
      const L = mv.length ? await qd(SB.from('stock_lots').select('lot_code').in('id', mv.map(m => m.lot_id))) : [];
      for (const c of [...new Set(L.map(l => l.lot_code))]) blocks.push(await fgBlock(c));
      if (!blocks.length) blocks.push('<p class="note">Đơn chưa xuất kho hoặc không tìm thấy.</p>');
    } else {
      const lots = await qd(SB.from('stock_lots').select('*').eq('lot_code', trQ));
      if (!lots.length) blocks.push('<p class="note">Không tìm thấy lô này.</p>');
      else if (lots[0].kind === 'Thành phẩm' || item(lots[0].item_code)?.kind === 'Thành phẩm') blocks.push(await fgBlock(trQ));
      else {
        const mv = await qd(SB.from('stock_moves').select('*').in('lot_id', lots.map(l => l.id)).eq('ref_type', 'lsx'));
        const lsx = [...new Set(mv.map(m => m.ref_id))], P = lsx.length ? await qd(SB.from('production_orders').select('*').in('id', lsx)) : [];
        blocks.push(`<div class="card" style="margin-bottom:12px"><h3>Lô NVL ${esc(trQ)} · ${esc(itName(lots[0].item_code))}</h3><p><b>Tồn hiện tại:</b> ${lots.map(l => `${num(l.qty, 2)} tại ${esc(l.location_id || '—')}`).join('; ')}</p><p><b>Đã dùng cho:</b> ${P.map(p => `lệnh ${esc(p.id)} → lô TP <b>${esc(p.lot_code || 'đang SX')}</b> (${num(-mv.filter(m => m.ref_id === p.id).reduce((a, m) => a + +m.qty, 0), 2)} kg)`).join('; ') || 'chưa dùng'}</p></div>`);
        for (const p of P.filter(p => p.lot_code)) blocks.push(await fgBlock(p.lot_code));
      }
    }
    out.innerHTML = blocks.join('');
  };
  $('#trgo').onclick = go; $('#trq').onkeydown = e => { if (e.key === 'Enter') go(); }; if (trQ) go();
};

// ---------- BẢO TRÌ ----------
V.maint = async () => {
  const [M, R] = await Promise.all([qd(SB.from('machines').select('*').order('id')), qd(SB.from('repair_requests').select('*').order('ts', { ascending: false }).limit(200))]);
  const td = today(), ed = ['ceo', 'to_truong'].includes(ME.role);
  $('#view').innerHTML = `<div class="card" style="margin-bottom:14px"><h3>Lịch bảo trì định kỳ</h3><div class="scroll"><table class="stack"><thead><tr><th>Máy</th><th>Việc định kỳ</th><th>Chu kỳ</th><th>Hạn kế tiếp</th><th></th></tr></thead><tbody>
  ${M.filter(m => m.active !== false).map(m => { const late = m.han_ke_tiep && m.han_ke_tiep < td, soon = m.han_ke_tiep && !late && m.han_ke_tiep <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); return `<tr><td data-l="Máy"><b>${esc(m.ten)}</b><br><span class="note">${esc(m.id)}</span></td><td data-l="Việc">${esc(m.viec_dinh_ky || '')}</td><td data-l="Chu kỳ">${m.chu_ky_ngay ? m.chu_ky_ngay + ' ngày' : ''}</td><td data-l="Hạn"><span class="${late ? 'bad' : ''}">${fdate(m.han_ke_tiep)}</span>${late ? ' <span class="pill p-bad">Quá hạn</span>' : soon ? ' <span class="pill p-wait">Sắp đến</span>' : ''}</td><td>${ed && m.chu_ky_ngay ? `<button class="btn sm" data-mdone="${esc(m.id)}">Đã bảo trì hôm nay</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="note">Chưa có máy. Thêm ở Danh mục › Máy móc thiết bị.</td></tr>'}</tbody></table></div></div>
  <div class="card"><div class="row between"><h3 style="margin:0">Yêu cầu sửa chữa</h3>${ed ? '<button class="btn sm pri" id="rnew">+ Báo hỏng</button>' : ''}</div><div class="scroll"><table class="stack" style="margin-top:8px"><thead><tr><th>Số</th><th>Máy</th><th>Hư hỏng</th><th>Phụ tùng</th><th>Trạng thái</th></tr></thead><tbody>
  ${R.map(r => `<tr><td data-l="Số"><b>${esc(r.id)}</b><br><span class="note">${ftime(r.ts)} · ${esc(userName(r.user_id))}</span></td><td data-l="Máy">${esc(M.find(m => m.id === r.machine_id)?.ten || r.machine_id)}</td><td data-l="Hư hỏng">${esc(r.mo_ta)}</td><td data-l="Phụ tùng">${esc(r.phu_tung || '')}</td><td>${ed ? `<select data-rst="${esc(r.id)}" style="${inputCss}">${['Chờ sửa', 'Đang sửa', 'Chờ phụ tùng', 'Đã xong'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : esc(r.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="note">Chưa có yêu cầu.</td></tr>'}</tbody></table></div></div>`;
  $$('[data-mdone]').forEach(b => b.onclick = async () => { const m = M.find(x => x.id === b.dataset.mdone), nx = new Date(Date.now() + 7 * 3600e3 + m.chu_ky_ngay * 864e5).toISOString().slice(0, 10); const { error } = await SB.from('machines').update({ han_ke_tiep: nx }).eq('id', m.id); toast(error ? errMsg(error) : 'Hạn kế tiếp: ' + fdate(nx)); await loadMaster('machines'); V.maint(); });
  $$('[data-rst]').forEach(s => s.onchange = async () => { const { error } = await SB.from('repair_requests').update({ status: s.value }).eq('id', s.dataset.rst); toast(error ? errMsg(error) : 'Đã cập nhật'); });
  $('#rnew') && ($('#rnew').onclick = () => { openSheet(`<div class="row between"><h2>Báo hỏng máy</h2><button class="btn sm" id="close">Đóng</button></div><div class="field"><label for="r-m">Máy</label><select id="r-m">${M.map(m => `<option value="${esc(m.id)}">${esc(m.ten)}</option>`).join('')}</select></div><div class="field"><label for="r-d">Mô tả hư hỏng</label><input id="r-d"></div><div class="field"><label for="r-p">Phụ tùng cần thay</label><input id="r-p"></div><div class="err bad" id="r-e"></div><button class="btn pri" id="r-go">Gửi yêu cầu</button>`);
    $('#r-go').onclick = async () => { const { data, error } = await SB.rpc('create_repair', { p_machine: $('#r-m').value, p_mo_ta: $('#r-d').value, p_phu_tung: $('#r-p').value || null }); if (error) return $('#r-e').textContent = errMsg(error); closeSheet(); toast('Đã gửi ' + data); V.maint(); }; });
};

// ---------- HÀNG LỖI & HỦY ----------
const DST = { cho_de_xuat: ['Chờ Tổ trưởng đề xuất', 'p-wait'], cho_ceo: ['Chờ CEO duyệt', 'p-bad'], da_xu_ly: ['Đã xử lý', 'p-ok'] };
let dfTab = 'mo';
V.defect = async () => {
  const [Dx] = await Promise.all([qd(SB.from('defects').select('*').order('ts', { ascending: false }).limit(300)), loadLots()]);
  const ids = [...new Set(Dx.map(d => d.lot_id))], LT = ids.length ? await qd(SB.from('stock_lots').select('*').in('id', ids)) : [], lot = id => LT.find(l => l.id === id) || {};
  const rs = Dx.filter(d => dfTab === 'all' || (dfTab === 'mo' ? d.status !== 'da_xu_ly' : d.status === 'da_xu_ly'));
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px">${chipsHtml([['mo', 'Đang xử lý'], ['xong', 'Đã xử lý'], ['all', 'Tất cả']], dfTab, 'dft')}${['to_truong', 'ceo', 'ke_toan'].includes(ME.role) ? '<button class="btn pri" id="dnew">+ Báo hàng lỗi trong kho</button>' : ''}</div>
  <div class="scroll"><table class="stack"><thead><tr><th>Phiếu</th><th>Nguồn</th><th>Hàng / lô</th><th class="n">SL</th><th>Mô tả</th><th>Đề xuất</th><th>Trạng thái</th></tr></thead><tbody>
  ${rs.map(d => { const l = lot(d.lot_id); return `<tr class="click" data-df="${esc(d.id)}"><td data-l="Phiếu"><b>${esc(d.id)}</b><br><span class="note">${ftime(d.ts)}</span></td><td data-l="Nguồn">${esc(d.nguon)}${d.dealer_id ? '<br><span class="note">' + esc(dlr(d.dealer_id)?.ten || d.dealer_id) + '</span>' : ''}</td><td data-l="Hàng">${esc(itName(l.item_code))}<br><span class="note">lô ${esc(l.lot_code || '')}</span></td><td class="n" data-l="SL">${num(d.qty, 2)} ${esc(itDvt(l.item_code))}</td><td data-l="Mô tả">${esc(d.mo_ta || '')}</td><td data-l="Đề xuất">${esc(d.de_xuat || '')}</td><td><span class="pill ${DST[d.status]?.[1]}">${DST[d.status]?.[0]}</span>${d.bien_ban ? '<br><span class="note">BB ' + esc(d.bien_ban) + '</span>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Không có phiếu.</td></tr>'}</tbody></table></div>
  <p class="note">Hàng lỗi nằm ở khu cách ly, không tính tồn khả dụng. Tổ trưởng đề xuất → CEO duyệt → hệ thống tự lập phiếu xuất hủy / trả NCC / chuyển hạ cấp; hủy có số biên bản. Hàng đại lý trả: Kế toán ghi giảm công nợ.</p>`;
  $$('[data-dft]').forEach(b => b.onclick = () => { dfTab = b.dataset.dft; V.defect(); });
  $$('[data-df]').forEach(tr => tr.onclick = () => { const d = Dx.find(x => x.id === tr.dataset.df), l = lot(d.lot_id);
    openSheet(`<div class="row between"><h2>${esc(d.id)}</h2><button class="btn sm" id="close">Đóng</button></div><p><span class="pill ${DST[d.status]?.[1]}">${DST[d.status]?.[0]}</span> <span class="note">${esc(d.nguon)} · ${ftime(d.ts)}</span></p>
    <div class="card">${esc(itName(l.item_code))} · lô ${esc(l.lot_code || '')} · <b>${num(d.qty, 2)} ${esc(itDvt(l.item_code))}</b> tại ${esc(l.location_id || '')}<br>${esc(d.mo_ta || '')}${d.ket_qua ? '<br><b>Kết quả:</b> ' + esc(d.ket_qua) : ''}${d.doc_xu_ly ? '<br><b>Phiếu xử lý:</b> ' + esc(d.doc_xu_ly) : ''}${d.da_giam_no ? '<br><b>Đã giảm nợ:</b> ' + vnd(d.da_giam_no) : ''}</div>
    <div class="err bad" id="dd-e" style="min-height:20px"></div>
    ${d.status === 'cho_de_xuat' && ['to_truong', 'ceo'].includes(ME.role) ? `<div class="field"><label for="dd-x">Đề xuất xử lý</label><select id="dd-x">${['Tái chế', 'Hạ cấp', 'Trả NCC', 'Hủy'].map(x => `<option>${x}</option>`).join('')}</select></div><button class="btn pri" id="dd-p">Gửi CEO duyệt</button>` : ''}
    ${d.status === 'cho_ceo' && ME.role === 'ceo' ? `<p>Đề xuất: <b>${esc(d.de_xuat)}</b></p><div class="field"><label for="dd-n">Ghi chú</label><input id="dd-n"></div><div class="row"><button class="btn pri" id="dd-ok">Duyệt</button><button class="btn" id="dd-no">Yêu cầu đề xuất lại</button></div>` : ''}
    ${d.status === 'da_xu_ly' && d.nguon === 'Đại lý trả về' && !d.da_giam_no && ['ke_toan', 'ceo'].includes(ME.role) ? `<div class="field"><label for="dd-t">Số tiền giảm nợ cho đại lý (đ)</label><input id="dd-t" type="number"></div><button class="btn pri" id="dd-c">Ghi giảm công nợ</button>` : ''}`);
    const e = t => $('#dd-e').textContent = t, fin = m => { closeSheet(); toast(m); V.defect(); };
    $('#dd-p') && ($('#dd-p').onclick = async () => { const { error } = await SB.rpc('defect_propose', { p_id: d.id, p_de_xuat: $('#dd-x').value }); error ? e(errMsg(error)) : fin('Đã gửi CEO'); });
    $('#dd-ok') && ($('#dd-ok').onclick = async () => { const { data, error } = await SB.rpc('defect_decide', { p_id: d.id, p_duyet: true, p_ghi_chu: $('#dd-n').value || null }); error ? e(errMsg(error)) : fin('Đã duyệt, phiếu ' + data); });
    $('#dd-no') && ($('#dd-no').onclick = async () => { const { error } = await SB.rpc('defect_decide', { p_id: d.id, p_duyet: false, p_ghi_chu: $('#dd-n').value || null }); error ? e(errMsg(error)) : fin('Đã trả lại đề xuất'); });
    $('#dd-c') && ($('#dd-c').onclick = async () => { const { error } = await SB.rpc('defect_credit', { p_id: d.id, p_so_tien: +$('#dd-t').value }); error ? e(errMsg(error)) : fin('Đã ghi giảm nợ'); });
  });
  $('#dnew') && ($('#dnew').onclick = () => {
    const ok = (LOTS || []).filter(l => !isQuar(l.location_id) && +l.qty > 0);
    openSheet(`<div class="row between"><h2>Báo hàng lỗi trong kho</h2><button class="btn sm" id="close">Đóng</button></div><p class="note">Lô được chuyển vào khu cách ly và tạo phiếu hàng lỗi.</p>
    <div class="field"><label for="dn-l">Lô hàng</label><div class="vitem"><input class="ac" id="dn-l" placeholder="Gõ tên hàng hoặc mã lô…" autocomplete="off"><div class="acl" id="dn-ll"></div></div></div>
    <div class="field"><label for="dn-q">Số lượng lỗi</label><input id="dn-q" type="number" step="any"></div><div class="field"><label for="dn-n">Nguồn lỗi</label><select id="dn-n">${['Hỏng trong kho', 'Lỗi sản xuất', 'Hết hạn', 'Khác'].map(x => `<option>${x}</option>`).join('')}</select></div><div class="field"><label for="dn-m">Mô tả</label><input id="dn-m" placeholder="vd: bao rách, vón cục"></div><div class="err bad" id="dn-e"></div><button class="btn pri" id="dn-go">Chuyển cách ly</button>`);
    let sel = null; acBox($('#dn-l'), $('#dn-ll'), () => ok.map(l => ({ ...l, s: l.item_code + ' ' + itName(l.item_code) + ' ' + l.lot_code })), l => `<b>${esc(itName(l.item_code))}</b><span>lô ${esc(l.lot_code)} · ${esc(l.location_id || '')} · còn ${num(l.qty, 2)}</span>`, l => { sel = l; $('#dn-l').value = itName(l.item_code) + ' · lô ' + l.lot_code; });
    $('#dn-go').onclick = async () => { if (!sel) return $('#dn-e').textContent = 'Chọn lô'; const { error } = await SB.rpc('stock_doc_manual', { p_loai: 'Chuyển vào cách ly', p_kind: sel.kind, p_item: sel.item_code, p_lot: sel.lot_code, p_qty: +$('#dn-q').value, p_vi_tri: sel.location_id, p_vi_tri_den: null, p_ref: $('#dn-m').value || null, p_dealer: null, p_nguon_loi: $('#dn-n').value, p_offline: null }); if (error) return $('#dn-e').textContent = errMsg(error); closeSheet(); toast('Đã chuyển cách ly'); LOTS = null; V.defect(); };
  });
};

// ---------- KIỂM KÊ ----------
V.count = async () => {
  const S = await qd(SB.from('stocktakes').select('*').order('mo_luc', { ascending: false }).limit(20)), cur = S.find(s => s.status !== 'da_duyet');
  const can2 = ['to_truong', 'ceo'].includes(ME.role);
  if (!cur) {
    $('#view').innerHTML = `<div class="card"><h3>Chưa có đợt kiểm kê đang mở</h3>${can2 ? `<div class="row"><input id="ck-k" value="Kiểm kê tháng ${today().slice(5, 7)}/${today().slice(0, 4)}" style="${inputCss};min-width:260px"><button class="btn pri" id="ck-o">Mở đợt kiểm kê</button></div><p class="note">Hệ thống chụp số sổ sách của mọi lô đang tồn để đếm thực tế.</p>` : ''}</div>
    <h3 style="font-size:15px">Các đợt đã duyệt</h3>${S.map(s => `<div class="alert"><span>${esc(s.ky)}</span><span class="note">${ftime(s.mo_luc)}${s.doc_id ? ' · phiếu ' + esc(s.doc_id) : ''}</span></div>`).join('') || '<p class="note">Chưa có.</p>'}`;
    $('#ck-o') && ($('#ck-o').onclick = async () => { const { error } = await SB.rpc('stocktake_open', { p_ky: $('#ck-k').value.trim() }); if (error) return toast(errMsg(error)); toast('Đã mở đợt kiểm kê'); V.count(); });
    return;
  }
  const L = await qd(SB.from('stocktake_lines').select('*').eq('stocktake_id', cur.id)), ids = L.map(l => l.lot_id), LT = ids.length ? await qd(SB.from('stock_lots').select('*').in('id', ids)) : [], lot = id => LT.find(l => l.id === id) || {};
  const counted = L.filter(l => l.thuc_te != null).length, diff = L.filter(l => l.thuc_te != null && +l.thuc_te !== +l.so_sach), dv = diff.reduce((a, l) => a + (l.thuc_te - l.so_sach) * (+lot(l.lot_id).don_gia || 0), 0);
  $('#view').innerHTML = `<div class="card" style="margin-bottom:12px"><div class="row between"><div><b>${esc(cur.ky)}</b> · mở ${ftime(cur.mo_luc)} · <span class="pill ${cur.status === 'cho_ceo' ? 'p-wait' : 'p-info'}">${cur.status === 'cho_ceo' ? 'Chờ CEO duyệt' : 'Đang đếm'}</span></div><div>Đã đếm <b>${counted}/${L.length}</b> lô · lệch <b>${diff.length}</b> lô · giá trị lệch <b class="${dv < 0 ? 'bad' : ''}">${vnd(dv)}</b></div></div>
  <div class="row" style="margin-top:8px">${cur.status === 'dang_dem' && can2 ? '<button class="btn pri" id="ck-s">Gửi CEO duyệt</button>' : ''}${cur.status === 'cho_ceo' && ME.role === 'ceo' ? '<button class="btn pri" id="ck-a">Duyệt – lập phiếu điều chỉnh</button>' : ''}</div></div>
  <div class="scroll"><table class="stack"><thead><tr><th>Hàng</th><th>Lô</th><th>Vị trí</th><th class="n">Sổ sách</th><th class="n">Thực tế</th><th class="n">Lệch</th></tr></thead><tbody>
  ${L.sort((a, b) => String(lot(a.lot_id).location_id).localeCompare(String(lot(b.lot_id).location_id))).map(l => { const t = lot(l.lot_id), d = l.thuc_te == null ? null : l.thuc_te - l.so_sach; return `<tr><td data-l="Hàng">${esc(itName(t.item_code))}</td><td data-l="Lô">${esc(t.lot_code || '')}</td><td data-l="Vị trí">${esc(t.location_id || '')}</td><td class="n" data-l="Sổ sách">${num(l.so_sach, 3)}</td><td class="n" data-l="Thực tế">${cur.status === 'dang_dem' && can2 ? `<input type="number" step="any" inputmode="decimal" data-ct="${l.lot_id}" value="${l.thuc_te ?? ''}" style="${inputCss};width:110px;text-align:right">` : num(l.thuc_te, 3)}</td><td class="n ${d ? 'bad' : ''}" data-l="Lệch">${d == null ? '' : (d > 0 ? '+' : '') + num(d, 3)}</td></tr>`; }).join('')}</tbody></table></div>`;
  $$('[data-ct]').forEach(i => i.onchange = async () => { if (i.value === '') return; const { error } = await SB.rpc('stocktake_count', { p_st: cur.id, p_lot: +i.dataset.ct, p_thuc: +i.value }); if (error) toast(errMsg(error)); else V.count(); });
  $('#ck-s') && ($('#ck-s').onclick = async () => { const { error } = await SB.rpc('stocktake_submit', { p_st: cur.id }); toast(error ? errMsg(error) : 'Đã gửi CEO'); V.count(); });
  $('#ck-a') && ($('#ck-a').onclick = async () => { const { data, error } = await SB.rpc('stocktake_approve', { p_st: cur.id }); toast(error ? errMsg(error) : 'Đã điều chỉnh tồn, phiếu ' + data); LOTS = null; V.count(); });
};

// ---------- NHẬP – XUẤT – TỒN ----------
let nxS = { tu: today().slice(0, 8) + '01', den: today(), k: '' };
V.nxt = async () => {
  const R = await qd(SB.rpc('nxt', { p_tu: nxS.tu, p_den: nxS.den }));
  const rs = R.filter(r => !nxS.k || r.kind === nxS.k).sort((a, b) => a.item_code.localeCompare(b.item_code)), tv = rs.reduce((a, r) => a + +r.gia_tri_cuoi, 0);
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><div class="row"><label>Từ <input type="date" id="nx-a" value="${nxS.tu}" style="${inputCss}"></label><label>Đến <input type="date" id="nx-b" value="${nxS.den}" style="${inputCss}"></label>${chipsHtml([['', 'Tất cả'], ['NVL', 'NVL'], ['Bao bì', 'Bao bì'], ['Thành phẩm', 'Thành phẩm']], nxS.k, 'nxk')}</div><button class="btn" id="nx-x">Tải Excel (CSV)</button></div>
  <div class="scroll"><table class="stack"><thead><tr><th>Mã</th><th>Tên hàng</th><th>ĐVT</th><th class="n">Tồn đầu</th><th class="n">Nhập</th><th class="n">Xuất</th><th class="n">Tồn cuối</th><th class="n">Giá trị cuối</th></tr></thead><tbody>
  ${rs.map(r => `<tr><td data-l="Mã">${esc(r.item_code)}</td><td data-l="Tên">${esc(itName(r.item_code))}</td><td data-l="ĐVT">${esc(itDvt(r.item_code))}</td><td class="n" data-l="Tồn đầu">${num(r.ton_dau, 2)}</td><td class="n" data-l="Nhập">${num(r.nhap, 2)}</td><td class="n" data-l="Xuất">${num(r.xuat, 2)}</td><td class="n" data-l="Tồn cuối"><b>${num(r.ton_cuoi, 2)}</b></td><td class="n" data-l="Giá trị">${vnd(r.gia_tri_cuoi)}</td></tr>`).join('') || '<tr><td colspan="8" class="note">Không có phát sinh.</td></tr>'}
  ${rs.length ? `<tr><td colspan="7"><b>Tổng giá trị tồn cuối</b></td><td class="n"><b>${vnd(tv)}</b></td></tr>` : ''}</tbody></table></div><p class="note">Nhập/xuất không tính điều chuyển nội bộ giữa vị trí, kho.</p>`;
  $('#nx-a').onchange = $('#nx-b').onchange = () => { nxS.tu = $('#nx-a').value; nxS.den = $('#nx-b').value; V.nxt(); };
  $$('[data-nxk]').forEach(b => b.onclick = () => { nxS.k = b.dataset.nxk; V.nxt(); });
  $('#nx-x').onclick = () => csvDownload(`NXT_${nxS.tu}_${nxS.den}.csv`, [['Mã', 'Tên hàng', 'Loại', 'ĐVT', 'Tồn đầu', 'Nhập', 'Xuất', 'Tồn cuối', 'Giá trị cuối'], ...rs.map(r => [r.item_code, itName(r.item_code), r.kind, itDvt(r.item_code), r.ton_dau, r.nhap, r.xuat, r.ton_cuoi, Math.round(r.gia_tri_cuoi)])]);
};

// ---------- CHỜ CEO DUYỆT ----------
V.inbox = async () => {
  const [O, P, Dx, S] = await Promise.all([qd(SB.from('orders').select('*, order_lines(qty,gia)').eq('status', 'cho_ceo')), qd(SB.from('production_orders').select('*').eq('status', 'cho_ceo')), qd(SB.from('defects').select('*').eq('status', 'cho_ceo')), qd(SB.from('stocktakes').select('*').eq('status', 'cho_ceo'))]);
  const sec = (t, n, body) => `<div class="card" style="margin-bottom:14px"><h3>${t} (${n})</h3>${body || '<p class="note">Không có.</p>'}</div>`;
  $('#view').innerHTML = `<p class="note" style="margin-top:0">Chỉ những việc vượt quy định mới lên đây; việc thường do GSV, Kế toán, Tổ trưởng tự duyệt.</p>
  ${sec('Đơn hàng vượt chính sách', O.length, O.map(o => `<div class="alert"><span class="dot" style="background:var(--coral)"></span><span style="flex:1"><b>${esc(o.id)}</b> · ${esc(dlr(o.dealer_id)?.ten || o.dealer_id)} · ${vnd((o.order_lines || []).reduce((a, l) => a + l.qty * l.gia, 0) * (1 - o.ck_pct / 100))}<br><span class="note">${(o.vi_pham || []).map(esc).join(' · ')}</span></span><button class="btn sm" data-io="${esc(o.id)}">Xem</button></div>`).join(''))}
  ${sec('Lệnh sản xuất chờ duyệt', P.length, P.map(p => `<div class="alert"><span class="dot" style="background:var(--amber)"></span><span style="flex:1"><b>${esc(p.id)}</b> · ${esc(prodName(p.sku))} · ${num(p.so_luong)} · ${num(p.kg_ke_hoach, 1)} kg, ${p.so_me} mẻ${p.from_order ? ' · cho đơn ' + esc(p.from_order) : ''}</span><button class="btn sm pri" data-ilsx="${esc(p.id)}">Duyệt lệnh</button></div>`).join(''))}
  ${sec('Hàng lỗi chờ duyệt xử lý', Dx.length, Dx.map(d => `<div class="alert"><span class="dot" style="background:var(--amber)"></span><span style="flex:1"><b>${esc(d.id)}</b> · ${esc(d.nguon)} · ${num(d.qty)} · đề xuất <b>${esc(d.de_xuat)}</b></span><a class="btn sm" href="#defect">Xem</a></div>`).join(''))}
  ${sec('Kiểm kê chờ duyệt', S.length, S.map(s => `<div class="alert"><span class="dot" style="background:var(--amber)"></span><span style="flex:1">${esc(s.ky)}</span><a class="btn sm" href="#count">Xem</a></div>`).join(''))}`;
  $$('[data-io]').forEach(b => b.onclick = () => orderOpen(b.dataset.io));
  $$('[data-ilsx]').forEach(b => b.onclick = async () => { const { error } = await SB.rpc('approve_lsx', { p_lsx: b.dataset.ilsx }); toast(error ? errMsg(error) : 'Đã duyệt ' + b.dataset.ilsx); V.inbox(); });
};

// ---------- MUA HÀNG ----------
const POS = { de_nghi: ['Đề nghị', 'p-wait'], da_dat_ncc: ['Đã đặt NCC', 'p-info'], cho_iqc: ['Đã về – chờ IQC', 'p-info'], da_nhap_kho: ['Đã nhập kho', 'p-ok'], huy: ['Đã hủy', 'p-bad'] };
let buyTab = 'po';
V.buy = async () => {
  const [P] = await Promise.all([qd(SB.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(300)), loadLots()]);
  const open = P.filter(p => ['de_nghi', 'da_dat_ncc', 'cho_iqc'].includes(p.status));
  const sug = (D.materials || []).filter(m => m.active !== false && +m.muc_bao_ton > 0).map(m => { const t = ton(m.ma), onway = open.filter(p => p.material_ma === m.ma).reduce((a, p) => a + +p.qty, 0); return { m, t, onway, need: Math.max(+m.ton_toi_da || 0, +m.muc_bao_ton * 2) - t - onway }; }).filter(x => x.t + x.onway < +x.m.muc_bao_ton);
  const tabs = chipsHtml([['po', 'Đơn mua (PO)'], ['sug', `Đề xuất mua ${sug.length}`]], buyTab, 'byt');
  const sup = id => D.suppliers?.find(s => s.id === id)?.ten || id || '';
  if (buyTab === 'sug') {
    $('#view').innerHTML = tabs + `<p class="note">Vật tư có tồn + hàng đang về thấp hơn mức báo tồn. Số đề xuất = đưa về tồn tối đa (hoặc 2 lần mức báo).</p><div class="scroll"><table class="stack"><thead><tr><th>Vật tư</th><th class="n">Tồn</th><th class="n">Đang về</th><th class="n">Mức báo</th><th class="n">Đề xuất mua</th><th>NCC chính</th><th></th></tr></thead><tbody>${sug.map(x => `<tr><td data-l="Vật tư"><b>${esc(x.m.ten)}</b><br><span class="note">${esc(x.m.ma)}</span></td><td class="n bad" data-l="Tồn">${num(x.t, 2)}</td><td class="n" data-l="Đang về">${num(x.onway, 2)}</td><td class="n" data-l="Mức báo">${num(x.m.muc_bao_ton)}</td><td class="n" data-l="Đề xuất"><b>${num(Math.max(x.need, +x.m.moq || 0), 2)} ${esc(x.m.dvt_kho)}</b></td><td data-l="NCC">${esc(sup(x.m.ncc_chinh))}</td><td>${can('buy', 'T') ? `<button class="btn sm pri" data-sp="${esc(x.m.ma)}|${Math.max(x.need, +x.m.moq || 0)}">Lập PO</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="note">Không có vật tư cần mua. (Cần điền "Tồn tối thiểu" trong danh mục NVL / bao bì.)</td></tr>'}</tbody></table></div>`;
  } else {
    $('#view').innerHTML = tabs + `<div class="row between" style="margin:10px 0"><p class="note" style="margin:0">Đề nghị → đặt NCC → hàng về (tạo IQC) → IQC đạt thì nhập kho. Mua lẻ nhập thẳng bằng phiếu Nhập kho → Nhập mua.</p>${can('buy', 'T') ? '<button class="btn pri" id="ponew">+ Lập PO</button>' : ''}</div>
    <div class="scroll"><table class="stack"><thead><tr><th>PO</th><th>Vật tư</th><th class="n">Số lượng</th><th class="n">Đơn giá</th><th>NCC</th><th>Ngày về</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${P.map(p => `<tr><td data-l="PO"><b>${esc(p.id)}</b><br><span class="note">${ftime(p.created_at)}</span></td><td data-l="Vật tư">${esc(itName(p.material_ma))}</td><td class="n" data-l="SL">${num(p.qty, 2)} ${esc(itDvt(p.material_ma))}</td><td class="n" data-l="Đơn giá">${vnd(p.don_gia)}</td><td data-l="NCC">${esc(sup(p.supplier_id))}</td><td data-l="Ngày về">${fdate(p.eta)}</td><td><span class="pill ${POS[p.status]?.[1]}">${POS[p.status]?.[0]}</span></td><td>${p.status === 'de_nghi' && can('buy', 'T') ? `<button class="btn sm" data-pst="${esc(p.id)}|da_dat_ncc">Đã đặt NCC</button> <button class="btn sm" data-pst="${esc(p.id)}|huy">Hủy</button>` : ''}${p.status === 'da_dat_ncc' ? `<button class="btn sm pri" data-prc="${esc(p.id)}">Hàng về</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="note">Chưa có PO.</td></tr>'}</tbody></table></div>`;
  }
  $$('[data-byt]').forEach(b => b.onclick = () => { buyTab = b.dataset.byt; V.buy(); });
  const poForm = (ma, q) => {
    openSheet(`<div class="row between"><h2>Lập đơn mua (PO)</h2><button class="btn sm" id="close">Đóng</button></div><div class="field"><label for="po-m">Vật tư</label><div class="vitem"><input class="ac" id="po-m" value="${esc(ma ? itName(ma) : '')}" autocomplete="off" placeholder="Gõ tên NVL / bao bì…"><div class="acl" id="po-ml"></div></div></div>
    <div class="f2"><div class="field"><label for="po-q">Số lượng</label><input id="po-q" type="number" step="any" value="${q || ''}"></div><div class="field"><label for="po-g">Đơn giá (để trống = giá chuẩn)</label><input id="po-g" type="number" step="any"></div>
    <div class="field"><label for="po-s">Nhà cung cấp</label><select id="po-s"><option value="">— NCC chính —</option>${(D.suppliers || []).filter(s => s.active !== false).map(s => `<option value="${esc(s.id)}">${esc(s.ten)}</option>`).join('')}</select></div><div class="field"><label for="po-e">Ngày hàng về dự kiến</label><input id="po-e" type="date"></div></div><div class="err bad" id="po-x"></div><button class="btn pri" id="po-go">Lập PO</button>`);
    acBox($('#po-m'), $('#po-ml'), () => items().filter(i => i.kind !== 'Thành phẩm').map(i => ({ ...i, s: i.code + ' ' + i.ten })), i => `<b>${esc(i.ten)}</b><span>${esc(i.code)} · tồn ${num(ton(i.code))}</span>`, i => { ma = i.code; $('#po-m').value = i.ten; });
    $('#po-go').onclick = async () => { if (!ma) return $('#po-x').textContent = 'Chọn vật tư'; const { data, error } = await SB.rpc('create_po', { p_material: ma, p_qty: +$('#po-q').value, p_supplier: $('#po-s').value || null, p_gia: $('#po-g').value === '' ? null : +$('#po-g').value, p_eta: $('#po-e').value || null }); if (error) return $('#po-x').textContent = errMsg(error); closeSheet(); toast('Đã lập ' + data); buyTab = 'po'; V.buy(); };
  };
  $('#ponew') && ($('#ponew').onclick = () => poForm('', ''));
  $$('[data-sp]').forEach(b => b.onclick = () => { const [m, q] = b.dataset.sp.split('|'); poForm(m, Math.ceil(+q)); });
  $$('[data-pst]').forEach(b => b.onclick = async () => { const [id, s] = b.dataset.pst.split('|'); const { error } = await SB.from('purchase_orders').update({ status: s }).eq('id', id); toast(error ? errMsg(error) : 'Đã cập nhật'); V.buy(); });
  $$('[data-prc]').forEach(b => b.onclick = () => { const p = P.find(x => x.id === b.dataset.prc);
    openSheet(`<div class="row between"><h2>Nhận hàng ${esc(p.id)}</h2><button class="btn sm" id="close">Đóng</button></div><p>${esc(itName(p.material_ma))}</p><div class="f2"><div class="field"><label for="rc-l">Số lô NCC / lô nhập</label><input id="rc-l" value="${esc(p.material_ma.split('-').pop().slice(0, 3) + '-' + today().slice(2).replace(/-/g, ''))}"></div><div class="field"><label for="rc-q">Số lượng thực nhận</label><input id="rc-q" type="number" step="any" value="${p.qty}"></div></div><div class="err bad" id="rc-e"></div><button class="btn pri" id="rc-go">Xác nhận hàng về – tạo phiếu IQC</button>`);
    $('#rc-go').onclick = async () => { const { error } = await SB.rpc('po_receive', { p_po: p.id, p_lot: $('#rc-l').value.trim(), p_qty: +$('#rc-q').value }); if (error) return $('#rc-e').textContent = errMsg(error); closeSheet(); toast('Hàng đã về, chờ IQC'); V.buy(); }; });
};

// ---------- GIAO VẬN ----------
V.ship = async () => {
  const [T, TO] = await Promise.all([qd(SB.from('trips').select('*').order('ngay', { ascending: false }).limit(200)), qd(SB.from('trip_orders').select('*'))]);
  const ids = [...new Set(TO.map(t => t.order_id))], O = ids.length ? await qd(SB.from('orders').select('id,dealer_id,status,order_lines(qty,sku)').in('id', ids)) : [];
  const kg = o => (o.order_lines || []).reduce((a, l) => a + l.qty * (+prod(l.sku)?.kg_moi_dv || 0), 0), ym = today().slice(0, 7);
  const byC = {}; T.filter(t => String(t.ngay).slice(0, 7) === ym).forEach(t => { const k = (D.carriers || []).find(c => c.id === t.carrier_id)?.ten || 'Khác'; byC[k] = (byC[k] || 0) + +t.cuoc; });
  $('#view').innerHTML = `<div class="tiles">${Object.entries(byC).map(([k, v]) => `<div class="tile"><span>Cước tháng · ${esc(k)}</span><b>${vnd(v)}</b></div>`).join('') || '<div class="tile"><span>Cước tháng</span><b>0 đ</b></div>'}</div>
  <div class="scroll"><table class="stack"><thead><tr><th>Chuyến</th><th>Ngày</th><th>Nhà xe / xe</th><th>Đơn hàng</th><th class="n">Tải (kg)</th><th class="n">Cước</th><th>Trạng thái</th></tr></thead><tbody>
  ${T.map(t => { const os = TO.filter(x => x.trip_id === t.id).map(x => O.find(o => o.id === x.order_id)).filter(Boolean); return `<tr><td data-l="Chuyến"><b>${esc(t.id)}</b></td><td data-l="Ngày">${fdate(t.ngay)}</td><td data-l="Xe">${esc((D.carriers || []).find(c => c.id === t.carrier_id)?.ten || '')} ${esc(t.bien_so || '')}<br><span class="note">${esc(t.tai_trong || '')}</span></td><td data-l="Đơn">${os.map(o => `${esc(o.id)} · ${esc(dlr(o.dealer_id)?.ten || '')}`).join('<br>')}</td><td class="n" data-l="Tải">${num(os.reduce((a, o) => a + kg(o), 0))}</td><td class="n" data-l="Cước">${['ke_toan', 'ceo'].includes(ME.role) ? `<input type="number" data-tc="${esc(t.id)}" value="${+t.cuoc || 0}" style="${inputCss};width:120px;text-align:right">` : vnd(t.cuoc)}</td><td>${['ke_toan', 'ceo'].includes(ME.role) ? `<select data-ts="${esc(t.id)}" style="${inputCss}">${['Chờ xuất kho', 'Đang giao', 'Đã giao', 'Hủy'].map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : esc(t.status)}${t.anh_bien_ban ? `<br><span class="note">${esc(t.anh_bien_ban)}</span>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="note">Chưa có chuyến. Chuyến tạo khi Kế toán xếp xe cho đơn hàng.</td></tr>'}</tbody></table></div>`;
  $$('[data-tc]').forEach(i => i.onchange = async () => { const { error } = await SB.from('trips').update({ cuoc: +i.value }).eq('id', i.dataset.tc); toast(error ? errMsg(error) : 'Đã lưu cước'); });
  $$('[data-ts]').forEach(i => i.onchange = async () => { const { error } = await SB.from('trips').update({ status: i.value }).eq('id', i.dataset.ts); toast(error ? errMsg(error) : 'Đã cập nhật'); });
};

// ---------- XUẤT DỮ LIỆU MISA ----------
let msS = { tu: today().slice(0, 8) + '01', den: today() };
V.misa = async () => {
  $('#view').innerHTML = `<div class="card"><h3>Xuất dữ liệu sang MISA</h3><p class="note" style="margin-top:-6px">Tải file CSV (mở bằng Excel), chỉnh cột theo mẫu nhập khẩu MISA của công ty rồi nhập vào MISA. Khi có mẫu MISA chính thức, đội triển khai sẽ khớp cột tự động.</p>
  <div class="row" style="margin:10px 0"><label>Từ <input type="date" id="ms-a" value="${msS.tu}" style="${inputCss}"></label><label>Đến <input type="date" id="ms-b" value="${msS.den}" style="${inputCss}"></label></div>
  <div class="row"><button class="btn pri" data-ms="hd">Hóa đơn bán hàng</button><button class="btn" data-ms="thu">Phiếu thu</button><button class="btn" data-ms="kho">Phiếu nhập / xuất kho</button><button class="btn" data-ms="kh">Danh mục khách hàng</button><button class="btn" data-ms="vt">Danh mục vật tư, hàng hóa</button></div><div class="note" id="ms-n" style="margin-top:10px"></div></div>`;
  const rng = () => { msS.tu = $('#ms-a').value; msS.den = $('#ms-b').value; return [msS.tu, msS.den]; };
  $$('[data-ms]').forEach(b => b.onclick = async () => {
    const [a, z] = rng(), k = b.dataset.ms, n = $('#ms-n'); n.textContent = 'Đang lấy dữ liệu…';
    if (k === 'hd') { const I = await qd(SB.from('invoices').select('*').gte('ngay', a).lte('ngay', z)); const oids = I.map(i => i.order_id).filter(Boolean), OL = oids.length ? await qd(SB.from('order_lines').select('*').in('order_id', oids)) : [], O = oids.length ? await qd(SB.from('orders').select('id,ck_pct').in('id', oids)) : [];
      const rows = [['Ngày hóa đơn', 'Số hóa đơn', 'Mã khách hàng', 'Tên khách hàng', 'Mã số thuế', 'Địa chỉ', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Tỷ lệ CK (%)', 'Tiền CK', 'Hạn thanh toán', 'Số đơn hàng']];
      I.forEach(i => { const d = dlr(i.dealer_id) || {}, ck = +O.find(o => o.id === i.order_id)?.ck_pct || 0; OL.filter(l => l.order_id === i.order_id).forEach(l => rows.push([i.ngay, i.id, i.dealer_id, d.ten, d.mst, d.dia_chi, l.sku, prodName(l.sku), prod(l.sku)?.dvt, l.qty, l.gia, l.qty * l.gia, ck, Math.round(l.qty * l.gia * ck / 100), i.han_tt, i.order_id])); });
      csvDownload(`MISA_HoaDon_${a}_${z}.csv`, rows); if (I.length) await SB.from('invoices').update({ misa_xuat_luc: new Date().toISOString() }).in('id', I.map(i => i.id)); n.textContent = `Đã xuất ${I.length} hóa đơn.`; }
    if (k === 'thu') { const R = await qd(SB.from('receipts').select('*').gte('ngay', a).lte('ngay', z)); csvDownload(`MISA_PhieuThu_${a}_${z}.csv`, [['Ngày', 'Mã khách hàng', 'Tên khách hàng', 'Số tiền', 'Diễn giải'], ...R.map(r => [r.ngay, r.dealer_id, dlr(r.dealer_id)?.ten, r.so_tien, r.ghi_chu])]); n.textContent = `Đã xuất ${R.length} phiếu thu.`; }
    if (k === 'kho') { const Dc = await qd(SB.from('stock_docs').select('*').gte('ngay', a).lte('ngay', z).neq('status', 'da_huy')), ids = Dc.map(d => d.id), M = ids.length ? await qd(SB.from('stock_moves').select('doc_id,qty,don_gia,loai,stock_lots(item_code,lot_code,location_id)').in('doc_id', ids)) : [];
      csvDownload(`MISA_PhieuKho_${a}_${z}.csv`, [['Ngày', 'Số phiếu', 'Loại phiếu', 'Đối tượng', 'Mã đối tượng', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Lô', 'Kho / vị trí', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Chứng từ gốc'], ...M.filter(m => !(m.loai === 'chuyen_kho' && m.qty > 0)).map(m => { const d = Dc.find(x => x.id === m.doc_id); return [d.ngay, d.id, d.loai, d.doi_tuong_ten, d.doi_tuong_id, m.stock_lots?.item_code, itName(m.stock_lots?.item_code), itDvt(m.stock_lots?.item_code), m.stock_lots?.lot_code, m.stock_lots?.location_id, Math.abs(m.qty), m.don_gia, Math.round(Math.abs(m.qty) * (+m.don_gia || 0)), d.ref]; })]); n.textContent = `Đã xuất ${Dc.length} phiếu kho.`; }
    if (k === 'kh') { csvDownload('MISA_KhachHang.csv', [['Mã khách hàng', 'Tên khách hàng', 'Địa chỉ', 'Mã số thuế', 'Điện thoại', 'Người liên hệ', 'Tỉnh', 'Hạn nợ (ngày)', 'Hạn mức nợ'], ...(D.dealers || []).map(d => [d.id, d.ten, d.dia_chi, d.mst, d.sdt, d.dai_dien, d.tinh, d.han_no_ngay, d.han_muc])]); n.textContent = 'Đã xuất danh mục khách hàng.'; }
    if (k === 'vt') { csvDownload('MISA_VatTuHangHoa.csv', [['Mã', 'Tên', 'Loại', 'ĐVT', 'Giá bán', 'Giá vốn / giá nhập chuẩn'], ...items().map(i => [i.code, i.ten, i.kind, i.dvt, i.gia_ban || '', i.gia_von])]); n.textContent = 'Đã xuất danh mục vật tư, hàng hóa.'; }
  });
};

// ---------- GIÁ THÀNH & CHI PHÍ ----------
let cstS = { tu: today().slice(0, 8) + '01', den: today() };
V.cost = async () => {
  const P = await qd(SB.from('production_orders').select('*').eq('status', 'hoan_thanh').gte('created_at', cstS.tu).lte('created_at', cstS.den + 'T23:59:59'));
  const ids = P.map(p => p.id), M = ids.length ? await qd(SB.from('stock_moves').select('ref_id,qty,lot_id,stock_lots(item_code,don_gia)').eq('ref_type', 'lsx').eq('loai', 'xuat_sx').in('ref_id', ids)) : [];
  const rows = P.map(p => { const ms = M.filter(m => m.ref_id === p.id), nvlKg = ms.filter(m => item(m.stock_lots?.item_code)?.kind === 'NVL').reduce((a, m) => a - +m.qty, 0), cost = ms.reduce((a, m) => a - m.qty * (+m.stock_lots?.don_gia || 0), 0), q = +p.so_luong_thuc || +p.so_luong, pr = prod(p.sku) || {}, outKg = q * (+pr.kg_moi_dv || 0); return { p, pr, q, cost, unit: q ? cost / q : 0, hh: nvlKg ? (nvlKg - outKg) / nvlKg * 100 : 0, margin: +pr.gia_ban ? (1 - (q ? cost / q : 0) / pr.gia_ban) * 100 : null }; });
  $('#view').innerHTML = `<div class="row" style="margin-bottom:10px"><label>Từ <input type="date" id="cs-a" value="${cstS.tu}" style="${inputCss}"></label><label>Đến <input type="date" id="cs-b" value="${cstS.den}" style="${inputCss}"></label></div>
  <div class="scroll"><table class="stack"><thead><tr><th>Lệnh / lô</th><th>Sản phẩm</th><th class="n">SL thực</th><th class="n">Chi phí NVL + bao bì</th><th class="n">Giá thành / ĐV</th><th class="n">Giá bán</th><th class="n">Biên lãi gộp</th><th class="n">Hao hụt thực</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td data-l="Lệnh"><b>${esc(r.p.id)}</b><br><span class="note">lô ${esc(r.p.lot_code || '')}</span></td><td data-l="SP">${esc(r.pr.ten || r.p.sku)}</td><td class="n" data-l="SL">${num(r.q, 2)} ${esc(r.pr.dvt || '')}</td><td class="n" data-l="Chi phí">${vnd(r.cost)}</td><td class="n" data-l="Giá thành"><b>${vnd(r.unit)}</b></td><td class="n" data-l="Giá bán">${vnd(r.pr.gia_ban)}</td><td class="n ${r.margin != null && r.margin < 10 ? 'bad' : ''}" data-l="Biên">${r.margin == null ? '' : num(r.margin, 1) + '%'}</td><td class="n ${r.hh > 3 ? 'bad' : ''}" data-l="Hao hụt">${num(r.hh, 2)}%</td></tr>`).join('') || '<tr><td colspan="8" class="note">Chưa có lệnh sản xuất hoàn thành trong kỳ.</td></tr>'}</tbody></table></div>
  <p class="note">Giá thành hiện tính chi phí nguyên vật liệu và bao bì thực xuất theo lô (giá nhập của từng lô). Nhân công, điện, khấu hao chưa phân bổ. Hao hụt thực = (kg NVL xuất − kg thành phẩm) / kg NVL xuất.</p>`;
  $('#cs-a').onchange = $('#cs-b').onchange = () => { cstS.tu = $('#cs-a').value; cstS.den = $('#cs-b').value; V.cost(); };
};

// ---------- ĐI TUYẾN & ẢNH ----------
async function compressImg(file, max = 1280, q = 0.7) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
  const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); g.font = `${Math.max(14, c.width / 40)}px sans-serif`; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
  const stamp = new Date().toLocaleString('vi-VN') + ' · ' + (ME.ho_ten || ''); g.strokeText(stamp, 12, c.height - 14); g.fillText(stamp, 12, c.height - 14);
  return await new Promise(ok => c.toBlob(ok, 'image/jpeg', q));
}
let rtS = { ngay: today() };
V.route = async () => {
  const mine = ME.role === 'nvkd', Vs = await qd(SB.from('visits').select('*').eq('ngay', rtS.ngay).order('tai_luc', { ascending: false }));
  const urls = {}; await Promise.all(Vs.filter(v => v.anh_path).map(async v => { const { data } = await SB.storage.from('anh').createSignedUrl(v.anh_path, 3600); urls[v.id] = data?.signedUrl; }));
  $('#view').innerHTML = `<div class="row between" style="margin-bottom:10px"><label>Ngày <input type="date" id="rt-d" value="${rtS.ngay}" style="${inputCss}"></label>${mine ? '<button class="btn pri" id="rt-new">📷 Ghé thăm đại lý</button>' : ''}</div>
  <div class="grid g2">${Vs.map(v => `<div class="card"><div class="row between"><b>${esc(dlr(v.dealer_id)?.ten || v.dealer_id)}</b><span class="note">${ftime(v.tai_luc)}</span></div><div class="note">${esc(userName(v.nvkd_id))}</div>${urls[v.id] ? `<img src="${urls[v.id]}" alt="Ảnh ghé thăm" style="width:100%;border-radius:8px;margin-top:8px">` : ''}${v.ket_qua ? `<p>${esc(v.ket_qua)}</p>` : ''}</div>`).join('') || '<p class="note">Chưa có lượt ghé thăm trong ngày.</p>'}</div>`;
  $('#rt-d').onchange = () => { rtS.ngay = $('#rt-d').value; V.route(); };
  $('#rt-new') && ($('#rt-new').onclick = () => {
    const dls = (D.dealers || []).filter(d => d.active !== false);
    openSheet(`<div class="row between"><h2>Ghé thăm đại lý</h2><button class="btn sm" id="close">Đóng</button></div><div class="field"><label for="vs-d">Đại lý</label><input id="vs-d" list="vs-dl" autocomplete="off" placeholder="Gõ tên đại lý…"><datalist id="vs-dl">${dls.map(d => `<option value="${esc(d.ten)}">${esc(d.id)}</option>`).join('')}</datalist></div>
    <div class="field"><label for="vs-f">Ảnh tại điểm bán (chụp trực tiếp)</label><input id="vs-f" type="file" accept="image/*" capture="environment"></div><div class="field"><label for="vs-k">Kết quả / ghi chú</label><input id="vs-k" placeholder="vd: đặt 50 bao NPK, hỏi giá Kali"></div><div class="err bad" id="vs-e"></div><button class="btn pri" id="vs-go">Lưu lượt ghé thăm</button>`);
    $('#vs-go').onclick = async () => {
      const d = dls.find(x => x.ten === $('#vs-d').value.trim() || x.id === $('#vs-d').value.trim()), f = $('#vs-f').files[0], e = t => $('#vs-e').textContent = t;
      if (!d) return e('Chọn đại lý trong danh sách'); if (!f) return e('Chụp ảnh tại điểm bán'); $('#vs-go').disabled = true;
      try { const blob = await compressImg(f), path = `${ME.id}/${today()}/${Date.now()}.jpg`; const up = await SB.storage.from('anh').upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
        const { error } = await SB.from('visits').insert({ offline_id: crypto.randomUUID?.(), nvkd_id: ME.id, dealer_id: d.id, anh_path: path, tai_luc: new Date().toISOString(), ket_qua: $('#vs-k').value.trim() || null }); if (error) throw error;
        closeSheet(); toast('Đã lưu lượt ghé thăm'); V.route(); } catch (x) { $('#vs-go').disabled = false; e(errMsg(x)); }
    };
  });
};

// ---------- KPI ----------
V.kpi = async () => {
  const ym = today().slice(0, 7), [K, TG, O, EV, VS] = await Promise.all([qd(SB.from('kpi_criteria').select('*').order('role')), qd(SB.from('sales_targets').select('*').eq('thang', ym)), qd(SB.from('orders').select('id,nvkd_id,ck_pct,order_lines(qty,gia)').neq('status', 'huy')), qd(SB.from('order_events').select('order_id,ts').like('action', 'Xuất kho%').gte('ts', ym + '-01')), qd(SB.from('visits').select('nvkd_id,ngay').gte('ngay', ym + '-01'))]);
  const OM = Object.fromEntries(O.map(o => [o.id, o])), rev = {}; EV.forEach(e => { const o = OM[e.order_id]; if (o) rev[o.nvkd_id] = (rev[o.nvkd_id] || 0) + (o.order_lines || []).reduce((a, l) => a + l.qty * l.gia, 0) * (1 - o.ck_pct / 100); });
  const nvs = (D.profiles || []).filter(p => p.role === 'nvkd' && p.active !== false && (ME.role !== 'nvkd' || p.id === ME.id));
  $('#view').innerHTML = `<div class="card" style="margin-bottom:14px"><h3>Kết quả tháng ${ym.slice(5)}/${ym.slice(0, 4)}</h3><div class="scroll"><table class="stack"><thead><tr><th>NVKD</th><th class="n">Doanh thu (đã xuất)</th><th class="n">Mục tiêu</th><th class="n">% đạt</th><th class="n">Lượt ghé thăm</th></tr></thead><tbody>${nvs.map(p => { const r = rev[p.id] || 0, t = +TG.find(x => x.ma === p.id)?.doanh_thu || 0; return `<tr><td data-l="NVKD">${esc(p.ho_ten)}</td><td class="n" data-l="Doanh thu">${vnd(r)}</td><td class="n" data-l="Mục tiêu">${t ? vnd(t) : '—'}</td><td class="n ${t && r / t < .6 ? 'bad' : ''}" data-l="% đạt">${t ? Math.round(r / t * 100) + '%' : ''}</td><td class="n" data-l="Ghé thăm">${VS.filter(v => v.nvkd_id === p.id).length}</td></tr>`; }).join('') || '<tr><td colspan="5" class="note">Chưa có NVKD.</td></tr>'}</tbody></table></div><p class="note">Mục tiêu đặt ở Tổng quan điều hành → "Đặt kế hoạch doanh thu".</p></div>
  <div class="card"><div class="row between"><h3 style="margin:0">Bộ tiêu chí KPI theo vai trò</h3>${ME.role === 'ceo' ? '<button class="btn sm pri" id="kn">+ Tiêu chí</button>' : ''}</div><div class="scroll"><table class="stack" style="margin-top:8px"><thead><tr><th>Vai trò</th><th>Tiêu chí</th><th class="n">Trọng số</th><th>Mục tiêu</th><th>Nguồn số liệu</th></tr></thead><tbody>${K.map(k => `<tr class="${ME.role === 'ceo' ? 'click' : ''} ${k.active === false ? 'off' : ''}" data-kid="${k.id}"><td data-l="Vai trò">${RN[k.role] || k.role}</td><td data-l="Tiêu chí">${esc(k.tieu_chi)}</td><td class="n" data-l="Trọng số">${num(k.trong_so)}%</td><td data-l="Mục tiêu">${esc(k.muc_tieu || '')}</td><td data-l="Nguồn">${esc(k.nguon || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="note">Chưa có tiêu chí.</td></tr>'}</tbody></table></div></div>`;
  const kf = k => { const isNew = !k; k = k || { role: 'nvkd', trong_so: 0, active: true };
    openSheet(`<div class="row between"><h2>${isNew ? 'Thêm' : 'Sửa'} tiêu chí KPI</h2><button class="btn sm" id="close">Đóng</button></div><div class="f2"><div class="field"><label for="k-r">Vai trò</label><select id="k-r">${Object.keys(RN).map(r => `<option value="${r}" ${r === k.role ? 'selected' : ''}>${RN[r]}</option>`).join('')}</select></div><div class="field"><label for="k-w">Trọng số (%)</label><input id="k-w" type="number" value="${k.trong_so ?? ''}"></div><div class="field full"><label for="k-t">Tiêu chí</label><input id="k-t" value="${esc(k.tieu_chi || '')}"></div><div class="field"><label for="k-m">Mục tiêu</label><input id="k-m" value="${esc(k.muc_tieu || '')}"></div><div class="field"><label for="k-n">Nguồn số liệu</label><input id="k-n" value="${esc(k.nguon || '')}" placeholder="vd: Doanh thu đã xuất"></div></div>${!isNew ? `<label class="chk"><input type="checkbox" id="k-a" ${k.active !== false ? 'checked' : ''}> Đang dùng</label>` : ''}<div class="err bad" id="k-e"></div><button class="btn pri" id="k-go">Lưu</button>`);
    $('#k-go').onclick = async () => { const o = { role: $('#k-r').value, trong_so: +$('#k-w').value || 0, tieu_chi: $('#k-t').value.trim(), muc_tieu: $('#k-m').value.trim() || null, nguon: $('#k-n').value.trim() || null }; if (!o.tieu_chi) return $('#k-e').textContent = 'Nhập tiêu chí'; if (!isNew) o.active = $('#k-a').checked; const r = isNew ? await SB.from('kpi_criteria').insert(o) : await SB.from('kpi_criteria').update(o).eq('id', k.id); if (r.error) return $('#k-e').textContent = errMsg(r.error); closeSheet(); V.kpi(); }; };
  $('#kn') && ($('#kn').onclick = () => kf(null));
  $$('[data-kid]').forEach(tr => ME.role === 'ceo' && (tr.onclick = () => kf(K.find(k => k.id === +tr.dataset.kid))));
};

// ---------- CHẤM CÔNG ----------
V.hr = async () => {
  const ym = today().slice(0, 7), all = ['ceo', 'ke_toan'].includes(ME.role);
  const A = await qd(SB.from('attendance').select('*').gte('ts', ym + '-01').order('ts', { ascending: false }).limit(5000));
  const mineToday = A.filter(a => a.user_id === ME.id && new Date(new Date(a.ts).getTime() + 7 * 3600e3).toISOString().slice(0, 10) === today());
  const lastIn = mineToday.find(a => a.loai === 'Vào ca'), lastOut = mineToday.find(a => a.loai === 'Ra ca');
  const dayKey = a => new Date(new Date(a.ts).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const sum = {}; A.forEach(a => { const k = a.user_id; sum[k] ||= { days: new Set(), ins: 0 }; if (a.loai === 'Vào ca') sum[k].days.add(dayKey(a)); });
  $('#view').innerHTML = `${ME.role !== 'dai_ly' ? `<div class="card" style="margin-bottom:14px"><h3>Chấm công hôm nay ${fdate(today())}</h3><p>${lastIn ? 'Vào ca lúc <b>' + ftime(lastIn.ts) + '</b>' : 'Chưa vào ca'}${lastOut ? ' · Ra ca lúc <b>' + ftime(lastOut.ts) + '</b>' : ''}</p><div class="row"><button class="btn pri" data-att="Vào ca">Vào ca</button><button class="btn" data-att="Ra ca">Ra ca</button></div></div>` : ''}
  ${all ? `<div class="card"><div class="row between"><h3 style="margin:0">Tổng hợp công tháng ${ym.slice(5)}/${ym.slice(0, 4)}</h3><button class="btn sm" id="hr-x">Tải Excel (CSV)</button></div><div class="scroll"><table class="stack" style="margin-top:8px"><thead><tr><th>Nhân viên</th><th>Vai trò</th><th class="n">Số ngày công</th></tr></thead><tbody>${(D.profiles || []).filter(p => p.role !== 'dai_ly' && p.active !== false).map(p => `<tr><td data-l="Nhân viên">${esc(p.ho_ten)}</td><td data-l="Vai trò">${esc(rl(p))}</td><td class="n" data-l="Ngày công">${sum[p.id]?.days.size || 0}</td></tr>`).join('')}</tbody></table></div></div>` :
    `<div class="card"><h3>Lịch sử của tôi tháng này</h3>${A.filter(a => a.user_id === ME.id).map(a => `<div class="alert"><span>${ftime(a.ts)}</span><span>${esc(a.loai)}</span></div>`).join('') || '<p class="note">Chưa có.</p>'}</div>`}`;
  $$('[data-att]').forEach(b => b.onclick = async () => { const { error } = await SB.from('attendance').insert({ offline_id: crypto.randomUUID?.(), user_id: ME.id, loai: b.dataset.att }); toast(error ? errMsg(error) : b.dataset.att + ' lúc ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })); V.hr(); });
  $('#hr-x') && ($('#hr-x').onclick = () => csvDownload(`ChamCong_${ym}.csv`, [['Nhân viên', 'Vai trò', 'Ngày', 'Vào ca', 'Ra ca'], ...(D.profiles || []).flatMap(p => [...(sum[p.id]?.days || [])].sort().map(d => { const r = A.filter(a => a.user_id === p.id && dayKey(a) === d); return [p.ho_ten, rl(p), d, ftime(r.filter(a => a.loai === 'Vào ca').at(-1)?.ts), ftime(r.find(a => a.loai === 'Ra ca')?.ts)]; }))]));
};

// ---------- khởi động ----------
(async () => {
  const { data } = await SB.auth.getSession();
  if (data?.session) afterLogin(); else showLogin(1);
})();
window.__app = { get D() { return D; }, get ME() { return ME; }, route };
