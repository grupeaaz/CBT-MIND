# CBT MIND - Healing & Wisdom App

## Overview
A mobile-first web application combining Cognitive Behaviour Therapy (CBT), religious wisdom, Eckhart Tolle teachings, and philosophical insights for depression healing and mindfulness practice. App name: CBT MIND.

## Recent Changes
- Feb 15, 2026: Added device-level data isolation - all wins, journal entries, mood entries, and insights are now scoped per device via deviceId. No data leaks between users.
- Feb 15, 2026: Fixed 404 on /focus route - onboarding now redirects to / correctly
- Feb 15, 2026: Changed Focus tab icon from house to crosshair, compacted FocusDetail page to fit one screen
- Feb 15, 2026: Updated app name to "CBT MIND" in manifest.json and index.html meta tags
- Feb 15, 2026: Fixed deployment build error - replaced top-level await with .catch() for CJS compatibility
- Feb 14, 2026: Renamed Practices to Insights tab - stats visualization (pie chart, active days, focus breakdown, common patterns) + AI-generated reflections using OpenAI
- Feb 14, 2026: Re-enabled all Stripe payment functionality, kept free wins limit at 30
- Feb 14, 2026: Added subscription restore by email - users can restore their subscription on a new device by entering their email
- Feb 13, 2026: Converted to PWA (Progressive Web App) - installable on mobile, offline support, app icons, install prompt
- Feb 13, 2026: Added evening push notifications - 8 PM daily reminder, toggle in Profile, web-push + service worker
- Feb 13, 2026: Added Stripe subscription paywall - 3 free wins, then €2/month billed yearly (€24/year) with 7-day free trial
- Feb 13, 2026: Added server-side subscription enforcement with device ID tracking
- Feb 13, 2026: Added wins tracking, victory animation, validation requiring all 3 sections filled
- Feb 13, 2026: Initial build - full-stack app with onboarding, mood tracking, journaling, quotes, and practices

## Architecture
- **Frontend**: React + Vite + TanStack Query + wouter routing + Tailwind CSS v4
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Payments**: Stripe (via stripe-replit-sync) - webhook route before express.json(), product "Presence Premium" seeded
- **Design**: "Ethereal Presence" aesthetic - Cormorant Garamond serif + Outfit sans-serif, sage/earth palette, glassmorphism cards

## Key Features
1. **Onboarding**: 3-screen intro flow (anxiety/memories/stress → CBT/Religion/Philosophy → personal experience)
2. **Focus Selection**: 4 clickable blocks (Bad Memory, Bad Thought, Bad Experience, Anxiety) - main landing page
3. **FocusDetail**: 3 required sections - Name It, Disfunction (10 cognitive distortions), Facts and Self Advocacy
4. **Wins**: Victory animation (trophy), wins page with ticket summaries, win count badge in nav
5. **Subscription Paywall**: After 3 free wins, requires Stripe subscription (€2/month yearly, 7-day trial)
6. **Journal**: Full CRUD with emotional tagging, persisted to database
7. **Insights**: Stats visualization (pie chart, active days, focus breakdown, common patterns) + AI-generated reflections via OpenAI
8. **Profile**: Stats from real data (journal count, mood tracking days, mood history chart)
9. **Push Notifications**: Evening reminder at 8 PM daily ("How are your thoughts?"), toggle on/off in Profile

## Stripe Integration
- **Product**: "Presence Premium" (prod_TyKidYZx7BlomT)
- **Price**: €24/year (€2/month billed yearly) with 7-day free trial
- **Paywall**: Server enforces at POST /api/wins after 30 free wins
- **Device tracking**: Device ID stored in localStorage, tied to subscription records
- **Restore**: Users can restore subscription on new device via email lookup (checks local DB + Stripe API, verifies Presence Premium product)
- **Files**: server/stripeClient.ts, server/webhookHandlers.ts, server/seedProducts.ts

## Project Structure
- `shared/schema.ts` - Drizzle schema (users, mood_entries, journal_entries, quotes, wins, app_subscriptions, push_subscriptions)
- `server/storage.ts` - DatabaseStorage class with all CRUD operations
- `server/routes.ts` - API routes (/api/moods, /api/journal, /api/quotes, /api/wins, /api/subscription/*, /api/stripe/*)
- `server/stripeClient.ts` - Stripe client with Replit connector credentials
- `server/webhookHandlers.ts` - Stripe webhook processing
- `server/seedProducts.ts` - Script to create Presence Premium product in Stripe
- `server/replit_integrations/` - OpenAI chat, audio, image, batch integrations (Replit AI Integrations)
- `client/src/pages/` - FocusSelection, FocusDetail, Wins, Subscribe, SubscriptionSuccess, Insights, Journal, Profile

## User Preferences
- Mobile-first design required
- Content themes: CBT, religion, Eckhart Tolle, philosophy
- Prefers simple clickable text blocks over complex UI components
- Navigation visible on ALL screens including Focus Selection
