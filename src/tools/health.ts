import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SshConfig } from "../lib/ssh.js";
import { asTextResult, runDiag } from "./util.js";

export function registerHealthTools(server: McpServer, ssh: SshConfig) {
  server.registerTool(
    "health",
    {
      description:
        "Check a configured Symfony readiness endpoint (default: http://127.0.0.1:8000/ready) from the server (loopback only).",
      inputSchema: {
        // Allow overriding, but remote runner will restrict this to loopback-only URLs.
        url: z.string().url().optional().describe("Optional readiness URL (loopback only)."),
      },
    },
    async ({ url }) => {
      const res = await runDiag(ssh, "health", url ? { url } : undefined);
      return asTextResult(res.output);
    },
  );

  server.registerTool(
    "ready",
    {
      description:
        "Check a configured Symfony readiness endpoint (default: http://127.0.0.1:8000/ready) from the server (loopback only).",
      inputSchema: {
        // Allow overriding, but remote runner will restrict this to loopback-only URLs.
        url: z.string().url().optional().describe("Optional readiness URL (loopback only)."),
      },
    },
    async ({ url }) => {
      const res = await runDiag(ssh, "ready", url ? { url } : undefined);
      return asTextResult(res.output);
    },
  );
}
