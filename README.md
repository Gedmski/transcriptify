# Transcriptify v2

Transcriptify is a private, program-aware academic decision workspace for University of Doha for Science and Technology students. It imports a text-based transcript PDF locally, requires verification before analysis, applies current UDST grade and repeat rules, models target CGPA paths, compares performance by course prefix, and matches completed courses to the appropriate versioned public program plan.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` or use the synthetic demo from the landing screen.

## Release checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Core data stays in the browser. The original PDF is not persisted, and there is no transcript upload or transcript-derived analytics path.

See [architecture](docs/ARCHITECTURE.md), [UDST policy notes](docs/UDST_POLICY_NOTES.md), [security](SECURITY.md), and [contributing](CONTRIBUTING.md).
