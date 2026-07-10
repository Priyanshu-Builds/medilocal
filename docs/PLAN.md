# Medicine Delivery Platform — Architecture & Build Plan

## Context

You're launching a hyperlocal medicine ordering + delivery platform (Swiggy/Zomato model) in your hometown in India: customers order from partnered local medical shops, your riders deliver, with online payments, live map tracking, and a central admin controlling everything. The repo is empty — this is a greenfield build. The goal is an MVP for one town on a foundation that scales to more towns without a rewrite.

**Stack finalized by merging your proposed table with my draft**: your choices adopted (Flutter, Firebase Phone Auth, AWS + S3, Nginx, Swagger, Firebase Analytics), my medicine-specific additions kept (COD, prescription verification flow, fuzzy search, zone scoping, partial order acceptance). Prometheus/Grafana deferred to the scale phase.

---

## Product surfaces

| Surface | Tech | Notes |
|---|---|---|
| Customer app | **Flutter** (Android-first, iOS later) | Browse/search, cart, Rx upload, Razorpay/COD, live tracking |
| Delivery (rider) app | **Flutter** | Task accept, status updates, background GPS (foreground service), COD collection |
| Pharmacy dashboard | **Next.js + TS** (separate app, phone-friendly) | Item-by-item order acceptance with loud new-order alert (Swiggy-partner style), stock/price management |
| Admin dashboard | **Next.js + TS** | Full control: catalog, shops, orders, riders, refunds, zones, staff RBAC |

## Compliance (shapes the product — do not skip)

- **Marketplace model is the right one.** Partner shops hold the drug licenses and dispense; you facilitate — same model as 1mg/PharmEasy. Keep it that way.
- **Prescription flow is mandatory** for Schedule H/H1 medicines: customer uploads Rx image at checkout → a registered pharmacist verifies before dispatch → Rx stored against the order. Catalog carries a schedule flag per medicine. **No Schedule X online, ever.** OTC needs no Rx.
- **DPDP Act 2023**: prescriptions are sensitive health data → private S3 bucket, time-limited signed URLs, explicit consent, privacy policy.
- **Firebase Phone Auth sidesteps India's DLT SMS registration** at launch (Google sends the OTP SMS). DLT is only needed if you later add your own transactional SMS — push + WhatsApp cover order updates meanwhile.
- E-pharmacy rules are still evolving — get a local lawyer's sign-off on T&Cs and the model before launch. Start Razorpay KYC immediately (takes days).

## Tech stack (final)

| Component | Technology | Notes |
|---|---|---|
| Customer + delivery apps | **Flutter** | Best performance on the low-end Androids common in small towns; `google_maps_flutter` for maps. Optional later: Shorebird for OTA code push |
| Admin + pharmacy dashboards | **Next.js + TypeScript** + Tailwind + shadcn/ui + TanStack Query/Table | Two apps in the monorepo sharing `packages/ui` |
| Backend | **NestJS + TypeScript** — modular monolith, REST + Socket.IO gateway | Modules: auth, catalog, shops, inventory, orders, prescriptions, payments, delivery, tracking, notifications, admin |
| API docs | **Swagger** (`@nestjs/swagger`) from day 1 | Also used to **generate the Dart API client** (openapi-generator) so Flutter models stay in sync with the backend |
| Database | **PostgreSQL + PostGIS + pg_trgm**, **Prisma** ORM | Geo queries (zones, nearby shops) + fuzzy medicine-name search; raw SQL for geo where Prisma falls short |
| Cache / jobs | **Redis + BullMQ** | Live rider locations (Redis GEO), OTP/session state, rate limits, job queues (notifications, order timeouts) |
| Auth | **Firebase Phone Auth → backend verifies ID token (Firebase Admin SDK) → issues own JWT (access+refresh)** | Auto OTP-read on Android, no DLT friction. Admin/pharmacy: email+password+TOTP. RBAC throughout |
| Payments | **Razorpay** (UPI/cards/netbanking/wallets) + **COD** | Order confirmed only on `payment.captured` webhook; COD under configurable value cap with rider cash ledger. Razorpay Route later for automated shop settlements |
| Maps | **Google Maps Platform** behind a thin provider abstraction | Free monthly call tiers cover launch volume; Ola Maps/Mappls swap option at scale |
| Live tracking | Own GPS pipeline: rider app → **Socket.IO** → Redis → customer app | Zero per-ping API cost; Directions API only for ETA (cached at assign + pickup) |
| Push / comms | **FCM** via Firebase; WhatsApp updates (AiSensy/Interakt) phase 2 | |
| Storage | **Amazon S3 (Mumbai)** — private bucket + signed URLs | Prescriptions, medicine images, shop license docs |
| Hosting | **AWS ap-south-1 (Mumbai)** — pilot: one EC2 t4g/Lightsail box with Docker Compose (API + Postgres + Redis + **Nginx**), nightly DB backups to S3 | Scale path: ECS Fargate + RDS + read replica. **Apply for AWS Activate credits** |
| CI/CD | **GitHub Actions** | Lint, typecheck, test, build; Flutter APK builds; deploy via SSH/compose pull |
| Monitoring | **Sentry** (API + Flutter) + CloudWatch alarms now; **Prometheus + Grafana at scale phase** | Prom/Grafana is its own ops burden — not worth it at pilot volume |
| Analytics | **Firebase Analytics** (free, already integrated); Mixpanel/PostHog later if funnels outgrow it | |
| Repo | Single monorepo: Turborepo/pnpm for TS (`apps/api`, `apps/admin`, `apps/pharmacy`, `packages/shared`, `packages/ui`) + `mobile/customer`, `mobile/rider` (Flutter) | |

**Why a modular monolith, not microservices:** one town's order volume never justifies distributed-system overhead. Clean module boundaries mean tracking/notifications can be extracted into services if scale demands. Every core table is scoped by `city_id`/`zone_id` from day 1, so town #2 is a config/data change, not a rewrite.

## Data model (core tables)

- `users`, `addresses` (geog point), `cities`, `zones` (polygon = delivery boundary; per-zone delivery fee/min-order config)
- `shops` (license no., geog, zone, commission %), `shop_staff`
- `medicines` — master catalog: name, brand, generic/salt, manufacturer, MRP, pack size, **schedule flag**, `rx_required`
- `shop_inventory` — shop_id + medicine_id, price (≤ MRP), in_stock
- `orders` (state, payment_state, totals, address snapshot), `order_items` (per-item accepted flag), `order_status_history`
- `prescriptions` (order_id, S3 key, status, verified_by, rejection reason)
- `riders`, `delivery_assignments`; rider live location in Redis GEO + sampled history table
- `payments` (Razorpay ids, method, status), `refunds`
- `admin_users`, roles/permissions, `audit_log` (every admin action)

## Key flows

**Order state machine** (the heart of the system):
`PLACED → RX_REVIEW (if Rx items) → ACCEPTED (shop confirms item-by-item) → PACKED → RIDER_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED`
Terminals/branches: `RX_REJECTED`, `CANCELLED`, `UNDELIVERED` — each with automatic refund handling. `payment_state` tracked separately: `PENDING → PAID → REFUNDED/PARTIALLY_REFUNDED`, or `COD_DUE → COD_COLLECTED`.

- **Partial acceptance** (small-town reality — shops won't keep stock accurate): shop confirms availability per item; unavailable items are dropped and the difference auto-refunded. Ops can confirm by phone on the shop's behalf.
- **Auth**: Flutter app completes Firebase Phone Auth → sends Firebase ID token → NestJS verifies via Admin SDK → issues its own JWT pair. Backend owns sessions; Firebase is only the OTP front door.
- **Payments**: Razorpay Checkout in app; order confirmed only on the `payment.captured` webhook (never trust the client). Auto-refund on Rx rejection/cancellation. COD capped by config; rider marks collection; admin reconciles per-rider cash ledger daily.
- **Rider assignment**: MVP = admin one-tap assign + "first to accept" FCM broadcast to online riders. Auto-nearest later.
- **Tracking**: rider app streams GPS (~every 7s, Android foreground service via `geolocator` + `flutter_foreground_task`) → Socket.IO → Redis → customer's order room; polyline on the in-app map.
- **Delivery OTP**: every order carries a 4-digit handoff code shown in the customer app; the rider must enter it to mark DELIVERED. Prevents "delivered but never received" disputes and protects COD cash handoffs. (Order field in M1, rider entry flow in M4 — no SMS needed, the code lives in the app.)
- **Search**: pg_trgm fuzzy match on brand + generic names (misspellings are the norm), filtered to in-stock inventory in the customer's zone. Postgres FTS / Elasticsearch only if a multi-city catalog ever outgrows this.

## Admin panel scope

Live orders board · order detail with **manual override of everything** (ops-assisted mode is the launch safety net) · Rx verification queue · catalog CRUD + CSV bulk import (seed top ~2,000 locally-sold SKUs; you'll do the data entry, not shops) · shop onboarding (license docs) + inventory editing on shops' behalf · rider management + live rider map · customers · refunds · zone/fee config · RBAC (SuperAdmin, Ops, Pharmacist, Support, Finance) · audit log.

## Deliberately deferred (agreed, revisit at scale)

- **CloudFront CDN** — serve medicine images straight from S3 Mumbai at pilot (one town = no latency problem). Prescriptions never go on a public CDN regardless — always private bucket + signed URLs.
- **Elasticsearch** — pg_trgm covers a small-town catalog; revisit at multi-city volume.
- **Route optimization** — pilot deliveries are single-order; Directions + ETA is enough. Multi-stop batching comes when riders carry several orders at once.
- **Low-stock alerts** — needs quantity-level inventory that shops won't maintain; boolean in/out-of-stock + partial acceptance covers the pilot.
- **Redis catalog caching** — Postgres serves a ~2k-SKU catalog in microseconds; caching adds invalidation bugs before it adds speed. Redis's MVP jobs: rider live locations, BullMQ queues, rate limits, Socket.IO adapter.
- **Prometheus + Grafana** — Sentry + CloudWatch alarms until real traffic.
- **Ratings & reviews (phase 2)** — rate the delivery and pharmacy service only; never medicine reviews (implied medical claims are a regulatory problem).
- **Transactional email** — AWS SES when GST invoices/receipts land (M2/M3); no email infra before that.

## Build milestones

- **M0 — Scaffold** (first coding session): monorepo (Turborepo/pnpm + `mobile/`); docker-compose (Postgres+Redis); NestJS skeleton with Prisma schema + migrations + seed + Swagger at `/docs`; Firebase project wiring (Auth/FCM/Analytics); Next.js admin + pharmacy shells with login; `flutter create` both apps with theming + navigation; `packages/shared`; GitHub Actions CI; README.
- **M1 — Backend core**: Firebase token verification + JWT issuance, catalog + fuzzy search, shops/inventory, cart + pricing, order state machine (incl. delivery OTP field), Rx upload via S3 signed URLs, Razorpay + webhook + COD, FCM notifications, OpenAPI → Dart client generation.
- **M2 — Dashboards**: admin orders board, Rx queue, CSV import, shop/rider management, manual assignment; pharmacy dashboard with sound alerts + item-by-item acceptance.
- **M3 — Customer app**: browse/search, cart, address with map pin, checkout (Razorpay/COD), Rx upload, live tracking screen.
- **M4 — Rider app**: online/offline shifts, task accept, status progression, background GPS, delivery OTP entry, COD marking.
- **M5 — Launch hardening**: end-to-end staging order with Razorpay test keys, Sentry, Play Store internal track, Razorpay KYC live, pilot with 2–3 shops and 1–2 riders.

Realistic pace: **~10–14 weeks to pilot** for 1–2 focused devs.

## Running costs at pilot scale

EC2 t4g.small/Lightsail ~$12–15/mo + S3 a few $ + domain; Firebase Phone Auth ~₹1–2 per OTP (negligible at pilot volume; swap to MSG91 ~₹0.20 at scale if it ever matters); Razorpay ~2% per transaction; Google Maps within free tier; Play Store $25 one-time. **₹3–6k/month infra**, and AWS Activate credits can cover most of year one.

## Risks & mitigations

- **Regulatory flux** → marketplace model + lawyer review before launch (non-negotiable).
- **Two-language stack** (Dart + TS) → duplicated models drift; mitigated by generating the Dart API client from the Swagger/OpenAPI spec in CI.
- **Shops won't maintain stock** → partial acceptance + ops-assisted inventory.
- **Catalog data entry burden** → CSV import; start with the ~2k SKUs your town actually buys.
- **COD cash leakage** → rider cash ledger + daily reconciliation in admin.
- **AWS cost surprises** → single-box compose pilot, billing alarms from day 1, no NAT gateways/RDS until needed.
- **Scope creep** → milestones are strictly ordered; nothing outside them until pilot ships.

## Verification

- **M0**: `docker compose up` → API `/health` returns OK and Swagger UI loads at `/docs`; `prisma migrate dev` + seed succeeds; both dashboards render login; `flutter run` boots both apps on an emulator/device.
- **M1+**: Jest e2e on the order state machine and Razorpay webhook signature verification (test mode); manual flow: create order via API → it appears on the admin board.
- **Pre-pilot**: one real staging order end-to-end — search → Rx upload → pay (test key) → pharmacy accepts → assign rider → GPS tracking visible in customer app → delivered → refund path checked.
