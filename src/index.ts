#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchTools, registerAnalysisTools } from "./tools.js";

const server = new McpServer({
  name: "x_search",
  version: "0.1.0",
});

registerSearchTools(server);
registerAnalysisTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("X Search MCP サーバー起動完了");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
