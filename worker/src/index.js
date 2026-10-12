const allowedOrigins = new Set([
  "https://babystock.pages.dev",
  "http://localhost",
  "capacitor://localhost"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://babystock.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin"
  };
}

function response(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=UTF-8", ...corsHeaders(request) } });
}

function readJwtSubject(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).user_id || JSON.parse(atob(payload)).sub || "";
  } catch { return ""; }
}

function mapKeys(value) { return Object.keys(value?.mapValue?.fields || {}); }
function text(value, limit) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit); }

async function familyForToken(env, token, familyId) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/families/${encodeURIComponent(familyId)}`;
  const result = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!result.ok) return null;
  return result.json();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/notify") return response(request, { error: "Not found" }, 404);
    if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) return response(request, { error: "Worker not configured" }, 503);

    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const senderId = readJwtSubject(token);
    if (!token || !senderId) return response(request, { error: "Unauthorized" }, 401);

    let payload;
    try { payload = await request.json(); } catch { return response(request, { error: "Invalid JSON" }, 400); }
    const familyId = text(payload.familyId, 160);
    const event = text(payload.event, 30);
    if (!familyId || !["family-post", "low-stock"].includes(event)) return response(request, { error: "Invalid event" }, 400);

    // Firestore verifica la firma del token y sus reglas determinan si este usuario puede leer la familia.
    const family = await familyForToken(env, token, familyId);
    const fields = family?.fields || {};
    const members = new Set([...mapKeys(fields.members), ...mapKeys(fields.roles)]);
    if (!family || !members.has(senderId)) return response(request, { error: "Forbidden" }, 403);

    const recipients = [...members].filter((id) => id !== senderId).map((id) => `babystock:${familyId}:${id}`);
    if (!recipients.length) return response(request, { ok: true, sent: 0 });

    const title = text(payload.title, 70) || "BabyStock";
    const body = text(payload.body, 180) || "Tienes una actualización familiar.";
    const oneSignal = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Key ${env.ONESIGNAL_REST_API_KEY}` },
      body: JSON.stringify({
        app_id: env.ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: recipients },
        headings: { en: title },
        contents: { en: body },
        data: { familyId, event, destination: "family" }
      })
    });
    if (!oneSignal.ok) {
      const detail = await oneSignal.text();
      console.error("OneSignal rejected notification", oneSignal.status, detail);
      return response(request, { error: "Notification service rejected request" }, 502);
    }
    return response(request, { ok: true, sent: recipients.length });
  }
};
