# LearnHarness web app for Mobile Codex

The portable edition uses **Mobile Codex’s existing bundled Node, Python and Codex account**. It needs no optional Linux environment, additional Node installation, Electron, account relay or separate Android app. The bundle contains the compiled web interface and its JavaScript dependencies plus editable source. It retains the upstream teaching, practice, MCQ, saved-session and knowledge-graph code.

## Install and open

Install the updated Mobile Codex APK from the generic local-web-apps draft PR. Transfer `artifacts/learnharness.mcwebapp`, then choose **Web apps → Import bundle → LearnHarness**. Use **⋯ → Add to home screen** for a standalone task. The icon cold-starts the app’s Node host and web backend. Existing-account discovery uses the installed Codex executable and its original environment; no account files are copied or parsed by LearnHarness.

Settings → **Check tool execution / Run check** verifies precisely the bundled tools this edition uses. The optional Linux setting is unrelated to this edition.

The host provides one user-facing loopback origin (8795), proxies streaming HTTP/SSE to its owned web backend (8796), and uses Mobile Codex’s foreground lifetime. Leaving both windows stops the managed processes after the existing five-second grace. Reopening restarts the saved build. There is no always-running remote computer or PWA service worker pretending it can start native runtimes.

## Files, rendering and e-ink

**Files & app** opens the app management/import page. Choose PDF, Markdown or text, up to 32 MiB. The file is saved locally and the page gives its actual device path; paste it into a learning chat and ask LearnHarness to use it. Importing a book does not automatically send every page to the model. Model requests and selected source content still go to the AI service as usual.

PDF text extraction uses JavaScript. PDF pages and SVGs render with PDF.js and canvas in the existing WebView. They do not install Skia, a Linux renderer or another Chromium process. Rendering jobs are bounded, authenticated within the same local origin, expire after 90 seconds and need the learning window visible. The desktop edition retains its native renderers. The WebView inherits Mobile Codex’s theme; mobile CSS supplies light/e-ink tokens and browser-compatible controls.

Books are in `mobile/books`; learning records and settings are in `mobile/profile`. Keep backups before clearing app data or uninstalling. Import refuses to overwrite an existing registered project. The device prototype migration preserved these folders and saved its old source without generated dependencies in `files/web-app-backups/`; it did not clear Mobile Codex data.

## Modify and rebuild

The management page shows the source folder. Ask Mobile Codex to edit the React/TypeScript/CSS files there, run relevant checks and preserve `mobile/profile` and `mobile/books`. The bundle is an editable source snapshot, not an automatically synchronized Git checkout. Initialize Git there if you want on-device commits.

For a clean source checkout, install packages with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`. Build with `node mobile/build.mjs`, then package with `python3 mobile/package.py`. This uses a single webpack build on desktop and Android; Next’s Android compiler uses its WASM fallback, while esbuild has an Android build. Browser-facing core hashing and random IDs use browser-compatible code. Building still needs npm downloads, free storage and sufficient memory. Initial installation does not need a build.

After rebuilding on device, stop the app with **⋯ → Stop and close**, then use `python3 mobile/package.py --apply-runtime` from Codex to replace only generated runtime files and the compiled Codex configuration helper. Reopen the home icon afterwards. Source, books and profile data stay outside the generated runtime. Desktop source changes can instead be repackaged and transferred. Mobile Codex native host changes require rebuilding its APK; ordinary web changes do not.

## Limits and verification

- Scanned PDFs need OCR elsewhere; DRM books are unsupported. PDF/SVG rendering requires a visible WebView and supports bounded image sizes. Graph-heavy views can be slow on e-ink.
- Desktop demo/browser automation, Electron updates/window controls and desktop provider browser sign-ins are not included. Codex is the configured provider.
- Internet, a working signed-in Codex account and available account quota remain necessary. The experimental app-server dynamic-tool/history API remains a compatibility dependency.
- The compiled interface installs without a device build. Full source rebuilds through Android’s compiler/WASM toolchain are not yet device-verified, and could hit memory or dependency limits. A build failure does not invalidate the installed web runtime.
- Source and learning data do not automatically synchronize between computer and device. Account credentials are never included in bundles.

Host validation covers core graph/fingerprint behavior, PDF text extraction in mobile mode, web-render job authorization/lifecycle, direct Node startup, streamed HTTP, book import, shutdown, the production web build and a dependency-confined standalone smoke. Device validation has confirmed startup through bundled Android Node, the actual web UI in e-ink mode, existing-account model discovery, real inference, persisted lessons and an interactive multiple-choice question. A scoped Android document-picker import also passed after the picker outlived the server idle timeout; the saved synthetic file was then removed. Broader PDF/SVG rendering, e-ink usability and on-device source-rebuild acceptance checks remain separate.

Upstream boundary: Mobile Codex only gets generic file-picker support and bounded web-bundle import capacity, plus the pre-existing generic launcher/lifetime/appearance work. LearnHarness code, dependencies, UI, web renderer, source bundle and data are outside that PR.

## Dictation through Mobile Codex

When hosted in Mobile Codex, the existing Dictate control uses the shared `window.mobileCodex.dictation` capability, backed by Mobile Codex’s own `InlineDictation` recognizer and Android microphone permission. It does not mint Deepgram tokens, create a web audio capture graph or open a Deepgram socket. Desktop/browser use keeps the existing provider.

Dictation retains the normal append-to-primary-input behavior: Stop/submit waits for the final transcript, Escape cancels, and navigating away discards late callbacks. The native service is shared with other Mobile Codex windows, so competing recordings are rejected. It records individual utterances; Android can end a session after a pause. Language support follows the installed recognizer. The existing multilingual (`multi`) setting selects the native default language, because Android’s service does not expose Deepgram’s multilingual mode. No API key is needed, but the configured Android recognizer may need internet access.
