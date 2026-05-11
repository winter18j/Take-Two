# Take Two Online Setup Guide

This guide keeps the first production pass as cheap as possible:

- Supabase Free for Auth + Postgres.
- A low-cost/free Node host for the Socket.IO server.
- AdMob for ads.
- RevenueCat over Google Play Billing for token packs, no-ads, and premium.

## 1. Accounts You Need

1. Create a Supabase account and project.
2. Create a GitHub account if you do not already have one.
3. Create a Google Play Console developer account. Google currently lists this as a one-time US$25 registration fee.
4. Create a Google AdMob account.
5. Create a RevenueCat account.
6. Optional but recommended: create an Expo account for EAS builds.

## 2. Supabase Project

1. Open Supabase and create a new project.
2. Save these values:
   - Project URL
   - anon public key
   - service role key
3. Go to Authentication > Providers > Email.
4. For now, disable email confirmations if you want sign-up to return a session immediately.
5. Go to SQL Editor.
6. Open `supabase/schema.sql` in this repo.
7. Paste it into Supabase SQL Editor and run it.

What this creates:

- `profiles`: account display name, hidden score, win/loss stats, ad/premium flags.
- `wallets`: token balance.
- `token_transactions`: every token gain/spend.
- `matches`: match results and final loser.
- `matchmaking_queue`: random-play queue.
- `purchases`: store purchase records.
- A trigger that creates a profile and 3 starting tokens for every new auth user.

## 3. Local Environment Values

Copy `.env.example` to `.env` in the app root:

```bash
copy .env.example .env
```

Fill in:

```text
EXPO_PUBLIC_SERVER_URL=https://YOUR_SERVER_HOST
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-...
EXPO_PUBLIC_REVENUECAT_PUBLIC_ANDROID_KEY=goog_...
```

Copy `server/.env.example` to `server/.env`:

```bash
copy server\.env.example server\.env
```

Fill in:

```text
PORT=3001
CLIENT_ORIGIN=*
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
ADMOB_ANDROID_APP_ID=ca-app-pub-...
GOOGLE_PLAY_PACKAGE_NAME=com.walidsabhi.taketwo
REVENUECAT_PUBLIC_ANDROID_KEY=goog_...
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in the mobile app.

## 4. Packages To Install When You Are Ready

The current code keeps placeholders so local play still works without native SDKs. When you are ready to wire real auth, ads, and purchases:

```bash
npm install @supabase/supabase-js
npx expo install expo-secure-store expo-application expo-dev-client
npx expo install react-native-google-mobile-ads
npx expo install react-native-purchases react-native-purchases-ui
```

You will need an Expo development build for native ads and purchases. Expo Go is not enough for full native purchase/ad testing.

## 5. Server Hosting

You need a public HTTPS server for Socket.IO so phones do not depend on localhost or Wi-Fi LAN.

Cheap/free-ish options:

- Render free web service, if available in your region/account.
- Railway/Fly.io free credits, if available.
- A small VPS later when traffic grows.

Deploy the `server` folder:

```bash
cd server
npm install
npm run typecheck
npm test
npm run dev
```

For production, the host should run:

```bash
npm install
npm start
```

Set the host environment variables from `server/.env.example`.

For Render specifically:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Do not manually set `PORT`; Render provides it automatically.

The repo also includes `render.yaml` with the same settings.

After deployment, set `EXPO_PUBLIC_SERVER_URL` to the public server URL.

## 6. Authentication Flow

Use Supabase email/password auth first:

- Sign up with email + password.
- Email confirmation disabled for early testing.
- On login, read `profiles` and `wallets`.
- Use the Supabase user ID as the account ID.
- When connecting to Socket.IO, send the Supabase access token so the server can verify the user.

Minimal next code events:

- Client sends `authToken` when connecting.
- Server verifies the token with Supabase.
- Server attaches `accountId` to the socket/session.
- `createRoom` spends 1 token when the game actually starts.
- Match finish records winner/loser and updates stats/tokens.

## 7. Token Rules

Rules requested:

- Win a match: +1 token.
- Create and start a room: -1 token.
- Watch rewarded ad: +1 token.
- Buy token packs:
  - 10 tokens: $0.99
  - 20 tokens: $1.59
  - 30 tokens: $1.99
  - 50 tokens: $2.99
  - 75 tokens: $3.99
  - 100 tokens: $4.99
- No ads: $0.99 and grant 3 tokens once.
- Premium: $5.99/month, no ads and unlimited tokens.

`server/src/services/economy.ts` contains these product IDs and helper formulas.

## 8. Google Play Products

In Google Play Console:

1. Create the app.
2. Set package name to `com.walidsabhi.taketwo`.
3. Go to Monetize > Products > In-app products.
4. Create consumables:
   - `tokens_10`
   - `tokens_20`
   - `tokens_30`
   - `tokens_50`
   - `tokens_75`
   - `tokens_100`
5. Create non-consumable:
   - `remove_ads`
6. Create subscription:
   - `premium_monthly`
7. Put the same product IDs in RevenueCat.

Use RevenueCat as the app-facing purchase layer. Your server should trust RevenueCat webhooks or verified purchase status before granting tokens.

## 8.1 RevenueCat Detailed Setup

Use this once your Google Play app and products exist.

### A. Create RevenueCat Project

1. Go to `https://app.revenuecat.com`.
2. Sign up or log in.
3. Create a new project.
4. Name it `Take Two`.
5. Add an Android app.
6. Use the exact same package name as Google Play Console, for example:

```text
com.walidsabhi.taketwo
```

7. RevenueCat will create an Android SDK API key.
8. Copy it into:

```text
EXPO_PUBLIC_REVENUECAT_PUBLIC_ANDROID_KEY=goog_xxxxxxxxx
REVENUECAT_PUBLIC_ANDROID_KEY=goog_xxxxxxxxx
```

### B. Connect RevenueCat To Google Play

RevenueCat needs a Google service account JSON key so it can verify purchases and subscriptions.

1. Open Google Cloud Console.
2. Use the same Google Cloud project linked to your Play Console app.
3. Enable these APIs:
   - Google Play Android Developer API
   - Google Play Developer Reporting API
   - Pub/Sub API
4. Go to IAM & Admin > Service Accounts.
5. Create a service account named:

```text
revenuecat-service-account
```

6. Give it these Google Cloud roles:
   - Pub/Sub Editor, or Pub/Sub Admin if Editor fails
   - Monitoring Viewer
7. Open the service account.
8. Go to Keys.
9. Create a new JSON key.
10. Download the JSON file and keep it private.

Now grant this service account access in Google Play:

1. Open Google Play Console.
2. Go to Users and permissions.
3. Invite the service account email from the JSON file.
4. Add your Take Two app under App permissions.
5. Grant these permissions:
   - View app information and download bulk reports
   - View financial data, orders, and cancellation survey response
   - Manage orders and subscriptions
6. Apply and save.

Now upload it in RevenueCat:

1. Open RevenueCat.
2. Go to Project Settings.
3. Open your Android app settings.
4. Find Google Play service credentials.
5. Upload the JSON key.
6. Save.

Important: RevenueCat says Google Play credentials can take up to 36 hours to validate.

### C. Create Entitlements

RevenueCat entitlements are feature flags unlocked by purchases.

Create:

```text
no_ads
premium
```

Use them like this:

- `no_ads`: granted by `remove_ads`.
- `premium`: granted by `premium_monthly`.

Token packs are consumables and do not need entitlements. They should grant tokens after purchase.

### D. Import Or Add Products

In RevenueCat:

1. Go to Products.
2. Import products from Google Play if the service credentials are valid.
3. If importing is not available yet, manually add them with matching IDs:

```text
tokens_10
tokens_20
tokens_30
tokens_50
tokens_75
tokens_100
remove_ads
premium_monthly
```

Attach products:

- `remove_ads` -> entitlement `no_ads`
- `premium_monthly` -> entitlement `premium`
- token packs -> no entitlement, consumable token grant

### E. Create Offering

1. Go to Offerings.
2. Create an offering named:

```text
default
```

3. Mark it as Current.
4. Add packages:
   - `tokens_10`
   - `tokens_20`
   - `tokens_30`
   - `tokens_50`
   - `tokens_75`
   - `tokens_100`
   - `remove_ads`
   - `premium_monthly`

RevenueCat offerings are what the app fetches to show products/paywalls.

### F. Testing Requirements

For Android real purchases:

1. Upload a signed AAB to Google Play Console.
2. Put it on Internal testing or Closed testing.
3. Add a tester email.
4. The tester email must not be the Play Console owner account.
5. Install the app from the Play testing link, or use an EAS dev build with the same package name.
6. Wait for products and credentials to become active.

Expo Go is not enough for real purchases. You need a development build:

```bash
npx expo install expo-dev-client react-native-purchases react-native-purchases-ui
eas build --platform android --profile development
```

## 9. AdMob

In AdMob:

1. Create app.
2. Copy Android app ID.
3. Create an interstitial ad unit for post-game ads.
4. Create a rewarded ad unit for “watch ad +1 token.”
5. Put IDs in `.env`.

Requested ad behavior:

- Track app-open time.
- If at least 5 minutes passed, show an interstitial right after a game ends.
- Do not show ads when `profiles.no_ads = true` or `premium_until > now()`.
- Rewarded ad grants +1 token only after the rewarded event completes.

The current app has an end-game ad placeholder. Replace it with real AdMob interstitial/rewarded calls after installing the SDK.

## 10. Matchmaking

Hidden score formula:

```text
1000 + winRate * 500 - lossRate * 350 + min(300, log2(games + 1) * 80)
```

Random play flow:

1. User taps Play Random.
2. Server checks `random_banned_until`.
3. If banned, reject with remaining time.
4. If not banned, add to `matchmaking_queue`.
5. Match players whose hidden scores are close.
6. If queue wait grows, widen the score range over time.

Quit penalties:

- quitter flag 1: 1 hour random-play ban
- quitter flag 2: 2 hours
- quitter flag 3: 3 hours
- quitter flag 4: 24 hours
- quitter flag 5+: 120 hours

`server/src/services/economy.ts` has the helper for these durations.

## 11. Expo / Android Build

When ready for real mobile builds:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile development
```

For Google Play release:

```bash
eas build --platform android --profile production
eas submit --platform android
```

You will need the Google Play Console account and the exact package name configured before store purchases work.

## 12. Current Placeholder Buttons

Main menu now includes placeholders for:

- Play Random
- Sign In
- Watch Ad +1 Token
- Buy Tokens
- Remove Ads
- Premium
- Customize

They are intentionally disabled until Supabase auth, AdMob, and RevenueCat keys are provided and SDKs are installed.
