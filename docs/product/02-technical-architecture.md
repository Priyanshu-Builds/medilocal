# MediLocal — Technical Architecture Document

> Reverse-documented from the built codebase on 2026-07-12. Versions are the actual pinned ranges
> from `package.json` / `pubspec.yaml`. Full rationale in [docs/PLAN.md](../PLAN.md).

---

## 1. Tech Stack

### Backend — `apps/api`
| Concern | Technology | Version | Why |
|---|---|---|---|
| Framework | **NestJS** (modular monolith, REST) | `^11.0.0` | Clean module boundaries; one town never needs microservices. Modules extractable later. |
| Language | **TypeScript** | `^5.7.2` | Shared language with dashboards + generated Dart client. |
| ORM | **Prisma** (`@prisma/client`) | `^6.8.0` | Type-safe DB access; raw SQL escape hatch for PostGIS geo. |
| Database | **PostgreSQL + PostGIS + pg_trgm** | PG 16 (Docker) | Geo (zones/nearby) + fuzzy medicine search in one engine. |
| Cache/jobs | **Redis** (+ BullMQ planned) | 7 (Docker) | Rider live locations (GEO), rate limits, queues, Socket.IO adapter. |
| Auth issue | **`@nestjs/jwt`** access+refresh | `^11.0.0` | Backend owns sessions; Firebase is only the OTP front door. |
| Phone OTP | **firebase-admin** (verify ID token) | `^13.0.0` | Sidesteps India DLT SMS registration at launch. |
| Payments | **razorpay** | `^2.9.6` | UPI/cards/netbanking/wallets; webhook-confirmed. |
| Storage | **@aws-sdk/client-s3** + presigner | `^3.108x` | Private bucket + signed URLs for prescriptions/images. |
| API docs | **@nestjs/swagger** | `^11.0.0` | `/docs` UI + committed `openapi.json` → generates Dart client. |
| Hardening | **helmet**, **@nestjs/throttler** | `^8.2.0`, `^6.5.0` | Security headers + rate limiting (10/min on auth). |
| Monitoring | **@sentry/node** | `^10.65.0` | Env-gated (inert without `SENTRY_DSN`). |
| Validation | **class-validator** / **class-transformer** | `^0.14.1` / `^0.5.1` | DTO validation. |
| Password hash | **bcryptjs** | `^3.0.2` | Shop-staff + admin passwords. |
| Testing | **Jest** + **ts-jest** + **supertest** | `^30.x` | Unit specs + e2e pre-pilot gate. |

### Dashboards — `apps/admin`, `apps/pharmacy`
**Next.js + TypeScript + Tailwind + shadcn/ui + TanStack Query/Table.** Two apps in the monorepo
sharing `packages/ui`. Admin on port **3001**, pharmacy on **3002**.

### Mobile — `mobile/customer`, `mobile/rider`
**Flutter** (Android-first). Maps via `google_maps_flutter`, GPS via `geolocator` +
`flutter_foreground_task`, push via FCM. Dart API client generated from `openapi.json` into
`mobile/api_client/`. Sentry via `SentryFlutter`.

### Platform / Ops
- **Runtime:** Node.js 22+, Docker Desktop.
- **Monorepo:** Turborepo + **pnpm** workspaces for TS; Flutter apps under `mobile/`.
- **Hosting (pilot):** AWS ap-south-1 (Mumbai) — single EC2 t4g/Lightsail box, Docker Compose
  (API + Postgres + Redis + **Nginx** TLS termination), nightly `pg_dump` → S3.
- **CI/CD:** GitHub Actions — lint, typecheck, test, e2e gate, OpenAPI drift check, Flutter builds.
- **Scale path (deferred):** ECS Fargate + RDS + read replica.

## 2. File & Folder Structure

```
Claude/                              # monorepo root
├─ apps/
│  ├─ api/                           # NestJS backend — port 3000
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma            # data model (single source of truth for DB)
│  │  │  └─ seed.ts                  # demo city/zone/shop/medicines + logins
│  │  ├─ src/
│  │  │  ├─ main.ts                  # bootstrap: helmet, CORS, Swagger, global filter
│  │  │  ├─ app.module.ts            # wires every feature module + ThrottlerModule
│  │  │  ├─ instrument.ts            # Sentry init (env-gated)
│  │  │  ├─ health.controller.ts     # GET /health
│  │  │  ├─ prisma/                  # PrismaService (DB client provider)
│  │  │  ├─ firebase/                # Firebase Admin ID-token verification
│  │  │  ├─ common/                  # guards, decorators, filters, money/phone utils
│  │  │  │  ├─ roles.guard.ts        # token-kind + admin-role enforcement
│  │  │  │  ├─ auth.decorator.ts     # @Auth() / @AdminRoles()
│  │  │  │  ├─ current-user.decorator.ts
│  │  │  │  ├─ all-exceptions.filter.ts   # unified error responses
│  │  │  │  └─ logging.interceptor.ts
│  │  │  ├─ auth/                     # dev-login, shop/admin login, JWT issue, JwtAuthGuard
│  │  │  ├─ zones/                    # zone list/config
│  │  │  ├─ users/                    # customer profile + addresses
│  │  │  ├─ catalog/                  # medicines, fuzzy search, CSV import
│  │  │  ├─ shops/                    # shops, staff, inventory
│  │  │  ├─ cart/                     # quote + pricing rules
│  │  │  ├─ orders/                   # state machine, order actions, rider service
│  │  │  ├─ prescriptions/            # Rx upload + verification
│  │  │  ├─ payments/                 # Razorpay + webhook signature + COD + refunds
│  │  │  ├─ notifications/            # FCM
│  │  │  └─ storage/                  # S3 signed URLs
│  │  ├─ test/                        # staging.e2e-spec.ts (pre-pilot gate)
│  │  ├─ Dockerfile                   # prod image (self-migrates on boot)
│  │  ├─ openapi.json                 # committed contract — regen with pnpm openapi:export
│  │  └─ .env.example                 # every config key documented
│  ├─ admin/                          # Next.js admin dashboard — port 3001
│  └─ pharmacy/                       # Next.js pharmacy portal — port 3002
├─ packages/
│  ├─ shared/                         # TS constants, order state machine, zod schemas
│  └─ ui/                             # shared dashboard components
├─ mobile/
│  ├─ customer/                       # Flutter customer app (lib/theme.dart = design system)
│  ├─ rider/                          # Flutter rider app
│  └─ api_client/                     # generated Dart client (from openapi.json)
├─ docker/nginx/                      # prod reverse-proxy + certs
├─ scripts/backup-db.sh               # nightly pg_dump → S3
├─ docker-compose.yml                 # dev: Postgres + Redis
├─ docker-compose.prod.yml            # prod: API + Postgres + Redis + Nginx
└─ docs/
   ├─ PLAN.md                         # architecture + roadmap (source of truth)
   └─ product/                        # these 5 product documents
```

**Convention:** each backend feature is a folder under `src/<feature>/` with
`*.module.ts`, `*.controller.ts`, `*.service.ts`, and a `dto.ts`. Cross-cutting concerns
(guards, decorators, filters, money/phone helpers) live in `src/common/`. Pure logic that is worth
unit-testing (`pricing.ts`, `state-machine`, `signature.ts`, `csv.ts`, `order-code.ts`) is kept in
its own file with a colocated `*.spec.ts`.

## 3. Database Schema

PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`). All money columns are `DECIMAL(10,2)` in INR.
IDs are `cuid()` strings. PostGIS enabled for zone polygons; pg_trgm for search.

### Geography
- **City** `(id, name, state, isActive, createdAt)` → has many Zones, Shops.
- **Zone** `(id, cityId→City, name, deliveryFeeInr, minOrderInr, codCapInr, isActive, createdAt)` —
  a delivery area with its own fee/min-order/COD-cap config. Boundary polygon added via raw SQL later.

### Customers
- **User** `(id, phone[unique], firebaseUid[unique?], name?, email?, fcmToken?, isBlocked, createdAt)` →
  has many Addresses, Orders.
- **Address** `(id, userId→User, zoneId→Zone?, label, line1, line2?, landmark?, pincode?, lat, lng, createdAt)`.

### Shops & catalogue
- **Shop** `(id, cityId, zoneId, name, licenseNo, gstin?, phone, email?, addressLine, lat, lng,
  commissionPct, status[PENDING|ACTIVE|SUSPENDED], openTime?, closeTime?, createdAt)` → staff,
  inventory, orders.
- **ShopStaff** `(id, shopId→Shop, name, email[unique], phone, passwordHash, isPharmacist,
  pharmacistRegNo?, isActive, createdAt)`.
- **Medicine** (master catalogue) `(id, name, brand?, genericName?, manufacturer?, mrpInr, packSize?,
  schedule[NONE|H|H1|X], rxRequired, imageUrl?, isActive, createdAt)`.
- **ShopInventory** `(id, shopId, medicineId, priceInr[≤ MRP], inStock, updatedAt)` —
  **unique (shopId, medicineId)**. This join is what "shop X sells medicine Y at price Z" means.

### Orders
- **Order** `(id, code[unique, e.g. ML-250712-0001], userId, shopId, zoneId, state[OrderState],
  paymentState[PaymentState], paymentMethod[RAZORPAY|COD], requiresRx, deliveryOtp[4-digit],
  addressSnapshot[Json — frozen at order time], itemsTotalInr, deliveryFeeInr, discountInr,
  grandTotalInr, placedAt, updatedAt)`. Indexed on state, userId, shopId.
- **OrderItem** `(id, orderId, medicineId, nameSnapshot, priceInrSnapshot, qty, accepted?)` —
  `accepted` is null until the shop confirms; `false` = dropped (partial acceptance).
- **OrderStatusHistory** `(id, orderId, fromState?, toState, note?, actorType, actorId?, createdAt)` —
  full audit trail of every transition.
- **Prescription** `(id, orderId, fileKey[S3], status[PENDING|APPROVED|REJECTED], verifiedById?,
  verifiedAt?, rejectionReason?, createdAt)`.

### Delivery
- **Rider** `(id, name, phone[unique], vehicleNo?, isActive, isOnDuty, cashInHandInr[COD ledger],
  fcmToken?, lastLat?, lastLng?, lastSeenAt?, createdAt)`.
- **DeliveryAssignment** `(id, orderId[unique]→Order, riderId→Rider,
  status[OFFERED|ACCEPTED|PICKED_UP|DELIVERED|CANCELLED], offeredAt, acceptedAt?, pickedUpAt?,
  deliveredAt?, codCollectedInr?)` — one live assignment per order.
- **RiderLocation** `(id, riderId, lat, lng, recordedAt)` — sampled GPS history; live location lives
  in Redis. Indexed on (riderId, recordedAt).

### Payments
- **Payment** `(id, orderId, method, amountInr, status[created|captured|failed|cod_due|cod_collected],
  razorpayOrderId[unique?], razorpayPaymentId?, razorpaySignature?, raw[Json?], createdAt)`.
- **Refund** `(id, paymentId→Payment, amountInr, status[initiated|processed|failed], razorpayRefundId?,
  reason?, createdAt)`.

### Admin & audit
- **AdminUser** `(id, email[unique], name, passwordHash, role[SUPER_ADMIN|OPS|PHARMACIST|SUPPORT|
  FINANCE], totpSecret?, isActive, createdAt)`.
- **AuditLog** `(id, actorType, actorId?, action, entity, entityId?, data[Json?], createdAt)` —
  indexed on (entity, entityId). Every admin action is recorded.

**Relationship summary:** City 1─* Zone 1─* Shop 1─* ShopInventory *─1 Medicine · User 1─* Order *─1
Shop · Order 1─* OrderItem · Order 1─1 DeliveryAssignment *─1 Rider · Order 1─* Payment 1─* Refund ·
Order 1─* Prescription.

## 4. Environment & Config

All keys live in `apps/api/.env` (copy from `apps/api/.env.example`). **Feature-gated design:** COD
orders, catalogue, cart and the full state machine run with **no external keys**; each integration
switches on only when its keys are present.

| Key(s) | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Use `127.0.0.1` not `localhost` on Windows (IPv6 gotcha). |
| `REDIS_URL` | Redis connection | |
| `PORT`, `CORS_ORIGINS` | HTTP + allowed dashboard origins | |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Signs backend access/refresh JWTs | **Change in every real environment.** |
| `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | Firebase Admin — verifies customer/rider phone OTP | Service-account key; enables phone login. |
| `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` | Online payments + webhook signature verification | Test keys work now; live keys need KYC. |
| `S3_REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY` | Private bucket for Rx/images | ap-south-1; signed URLs only. |
| `S3_ENDPOINT` | S3-compatible override (e.g. MinIO) for local dev | Empty = real AWS S3. |
| `DEV_LOGIN_ENABLED` | Enables `POST /v1/auth/dev/login` (mints tokens without Firebase) | **Never in production** — hard-disabled when `NODE_ENV=production` regardless. |
| `SENTRY_DSN/ENVIRONMENT/TRACES_SAMPLE_RATE/RELEASE` | Error monitoring | Empty DSN = no-op. |
| `NODE_ENV`, `ENABLE_SWAGGER` | `production` disables dev-login + Swagger | Set `ENABLE_SWAGGER=true` to force `/docs` in prod. |

**Never hardcode:** JWT secrets, Firebase private key, Razorpay secrets, S3 credentials — all come
from env. Secrets never enter the repo; `.env.production` is filled on the host only. Prescriptions
are **never** served from a public URL — always private bucket + time-limited signed URL.
