# LearnHarness hosted browser adaptation

The source is adapted from the previous Mobile Codex edition with pinned recovered
components recorded in aether/upstream-recovery.json. This is an importable AGPL app,
not a host APK payload. Read AETHER.md and pwa/HOSTED.md for source/storage boundaries.

The actual browser build reuses React session/teaching/practice/graph interfaces and
original agent factories. Local API routes are handled inside the web app. Shared
LocalStore records preserve original session/graph/export JSON and document Blob
values. Home, chat and Files are separate lazy modules; heavy document tools load on
request. Large resources and complete histories/books are not automatically uploaded.

The app's Advanced model/thinking preference is resolved by the Apps extension and
native authenticated facade. Existing sessions follow that explicit app selection on
their next request; historic messages/usage remain unchanged. No per-role cheap or
vision substitution is made. AI context contains only this app's relevant instructions,
messages and necessary app workflow tools. Unsupported background tools are omitted.

Build: node pwa/build.mjs after lockfile dependencies are installed. The manifest
also declares Python so the generic build adapter provisions it when needed for
source-offer/finalization scripts. These are build tools, not app servers. App Open
reuses valid prebuilt assets and rebuilds only changed source. The agent can use
app_project build from the device; that path was reviewed in code, not live-tested.

Evidence from the learning-apps release: desktop home, document import/preview,
new-session rendering and storage failure checks; on-device teaching/probing smoke
using a small synthetic topic and two live completions. OSCE is a separate app.
See the release handover/FIX-STATUS.json for precise installed bytes and final status.

Full parity is not established: comprehensive practice, graph extraction/audit/merge,
PDF-agent and long-session behavior need further acceptance. Research/demo/visual,
durable background wake, compaction, automatic idle extraction and native dictation
remain incomplete. Storage quotas/conflicts/errors are explicit and never reset data.
UI imports and exports retain the existing schemas and overwrite confirmations.
AGPL source, licences, resource provenance and third-party notices are retained.
