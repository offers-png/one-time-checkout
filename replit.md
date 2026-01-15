# Payment Link Generator

A secure Stripe payment link generator that creates single-use, expiring payment links.

## Overview

This application allows users to create private Stripe checkout payment links that:
- Expire after 1 hour
- Can only be used once
- Redirect to Stripe checkout when accessed

## Architecture

### Frontend (React + Vite)
- **Home page**: Payment link generation form with price input
- **Success page**: Shown after successful payment
- **Cancel page**: Shown when payment is cancelled

### Backend (Express + SQLite)
- **/api/create-link**: Creates a new Stripe checkout session and stores link in SQLite
- **/pay/:sessionId**: Validates and redirects to Stripe checkout
- **/api/webhook**: Handles Stripe webhook events (marks links as used)

### Database (SQLite)
- **links table**: Stores session IDs, prices, expiration times, and usage status

## Environment Variables

Required secrets:
- `STRIPE_SECRET_KEY`: Your Stripe secret key (test or live)

## Key Files

- `server/index.ts`: Main backend server with Stripe integration
- `client/src/pages/home.tsx`: Payment link generation UI
- `shared/schema.ts`: Shared TypeScript types and Zod schemas

## Running the App

The app runs on port 5000 using `npm run dev`.
