# Transcriptify v2 architecture

The application is a static Next.js client. PDF parsing, validation, analytics, planning, persistence, and exports run in the browser.

## Boundaries

- `domain/transcript.ts`: UDST grade rules, repeat reconciliation, GPA calculations, term metrics, and target solving.
- `domain/udst-parser.ts`: transcript row extraction, normalization, provenance snapshot, and validation warnings.
- `domain/programs.ts`: versioned program-plan types, cohort inference from the earliest transcript term, manual plan selection, prerequisite parsing, and credit-based progress matching.
- `components/v2/transcriptify-app.tsx`: import, review, overview, courses, planning, report, export, and privacy flows.
- `data/udst-programs.json`: generated snapshot of official public program pages and every historical study-plan page linked by UDST.
- `scripts/sync-udst-programs.mjs`: reproducible program directory and study-plan sync.
- `public/pdf.worker.min.mjs`: same-origin PDF.js worker copied from the pinned dependency.

## Data lifecycle

The original PDF is held only while parsing. Verified state contains normalized course attempts, optional program selection, and an optional manual study-plan override. Session-only mode does not write the transcript to `localStorage`; device and clear-after-export modes do. Derived metrics, course-prefix performance, cohort recommendations, and plan progress are recalculated from attempts.

## Trust model

The parser surfaces uncertainty rather than treating every row as verified. Users can edit, exclude, restore, and confirm rows before analytics. The earliest dated transcript term suggests an academic-year plan, but users can switch to any published version. Progress uses matched credits against the plan’s official required-credit total rather than counting every elective option as mandatory. Program progress remains advisory because elective interpretation, substitutions, transfers, deferrals, and exceptions require UDST review.
