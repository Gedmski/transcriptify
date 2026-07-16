# Security and privacy

Please report security or privacy issues privately to the repository owner rather than opening a public issue with exploit details or student data.

## Sensitive data

Never attach a real transcript or include student names, identifiers, course history, grades, exact GPA, filenames, or extracted PDF text in a report. A minimal synthetic reproduction is preferred.

## Current controls

- PDF MIME type, signature, size, and page-count checks.
- Same-origin pinned PDF.js worker.
- No transcript analytics or server upload path.
- Normalized structured persistence only, selected by the user.
- CSV formula-injection escaping.
- No extracted HTML rendering.

Transcriptify is an unofficial planning tool. Policy interpretation and graduation eligibility must be confirmed with UDST.
