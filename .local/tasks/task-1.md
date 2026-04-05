---
title: UI redesign — landing page + all public pages
---
# UI Redesign — Landing Page + All Public Pages

## What & Why
The current app is a bare form with no explanation of what the product is or why someone should buy it. This task turns the home page into a proper landing page that explains the product, walks the visitor through exactly how it works step by step, and highlights the benefits — then leads them into plan selection and purchase. All other public pages get the same modern visual treatment.

## Done looks like
- **Home page is a full landing page** with:
  - A hero section: product name, one-sentence pitch, and a CTA button that scrolls to pricing
  - A "How it works" section with numbered steps (e.g., 1. Choose a plan → 2. Complete checkout → 3. Get your API key → 4. Use the key to verify access)
  - A "Why use this?" / benefits section highlighting key advantages (single-use keys, expiring access, instant delivery, secure verification)
  - A pricing section with the 4 plans displayed as cards (24h/$2, 7d/$10, 30d/$30, Lifetime/$100) — clicking a plan selects it and scrolls to the checkout form
  - Terms checkbox and "Get Access" submit button at the bottom
- `success.html` shows a clean API key reveal with a copy button and save warning, with polling handled gracefully
- `cancel.html` has a friendly message and a "Try again" link back to the home page
- `wait.html` has an animated spinner and reassuring copy
- Legal pages (terms, privacy, refunds, disclaimer) share the same stylesheet with readable typography
- All pages share a consistent header, footer with legal links, color palette, and font

## Out of scope
- Backend changes
- New features or pages
- Email delivery

## Tasks
1. **Shared stylesheet** — Create a single `style.css` file in `public/` with the full design system: colors, typography, button styles, card styles, and responsive layout utilities. All pages import it.

2. **Landing page (home)** — Rebuild `index.html` as a full landing page: hero section, "How it works" numbered steps, benefits section, pricing cards, and the checkout form with terms checkbox. Keep all existing JS logic for form submission.

3. **Success page** — Redesign `success.html` with a polished key-reveal card, monospace key display, copy-to-clipboard button with feedback, and a clear save warning. Preserve the polling logic.

4. **Cancel and wait pages** — Polish `cancel.html` with a friendly message and "Try again" link; add a CSS spinner animation and reassuring copy to `wait.html`.

5. **Legal pages** — Apply shared stylesheet to `terms.html`, `privacy.html`, `refunds.html`, and `disclaimer.html` for consistent readable typography and footer nav.

## Relevant files
- `public/index.html`
- `public/success.html`
- `public/cancel.html`
- `public/wait.html`
- `public/terms.html`
- `public/privacy.html`
- `public/refunds.html`
- `public/disclaimer.html`