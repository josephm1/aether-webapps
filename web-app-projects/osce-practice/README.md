# OSCE Practice for Aether

Static adaptation of the existing local OSCE Practice project for Mobile Codex.
It retains its fictional unfolding case, 1–100 open-ended questions (12 default),
random/blind topics, concise answer feedback, explicit next-question navigation,
source evidence, cumulative case, reading controls and saved station JSON fields.
The Node server/Codex CLI are replaced by shared LocalStore records and Aether's
model bridge. No server, extra login, pairing or per-app APK is required.

Editable source is WebApps/aether-osce-practice/source/. User-provided Markdown
references are in source/references/Zero to Finals, with their original filenames,
folders, URL/download metadata and bytes preserved. Reopen via Apps after editing
or adding sources to rebuild the small index and verified static resources. Only
that index loads at setup; a new station loads one selected article. Active stations
retain an immutable source snapshot, regardless of later reference edits.

Stations and debounced answer/view state are saved in data/aether-osce-v1/ using
the standard shared record SDK. Answer drafts save after a short typing pause and
before station requests; force-killing during that pause can lose recent keystrokes.
Failed generation/validation retains the last saved station and answer draft. No
automatic paid retry occurs. Two screens do not run station writes concurrently.

AI uses the per-app model/thinking choice in Apps → Advanced, defaulting to Aether's
current selection and existing authentication. It sends examiner instructions,
selected article sections and the current station's chronological case/questions/
answers/feedback only. It sends no unrelated tools, Skills, histories or full library.
Context size is bounded and not silently summarized/truncated. Each explicit start
or answer uses one completion; reading/navigation/expansion use none. Source citations
are validated and displayed from saved sections, not model-invented quotations.

The original examiner instructions and source hashes/provenance are retained. These
are study snapshots, not live clinical guidance. AI feedback has not been clinically
validated. Dictation from Mobile Codex has no matching generic Aether hosted API and
is omitted; use the keyboard's own dictation if available. No fake microphone action.

Build: `node pwa/build.mjs`, normally through Apps' source-aware build/Open path.
There are no npm dependencies. The reference corpus is user-supplied material; no
redistribution licence is inferred. UPSTREAM.json records original code provenance.
