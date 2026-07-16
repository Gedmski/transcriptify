# Contributing to Transcriptify

Transcriptify is UDST-first and correctness-sensitive. Changes to parsing, grades, repeats, GPA, or program progression should include a public UDST source and a de-identified or synthetic regression case.

## Local checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Do not commit real transcripts, student identifiers, filenames, raw extracted PDF text, or screenshots containing academic records. Use synthetic data only.

## Updating program plans

Run `node scripts/sync-udst-programs.mjs`, review the generated diff in `data/udst-programs.json`, and spot-check changed programs against their official UDST pages. A missing public plan must stay explicit; do not infer or invent course requirements.
