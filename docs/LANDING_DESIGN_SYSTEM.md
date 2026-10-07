# Transcriptify — classroom memory book

## Direction

A warm classroom scrapbook: chalkboard sections, tactile paper layers, handwritten annotations, taped Polaroid frames, and restrained cutout lettering. Inspired by the layered storytelling and hands-on demos of Sailboats, with an independent visual identity grounded in Transcriptify's existing classroom palette.

The page invites a student to try an academic what-if, then import and verify their own transcript. The signature composition is a real paper notebook behind a live-looking GPA Polaroid, with a handwritten note layered across it.

Design feasibility score: impact 5 + context fit 5 + feasibility 5 + performance 4 − consistency risk 4 = **15**.

## System

- **Typography:** IBM Plex Sans for clear body copy and large headlines; Patrick Hand for annotations, paper labels, and expressive secondary headings; JetBrains Mono for data and small numbered labels. These fonts are already shared with the workspace.
- **Palette:** forest chalkboard `--slate-900`, cream `--paper` / `--white`, butter yellow `--chalk`, mint `--mint`, sage `--success`, and faded pink `--sb-pink`. Landing aliases are scoped to `.scrapbook` so workspace styling stays independent.
- **Spacing:** a base rhythm of roughly 8px, generous 70–130px section spacing, bounded 1240px content, and a wider 1440px composition on large displays. Phone gutters are 20px.
- **Paper:** square or lightly imperfect edges, asymmetrical rotations, physical shadows, diagonal washi tape, ruled notebook lines, and torn section edges. Decorative artwork has no pointer events.
- **Motion:** two slow paper floats in the hero and CSS scroll entrances where supported. Pause disables entrances and pauses paper motion. Reduced-motion preference disables all animation and transitions.
- **Accessibility:** skip link, semantic landmarks, descriptive field labels, keyboard-operable tabs (arrows/Home/End), native FAQ disclosures, live demo result announcements, visible focus states, and a collapsible mobile navigation.

## Live demos and integration

The grade demo uses `reconcileRepeats` and `calculateStats`; the goal demo uses `solveTargetCgpa`. They share calculations with the actual academic workspace. All data is synthetic and kept in component state. Reset restores grades, target, credits, and selected semester courses.

The semester demo is explicitly an illustrative credit-load sketch. It does not imply prerequisite validation or actual course availability. The full workspace CTA opens the existing synthetic document; import CTAs use the existing PDF handler, progress messages, errors, and verification flow. Existing saved records still reopen in the workspace.

## Generated asset

- **Provider:** native built-in image generation; transparent background.
- **Project asset:** `public/artwork/scrapbook-notebook.png`.
- **Usage:** decorative hero backdrop, served by Next Image with responsive sizes and priority loading.
- **Final prompt:**

> Create a premium handmade classroom scrapbook still-life asset for a university academic planning website named Transcriptify. Transparent background, square composition, isolated cutout with realistic subtle contact shadows. Arrange a small tactile collage of a worn cream spiral notebook with blank ruled pages (no words), torn graph paper, muted mustard and sage washi tape, a short yellow wooden pencil with pink eraser angled diagonally, a small brass paperclip, a kraft paper five-point star sticker, and one teal-green binder clip. Photographic paper fibers, aged edges, actual physical layered paper, nostalgic warm student desk aesthetic. Color palette cream ivory, deep forest green #1c2d2a, warm butter yellow #f4df79, faded coral. Top down camera. Keep silhouette airy and asymmetrical, cutout craft editorial magazine quality, not a vector illustration, no background rectangle, no text or lettering. This asset will sit at lower right of a chalkboard hero with live UI cards layered above it.

## Files

- `components/landing/scrapbook-landing.tsx`: landing content, demo controls, import handoff.
- `components/landing/scrapbook.css`: scoped design tokens, paper composition, responsive layouts, motion.
- `components/v2/transcriptify-app.tsx`: delegates the initial import stage to the landing page.
- `app/layout.tsx`: loads landing styles alongside workspace styles.

## Validation

Production build, TypeScript, and lint pass. Existing tests pass (14 tests across two test files). Browser checks covered desktop and 390px phone layouts, no horizontal overflow, mobile navigation, grade recalculation, keyboard tab switching, impossible GPA goals, semester credit selection, reset, pause/resume, invalid-PDF feedback, and the full synthetic workspace handoff. The PDF parsing and verification implementation is unchanged.
