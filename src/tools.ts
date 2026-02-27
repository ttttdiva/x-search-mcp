/**
 * MCP ツール定義（search_posts, search_user_posts, analyze_topic）
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  XSearchAPIClient,
  parseHandles,
  validateIsoDate,
} from "./api-client.js";

const SEARCH_SYSTEM_PROMPT =
  "あなたは速報性の高いニュースリサーチャーです。" +
  "GrokのX検索ツールで取得した投稿について、以下の形式で報告してください:\n" +
  "1. 主要な投稿の要点を箇条書きでまとめる（各投稿にポストURLを付記）\n" +
  "2. 投稿者のハンドルとポストURLを必ず含める\n" +
  "3. 投稿日時がわかる場合は記載する";

const USER_SEARCH_SYSTEM_PROMPT =
  "あなたはSNSアナリストです。" +
  "指定されたユーザーのX投稿を分析し、以下の形式で報告してください:\n" +
  "1. 各投稿の要点をまとめる（ポストURLを付記）\n" +
  "2. 投稿の傾向やトピックを簡潔に説明する\n" +
  "3. 投稿日時がわかる場合は記載する";

const ANALYSIS_PROMPTS: Record<string, string> = {
  summary:
    "あなたはSNS分析の専門家です。" +
    "指定されたトピックについてXの投稿を調査し、以下の形式で分析結果を報告してください:\n" +
    "1. **概要**: トピックに関する全体的な状況（2-3文）\n" +
    "2. **主要な意見・情報**: 重要な投稿を箇条書きで5-8件（ポストURLを付記）\n" +
    "3. **まとめ**: 全体的な傾向や注目点",
  sentiment:
    "あなたはSNS感情分析の専門家です。" +
    "指定されたトピックについてXの投稿を調査し、以下の形式で感情分析を報告してください:\n" +
    "1. **全体的な感情傾向**: ポジティブ/ネガティブ/中立の割合感\n" +
    "2. **肯定的な意見**: 代表的な投稿を3-5件（ポストURLを付記）\n" +
    "3. **否定的な意見**: 代表的な投稿を3-5件（ポストURLを付記）\n" +
    "4. **総評**: 賛否のバランスと主な論点",
  timeline:
    "あなたはニュースタイムライン作成の専門家です。" +
    "指定されたトピックについてXの投稿を時系列で調査し、以下の形式で報告してください:\n" +
    "1. 時系列順に主要な投稿・出来事を列挙する（日時とポストURLを付記）\n" +
    "2. 各イベント間の関連性や因果関係を説明する\n" +
    "3. 最新の状況をまとめる",
};

const apiClient = new XSearchAPIClient();

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function registerSearchTools(server: McpServer): void {
  server.tool(
    "search_posts",
    "X(旧Twitter)の投稿を検索します。Grok x_search経由で最新ポストを取得します。",
    {
      query: z.string().describe("検索クエリ"),
      max_results: z.number().default(8).describe("最大結果数 (1-25)"),
      allowed_x_handles: z
        .string()
        .default("")
        .describe('検索対象ハンドル（カンマ区切り、例: "elonmusk,OpenAI"）'),
      excluded_x_handles: z
        .string()
        .default("")
        .describe("除外ハンドル（カンマ区切り）"),
      from_date: z.string().default("").describe("開始日 (YYYY-MM-DD)"),
      to_date: z.string().default("").describe("終了日 (YYYY-MM-DD)"),
      freshness: z
        .string()
        .default("auto")
        .describe("鮮度フィルタ (auto/day/week/month)"),
      search_mode: z
        .string()
        .default("auto")
        .describe("検索モード (auto/latest/popular)"),
      language: z.string().default("ja").describe("言語コード (ja/en等)"),
      enable_image_understanding: z
        .boolean()
        .default(false)
        .describe("画像理解を有効化"),
      enable_video_understanding: z
        .boolean()
        .default(false)
        .describe("動画理解を有効化"),
      temperature: z.number().default(0.2).describe("生成温度 (0.0-1.0)"),
      max_output_tokens: z
        .number()
        .default(900)
        .describe("最大出力トークン数"),
    },
    async (params) => {
      if (!params.query?.trim()) {
        return textResult("検索クエリを指定してください。");
      }

      const maxResults = Math.max(1, Math.min(25, params.max_results));
      const temperature = Math.max(0.0, Math.min(1.0, params.temperature));

      const allowed = parseHandles(params.allowed_x_handles);
      const excluded = parseHandles(params.excluded_x_handles);
      if (allowed.length > 0 && excluded.length > 0) {
        return textResult(
          "allowed_x_handlesとexcluded_x_handlesは同時に指定できません。"
        );
      }

      try {
        validateIsoDate(params.from_date, "from_date");
        validateIsoDate(params.to_date, "to_date");
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e));
      }

      const result = await apiClient.search({
        query: params.query,
        systemPrompt: SEARCH_SYSTEM_PROMPT,
        maxResults,
        allowedHandles: allowed.length > 0 ? allowed : null,
        excludedHandles: excluded.length > 0 ? excluded : null,
        fromDate: params.from_date || null,
        toDate: params.to_date || null,
        freshness: params.freshness?.toLowerCase() || "auto",
        searchMode: params.search_mode?.toLowerCase() || "auto",
        language: params.language,
        enableImageUnderstanding: params.enable_image_understanding,
        enableVideoUnderstanding: params.enable_video_understanding,
        temperature,
        maxOutputTokens: params.max_output_tokens,
      });

      return textResult(result);
    }
  );

  server.tool(
    "search_user_posts",
    "特定ユーザーのX投稿を検索します。",
    {
      username: z
        .string()
        .describe('Xのユーザー名（@なしで指定、例: "elonmusk"）'),
      query: z.string().default("").describe("追加の検索キーワード（省略可）"),
      max_results: z.number().default(10).describe("最大結果数 (1-25)"),
      from_date: z.string().default("").describe("開始日 (YYYY-MM-DD)"),
      to_date: z.string().default("").describe("終了日 (YYYY-MM-DD)"),
      freshness: z.string().default("auto").describe("鮮度フィルタ"),
      search_mode: z
        .string()
        .default("latest")
        .describe("検索モード (auto/latest/popular)"),
      language: z.string().default("ja").describe("言語コード"),
      max_output_tokens: z
        .number()
        .default(900)
        .describe("最大出力トークン数"),
    },
    async (params) => {
      if (!params.username?.trim()) {
        return textResult("ユーザー名を指定してください。");
      }

      const handle = params.username.trim().replace(/^@/, "");
      let searchQuery = `@${handle}の投稿`;
      if (params.query?.trim()) {
        searchQuery = `@${handle} ${params.query.trim()}`;
      }

      const maxResults = Math.max(1, Math.min(25, params.max_results));

      try {
        validateIsoDate(params.from_date, "from_date");
        validateIsoDate(params.to_date, "to_date");
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e));
      }

      const result = await apiClient.search({
        query: searchQuery,
        systemPrompt: USER_SEARCH_SYSTEM_PROMPT,
        maxResults,
        allowedHandles: [handle],
        fromDate: params.from_date || null,
        toDate: params.to_date || null,
        freshness: params.freshness?.toLowerCase() || "auto",
        searchMode: params.search_mode?.toLowerCase() || "latest",
        language: params.language,
        maxOutputTokens: params.max_output_tokens,
      });

      return textResult(result);
    }
  );
}

export function registerAnalysisTools(server: McpServer): void {
  server.tool(
    "analyze_topic",
    "X上でのトピックに対する反応・議論を分析します。",
    {
      topic: z.string().describe('分析対象のトピック（例: "生成AI規制"）'),
      aspect: z
        .string()
        .default("summary")
        .describe(
          "分析の観点 (summary=要約, sentiment=感情分析, timeline=時系列)"
        ),
      max_results: z.number().default(15).describe("最大結果数 (1-25)"),
      from_date: z.string().default("").describe("開始日 (YYYY-MM-DD)"),
      to_date: z.string().default("").describe("終了日 (YYYY-MM-DD)"),
      freshness: z
        .string()
        .default("week")
        .describe("鮮度フィルタ (auto/day/week/month)"),
      language: z.string().default("ja").describe("言語コード"),
      max_output_tokens: z
        .number()
        .default(1500)
        .describe("最大出力トークン数"),
    },
    async (params) => {
      if (!params.topic?.trim()) {
        return textResult("分析対象のトピックを指定してください。");
      }

      const aspect = params.aspect?.toLowerCase() || "summary";
      const systemPrompt = ANALYSIS_PROMPTS[aspect];
      if (!systemPrompt) {
        return textResult(
          `aspectは summary/sentiment/timeline のいずれかを指定してください（指定値: ${params.aspect}）`
        );
      }

      const maxResults = Math.max(1, Math.min(25, params.max_results));

      try {
        validateIsoDate(params.from_date, "from_date");
        validateIsoDate(params.to_date, "to_date");
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e));
      }

      const result = await apiClient.search({
        query: params.topic.trim(),
        systemPrompt,
        maxResults,
        fromDate: params.from_date || null,
        toDate: params.to_date || null,
        freshness: params.freshness?.toLowerCase() || "week",
        searchMode: "auto",
        language: params.language,
        temperature: 0.3,
        maxOutputTokens: params.max_output_tokens,
      });

      return textResult(result);
    }
  );
}
