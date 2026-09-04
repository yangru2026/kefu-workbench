// ============================================================
// Edge Function: reset-password  （重置客服工作台登录密码）
// 安全模型：
//   1. 必须带登录态（Authorization: Bearer <用户JWT>）
//   2. 服务端查 profiles 校验调用者 role === 'admin' 且未停用
//   3. 用内置 SUPABASE_SERVICE_ROLE_KEY 走 admin API 改密（密钥不出服务端）
// 部署：Supabase Dashboard → Edge Functions → Create a new function
//       → 命名 reset-password → 粘贴本文件全部代码 → Deploy
// 前端调用：supabase.functions.invoke('reset-password', { body: { phone, new_password } })
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, message: "未登录" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. 校验调用者登录态
    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) {
      return json({ ok: false, message: "登录状态无效，请重新登录" }, 401);
    }

    // 2. 校验调用者是管理员（admin 角色、未被停用）
    const { data: prof } = await admin
      .from("profiles")
      .select("role,status")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!prof || prof.role !== "admin" || prof.status === "disabled") {
      return json({ ok: false, message: "仅管理员可重置密码" }, 403);
    }

    // 3. 参数校验
    const { phone, new_password } = await req.json();
    if (!phone || typeof phone !== "string") {
      return json({ ok: false, message: "缺少手机号" });
    }
    if (!new_password || String(new_password).length < 6) {
      return json({ ok: false, message: "新密码至少 6 位" });
    }
    const email = phone.trim() + "@youhu.app";

    // 4. 按邮箱找到账号（分页遍历，客服规模足够用）
    let target: { id: string } | null = null;
    for (let page = 1; page <= 10 && !target; page++) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page,
        perPage: 500,
      });
      if (listErr) {
        return json({ ok: false, message: "查询账号失败：" + listErr.message });
      }
      target =
        (list?.users || []).find(
          (u: { email?: string }) =>
            (u.email || "").toLowerCase() === email.toLowerCase()
        ) || null;
    }
    if (!target) {
      return json({
        ok: false,
        message: "未找到手机号 " + phone + " 对应的账号，请确认该客服已注册工作台",
      });
    }

    // 5. 重置密码
    const { error: upErr } = await admin.auth.admin.updateUserById(target.id, {
      password: String(new_password),
    });
    if (upErr) {
      return json({ ok: false, message: "重置失败：" + upErr.message });
    }

    return json({ ok: true, email, message: "密码已重置" });
  } catch (e) {
    return json(
      { ok: false, message: "服务异常：" + ((e as Error)?.message || e) },
      500
    );
  }
});
