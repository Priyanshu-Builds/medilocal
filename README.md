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

Environment lives in `apps/api/.env` (see `.env.example` for all keys). Dev defaults work out of the box; Firebase/Razorpay/S3 keys are only needed from M1 onward.

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
- [ ] **M1** — Backend core: catalog, cart/pricing, order state machine, Rx upload (S3), Razorpay + webhook + COD, FCM
- [ ] **M2** — Dashboards: live orders board, Rx queue, CSV catalog import, shop/rider management, manual assignment
- [ ] **M3** — Customer app: search → cart → checkout → track
- [ ] **M4** — Rider app: shifts, tasks, background GPS, COD collection
- [ ] **M5** — Launch hardening + pilot with 2–3 shops
