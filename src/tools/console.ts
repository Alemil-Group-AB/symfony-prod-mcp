import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SshConfig } from "../lib/ssh.js";
import { asTextResult, runDiag } from "./util.js";

export function registerConsoleTools(
  server: McpServer,
  ssh: SshConfig,
  policy: { enableMutations: boolean },
) {
  // ---- Safe, read-mostly console commands ----

  server.registerTool(
    "console_about",
    { description: "Run `php bin/console about` (safe summary).", inputSchema: {} },
    async () => asTextResult((await runDiag(ssh, "console.about")).output),
  );

  server.registerTool(
    "console_version",
    { description: "Run `php bin/console --version`.", inputSchema: {} },
    async () => asTextResult((await runDiag(ssh, "console.version")).output),
  );

  server.registerTool(
    "console_debug_router",
    { description: "Run `php bin/console debug:router` (route list).", inputSchema: {} },
    async () => asTextResult((await runDiag(ssh, "console.debug_router")).output),
  );

  server.registerTool(
    "console_doctrine_migrations_status",
    {
      description:
        "Run `php bin/console doctrine:migrations:status` (if Doctrine Migrations is installed).",
      inputSchema: {},
    },
    async () => asTextResult((await runDiag(ssh, "console.doctrine_migrations_status")).output),
  );

  server.registerTool(
    "console_doctrine_schema_validate",
    {
      description:
        "Run `php bin/console doctrine:schema:validate` (if Doctrine ORM is installed).",
      inputSchema: {},
    },
    async () => asTextResult((await runDiag(ssh, "console.doctrine_schema_validate")).output),
  );

  server.registerTool(
    "console_messenger_failed",
    {
      description:
        "Show Symfony Messenger failed messages (uses `messenger:failed:show` with `--stats`).",
      inputSchema: {
        transport: z
          .string()
          .min(1)
          .max(64)
          .optional()
          .describe("Optional messenger transport name (e.g. `failed`, `async`)."),
      },
    },
    async ({ transport }) =>
      asTextResult((await runDiag(ssh, "console.messenger_failed", { transport })).output),
  );

  // ---- Mutations (disabled by default; "break-glass") ----

  server.registerTool(
    "console_cache_clear",
    {
      description:
        "BREAK-GLASS: Run `php bin/console cache:clear --no-warmup`. Disabled unless SYMFONY_PROD_ENABLE_MUTATIONS=1.",
      inputSchema: {},
    },
    async () => {
      if (!policy.enableMutations) {
        return asTextResult(
          "Refused: mutations are disabled. Set SYMFONY_PROD_ENABLE_MUTATIONS=1 on the MCP server *and* allow this tool in Codex enabled_tools.",
        );
      }
      return asTextResult((await runDiag(ssh, "console.cache_clear")).output);
    },
  );

  server.registerTool(
    "console_cache_warmup",
    {
      description:
        "BREAK-GLASS: Run `php bin/console cache:warmup`. Disabled unless SYMFONY_PROD_ENABLE_MUTATIONS=1.",
      inputSchema: {},
    },
    async () => {
      if (!policy.enableMutations) {
        return asTextResult(
          "Refused: mutations are disabled. Set SYMFONY_PROD_ENABLE_MUTATIONS=1 on the MCP server *and* allow this tool in Codex enabled_tools.",
        );
      }
      return asTextResult((await runDiag(ssh, "console.cache_warmup")).output);
    },
  );

  server.registerTool(
    "console_messenger_stop_workers",
    {
      description:
        "BREAK-GLASS: Run `php bin/console messenger:stop-workers`. Disabled unless SYMFONY_PROD_ENABLE_MUTATIONS=1.",
      inputSchema: {},
    },
    async () => {
      if (!policy.enableMutations) {
        return asTextResult(
          "Refused: mutations are disabled. Set SYMFONY_PROD_ENABLE_MUTATIONS=1 on the MCP server *and* allow this tool in Codex enabled_tools.",
        );
      }
      return asTextResult((await runDiag(ssh, "console.messenger_stop_workers")).output);
    },
  );

  server.registerTool(
    "console_messenger_failed_retry",
    {
      description:
        "BREAK-GLASS: Run `php bin/console messenger:failed:retry <ids|all>`. Pass `targets` as `all` (default) or a list of failed message IDs separated by spaces/commas. Disabled unless SYMFONY_PROD_ENABLE_MUTATIONS=1.",
      inputSchema: {
        targets: z.string().min(1).max(500).default("all"),
        transport: z
          .string()
          .min(1)
          .max(64)
          .optional()
          .describe("Optional messenger transport name."),
      },
    },
    async ({ targets, transport }) => {
      if (!policy.enableMutations) {
        return asTextResult(
          "Refused: mutations are disabled. Set SYMFONY_PROD_ENABLE_MUTATIONS=1 on the MCP server *and* allow this tool in Codex enabled_tools.",
        );
      }
      return asTextResult((await runDiag(ssh, "console.messenger_failed_retry", { targets, transport })).output);
    },
  );
}
