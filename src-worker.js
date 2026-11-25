const COOKIE_NAME = "astor_session";
const encoder = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
function redirect(url, status = 302) {
  return new Response(null, { status, headers: { Location: url } });
}
function cookieOptions(maxAge) {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function makeSession(user, secret) {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    user, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${payload}.${await hmac(secret, payload)}`;
}
async function readSession(request, secret) {
  const raw = request.headers.get("Cookie") || "";
  const match = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const [payload, signature] = match[1].split(".");
  if (!payload || !signature || !(await hmac(secret, payload) === signature)) return null;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(decodeURIComponent(escape(decoded)));
    if (!data.user || data.exp < Date.now() / 1000) return null;
    return data.user;
  } catch { return null; }
}
async function discordBot(env, endpoint, options = {}) {
  return fetch(`https://discord.com/api/v10${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}
async function handleApi(request, env, url) {
  if (url.pathname === "/auth/discord") {
    const callback = `${url.origin}/auth/discord/callback`;
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: callback,
      response_type: "code",
      scope: "identify"
    });
    return redirect(`https://discord.com/oauth2/authorize?${params}`);
  }

  if (url.pathname === "/auth/discord/callback") {
    const code = url.searchParams.get("code");
    if (!code) return redirect("/?login=failed");
    const callback = `${url.origin}/auth/discord/callback`;
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: callback
      })
    });
    if (!tokenRes.ok) return redirect("/?login=failed");
    const token = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    if (!userRes.ok) return redirect("/?login=failed");
    const d = await userRes.json();
    const user = {
      id: d.id,
      username: d.global_name || d.username,
      avatar: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png` : null
    };
    const session = await makeSession(user, env.SESSION_SECRET);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": `${COOKIE_NAME}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
      }
    });
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    return json({ user: await readSession(request, env.SESSION_SECRET) });
  }

  if (url.pathname === "/auth/logout" && request.method === "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "Set-Cookie": cookieOptions(0) }
    });
  }

  const user = await readSession(request, env.SESSION_SECRET);
  if (!user) return json({ error: "Khassek tdir login b Discord luwel." }, 401);

  if (url.pathname === "/api/whitelist" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid form." }, 400); }
    const { characterName, age, experience, story } = body;
    if (![characterName, age, experience, story].every(v => typeof v === "string" && v.trim())) {
      return json({ error: "3ammer ga3 lkhانات." }, 400);
    }
    if (characterName.length > 60 || age.length > 3 || experience.length > 1000 || story.length > 1500) {
      return json({ error: "Chi jawab twil بزاف." }, 400);
    }
    const embed = {
      title: "ASTOR ROLE PLAY — New Whitelist Application",
      color: 0x258BFF,
      fields: [
        { name: "Discord", value: `<@${user.id}> (${user.username})` },
        { name: "Character Name", value: characterName.trim() },
        { name: "Age", value: age.trim() },
        { name: "RP Experience", value: experience.trim() },
        { name: "Character Story", value: story.trim() }
      ],
      footer: { text: `ASTOR ROLE PLAY • Discord ID: ${user.id}` },
      timestamp: new Date().toISOString()
    };
    if (!env.DISCORD_WEBHOOK_URL) return json({ error: "DISCORD_WEBHOOK_URL is missing in Worker secrets." }, 500);
    const sent = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
    if (!sent.ok) return json({ error: "Discord webhook error. Check your webhook URL." }, 502);
    return json({ ok: true, message: "Whitelist dyalek tsift l Staff!" });
  }

  if (url.pathname === "/api/tickets" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid form." }, 400); }
    const allowed = ["Support", "Player Report", "Bug Report", "Staff Application"];
    if (!allowed.includes(body.topic) || typeof body.details !== "string" || !body.details.trim() || body.details.length > 1500) {
      return json({ error: "Khtar naw3 ticket w kteb التفاصيل." }, 400);
    }
    if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) {
      return json({ error: "Ticket setup incomplete: add DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in Worker secrets." }, 500);
    }
    const safeName = `ticket-${String(user.username).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 65) || user.id}`;
    const overwrites = [
      { id: env.DISCORD_GUILD_ID, type: 0, deny: "1024" },
      { id: user.id, type: 1, allow: "101376" }
    ];
    if (env.STAFF_ROLE_ID) overwrites.push({ id: env.STAFF_ROLE_ID, type: 0, allow: "68608" });
    const channelBody = {
      name: safeName,
      type: 0,
      topic: `ASTOR ROLE PLAY ticket for ${user.id} | ${body.topic}`,
      permission_overwrites: overwrites
    };
    if (env.TICKET_CATEGORY_ID) channelBody.parent_id = env.TICKET_CATEGORY_ID;
    const created = await discordBot(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`, {
      method: "POST", body: JSON.stringify(channelBody)
    });
    if (!created.ok) {
      const detail = await created.text();
      console.error("Discord channel create failed", created.status, detail);
      return json({ error: "Ticket ma t7ellch. Check bot permissions and IDs." }, 502);
    }
    const channel = await created.json();
    const msg = await discordBot(env, `/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: `<@${user.id}> **${body.topic}**\n\n${body.details.trim()}\n\nASTOR ROLE PLAY Staff ghadi yjawبوك hna.` })
    });
    if (!msg.ok) return json({ error: "Channel created but bot could not send the first message. Check Send Messages permission." }, 502);
    return json({ ok: true, channelUrl: `https://discord.com/channels/${env.DISCORD_GUILD_ID}/${channel.id}` });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env, url); }
      catch (err) {
        console.error(err);
        return json({ error: "Server error. Check Worker logs and environment secrets." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};