# MediLocal — Security & Access Document

> Reverse-documented from the built codebase on 2026-07-12. Reflects the actual guards
> (`src/common/roles.guard.ts`, `src/auth/jwt-auth.guard.ts`), the state machine, and M5 hardening.

---

## 1. Authentication Method

MediLocal has **four kinds of account**, each with a login path suited to the user:

| Account kind | Login method | Flow |
|---|---|---|
| **Customer** | **Firebase Phone Auth (OTP)** | App completes OTP → sends Firebase **ID token** → backend verifies via **Firebase Admin SDK** → issues its **own JWT** (access + refresh). Backend owns the session; Firebase is only the OTP front door. Auto OTP-read on Android; no India DLT SMS registration needed. |
| **Rider** | **Firebase Phone Auth (OTP)** | Same as customer; token `kind: rider`. |
| **Pharmacy staff** | **Email + password** | `POST /v1/auth/shop/login`; password verified with **bcrypt** against `ShopStaff.passwordHash` → backend JWT `kind: shop`. |
| **Admin / Ops** | **Email + password (+ TOTP)** | `AdminUser.passwordHash` (bcrypt) + optional `totpSecret` (2FA). Backend JWT `kind: admin` carrying the admin `role`. |

**Backend-issued JWTs** are the single session currency across all surfaces. `JwtAuthGuard`
(`src/auth/jwt-auth.guard.ts`) requires a `Bearer` token on protected routes, verifies it with
`JWT_SECRET`, and attaches the payload to `request.user`. Missing token → **401 Missing bearer
token**; invalid/expired → **401 Invalid or expired token**.

**Dev-only shortcut:** `POST /v1/auth/dev/login` mints customer/rider tokens without Firebase, gated
by `DEV_LOGIN_ENABLED=true` **and** hard-disabled whenever `NODE_ENV=production` — it can never be
enabled on a production build.

## 2. User Roles & Permissions

Two-layer enforcement in `RolesGuard` (`src/common/roles.guard.ts`), which runs after `JwtAuthGuard`:
1. **Token kind** — `@Auth('customer'|'shop'|'rider'|'admin')` on a controller/handler restricts it to
   that account kind. Wrong kind → **403 "This endpoint is for … accounts"**.
2. **Admin role** — `@AdminRoles(...)` further restricts admin endpoints. `SUPER_ADMIN` passes every
   role gate. Wrong role → **403 "Requires admin role: …"**.

| Role | Can do | Blocked from |
|---|---|---|
| **Customer** | Manage own profile/addresses; search catalogue; quote cart; place orders; upload own Rx; view/track **own** orders; see own delivery OTP. | Any shop/rider/admin endpoint; any other user's data. |
| **Pharmacy staff** | See orders for **their shop**; accept item-by-item; mark packed; manage their shelf (stock/price ≤ MRP). | Other shops' orders/inventory; admin functions. |
| **Pharmacist (shop staff w/ `isPharmacist`)** | All shop-staff actions **plus** verify/reject prescriptions inline. | Non-pharmacist staff cannot verify Rx. |
| **Rider** | See offered tasks (only while `isOnDuty`); accept; progress pickup→delivery; enter delivery OTP; mark COD collected (own ledger). | Other riders' tasks; customer/shop/admin data. |
| **Admin · SUPER_ADMIN** | Everything, incl. staff/RBAC management; passes all role gates. | — |
| **Admin · OPS** | Live orders board; manual override of any legal transition; assign/reassign riders; shop & rider onboarding; inventory-on-behalf. | Finance-only + super-admin-only actions. |
| **Admin · PHARMACIST** | Rx verification queue (approve/reject → auto cancel+refund on reject). | Ops/finance actions. |
| **Admin · SUPPORT** | Read orders/customers; assist. | State-changing/finance actions beyond scope. |
| **Admin · FINANCE** | Payments, refunds, COD reconciliation. | Catalogue/shop/rider management. |

## 3. Data-scoping / Row-Level Rules

MediLocal is **not** on Supabase, so isolation is enforced in the **service layer + guards**, not
Postgres RLS. The rules that must hold on every query:

- **Customers see only their own rows.** Orders, addresses, prescriptions and the delivery OTP are
  always filtered by `userId` from the JWT — never by a client-supplied id alone.
- **Shops see only their own shop's data.** Order and inventory queries are scoped by the staff
  member's `shopId`; a shop can never read another shop's orders, prices, or stock.
- **Riders see only their own tasks.** Assignment queries scoped by `riderId`; only `isOnDuty` riders
  are offered tasks; the COD ledger is per-rider.
- **Zone scoping.** Catalogue/search results are limited to in-stock inventory in the customer's
  **zone**; every core table carries `cityId`/`zoneId` so town #2 is a data change, not a rewrite.
- **Admin override is audited.** When Ops manually changes an order, the actor is recorded in
  `OrderStatusHistory` and `AuditLog` (`actorType`, `actorId`, `action`, `entity`, `entityId`).
- **Prescriptions** are private S3 objects — access only via **short-lived signed URLs** minted for an
  authorised viewer (the owning customer, the shop's pharmacist, or an admin pharmacist). No public
  URL, ever (DPDP Act 2023: sensitive health data).

## 4. Error Handling

A **global exception filter** (`src/common/all-exceptions.filter.ts`) returns a **unified JSON error
shape** for every failure so the app never leaks a stack trace or crashes silently. Key cases:

| Failure point | Response |
|---|---|
| Missing/invalid/expired token | **401** `Missing bearer token` / `Invalid or expired token`. App routes user to login. |
| Wrong account kind / role | **403** with a message naming the required kind/role. |
| Invalid request body (DTO) | **400** from `class-validator` with per-field messages. |
| Not found (order/medicine/etc.) | **404**. |
| Rate limit exceeded | **429** (throttler; **10/min on auth** endpoints). |
| **Razorpay webhook — bad signature** | Rejected; order is **never** marked PAID (`src/payments/signature.ts` verifies HMAC — client is never trusted). |
| Payment failed / not captured | Order stays `PENDING`, hidden from the shop; customer can retry. |
| Rx rejected | Order → `RX_REJECTED`, auto **cancel + refund**; customer notified. |
| Wrong delivery OTP | Delivery **not** completed; rider prompted to re-enter. |
| Price > MRP on inventory | Rejected in service layer (price must be ≤ Medicine MRP). |
| Unhandled server error | **500** with a generic message; full detail to **Sentry** (if `SENTRY_DSN` set) + logs, never to the client. |
| Illegal state transition | Rejected by the order **state machine** (only defined edges allowed). |

## 5. Edge Cases

- **Empty / partial cart or form** → validated by DTOs; blocked with a 400 before any DB write.
- **Minimum-order not met** → checked against the zone's `minOrderInr` at quote/checkout.
- **COD over the zone cap** → `codCapInr` enforced; customer must pay online instead.
- **Shop has none of the items in stock** → partial acceptance drops all items → order auto-cancelled +
  fully refunded (ops can also confirm by phone on the shop's behalf).
- **Some items out of stock** → dropped items' amount **auto-refunded** (`PARTIALLY_REFUNDED`); order
  proceeds with the rest.
- **Customer accesses an order/address that isn't theirs** → 403/404; never leaked.
- **Rider goes offline mid-task / never accepts** → admin manual reassign (ops safety net); MVP uses
  one-tap assign + first-to-accept broadcast.
- **`UNDELIVERED` / cancellation** → terminal states with automatic refund handling.
- **Duplicate Razorpay webhook** → idempotent on `razorpayOrderId` (unique) — captured once.
- **Slow / dropped connection** → app retries; order confirmation is server-authoritative (webhook),
  so a lost client response never loses an order.
- **Schedule X medicine** → never sold online; CSV import **rejects** Schedule X rows; catalogue can't
  list it.
- **Blocked user** (`User.isBlocked`) → cannot place orders.
- **Production safety** → Swagger and dev-login are **off** when `NODE_ENV=production`; helmet headers,
  rate limiting and graceful shutdown are on by default.
