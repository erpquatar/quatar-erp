// ERP QUATAR – Edge Function admin-users
// Chỉ CEO / Admin (profiles.role = 'ceo', đang hoạt động) gọi được.
// Thao tác: create | update | set_active | reset_password
// Đăng nhập bằng tên đăng nhập → email nội bộ <ten>@erp.quatar.vn (không gửi thư).
import { createClient } from "npm:@supabase/supabase-js@2";

const DOMAIN = "erp.quatar.vn";
const ROLES = ["ceo", "gsv", "nvkd", "ke_toan", "to_truong", "dai_ly"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Mật khẩu tạm dễ đọc: bỏ các ký tự dễ nhầm (0/O, 1/l/I)
function tempPassword(n = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => chars[x % chars.length]).join("");
}

function checkScope(role: string, vung?: string | null, dealer_id?: string | null) {
  if (!ROLES.includes(role)) return "Vai trò không hợp lệ";
  if ((role === "gsv" || role === "nvkd") && !vung) return "GSV / NVKD phải có vùng phụ trách";
  if (role === "dai_ly" && !dealer_id) return "Tài khoản đại lý phải gắn với một đại lý";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Chỉ nhận POST" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: who, error: whoErr } = await admin.auth.getUser(token);
    if (whoErr || !who?.user) return json({ error: "Chưa đăng nhập" }, 401);
    const callerId = who.user.id;
    const { data: me, error: meErr } = await admin.from("profiles").select("role,active").eq("id", callerId).maybeSingle();
    if (meErr) { console.error("profiles lookup failed", meErr); return json({ error: "Lỗi máy chủ khi kiểm tra quyền: " + meErr.message }, 500); }
    if (!me || me.role !== "ceo" || !me.active) { console.error("not ceo", callerId, me); return json({ error: "Chỉ CEO / Admin được quản lý tài khoản" }, 403); }

    const body = await req.json();
    const log = (thao_tac: string, khoa: string, moi: unknown) =>
      admin.from("audit_log").insert({ user_id: callerId, bang: "accounts", khoa, thao_tac, moi });

    // ---------- Tạo tài khoản kèm phân quyền ----------
    if (body.action === "create") {
      const username = String(body.username ?? "").trim().toLowerCase();
      const { ho_ten, role, sdt } = body;
      const vung = body.vung || null;
      const dealer_id = body.dealer_id || null;
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: "Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch" }, 400);
      if (!ho_ten) return json({ error: "Thiếu họ tên" }, 400);
      const bad = checkScope(role, vung, dealer_id);
      if (bad) return json({ error: bad }, 400);
      const password = body.password && String(body.password).length >= 8 ? String(body.password) : tempPassword();

      // Phiếu mời: trigger block_self_signup chỉ cho tạo user khi có phiếu (chặn tự đăng ký)
      const email = `${username}@${DOMAIN}`;
      const { error: iErr } = await admin.from("account_invites").upsert({ email, created_at: new Date().toISOString() });
      if (iErr) return json({ error: "Không tạo được phiếu mời: " + iErr.message }, 500);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { ho_ten, username },
        app_metadata: { created_by_admin: true },
      });
      if (cErr || !created?.user) {
        await admin.from("account_invites").delete().eq("email", email);
        const msg = cErr?.message?.includes("already") ? "Tên đăng nhập đã tồn tại" : cErr?.message;
        return json({ error: msg }, 400);
      }
      const id = created.user.id;
      const { error: pErr } = await admin.from("profiles").insert({
        id, ho_ten, role, vung: role === "gsv" || role === "nvkd" ? vung : null,
        dealer_id: role === "dai_ly" ? dealer_id : null, sdt: sdt || null, chuc_danh: body.chuc_danh || null,
        username, must_change_pw: true, created_by: callerId,
      });
      if (pErr) { await admin.auth.admin.deleteUser(id); return json({ error: pErr.message }, 400); }

      // Phạm vi dữ liệu: NVKD nhận danh sách đại lý phụ trách; đại lý bật/tắt quyền tự đặt hàng
      if (role === "nvkd" && Array.isArray(body.dealers) && body.dealers.length)
        await admin.from("dealers").update({ nvkd_id: id }).in("id", body.dealers);
      if (role === "dai_ly" && typeof body.tu_dat_hang === "boolean")
        await admin.from("dealers").update({ tu_dat_hang: body.tu_dat_hang }).eq("id", dealer_id);

      await log("TẠO TÀI KHOẢN", username, { role, vung, dealer_id, dealers: body.dealers ?? [] });
      return json({ id, username, password, must_change_pw: true });
    }

    const id = String(body.id ?? "");
    const { data: target } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!target) return json({ error: "Không tìm thấy tài khoản" }, 404);

    // ---------- Đổi vai trò / phạm vi / thông tin ----------
    if (body.action === "update") {
      const role = body.role ?? target.role;
      const vung = body.vung !== undefined ? body.vung || null : target.vung;
      const dealer_id = body.dealer_id !== undefined ? body.dealer_id || null : target.dealer_id;
      const bad = checkScope(role, vung, dealer_id);
      if (bad) return json({ error: bad }, 400);
      if (id === callerId && role !== "ceo") return json({ error: "Không tự hạ quyền của chính mình" }, 400);
      const { error } = await admin.from("profiles").update({
        role, ho_ten: body.ho_ten ?? target.ho_ten, sdt: body.sdt ?? target.sdt,
        chuc_danh: body.chuc_danh !== undefined ? body.chuc_danh || null : target.chuc_danh,
        vung: role === "gsv" || role === "nvkd" ? vung : null,
        dealer_id: role === "dai_ly" ? dealer_id : null,
      }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      if (role === "nvkd" && Array.isArray(body.dealers)) {
        await admin.from("dealers").update({ nvkd_id: null }).eq("nvkd_id", id).not("id", "in", `(${body.dealers.map((d: string) => `"${d}"`).join(",") || '""'})`);
        if (body.dealers.length) await admin.from("dealers").update({ nvkd_id: id }).in("id", body.dealers);
      }
      await log("SỬA PHÂN QUYỀN", target.username ?? id, { truoc: { role: target.role, vung: target.vung, dealer_id: target.dealer_id }, sau: { role, vung, dealer_id } });
      return json({ ok: true });
    }

    // ---------- Khóa / mở tài khoản ----------
    if (body.action === "set_active") {
      const active = !!body.active;
      if (id === callerId && !active) return json({ error: "Không tự khóa tài khoản của mình" }, 400);
      await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
      await admin.from("profiles").update({ active }).eq("id", id);
      await log(active ? "MỞ KHÓA" : "KHÓA TÀI KHOẢN", target.username ?? id, { active });
      return json({ ok: true });
    }

    // ---------- Đặt lại mật khẩu (bắt đổi ở lần đăng nhập sau) ----------
    if (body.action === "reset_password") {
      const password = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ must_change_pw: true }).eq("id", id);
      await log("ĐẶT LẠI MẬT KHẨU", target.username ?? id, {});
      return json({ password });
    }

    return json({ error: "Thao tác không hợp lệ" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
