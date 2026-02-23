import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SshConfig } from "../lib/ssh.js";
import { asTextResult, runDiag } from "./util.js";

export function registerCacheTools(server: McpServer, ssh: SshConfig) {
  server.registerTool(
    "cache_status",
    {
      description:
        "Inspect Symfony cache artifacts (var/cache/*) with basic metadata (no secrets).",
      inputSchema: {},
    },
    async () => asTextResult((await runDiag(ssh, "cache.status")).output),
  );
}
