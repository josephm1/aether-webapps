# Aether hosted project — shared source and data

This is a separately importable test/example project, not an APK payload. Use the matching current Apps owner with the matching Android host adapters. Import its project ZIP, review its
capabilities, then Grant access and open. Choose the shared WebApps folder once;
Android may ask once to add a home icon. Later use Open or the icon. Native hosting
uses immutable local WebView assets without a web server or browser-install flow.

Canonical code/resources/licences: `<chosen WebApps>/<app-id>/source/`.
Saved JSON and document blobs: `<chosen WebApps>/<app-id>/data/<store>/`.
Use Apps Source or `app_project` to edit; direct edits from other Android apps are
also recognized on next preparation. Private build caches/dependencies/assets are
recreated automatically and must not become authoritative source. Build failures,
revision conflicts and malformed data stop with errors; existing records remain.

LocalStore preserves JSON values and Blob types in shared records; original
application backup/export schemas remain supported. This version has no legacy
IndexedDB or cross-package migration. Old private records remain untouched. Use
explicit app data import/export when choosing to transfer existing records.

AI uses the selected Aether provider/model/reasoning effort through the Apps extension
and generic native selection/auth adapter, with app-only messages/tools. There is no
new app provider login, key in browser code or automatic live call on import. Data
resources initialize from public bundled fixtures on demand. The extension has no browser bootstrap or pairing fallback.

Read Apps README.md in the source handoff for the manifest/capability/build contract,
limits, trust boundary, interrupted-write recovery and safe update rules. Imported
command builds run trusted source with Aether's filesystem privileges. Inspect code
before opening an untrusted project. Do not publish the personal data folder.

See the current learning-apps handover for separate build/install/smoke status. LearnHarness background/wake/research/demo/visual/compaction and other
baseline workflows remain incomplete; no full parity claim is made.
