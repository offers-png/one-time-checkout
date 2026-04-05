# KeyAccess — API Key Access Generator

A secure Stripe payment link generator that sells time-limited, single-use API access keys.

## Overview

Customers visit the landing page, select a plan, pay via Stripe, and receive a unique `plk_` API key instantly on the success page. Keys are single-use and expire based on the plan purchased.

## Plans

| Plan | Price | Duration |
|------|-------|----------|
| 24 Hours | $2 | 24h |
| 7 Days | $10 | 7 days |
| 30 Days | $30 | 30 days |
| Lifetime | $100 | Never |

## Architecture

### Frontend (Static HTML + CSS)
- `public/style.css` — Shared design system (colors, typography, components)
- `public/index.html` — Full landing page: hero, how-it-works, benefits, pricing cards, checkout form
- `public/success.html` — API key reveal page with polling and copy-to-clipboard
- `public/cancel.html` — Payment cancelled page with try-again link
- `public/wait.html` — Animated waiting page with spinner
- `public/terms.html`, `privacy.html`, `refunds.html`, `disclaimer.html` — Legal pages

### Backend (Express + SQLite)
- **/api/create-link**: Creates a Stripe checkout session and stores it in SQLite
- **/pay/:sessionId**: Validates and redirects to Stripe checkout
- **/api/webhook**: Handles Stripe webhook events — generates `plk_` key and marks session paid
- **/api/get-key**: Returns the API key by session ID (used by success page polling)
- **/api/verify-coupon**: Verifies a key by value, marks it used (protected by `x-api-key` header)
- **/deliver/:sessionId**: One-time delivery endpoint for wait.html flow

### Database (SQLite — `links.db`)
- **links table**: `session_id`, `checkout_url`, `paid`, `used`, `payload` (JSON with `key`), `expires_at`

## Key Flow

1. User selects plan on `/` → clicks "Generate Payment Link"
2. POST `/api/create-link` → creates Stripe session, stores in DB, returns `private_url`
3. User clicks "Proceed to Checkout" → visits `/pay/:sessionId` → redirected to Stripe
4. Stripe fires webhook → `/api/webhook` generates `plk_` key, updates DB
5. User lands on `/success.html?session_id=xxx` → polls `/api/get-key` → sees their key

## Environment Variables

- `STRIPE_SECRET_KEY`: Stripe secret key (test or live)
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `API_KEY`: Internal API key for `/api/verify-coupon` authorization

## Running the App

```
npm run dev
```
App runs on port 5000.
