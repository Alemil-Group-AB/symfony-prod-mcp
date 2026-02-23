# symfony-prod-mcp

A **production-safe MCP server** (STDIO) that lets **Codex CLI** run *common, read-mostly* production diagnostics for a **Symfony** app **without granting shell access**.

## Architecture
- Codex CLI ⇄ (stdio) ⇄ this MCP server (runs locally)
- this MCP server ⇄ (SSH) ⇄ `symfony-diag` remote runner (runs on the production host)
- `symfony-diag` executes a strict allowlist of diagnostics and returns JSON

> Why this split? It avoids exposing an MCP server publicly, and it allows you to harden access using SSH + forced command + allowlists.

---

## What you get (tools)

### App / Symfony
- `health` — checks a configured health endpoint (loopback only)
- `console_version` — `php bin/console --version`
- `console_about` — `php bin/console about`
- `console_debug_router` — `php bin/console debug:router`
- `console_doctrine_migrations_status` — `php bin/console doctrine:migrations:status` (if installed)
- `console_doctrine_schema_validate` — `php bin/console doctrine:schema:validate` (if installed)
- `console_messenger_failed` — `php bin/console messenger:failed:show --stats` (if installed)
- `file_list` — lists files/directories under app root (optionally recursive)
- `file_read` — reads any file under app root by relative path
- `env_read` — reads `.env` / `.env.*` from app root (best-effort redacted; excludes `.env.local.php`)

### Logs
- `logs_list` — lists log files in `var/log`
- `logs_tail` — tail last N lines (defaults to newest log file)
- `logs_grep` — fixed-string search in logs (with caps)
- `logs_last_error` — heuristic "show last error-looking lines"

### System
- `sys_info` — uname/date/uptime/whoami
- `sys_disk` — df -h
- `sys_memory` — free -m (or /proc fallback)
- `sys_top` — ps snapshots (CPU & memory)
- `php_version` — php -v
- `php_extensions` — php -m

### Symfony cache artifacts (safe)
- `cache_status` — inspects `var/cache/*` directories with basic metadata

### Database (read-only)
- `database_connections` — lists configured Doctrine DB connections and default
- `database_schema` — inspects tables/columns/indexes/foreign keys (with optional filter)
- `database_query` — executes read-only SQL (`SELECT/SHOW/EXPLAIN/DESCRIBE`) with row caps

### Break-glass mutations (disabled by default)
- `console_cache_clear` — `php bin/console cache:clear --no-warmup`
- `console_cache_warmup` — `php bin/console cache:warmup`
- `console_messenger_stop_workers` — `php bin/console messenger:stop-workers`
- `console_messenger_failed_retry` — `php bin/console messenger:failed:retry <ids|all>`

Both are **double-gated**:
1) Local: `SYMFONY_PROD_ENABLE_MUTATIONS=1`
2) Remote: `SYMFONY_DIAG_ENABLE_MUTATIONS=1`

---

## Requirements

### Local
- Node.js >= 18
- Codex CLI installed
- SSH access to prod

### Remote (production host)
- PHP CLI available (for the runner)
- Common utilities: `sh`, `tail`, `grep`, `df`, `ps`, `curl` (curl recommended for `health`)
- A dedicated locked-down user (recommended)

---

## Install (local)

```bash
git clone <your-repo-url> symfony-prod-mcp
cd symfony-prod-mcp
npm install
```

### Build output
This repo can run in two modes:

**A) Dev/TS mode (recommended initially):**
```bash
npm run dev
# (runs: tsx src/index.ts)
```

**B) Built JS mode (recommended once stable):**
```bash
npm run build
ls -la dist/index.js
npm start
# (runs: node dist/index.js)
```

> If `dist/index.js` does not exist after `npm run build`, use TS mode (`npm run dev`) and point Codex to `tsx src/index.ts`.

---

## Install (remote / production)

### 1) Create a restricted user (recommended)

Example (Ubuntu/Debian):
```bash
sudo adduser --disabled-password --gecos "" codexdiag
```

### 2) Install the remote runner

Copy the runner to the server (or use your deployment mechanism):
```bash
# from your local machine
scp scripts/remote/symfony-diag root@prod.example.com:/tmp/symfony-diag
scp scripts/remote/symfony-diag.env.example root@prod.example.com:/tmp/symfony-diag.env.example
```

On the server:
```bash
sudo install -m 0755 /tmp/symfony-diag /usr/local/bin/symfony-diag
sudo install -m 0640 /tmp/symfony-diag.env.example /etc/symfony-diag.env
sudo nano /etc/symfony-diag.env   # set SYMFONY_DIAG_APP_DIR etc
```

(Alternatively run `scripts/remote/install-remote.sh` as root.)

### 3) Configure `/etc/symfony-diag.env` (REQUIRED)
At minimum you must set:

```env
SYMFONY_DIAG_APP_DIR=/absolute/path/to/your/app   # folder where bin/console lives
```

Example:
```env
SYMFONY_DIAG_APP_DIR=/var/www/myapp/current
SYMFONY_DIAG_LOG_DIR=/var/www/myapp/current/var/log
SYMFONY_DIAG_CONSOLE=/var/www/myapp/current/bin/console
SYMFONY_DIAG_PHP_BIN=php
SYMFONY_DIAG_HEALTH_URL=http://127.0.0.1/health

# Optional: Symfony kernel/bootstrap (if your app is non-standard)
SYMFONY_DIAG_KERNEL_CLASS=App\\Kernel
SYMFONY_DIAG_APP_ENV=prod
SYMFONY_DIAG_APP_DEBUG=0

SYMFONY_DIAG_TIMEOUT_SEC=25
SYMFONY_DIAG_MAX_OUTPUT_CHARS=200000
SYMFONY_DIAG_ENABLE_MUTATIONS=0
```

> Note: Symfony doesn't ship a built-in `/up` endpoint like Laravel. Create a lightweight health route yourself and point `SYMFONY_DIAG_HEALTH_URL` at it.

### 4) SSH hardening (strongly recommended)
Put your public key in `~codexdiag/.ssh/authorized_keys` and use **forced command**.

See `scripts/remote/authorized_keys.example`.

This makes OpenSSH always execute `/usr/local/bin/symfony-diag` (and ignore any client-supplied command).

---

## Configure the MCP server (local)

Create `.env` in the repo root (copy from `.env.example`):

```bash
cp .env.example .env
nano .env
```

Minimal:
```env
SYMFONY_PROD_HOST=prod.example.com
SYMFONY_PROD_USER=codexdiag
SYMFONY_PROD_SSH_KEY=/home/alex/.ssh/codexdiag_ed25519
```

---

## Connect Codex CLI to this MCP server

### Option A: Using `codex mcp add` (recommended)

**TS/dev mode (recommended initially):**
```bash
codex mcp add symfonyProd \
  --env SYMFONY_PROD_HOST=prod.example.com \
  --env SYMFONY_PROD_USER=codexdiag \
  --env SYMFONY_PROD_SSH_KEY=/home/alex/.ssh/codexdiag_ed25519 \
  -- npx tsx /ABS/PATH/symfony-prod-mcp/src/index.ts
```

**Built JS mode (once `dist/index.js` exists):**
```bash
codex mcp add symfonyProd \
  --env SYMFONY_PROD_HOST=prod.example.com \
  --env SYMFONY_PROD_USER=codexdiag \
  --env SYMFONY_PROD_SSH_KEY=/home/alex/.ssh/codexdiag_ed25519 \
  -- node /ABS/PATH/symfony-prod-mcp/dist/index.js
```

### Option B: Edit `~/.codex/config.toml`

> Important: `enabled_tools` must be under `[mcp_servers.symfonyProd]` (NOT under `.env`).

**TS/dev mode:**
```toml
[mcp_servers.symfonyProd]
command = "npx"
args = ["tsx", "/ABS/PATH/symfony-prod-mcp/src/index.ts"]
startup_timeout_sec = 20
tool_timeout_sec = 60

enabled_tools = [
  "health",
  "logs_list",
  "logs_tail",
  "logs_grep",
  "logs_last_error",
  "sys_info",
  "sys_disk",
  "sys_memory",
  "sys_top",
  "php_version",
  "php_extensions",
  "cache_status",
  "file_list",
  "file_read",
  "env_read",
  "database_connections",
  "database_schema",
  "database_query",
  "console_version",
  "console_about",
  "console_debug_router",
  "console_doctrine_migrations_status",
  "console_doctrine_schema_validate",
  "console_messenger_failed",
]

[mcp_servers.symfonyProd.env]
SYMFONY_PROD_HOST = "prod.example.com"
SYMFONY_PROD_USER = "codexdiag"
SYMFONY_PROD_SSH_KEY = "/home/alex/.ssh/codexdiag_ed25519"
```

---

## Troubleshooting

### MCP handshake fails
- Ensure the MCP server does **not** print to stdout (only JSON-RPC). Use stderr for logs.
- Verify the entrypoint path exists:
  - TS mode: `src/index.ts`
  - Built mode: `dist/index.js` after `npm run build`

### SSH connectivity
Confirm SSH works non-interactively:
```bash
ssh -i /path/to/key codexdiag@prod.example.com 'echo ok'
```

If you use forced-command, running `ssh codexdiag@prod.example.com` will wait for JSON input; this is expected.

### `health` fails
- Confirm `curl` exists on the server.
- Confirm the health URL is loopback and reachable from the server:
  ```bash
  curl -i http://127.0.0.1/health
  ```

### Doctrine tools fail
- Ensure Doctrine DBAL/Bundle is installed and available.
- Ensure the runner can boot the Symfony kernel (`vendor/autoload.php` exists).
- If your kernel class isn't `App\\Kernel`, set `SYMFONY_DIAG_KERNEL_CLASS`.

---

## Security checklist
- Use a **dedicated SSH user**
- Use **forced-command** in `authorized_keys`
- Keep this toolset **read-only**; enable mutations only for break-glass situations
- Redact secrets; still treat outputs as sensitive
- File reads are restricted to files that resolve under app root (`SYMFONY_DIAG_APP_DIR`)
- SQL execution is restricted to read-only allowlisted statements

---

## License
MIT
