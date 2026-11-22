// ERP Quatar – app thật (Supabase). Phase 1: đăng nhập, phân quyền, danh mục, kho (nhập / xuất / điều chuyển / tồn).
const CFG = {
  url: 'https://qfjarxoymmabropgscek.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmamFyeG95bW1hYnJvcGdzY2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMTU1NTgsImV4cCI6MjExMDg5MTU1OH0._ccBX9tTCE_0WxhgkP6hqpmRaTbM3bK5G6L3vExTafo',
  domain: 'erp.quatar.vn',
  version: '0.4 · 22/11/2026'
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
  dash: { t: 'Tổng quan & thiết lập', g: 'dh' }, inbox: { t: 'Chờ CEO duyệt', g: 'dh' }, cost: { t: 'Giá thành & chi phí', g: 'dh' },
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
  nav(); $('#title').textContent = VIEWS[cur]?.t || 'ERP';
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
  await loadLots();
  const val = LOTS.reduce((a, l) => a + (+l.qty || 0) * (+l.don_gia || 0), 0);
  const steps = [
    ['dm_kho', 'Kho & vị trí lưu', (D.locations || []).filter(l => !isQuar(l.id)).length, 'vị trí'],
    ['dm_chung', 'Danh mục chung (ĐVT, vùng, nhóm hàng, bộ phận)', (D.units || []).length, 'ĐVT'],
    ['dm_ncc', 'Nhà cung cấp', (D.suppliers || []).length, 'NCC'],
    ['dm_nvl', 'Nguyên vật liệu', (D.materials || []).filter(m => m.loai === 'NVL').length, 'mã'],
    ['dm_bb', 'Bao bì', (D.materials || []).filter(m => m.loai === 'Bao bì').length, 'mã'],
    ['dm_tp', 'Thành phẩm', (D.products || []).length, 'SKU'],
    ['dm_kh', 'Khách hàng / đại lý', (D.dealers || []).length, 'khách'],
    ['perm', 'Tài khoản người dùng', (D.profiles || []).length, 'tài khoản'],
    ['nhap', 'Tồn đầu kỳ (phiếu Nhập khác – Tồn đầu kỳ)', LOTS.length, 'lô đang tồn']];
  $('#view').innerHTML = `<div class="grid g3" style="margin-bottom:16px">
   <div class="card"><div class="note">Giá trị tồn kho</div><div style="font-size:24px;font-weight:700">${vnd(val)}</div></div>
   <div class="card"><div class="note">Mặt hàng đang có tồn</div><div style="font-size:24px;font-weight:700">${num(new Set(LOTS.map(l => l.item_code)).size)}</div></div>
   <div class="card"><div class="note">Người dùng đang hoạt động</div><div style="font-size:24px;font-weight:700">${num((D.profiles || []).filter(p => p.active !== false).length)}</div></div></div>
  <div class="card"><h3>Các bước thiết lập ban đầu</h3><p class="note" style="margin-top:-6px">Làm lần lượt từ trên xuống. Danh mục phải có trước thì phiếu kho và đơn hàng mới chọn được.</p>
  <table><tbody>${steps.map(([v, t, n, u], i) => `<tr class="${PERM[v] ? 'click' : ''}" data-go="${PERM[v] ? v : ''}"><td style="width:28px"><span class="vno">${i + 1}</span></td><td>${t}</td><td class="n">${n ? `<span class="ok">${num(n)} ${u}</span>` : '<span class="pill p-wait">Chưa có</span>'}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Phiên bản ${CFG.version}. Các phân hệ còn lại (đơn hàng, sản xuất, mua hàng, giao vận…) sẽ lần lượt được bật.</p>`;
  $$('[data-go]').forEach(r => r.dataset.go && (r.onclick = () => location.hash = r.dataset.go));
};

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

// ---------- khởi động ----------
(async () => {
  const { data } = await SB.auth.getSession();
  if (data?.session) afterLogin(); else showLogin(1);
})();
window.__app = { get D() { return D; }, get ME() { return ME; }, route };
