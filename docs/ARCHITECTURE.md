# Transcriptify v2 architecture

The application is a static Next.js client. PDF parsing, validation, analytics, planning, persistence, and exports run in the browser.

## Boundaries

- `domain/transcript.ts`: UDST grade rules, repeat reconciliation, GPA calculations, term metrics, migration, and target solving.
- `domain/udst-parser.ts`: transcript row extraction, normalization, provenance snapshot, and validation warnings.
- `domain/programs.ts`: mandatory, grouped-elective, and open-elective requirement types; cohort inference; prerequisite parsing; and single-use requirement matching.
- `domain/planning.ts`: calendar-term inference, version-scoped academic plans, schedule variance, per-course GPA projection, and deterministic report insights.
- `components/v2/transcriptify-app.tsx` and `academic-analytics.tsx`: import, review, radar, semester rail, course planner, detailed report, export, and privacy flows.
- `data/udst-programs.json`: generated schema-v3 snapshot of official program pages and linked historical plans.
- `scripts/sync-udst-programs.mjs` and `udst-plan-parser.mjs`: reproducible program sync and source-table requirement parsing.
- `public/pdf.worker.min.mjs`: same-origin PDF.js worker copied from the pinned dependency.

## Data lifecycle

The original PDF is held only while parsing. Schema-v3 verified state contains normalized course attempts, optional program selection, version-scoped academic plans, elective selections, term overrides, and expected grades. Schema-v2 documents migrate in memory without losing attempts. Session-only mode does not write the transcript to `localStorage`; device and clear-after-export modes do.

Derived metrics, course-family performance, schedule signals, projections, and report insights are recalculated locally. JSON export includes academic plans; CSV remains the normalized attempt export.

## Trust model

The parser surfaces uncertainty rather than treating every row as verified. Users can edit, exclude, restore, and confirm rows before analytics. The earliest dated transcript term suggests both the study-plan version and Semester 1 calendar mapping, with manual correction available.

Elective options are consumed once against their published selection count; unused alternatives are never treated as missing courses. Program progress and schedule signals remain advisory because substitutions, transfers, deferrals, and exceptions require UDST review.
