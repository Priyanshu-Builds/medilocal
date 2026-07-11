# MediLocal

Hyperlocal medicine ordering + delivery platform (Swiggy-style marketplace): customers order from partnered licensed local pharmacies, platform riders deliver, with online payments (Razorpay + COD), prescription verification, live tracking, and a central admin.

> "MediLocal" is a working name — rename by searching for `medilocal`/`MediLocal` across the repo.

Full architecture, data model, order state machine, compliance notes, and roadmap: **[docs/PLAN.md](docs/PLAN.md)**.

## Repo layout

```
apps/
  api/        NestJS backend (REST + Swagger) — port 3000
  admin/      Next.js admin dashboard         — port 3001
  pharmacy/   Next.js pharmacy partner portal — port 3002
packages/
  shared/     Shared TS constants, order state machine, zod schemas
mobile/
  customer/   Flutter customer app  (M3)
  rider/      Flutter rider app     (M4)
docs/         Plan & documentation
```

## Prerequisites

- Node.js 22+ and Docker Desktop (running)
- Flutter SDK — only needed for the mobile apps (see `mobile/*/README.md`)

## Quickstart

```powershell
corepack enable pnpm          # one-time: makes pnpm available
pnpm install                  # installs all workspaces, generates Prisma client
docker compose up -d          # Postgres (PostGIS) + Redis

pnpm --filter @medilocal/api exec prisma migrate dev --name init   # first migration
pnpm db:seed                  # demo city/zone/shop/medicines + logins

pnpm dev                      # api :3000 + admin :3001 + pharmacy :3002
```

Then:

| What | URL | Login |
|---|---|---|
| API health | http://localhost:3000/health | — |
| Swagger | http://localhost:3000/docs | — |
| Admin dashboard | http://localhost:3001 | `admin@medilocal.local` / `ChangeMe123!` |
| Pharmacy portal | http://localhost:3002 | `pharmacy@medilocal.local` / `ChangeMe123!` |

Try the fuzzy search (misspellings on purpose): `http://localhost:3000/v1/catalog/medicines?q=dollo`

Environment lives in `apps/api/.env` (see `.env.example` for all keys). Dev defaults work out of the box: COD orders, catalog, cart and the full order state machine run with **no external keys**. Firebase enables customer/rider phone login + push, Razorpay enables online payments, S3 enables prescription upload — each feature switches on independently when its keys are present.

## Trying the M1 order flow locally (no Firebase/Razorpay needed)

Set `DEV_LOGIN_ENABLED=true` in `apps/api/.env` (never in production), then from Swagger (`/docs`) or curl:

1. `POST /v1/auth/dev/login` `{"kind":"customer","phone":"9811111111"}` → customer token
2. `GET /v1/zones` → zone id · `POST /v1/me/addresses` (with that `zoneId`) → address id
3. `POST /v1/cart/quote` with `{zoneId, items:[{medicineId, qty}]}` (ids from catalog search) → priced quote
4. `POST /v1/orders` `{addressId, paymentMethod:"COD", items:[...]}` → order + 4-digit delivery OTP
5. Shop side (`POST /v1/auth/shop/login`, seeded creds): `GET /v1/shop/orders` → `POST /v1/shop/orders/:id/accept` (item-by-item) → `/pack`
6. Admin side: `POST /v1/admin/orders/:id/assign-rider` (rider from `GET /v1/admin/riders`)
7. Rider side (`dev/login` kind `rider`, phone `9800000003`): `/pickup` → `/out-for-delivery` → `/deliver` with the customer's OTP — wrong OTP is rejected; COD lands in the rider cash ledger.

Razorpay online payment: put test keys + webhook secret in `.env`, point a [Razorpay webhook](https://dashboard.razorpay.com) (`payment.captured`) at `POST /v1/payments/razorpay/webhook`; orders stay hidden from the shop until the webhook (or the checkout `verify` endpoint) marks them PAID.

## Dashboards (M2)

Both dashboards are Next.js apps that talk to the API above — start everything with `pnpm dev`, or run one with e.g. `pnpm --filter @medilocal/admin dev`.

**Admin console** (http://localhost:3001, `admin@medilocal.local` / `ChangeMe123!`):

- **Orders** — live board (auto-refreshes every 5s), filter by state; order detail with **manual override of everything**: assign/reassign a rider, force any legal state transition (refunds and the COD ledger apply automatically), see payments, refunds and the full audit trail.
- **Rx queue** — pharmacist approve/reject with a short-lived signed image link; rejecting also cancels + refunds the order.
- **Catalog** — search, create/edit medicines, activate/deactivate, and **CSV bulk import** (paste or upload; upserts by name, rejects Schedule X, reports bad rows without aborting the batch).
- **Shops** — onboard a shop (created PENDING until you verify the license), activate/suspend, add staff logins, edit inventory on the shop's behalf.
- **Riders** — register riders and watch each one's COD cash-in-hand.

**Pharmacy portal** (http://localhost:3002, `pharmacy@medilocal.local` / `ChangeMe123!`):

- **Orders** — Swiggy-partner-style live board with a **new-order sound alert** (click "Enable sound" once — browsers require a gesture before audio). Accept **item by item** (drop what's out of stock; the difference auto-refunds), mark packed, and verify prescriptions inline (registered pharmacists only).
- **Stock & prices** — add catalog medicines to your shelf, toggle in/out of stock, set your price up to MRP.

To populate the boards without the mobile apps, place a couple of orders with the M1 dev-login flow above.

## Dart API client (Flutter apps)

`apps/api/openapi.json` is the committed contract (CI fails if it drifts from the code — regenerate with `pnpm openapi:export`). Generate the Dart client with `pnpm gen:dart-client` (needs Java, or use the `openapitools/openapi-generator-cli` Docker image) → `mobile/api_client/`, wired into the Flutter apps in M3/M4.

## Firebase setup (needed for customer login, M1+)

1. Create a project at console.firebase.google.com; enable **Authentication → Phone**.
2. Project Settings → Service Accounts → **Generate new private key**; put `project_id`, `client_email`, `private_key` into `apps/api/.env` (`FIREBASE_*`).
3. Add Android apps for `com.medilocal.customer` / `com.medilocal.rider` and drop `google-services.json` into each Flutter app when M3/M4 begin.

## Do these early (they take days–weeks of lead time)

- Razorpay KYC (test keys work immediately; live keys need business verification)
- AWS account in ap-south-1 + apply for AWS Activate credits
- Lawyer review of the marketplace model & T&Cs (e-pharmacy rules are evolving)
- Collect partner shop drug-license copies and pharmacist registration numbers

## Roadmap

- [x] **M0** — Monorepo scaffold: API + schema + seed + Swagger, dashboard shells with login, Flutter app sources, CI
- [x] **M1** — Backend core: catalog, cart/pricing, order state machine, Rx upload (S3), Razorpay + webhook + COD, FCM
- [x] **M2** — Dashboards: live orders board, Rx queue, CSV catalog import, shop/rider management, manual assignment
- [x] **M3** — Customer app: search → cart → COD checkout → live tracking (Firebase OTP, Razorpay, Rx upload, map pin deferred until keys/device — see [mobile/customer/README.md](mobile/customer/README.md))
- [x] **M4** — Rider app: duty shifts, task accept, pickup→delivery status flow, delivery-OTP handoff, COD cash ledger, live-location streaming (background GPS via `geolocator`/foreground-service, Firebase OTP, maps, Socket.IO deferred until keys/device — see [mobile/rider/README.md](mobile/rider/README.md))
- [ ] **M5** — Launch hardening + pilot with 2–3 shops
