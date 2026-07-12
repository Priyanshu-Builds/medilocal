# MediLocal — Feature Ticket List

> Reverse-documented on 2026-07-12. Because M0–M5 **engineering** is already shipped, most build
> tickets are marked ✅ **Done** for the record; the live work is the ⬜ **operational** launch
> tickets at the end. Each done ticket doubles as a regression checklist. Priorities: **P0** = must-have
> for pilot, **P1** = should-have, **P2** = nice-to-have. Roadmap source: [PLAN.md](../PLAN.md).

---

## Legend
- ✅ Done · 🟡 Partial (backend done, in-app pending keys/device) · ⬜ Not started
- **Dep** = must be completed first.

---

## M0 — Scaffold

### T0.1 Monorepo + tooling ✅ · P0
Turborepo + pnpm workspaces (`apps/*`, `packages/*`) plus `mobile/*` for Flutter; docker-compose for
Postgres (PostGIS) + Redis; GitHub Actions CI (lint, typecheck, test).
**Acceptance:** `pnpm install` bootstraps all workspaces; `docker compose up -d` gives healthy
Postgres + Redis; CI is green. **Dep:** none.

### T0.2 NestJS skeleton + Prisma schema + seed + Swagger ✅ · P0
API boots; full Prisma schema migrates; seed creates demo city/zone/shop/medicines + logins; Swagger
at `/docs`.
**Acceptance:** `GET /health` OK; `/docs` loads; `prisma migrate dev` + `pnpm db:seed` succeed; seed
logins work. **Dep:** T0.1.

### T0.3 Dashboard shells + Flutter app scaffolds ✅ · P0
Next.js admin (:3001) + pharmacy (:3002) with login; both Flutter apps created with theming +
navigation; `packages/shared` (state machine, zod, constants).
**Acceptance:** both dashboards render a login; both Flutter apps boot on emulator. **Dep:** T0.1.

---

## M1 — Backend core

### T1.1 Firebase token verification → JWT issuance ✅ · P0
Verify Firebase ID token via Admin SDK; issue backend access+refresh JWTs; `JwtAuthGuard` +
`RolesGuard` (token-kind + admin-role). Dev-login shortcut gated + prod-disabled.
**Acceptance:** valid Firebase token → JWT pair; protected route rejects missing/invalid token (401);
wrong kind/role → 403; dev-login refuses to run under `NODE_ENV=production`. **Dep:** T0.2.

### T1.2 Catalogue + fuzzy search ✅ · P0
Medicine master catalogue; pg_trgm fuzzy search on brand + generic, filtered to in-stock inventory in
the customer's zone.
**Acceptance:** `?q=dollo` returns Dolo despite the misspelling; results are zone- + stock-filtered.
**Dep:** T0.2.

### T1.3 Shops + inventory ✅ · P0
Shop + ShopStaff + ShopInventory; price enforced ≤ MRP; unique (shop, medicine).
**Acceptance:** can't set inventory price above MRP; a medicine appears once per shop. **Dep:** T1.2.

### T1.4 Cart + pricing ✅ · P0
Quote endpoint computes item totals, zone delivery fee, min-order check.
**Acceptance:** quote returns correct totals; below-minimum order is flagged; `pricing.spec.ts` passes.
**Dep:** T1.2, T1.3.

### T1.5 Order state machine (+ delivery OTP) ✅ · P0
Full state machine (`PLACED → … → DELIVERED` + `RX_REJECTED/CANCELLED/UNDELIVERED`); separate
`paymentState`; item-level `accepted` for partial acceptance; 4-digit `deliveryOtp`; status history.
**Acceptance:** only defined transitions allowed; partial acceptance drops items + auto-refunds the
difference; `state-machine.spec.ts` passes. **Dep:** T1.4.

### T1.6 Prescription upload (S3 signed URLs) ✅ · P0
Rx image → private S3; PENDING/APPROVED/REJECTED; served only via short-lived signed URLs; reject →
cancel + refund.
**Acceptance:** upload returns a key, not a public URL; a viewer gets a time-limited link; reject
cancels + refunds. **Dep:** T1.5, S3 keys.

### T1.7 Razorpay + webhook + COD ✅ · P0
Razorpay checkout; order confirmed only on HMAC-verified `payment.captured` webhook; COD under zone
cap with rider ledger; refunds.
**Acceptance:** bad webhook signature never marks PAID (`signature.spec.ts`); duplicate webhook is
idempotent; COD over cap is blocked. **Dep:** T1.5.

### T1.8 FCM notifications ✅ · P1
Push on new order / status change / rider offer.
**Acceptance:** a status change pushes to the right token. **Dep:** T1.5, Firebase keys.

### T1.9 OpenAPI → Dart client ✅ · P0
Committed `openapi.json`; CI fails on drift; generates `mobile/api_client/`.
**Acceptance:** `pnpm openapi:export` produces no diff on a clean build; `pnpm gen:dart-client`
outputs the Dart client. **Dep:** T1.1–T1.7.

---

## M2 — Dashboards

### T2.1 Admin orders board + manual override ✅ · P0
Live board (5s refresh), state filter; order detail with force-transition, assign/reassign rider,
payments/refunds/audit trail.
**Acceptance:** ops can force any legal transition and refunds/COD ledger apply automatically; every
override is audited. **Dep:** T1.5.

### T2.2 Admin Rx queue ✅ · P0
Pharmacist approve/reject with short-lived signed image link; reject cancels + refunds.
**Acceptance:** approving releases the order; rejecting cancels + refunds. **Dep:** T1.6, T2.1.

### T2.3 Catalogue CRUD + CSV import ✅ · P0
Create/edit/activate medicines; CSV bulk import upserts by name, **rejects Schedule X**, reports bad
rows without aborting.
**Acceptance:** a CSV with one Schedule X row + one malformed row imports the valid rows and reports
the two rejects (`csv.spec.ts`, `medicine-import.spec.ts`). **Dep:** T1.2.

### T2.4 Shop + rider management ✅ · P0
Onboard shop (PENDING until license verified), activate/suspend, add staff, edit inventory on behalf;
register riders, view COD in-hand.
**Acceptance:** new shop starts PENDING; ops can edit its inventory; rider COD shows correctly.
**Dep:** T1.3, T2.1.

### T2.5 Pharmacy portal — board + sound + item-by-item ✅ · P0
Live board with new-order **sound alert**; accept item-by-item; mark packed; inline Rx verify
(pharmacists only); stock/price management.
**Acceptance:** new order plays the sound (after the one-time gesture); dropping an item auto-refunds
the difference; non-pharmacist can't verify Rx. **Dep:** T1.5, T1.6.

---

## M3 — Customer app (Flutter)

### T3.1 Browse / search / cart / COD checkout ✅ · P0
Search → add to cart → COD checkout → order placed → live status timeline.
**Acceptance:** end-to-end COD order from the app reaches the admin board (verified in browser pane).
**Dep:** T1.9.

### T3.2 Firebase OTP login, Razorpay pay, Rx upload, map pin 🟡 · P0
Backend done; in-app wiring **deferred until Firebase/Razorpay keys + a device**.
**Acceptance:** OTP login, online payment, Rx capture, and address map-pin work on a real device with
keys. **Dep:** T3.1 + keys. See `mobile/customer/README.md`.

---

## M4 — Rider app (Flutter)

### T4.1 Duty shifts + task flow + OTP + COD ✅ · P0
Online/offline shifts; accept task; pickup → out-for-delivery → delivered gated by the customer's OTP;
COD marking into the ledger.
**Acceptance:** wrong OTP is rejected; correct OTP completes delivery; COD lands in the rider ledger
(verified on Android emulator). **Dep:** T1.5, T1.9.

### T4.2 Background GPS + live-location streaming 🟡 · P0
Foreground-service GPS built; live pipeline (Socket.IO/Maps) **deferred until keys + device**.
**Acceptance:** rider GPS streams to the customer's live map on a real device. **Dep:** T4.1 + keys.
See `mobile/rider/README.md`.

---

## M5 — Launch hardening (engineering ✅ / operational ⬜)

### T5.1 API hardening ✅ · P0
Helmet headers, rate limiting (10/min auth), graceful shutdown, unified error filter; Swagger +
dev-login off under `NODE_ENV=production`.
**Acceptance:** prod build exposes no `/docs` / dev-login; auth endpoints return 429 past the limit.

### T5.2 End-to-end pre-pilot gate ✅ · P0
`staging.e2e-spec.ts` walks a full order (COD + Razorpay webhook + refund) against a seeded DB; CI
`e2e` job runs on every push.
**Acceptance:** `pnpm --filter @medilocal/api test:e2e` passes.

### T5.3 Sentry (env-gated) ✅ · P1
API + Flutter error reporting; inert without `SENTRY_DSN`.
**Acceptance:** with a DSN, a thrown error appears in Sentry; without, it's a no-op.

### T5.4 Production Docker stack + backups ✅ · P0
`docker-compose.prod.yml` (API + Postgres + Redis + Nginx TLS); image self-migrates on boot; nightly
`pg_dump` → S3 via `scripts/backup-db.sh`.
**Acceptance:** `docker compose -f docker-compose.prod.yml up -d --build` serves the API behind Nginx;
backup script writes to S3.

---

## M5 (operational) — the remaining launch work ⬜

These need **your accounts and have days–weeks of lead time** — this is the live to-do list.

| # | Ticket | Priority | Dep | Done when |
|---|---|---|---|---|
| **T5.5** | **Razorpay live KYC + keys** | P0 | T1.7 | KYC approved; live keys + webhook secret in `.env.production`; live webhook points to `/v1/payments/razorpay/webhook`. |
| **T5.6** | **Firebase project + Phone Auth + FCM** | P0 | T1.1, T1.8 | `google-services.json` in each app; `FIREBASE_*` set; OTP login + push verified on device. |
| **T5.7** | **AWS ap-south-1 provisioning** | P0 | T5.4 | EC2/Lightsail host up; private S3 bucket (prescriptions); domain + TLS cert in `docker/nginx/certs/`; Activate credits applied. |
| **T5.8** | **Play Store internal track** | P0 | T3.2, T4.2 | Developer account; signed `.aab` on the internal track (see `mobile/rider/README.md`). |
| **T5.9** | **Native Android config** | P0 | T4.2 | Location / foreground-service / FCM manifest permissions added for the release build. |
| **T5.10** | **Legal sign-off** | P0 | — | Local lawyer reviews the marketplace model + T&Cs (e-pharmacy rules evolving). |
| **T5.11** | **Onboard pilot partners** | P0 | T2.4 | 2–3 shops (license copies + pharmacist reg numbers) + 1–2 riders onboarded via admin. |
| **T5.12** | **Wire in-app Firebase/Razorpay/Maps** | P0 | T3.2, T4.2, T5.5, T5.6 | Deferred mobile integrations (OTP, online pay, Rx capture, live map) working on device. |

---

## Post-pilot backlog (Deferred — do not build before pilot ships)

CloudFront CDN · Elasticsearch · multi-stop route optimisation · quantity-level low-stock alerts ·
Redis catalogue caching · Prometheus + Grafana · ratings & reviews (delivery/pharmacy service only,
**never** medicine) · transactional email (SES) · auto-nearest rider assignment · WhatsApp updates ·
Razorpay Route shop settlements · Shorebird OTA. Rationale per item in
[PLAN.md → "Deliberately deferred"](../PLAN.md).
