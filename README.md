# X Search MCP Server

X (旧 Twitter) の投稿をリアルタイム検索・分析する [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) サーバーです。

xAI の Grok API が提供する `x_search` ツールを利用して、最新の X 投稿を取得します。

## 提供ツール

| ツール名 | 説明 |
|---|---|
| `search_posts` | キーワードで X 投稿を検索 |
| `search_user_posts` | 特定ユーザーの投稿を検索 |
| `analyze_topic` | トピックに対する反応・議論を分析（要約 / 感情分析 / 時系列） |

## セットアップ

### 1. xAI API キーの取得

[xAI Console](https://console.x.ai/) でアカウントを作成し、API キーを取得してください。

### 2. インストール

```bash
git clone https://github.com/yourname/x-search-mcp.git
cd x-search-mcp
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -e .
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して `XAI_API_KEY` を設定してください。

```
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxx
```

## 使い方

### MCP クライアントから接続する

#### Claude Desktop

`claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "x_search": {
      "command": "python",
      "args": ["-m", "x_search_mcp"],
      "cwd": "/path/to/x-search-mcp",
      "env": {
        "XAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

> venv を使う場合は `command` を venv 内の Python パスに変更してください。

#### その他の MCP クライアント

STDIO トランスポートで接続します:

```bash
python -m x_search_mcp
```

### ツールの詳細

#### `search_posts` — 投稿検索

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `query` | string | (必須) | 検索クエリ |
| `max_results` | int | 8 | 最大結果数 (1-25) |
| `allowed_x_handles` | string | "" | 検索対象ハンドル（カンマ区切り） |
| `excluded_x_handles` | string | "" | 除外ハンドル（カンマ区切り） |
| `from_date` | string | "" | 開始日 (YYYY-MM-DD) |
| `to_date` | string | "" | 終了日 (YYYY-MM-DD) |
| `freshness` | string | "auto" | 鮮度フィルタ (auto/day/week/month) |
| `search_mode` | string | "auto" | 検索モード (auto/latest/popular) |
| `language` | string | "ja" | 言語コード |
| `enable_image_understanding` | bool | false | 画像理解を有効化 |
| `enable_video_understanding` | bool | false | 動画理解を有効化 |
| `temperature` | float | 0.2 | 生成温度 (0.0-1.0) |
| `max_output_tokens` | int | 900 | 最大出力トークン数 |

#### `search_user_posts` — ユーザー投稿検索

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `username` | string | (必須) | X のユーザー名（@なしで指定） |
| `query` | string | "" | 追加の検索キーワード |
| `max_results` | int | 10 | 最大結果数 (1-25) |
| `from_date` | string | "" | 開始日 (YYYY-MM-DD) |
| `to_date` | string | "" | 終了日 (YYYY-MM-DD) |
| `freshness` | string | "auto" | 鮮度フィルタ |
| `search_mode` | string | "latest" | 検索モード |
| `language` | string | "ja" | 言語コード |
| `max_output_tokens` | int | 900 | 最大出力トークン数 |

#### `analyze_topic` — トピック分析

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `topic` | string | (必須) | 分析対象トピック |
| `aspect` | string | "summary" | 分析観点 (summary/sentiment/timeline) |
| `max_results` | int | 15 | 最大結果数 (1-25) |
| `from_date` | string | "" | 開始日 (YYYY-MM-DD) |
| `to_date` | string | "" | 終了日 (YYYY-MM-DD) |
| `freshness` | string | "week" | 鮮度フィルタ |
| `language` | string | "ja" | 言語コード |
| `max_output_tokens` | int | 1500 | 最大出力トークン数 |

**`aspect` の種類:**

- `summary` — 主要な投稿と全体的な傾向をまとめる
- `sentiment` — 肯定・否定・中立の感情を分析する
- `timeline` — 時系列で出来事の流れを追う

## 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `XAI_API_KEY` | Yes | — | xAI API キー |
| `GROK_API_KEY` | No | — | `XAI_API_KEY` 未設定時のフォールバック |
| `XAI_GROK_MODEL` | No | `grok-4-0709` | 使用する Grok モデル |
| `XAI_API_BASE` | No | `https://api.x.ai/v1` | API ベース URL |

## テスト

```bash
pip install -e ".[dev]"
pytest
```

## ライセンス

MIT
