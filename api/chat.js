/**
 * 青序 · Vercel Serverless 代理（隐藏智谱 Key，绕开浏览器 CORS）
 *
 * 职责划分（严格分层）：
 *   - 前端（src/lib/llmClient.ts）：只负责 UI 与发送 messages，不包含任何 Key、不携带任何 Authorization 头。
 *   - 本函数（服务端）：从环境变量读取 ZHIPU_API_KEY，写死
 *     Authorization: Bearer ${process.env.ZHIPU_API_KEY}，
 *     把请求转发到智谱大模型，再把结果原样返回给前端。
 *
 * 这样用户打开网页无需任何配置即可直接聊天；Key 永不进入浏览器、也不会触发 CORS。
 * 部署：在 Vercel 的环境变量中配置 ZHIPU_API_KEY（可选 ZHIPU_BASE_URL / ZHIPU_MODEL）后重新部署。
 */
export const config = {
  runtime: "nodejs",
};

const ZHIPU_BASE_DEFAULT = "https://open.bigmodel.cn/api/paas/v4";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function sendJSON(payload, status, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extra,
    },
  });
}

export default async function handler(req) {
  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return sendJSON({ error: { message: "仅支持 POST 请求" } }, 405);
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return sendJSON(
      {
        error: {
          message:
            "服务端尚未配置 ZHIPU_API_KEY：请部署者在服务端环境变量中填入你的智谱 API Key（例如 Vercel 的 Settings → Environment Variables 新增 ZHIPU_API_KEY，或自有服务器启动时 export ZHIPU_API_KEY=...），配置后重新部署/重启即可。",
        },
      },
      500
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return sendJSON({ error: { message: "请求体不是合法 JSON" } }, 400);
  }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return sendJSON({ error: { message: "缺少 messages 字段" } }, 400);
  }

  const baseURL = (process.env.ZHIPU_BASE_URL || ZHIPU_BASE_DEFAULT).replace(/\/+$/, "");
  const model = process.env.ZHIPU_MODEL || "glm-4-flash";
  const upstream = `${baseURL}/chat/completions`;

  try {
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 写死：服务端隐藏 Key，浏览器永远拿不到、也无需配置
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.85,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 800,
        stream: false,
      }),
    });
    const text = await upstreamRes.text();
    return new Response(text, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders(),
      },
    });
  } catch (e) {
    return sendJSON(
      { error: { message: `转发到智谱失败：${e?.message ?? String(e)}` } },
      502
    );
  }
}
