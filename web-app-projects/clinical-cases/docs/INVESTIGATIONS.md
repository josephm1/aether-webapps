# Case-linked investigation packs

Each saved synthetic case owns its MCQs, answers, optional source-linked lab
results, and explicit investigation references. A source figure is an illustration,
not evidence that the invented patient is the original patient. Imported teaching
material retains its original case ID, presentation, URL and licence. Never combine
values from different real patients and label them as one recorded case.

Resources live in `aether-clinical-cases/resources/`, beside `source/` and `data/`.
Keep the BMJ specialty/topic folders. Keep reusable ECG recordings separately under `ECGs/<recording-name>/`. Only the selected file
is read, in bounded chunks with SHA-256 verification. Images are displayed to the
learner and are **not sent to AI**. Do not embed images as base64 in manifests.
Originals stay unchanged; normalized pen strokes are separate saved records.

Within a saved case, use **Import case investigation manifest** for a small JSON
file (128 KiB maximum). This attaches teaching material; it does not replace the
synthetic presentation. Put its referenced images into the app's resource folder
as part of a prepared resource pack. The first version does not yet have a media
file picker/uploader or automatic remote image downloader.

```json
{
  "format": "clinical-case-investigations",
  "version": 1,
  "source": {
    "caseId": "publisher-case-id",
    "title": "Original teaching case",
    "url": "https://publisher.example/case/id",
    "licence": "Exact licence, credit, and permitted use",
    "presentation": "Original recorded presentation, with provenance; no personal identifiers"
  },
  "labs": [],
  "images": [
    {
      "path": "ECGs/recording-name/12-lead.png",
      "sha256": "<actual-64-character-SHA256>",
      "mime": "image/png",
      "label": "Investigation 1"
    }
  ]
}
```

Each lab entry needs `name`, numeric `value`, `unit`, numeric `low` and `high`,
and `explanation`. Copy the original laboratory's patient-appropriate interval;
never invent it or silently substitute a generic interval. If no interval is
available, this version cannot range-grade it: omit it from the graded panel and
retain it in the source presentation until support for ungraded values is added.
The range check is deterministic; it is not an interpretation of clinical severity.

Helpful contributions: a small, permission-cleared set with normal comparators,
ECG calibration/lead labels, original case presentation, specimen timing, lab units
and reference intervals, diagnosis and explanation hidden until reveal, and reviewed
abnormal regions in normalized image coordinates. Diverse skin tones and image
quality matter for dermatology. Do not include patient identifiers or unlicensed
clinical records. A clinician-reviewed answer key will be needed for actual image
grading; drawing-overlap alone does not establish clinical understanding.

## Sources to consider (checked 6 November 2026)

| Source | Best fit | Important integration limit |
|---|---|---|
| [PTB-XL / PhysioNet](https://physionet.org/content/ptb-xl/1.0.3/) | Real 12-lead ECG waveforms, diagnostic labels and metadata | CC BY 4.0 in this version. Render calibrated waveforms to a learner image; not a complete case narrative or general lab dataset. |
| [NLM Open-i](https://openi.nlm.nih.gov/) and [FAQ](https://openi-vip.nlm.nih.gov/faq) | Published radiology/case-report figures; can lead to the original case and recorded values | Reuse depends on each image/article licence. Prefer an explicitly reusable case report with its own clinical details. Do not assume all indexed figures share one licence. |
| [DermNet image licence](https://dermnetnz.org/image-licence) | Dermatology examples and explanatory condition pages | Watermarked educational images are offered under CC BY-NC-ND 4.0 terms described there; retain watermark and attribution. No bulk collection or AI processing has been undertaken. Keep private pen overlays separate; do not redistribute modified images. |
| [ASNR case archive](https://www.asnr.org/case-of-the-week/case-of-the-week-archives/) | Neuroradiology teaching cases | A useful case reference, not a blanket permission to redistribute its images. Obtain item-specific permission/licence before bundling. |
| [MIMIC access information](https://mimic.mit.edu/docs/faq/how-to-get-access.html) | Future linked clinical observations and lab histories | Credentialed access/training/data-use agreement. Not a zero-login public starter corpus and not bundled here. |

A good first contribution would be 5–10 coherent teaching cases with images and
recorded labs from the **same case**, each with clear reuse permission. That is more
useful initially than thousands of isolated, weakly tagged images. No third-party
image collection has been downloaded, and no rights to BMJ redistribution are
implied by this app's source-code licence.

## Separate ECG recordings

Keep the BMJ hierarchy unchanged. Reusable recordings belong in
`resources/ECGs/<readable-source-case-or-recording-name>/`, with a small
`investigations.json` alongside the image. The manifest's `images[].path` starts
with `ECGs/`. Import the manifest into a compatible saved case; the case stores a
reference, not a copy of the image. Only opening that investigation reads the ECG.
The current app requires explicit attachment; automated tag/condition matching is
future work and must preserve age, presentation, timing, lead/calibration quality,
known diagnosis and source-case compatibility rather than matching a disease name
alone. Guideline ECG diagrams stay with their BMJ topic and are labelled illustrations.
