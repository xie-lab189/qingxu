/**
 * 青序 · 大模型客户端（纯前端，零 Key、零配置）
 *
 * 只向同源的 /api/chat 发送对话请求（messages 已含 system 灵魂提示）。
 * 浏览器既不持有 API Key、也不发送任何 Authorization 头；真正的 Key 与
 * 对智谱的转发全部由服务端代理（api/chat.js 或 server/index.js）完成，
 * 因此用户打开网页无需任何配置即可直接聊天，也不存在 CORS / 泄露问题。
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 统一错误类型：前端据此在聊天框以红色提示 */
export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

export async function callLLM(params: {
  systemPrompt: string;
  history: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const messages: LLMMessage[] = [
    { role: "system", content: params.systemPrompt },
    ...params.history,
  ];

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: params.temperature ?? 0.85,
        max_tokens: params.maxTokens ?? 800,
        stream: false,
      }),
      signal: params.signal,
    });
  } catch {
    // 网络层失败（服务端代理未部署 / 用户离线）
    throw new LLMError("网络似乎断开了，没能连上对话服务，请稍后再试。");
  }

  // 非 2xx：解析上游返回的错误信息（Key 未配置、余额不足、模型不存在等）
  if (!res.ok) {
    let reason = `请求失败（${res.status}）`;
    try {
      const data = await res.json();
      if (data?.error?.message) reason = data.error.message;
    } catch {
      /* 响应体非 JSON，沿用状态码提示 */
    }
    throw new LLMError(reason);
  }

  const data = await res.json().catch(() => null);
  const content: string =
    data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
  if (!content || !content.trim()) {
    throw new LLMError("模型返回为空，请再试一次。");
  }
  return content.trim();
}
