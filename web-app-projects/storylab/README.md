# StoryLab for Aether

Source-grounded learning adventures, one decision at a time. Add an EPUB, TXT,
Markdown document, pasted text, or Wikipedia link; choose a topic and start.
Narrative mode establishes your role, setting, background, goal and stakes before
showing an in-character choice. Problem-solving adventures and factual quizzes
use the same four-choice assessment flow.

## Run and verify

```sh
npm test
npm run build
npm run dev
```

Desktop preview: http://127.0.0.1:4173/. Its loopback server uses the installed Pi
SDK and configured credentials. Hosted Aether uses the native AI bridge, model
picker and shared LocalStore instead. Credentials never enter the release.

```sh
python3 package-aether.py --output /absolute/path/to/new-release
node tests/import-package.mjs /absolute/path/to/new-release/aether-storylab-project.zip
```

Install through Aether Apps, or update the granted project's `source/` and reopen
through Apps to rebuild. Native host changes are unnecessary. The shared app is
portable; Android gameplay has been exercised on device. iOS device verification
requires a Mac and remains outstanding.

## Small, explicit context

Each request contains short instructions, up to three relevant passages, the topic
and difficulty, and only the latest decision/outcome plus a compact role summary.
Full books, activity history, unrelated chat and tool inventories are never sent.
Provider-reported input/output/cache usage is saved separately from the app's
conservative 4,000-unit input guard (UTF-8 context bytes plus 400 for framing).
Each explicit attempt has its own input limit; failures are logged. No automatic paid retry.
Opening, answer submission, feedback and navigation use no additional AI calls.
Continuing retrieves fresh passages for the next chronological topic.

EPUB import reads the ZIP directory, package and existing navigation. Chapter
bodies are read just in time. Search reads at most six sections per pass; another
pass can inspect more. Whole-life requests prioritize early narrative sections.
Twelve section bodies are cached in memory. Wikipedia stores article identity and
section metadata and fetches section text on demand from the granted origin.
Ordinary links are saved as references; paste their text to study their contents.
This is bounded keyword retrieval, not semantic search or a full-book index.

## State and assessment

One current adventure per source, using one activity format. Starting again
replaces that adventure; there is no legacy renderer, migration or archive UI.
Original source files remain local. Source identity uses SHA-256. Concurrent
windows are checked before committing progress.

The generated key marks answers locally (+1/-1). Exact quoted evidence must occur
in a supplied passage. This checks provenance, not the truth of an interpretation.
Recorded choices and inferred motives must be distinguished. Insufficient evidence
stops generation rather than inventing an answer. Historical mismatch need not
mean an irrational decision.

Limits: 16 MiB original book, 1 MiB expanded chapter, 128 MiB declared expanded ZIP,
8,192 ZIP entries, 40 sources, 30 questions per adventure. DRM books, PDF/OCR and
questions requiring unread figures/equations are unsupported. Handwritten work,
interactive diagrams, external research and MCP puzzles are future work.
