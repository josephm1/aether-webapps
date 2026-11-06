# Local Codex-backed LearnHarness

This computer-only integration uses the installed Codex CLI and its existing ChatGPT login. LearnHarness does not import, store, or refresh Codex credentials. No LearnHarness provider sign-in or API key is needed for this mode. It is a local integration branch, not an upstream release.

## Open it

- **Desktop:** launch **LearnHarness · Codex** from the application menu, or run `bin/learnharness-desktop` from this checkout. Its native window supports the upstream local-file drag-and-drop path chips. The desktop window starts its backend when opened and stops it when closed.
- **Within Codex:** the globally registered `learnharness` MCP supplies `open_learning_ui`, `get_learning_dashboard`, and `stop_learning_ui`. Ask Codex to open the learning UI and show the returned URL in its browser panel. Newly registered tools may require a new chat or restarting Codex.
- **Books on this computer:** use a quoted absolute file path in the prompt, or drag the file into the native desktop window. The existing PDF reader can inspect/search/render PDFs. Markdown/plain-text notes can use upstream import. This does not add a general EPUB conversion pipeline or Android file uploads.

The web UI is `http://127.0.0.1:8793/?lh_local=1` while running. Its manifest permits a standalone browser window where supported, but a browser PWA icon cannot restart a stopped native server by itself. Use the desktop launcher for guaranteed cold start or call the MCP open tool again. No service worker caches learning records, model requests, or API replies.

Web mode reports visibility every five seconds. After every tab reports hidden/closed, its backend stops after about five seconds. Lost heartbeats expire after 15 seconds; throttled browsers can therefore close the backend even if a tab is still present. Initial launch allows 90 seconds to open the returned URL. Reopen through MCP after shutdown. Saved data survives; unsaved in-memory UI state does not. Closing the MCP transport stops its backend. Active web requests can be interrupted by leaving the UI; there is no promise of unattended background lesson work.

## Data and account

The dedicated profile is `~/.config/LearnHarness-Codex/` (`XDG_CONFIG_HOME` respected). Lessons, graph and settings are in `data/`. This is separate from ordinary LearnHarness installations and the ignored Android checkout. Both launchers share this profile and refuse simultaneous web/native writers. A dead-process lock is recovered on the next launch. Back up this folder before replacing installations; uninstalling source/build files does not intentionally remove it.

On first use, all three LearnHarness model slots use the default model returned by the local Codex catalog, with medium reasoning. Later launches preserve chosen slots. Public catalog metadata is passed in the launcher environment. Authentication remains under Codex's normal account configuration. Account access is checked before launching and before each model operation; an API-key-only Codex login is refused instead of silently incurring API-key billing. There is no billing fallback to another provider. Usage counts can be unavailable for interrupted tool handoffs; no API-dollar estimate is fabricated for the Codex route. Selected model capabilities/availability remain subject to the signed-in Codex account.

## Integration

`src/agent/codex-cli/` implements a Pi provider backed by `codex app-server --listen stdio://`. Each model operation creates an ephemeral thread and a temporary empty working directory, replays role-preserving history and declares LearnHarness tools as experimental dynamic functions. A tool request is returned to the original LearnHarness agent loop; the Codex process then closes. LearnHarness executes the tool and the next operation replays its actual tool result. This preserves quizzes and saved state without running two simultaneous agent loops.

The bridge disables configured external MCP servers per thread, disables the shell/multi-agent features, uses read-only sandboxing and declines unexpected host operations. It supplies LearnHarness's own system instructions. Source content is data. These restrictions do not sandbox LearnHarness's own tools: its existing file tools run with the user's local application permissions. Credentials are never surfaced through the MCP/UI. MCP itself exposes only open/stop and a local dashboard; it does not expose a token endpoint or arbitrary command runner.

Cancellation, timeout and process exit terminate bridge-owned children. There is a 4 MiB request guard, an 8 MiB response-line guard and a three-minute per-operation deadline. The code targets the locally verified Codex CLI 0.159.0 and experimental dynamic-tool/history APIs. Check compatibility after updating Codex. Model prompts/history are sent to OpenAI through Codex; local storage does not mean local model inference.

References: [Codex app-server](https://learn.chatgpt.com/docs/app-server), especially dynamic tools and history injection; [upstream LearnHarness development](development.md) and [Linux packaging](desktop-release.md).

## Rebuild and verify

```sh
npm ci
npm run typecheck
npm run lint
npm run build
node scripts/build-server.mjs
node scripts/smoke-server.mjs --electron
npx electron-builder --linux --dir --x64 --publish never
```

The installed desktop launcher expects `dist/linux-unpacked/learnharness` in this checkout. The MCP expects `.next/standalone/server.js`. Moving the checkout requires updating the desktop entry and MCP command. Neither launcher publishes anything or adds an always-on system service.

Tests:

```sh
NODE_ENV=test node --import tsx --test --test-concurrency=1 tests/codex-cli.test.ts tests/local-host.test.ts
node --import tsx scripts/smoke-local-mcp.ts
# Explicit live checks consume the existing Codex plan allowance:
node --import tsx scripts/smoke-local-codex.ts
LH_LIVE_LESSON_SMOKE=1 node --import tsx scripts/smoke-local-mcp.ts
```

Verification on this computer: selected provider/catalog/setup/pricing regressions passed (77 tests before the additional visibility test); seven bridge/visibility tests passed; 21 native PDF/SVG tests passed. Type checking, lint, production build, provider-runtime and standalone-server boot smoke passed. Live Codex text and tool/result replay passed. The MCP smoke verified discovery, configured catalog, no setup gate, manifest, visibility-based port release, saved settings and restart; its live lesson gate verified a persisted interactive question. The entire upstream suite was attempted during initial setup but did not complete under the earlier memory-heavy parallel run; it is not claimed as passed.

Browser automation is disabled in this Codex session's Work settings, so interactive visual inspection is not claimed. Use the native launcher or open the MCP URL to check presentation. Android and Mobile Codex were not changed for this integration.
