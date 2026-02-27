/**
 * xAI Grok API クライアント（X検索用）
 */

/** カンマ区切りのXハンドル文字列をリストに変換する。@/＠プレフィックスを除去。 */
export function parseHandles(rawValue: string): string[] {
  if (!rawValue) return [];
  const handles: string[] = [];
  for (const part of rawValue.replace(/\uff20/g, "@").split(",")) {
    let handle = part.trim();
    if (!handle) continue;
    if (handle.startsWith("@")) handle = handle.slice(1);
    if (handle) handles.push(handle);
  }
  return handles;
}

/** YYYY-MM-DD形式の日付文字列を検証する。空文字はnullを返す。 */
export function validateIsoDate(value: string, label: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || isNaN(new Date(value).getTime())) {
    throw new Error(`${label}はYYYY-MM-DD形式で指定してください: ${value}`);
  }
  return value;
}

/** Grok API レスポンスからテキストを抽出する。 */
export function extractTextFromResponse(payload: Record<string, unknown>): string {
  // 最優先: トップレベル output_text
  const outputText = payload.output_text;
  if (outputText) {
    if (Array.isArray(outputText)) {
      return outputText.map(String).join("\n").trim();
    }
    return String(outputText).trim();
  }

  // output 配列からメッセージを抽出
  let outputs = payload.output;
  if (!Array.isArray(outputs)) outputs = [];

  const texts: string[] = [];
  for (const item of outputs as unknown[]) {
    if (typeof item === "string") {
      texts.push(item);
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    if (obj.type !== "message") continue;

    const content = obj.content;
    if (typeof content === "string") {
      if (content) texts.push(content);
      continue;
    }
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (typeof block === "string") {
        if (block) texts.push(block);
        continue;
      }
      if (typeof block !== "object" || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b.type === "output_text" || b.type === "text") {
        const textValue = (b.text || b.output_text) as string | undefined;
        if (textValue) texts.push(String(textValue));
      }
    }
  }
  if (texts.length > 0) return texts.join("\n").trim();

  // フォールバック: JSON全体
  return JSON.stringify(payload);
}

export interface SearchOptions {
  query: string;
  systemPrompt: string;
  maxResults?: number;
  allowedHandles?: string[] | null;
  excludedHandles?: string[] | null;
  fromDate?: string | null;
  toDate?: string | null;
  freshness?: string;
  searchMode?: string;
  language?: string;
  enableImageUnderstanding?: boolean;
  enableVideoUnderstanding?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutSeconds?: number;
}

export class XSearchAPIClient {
  private apiKey: string;
  private apiBase: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
    this.apiBase = process.env.XAI_API_BASE || "https://api.x.ai/v1";
    this.model = process.env.XAI_GROK_MODEL || "grok-4-0709";
  }

  async search(options: SearchOptions): Promise<string> {
    if (!this.apiKey) {
      return "XAI_API_KEY (またはGROK_API_KEY) が設定されていません。";
    }

    const toolConfig: Record<string, unknown> = {
      max_results: options.maxResults ?? 8,
      search_mode: options.searchMode ?? "auto",
      freshness: options.freshness ?? "auto",
      language: options.language ?? "ja",
    };
    if (options.allowedHandles?.length)
      toolConfig.allowed_x_handles = options.allowedHandles;
    if (options.excludedHandles?.length)
      toolConfig.excluded_x_handles = options.excludedHandles;
    if (options.fromDate) toolConfig.from_date = options.fromDate;
    if (options.toDate) toolConfig.to_date = options.toDate;
    if (options.enableImageUnderstanding)
      toolConfig.enable_image_understanding = true;
    if (options.enableVideoUnderstanding)
      toolConfig.enable_video_understanding = true;

    const payload = {
      model: this.model,
      input: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.query.trim() },
      ],
      tools: [{ type: "x_search", x_search: toolConfig }],
      temperature: options.temperature ?? 0.2,
      max_output_tokens: options.maxOutputTokens ?? 900,
    };

    const url = `${this.apiBase.replace(/\/+$/, "")}/responses`;
    const timeoutMs = (options.timeoutSeconds ?? 45) * 1000;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return `Grok APIへの接続に失敗しました: ${err}`;
    }

    // body は一度しか読めないので text() で取得してから JSON.parse
    const rawBody = await response.text();

    if (response.status >= 300) {
      try {
        const errorPayload = JSON.parse(rawBody);
        const err = errorPayload.error;
        let errorMessage: string;
        if (typeof err === "object" && err !== null) {
          errorMessage = err.message || JSON.stringify(err);
        } else if (typeof err === "string" && err) {
          errorMessage = err;
        } else {
          errorMessage = JSON.stringify(errorPayload);
        }
        return `Grok APIエラー(${response.status}): ${errorMessage}`;
      } catch {
        return `Grok APIエラー(${response.status}): ${rawBody}`;
      }
    }

    let responsePayload: Record<string, unknown>;
    try {
      responsePayload = JSON.parse(rawBody);
    } catch {
      return `Grok APIの応答を解析できませんでした: ${rawBody}`;
    }

    const text = extractTextFromResponse(responsePayload);
    return text || JSON.stringify(responsePayload);
  }
}
