# BalancedLive — Marketing Site

Single-page marketing site for BalancedLive, an accounting platform for
entrepreneurs running multiple businesses. Built per the build-ready spec.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (custom design tokens for colors, type, spacing)
- `lucide-react` for icons

## Routes

- `/` — Main marketing page (Hero → Problem → What You Get → How It Works → Pricing → Founder → CTA → Email capture)
- `/partners` — CPA / partner sub-page

## Develop

```bash
cd balancedlive
npm install
npm run dev
```

Opens at http://localhost:5173.

## Build

```bash
npm run build
npm run preview
```

## Notes

- The Discovery Call CTA opens an intake modal (4 questions). In production
  the submit handler should hand off to Calendly with prefilled context.
  Today it just shows a confirmation state.
- Email capture (footer + partners page) is wired client-side only —
  connect to Loops / ConvertKit when integration creds are available.
- No competitor names. No forecasting copy. No customer logos. Per spec.
