# Clinical Cases for Aether

A separate, editable local web app: title/specialty search → selected topic →
section → saved synthetic case → MCQs → source evidence and optional investigations.
Material 3 inspired responsive UI; pen annotations and structured lab marking.

## Architecture

- Application source: this directory. Vanilla browser modules, no package install,
  web server, Python process, per-app APK, service worker, or background daemon.
- Generated UI: `pwa/dist`, built by `node pwa/build.mjs`. Apps' normal managed
  build verifies source freshness and atomically replaces generated assets.
- Immutable private library: `aether-clinical-cases/resources/bmj/` beside source,
  **not** inside source or data. Reference files retain the BMJ specialty/topic structure and are bounded and
  individually verified when opened. There is no eager corpus/figure scan.
- Progress: the standard Aether SDK shared file store, under this app's `data/`.
  Local browser storage is not the authoritative saved-data store. Locks and
  transactional file-store commits prevent concurrent answer overwrites.
- Generic resource reader: Apps 1.5.6, `resource.read` under the reviewed storage
  grant. Read-only, scoped to this project's resource folder, 256 KiB replies,
  8 MiB/file. Existing native documents API; **no Aether Kotlin/Swift changes**.
- Startup: only the bundled title index. Zero host/AI/storage requests before a
  user action. Only one selected topic is kept in memory. Figure bytes are fetched
  only when opened and object URLs are released when the viewer closes.
- AI: explicit case generation only, one selected section, a short list of prior
  objectives, `tools: []`; existing Aether credentials/model/thinking selection.
  No full documents, unrelated history, tools/MCP inventory or image upload.
  JSON and exact-quotation validation reject malformed/unsupported provenance.
  This is not expert clinical validation. No automatic paid retry.

## Private library preparation (desktop, once)

```bash
python3 tools/index-bmj.py --epubs '/path/to/Converted BMJ Guidelines' --output '/private/resources/bmj'
python3 tools/prepare-figures.py --epubs '/path/to/Converted BMJ Guidelines' --library '/private/resources/bmj'
cp /private/resources/bmj/catalog.json pwa/src/catalog.json
node pwa/build.mjs
```

The original EPUBs/PDFs are untouched. EPUBs are used because these conversions
retain XHTML text, tables, PDF page anchors, and original raster image files. No
whole EPUB/PDF is sent to AI. All source images remain byte-identical; text chunks
carry source block/page locators and source EPUB hashes. Reference/front-matter
blocks excluded from generation remain readable and explicitly unassessed.
Extraction is loss-aware but not a verified semantic reproduction of every PDF.

Deploy the matching private resource pack and code together, without replacing an
existing `data/` folder. The first deployment is prepared as a desktop/device
handoff; installing/updating the Apps extension and exercising the app requires
user approval. No manual server/storage JSON setup is part of normal usage.
A generic on-device resource-pack importer is **not yet implemented**: the current
large corpus is provisioned from the desktop alongside the project. Do not claim
this first version satisfies fully autonomous large-library import on device.

## Implemented / remaining

Implemented: lightweight search/chooser; one-topic lazy loading; section-level
case generation; cached cases and answer persistence; explicit coverage counters;
source quotations/reading; exact image viewer; normalized pen marks saved apart
from images; case-linked investigation references/import; lab row highlighting
and deterministic reference-range feedback; per-app model/thinking settings;
progress export; no eager host calls.

Not implemented/validated: clinical expert review; complete fact-level coverage or
mastery; automated lesion/ECG annotation grading; vision-model grading; automated
real-case matching; tagged image retrieval across the entire corpus; scheduled
spaced repetition; free-response examiner; generic large corpus import from the
on-device UI. Source diagrams may contain labels/answers and are identified as
such; they must not be presented as blind diagnostic challenges without review.
Cases are independent section-focused synthetic scenarios, not yet a fully
progressive longitudinal patient simulation.

See `docs/INVESTIGATIONS.md` for case-linked media format, contributing guidance
and researched external sources. Application code and the copied Aether SDK are
GPL-3.0-only. BMJ resources retain their original rights; they are separate private
study material and must not be included in a public source repository/release.
