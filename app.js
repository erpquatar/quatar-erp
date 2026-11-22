// ERP Quatar – app thật (Supabase). Phase 1: đăng nhập, phân quyền, danh mục, kho (nhập / xuất / điều chuyển / tồn).
const CFG = {
  url: 'https://qfjarxoymmabropgscek.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmamFyeG95bW1hYnJvcGdzY2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMTU1NTgsImV4cCI6MjExMDg5MTU1OH0._ccBX9tTCE_0WxhgkP6hqpmRaTbM3bK5G6L3vExTafo',
  domain: 'erp.quatar.vn',
  version: '0.1 · 22/11/2026'
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
const TABLES = ['units', 'regions', 'item_groups', 'departments', 'stock_reasons', 'warehouses', 'locations', 'products', 'materials', 'suppliers', 'dealers', 'carriers', 'machines', 'profiles'];
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
  $('#view').innerHTML = `<div class="ph"><b>${esc(VIEWS[cur]?.t)}</b><br>Phân hệ này đang được xây dựng ở bước tiếp theo. Bản demo đã có giao diện mẫu để tham khảo.</div>`;
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

// ---------- khởi động ----------
(async () => {
  const { data } = await SB.auth.getSession();
  if (data?.session) afterLogin(); else showLogin(1);
})();
window.__app = { get D() { return D; }, get ME() { return ME; }, route };
