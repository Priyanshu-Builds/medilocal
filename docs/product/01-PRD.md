# MediLocal — Product Requirements Document

> Reverse-documented from the built codebase (M0–M5 engineering complete) on 2026-07-12.
> Status tags: **[Built]** shipped and verified · **[Planned]** designed, not yet built · **[Deferred]** intentionally out of v1 (see [PLAN.md](../PLAN.md)).
> Source of truth for architecture and roadmap remains [docs/PLAN.md](../PLAN.md).

---

## 1. Problem Statement

In small Indian towns, buying medicine still means walking to a chemist, hoping they stock what
you need, and paying cash. There is no reliable way to know which nearby shop has a medicine in
stock, to order it for delivery, or to get prescription medicines without physically handing over
a paper Rx. The big e-pharmacies (1mg, PharmEasy) optimise for metros with central warehouses and
next-day logistics — they don't serve a single town with same-hour delivery from the shops that
are already there.

**Who faces this:** residents of a tier-3/4 Indian town — the elderly, people caring for sick
family members, anyone who can't easily travel to a pharmacy, and everyone who'd simply rather not.
On the other side, local licensed pharmacies have no digital storefront and lose walk-in customers
to whoever is physically closest.

**Why it matters:** medicine is time-sensitive and often needed by people who are unwell or
immobile. Getting the right medicine to someone's door in under an hour — legally, with prescription
checks intact — is a genuine improvement in daily life, and it keeps money with the town's own
licensed pharmacies rather than a distant warehouse.

## 2. Target Users

| User | Who they are | What they want | What frustrates them |
|---|---|---|---|
| **Customer** | 20–65, small-town resident, mid-range Android phone, moderate tech comfort. Often ordering for a parent or child. | Find a medicine, know it's in stock nearby, pay online or cash, get it delivered fast, upload an Rx without a clinic trip. | Not knowing who has stock; travelling while unwell; unclear whether an online order is "real". |
| **Pharmacy partner** | Owner/staff of a licensed local medical shop. Low patience for fiddly software; runs the shop while using it. | A loud alert on a new order, accept item-by-item (they rarely have everything), get paid, no data-entry burden. | Complex dashboards; orders for items they don't stock; maintaining a perfect inventory count. |
| **Rider** | 18–40 delivery rider, low-end Android, works shifts. | See offered tasks, accept, navigate, collect COD cash, confirm handoff simply. | Battery drain from GPS; disputes over "never received"; cash reconciliation confusion. |
| **Admin / Ops** | Platform operator (initially the founder + a couple of staff). | Total control and manual override of every order, an Rx verification queue, onboarding, refunds, a rider map. | Anything they can't fix by hand when a shop or rider goes offline. |

## 3. Product Vision

**A Swiggy for medicine in your town — order from the licensed pharmacies already around you and
have it at your door within the hour, prescriptions handled, built so town #2 is a config change,
not a rewrite.**

## 4. Core Features

### Customer
- **Fuzzy medicine search** — **[Built]** pg_trgm search across brand + generic names (handles
  misspellings like "dollo"), scoped to in-stock inventory in the customer's zone. *Must-have.*
- **Cart & transparent pricing** — **[Built]** per-item prices (capped at MRP), delivery fee and
  minimum-order rules per zone, live quote before ordering. *Must-have.*
- **Prescription upload** — **[Built, backend]** upload an Rx image at checkout for Schedule H/H1
  items; stored privately; order held for pharmacist review. *Must-have.*
- **Checkout — Razorpay + COD** — **[Built]** online payment (UPI/cards/netbanking/wallets) or
  cash on delivery under a per-zone cap. *Must-have.*
- **Live order tracking** — **[Built, screen]** order state timeline; live rider map **[Planned — needs
  Maps/Socket.IO keys + device]**. *Must-have (state) / Nice-to-have (live map at pilot).*
- **Delivery OTP** — **[Built]** a 4-digit handoff code in the app the rider must enter to complete
  delivery. *Must-have.*
- **Phone-OTP login** — **[Built, backend]** Firebase Phone Auth; **[Planned]** wired in-app once
  Firebase keys land. *Must-have.*

### Pharmacy
- **Live order board with sound alert** — **[Built]** Swiggy-partner-style new-order sound. *Must-have.*
- **Item-by-item acceptance (partial fulfilment)** — **[Built]** accept what's in stock, drop the
  rest; dropped items auto-refund. *Must-have.*
- **Inline Rx verification** — **[Built]** registered pharmacists approve/reject with a short-lived
  signed image link. *Must-have.*
- **Stock & price management** — **[Built]** add catalogue medicines to the shelf, toggle in/out of
  stock, set price up to MRP. *Must-have.*

### Rider
- **Duty shifts (online/offline)** — **[Built]** only on-duty riders get task offers. *Must-have.*
- **Task accept → pickup → out-for-delivery → delivered** — **[Built]** status progression with
  OTP-gated completion. *Must-have.*
- **COD cash ledger** — **[Built]** collected cash tracked per rider for daily reconciliation. *Must-have.*
- **Background GPS streaming** — **[Built, app]** foreground-service GPS; **[Planned]** live pipeline
  to customers once Socket.IO/Maps keys land. *Must-have at scale / Should-have at pilot.*

### Admin
- **Live orders board + total manual override** — **[Built]** force any legal state transition,
  assign/reassign riders; refunds and COD ledger apply automatically. *Must-have (ops safety net).*
- **Rx verification queue** — **[Built]** approve/reject; rejection cancels + refunds. *Must-have.*
- **Catalogue CRUD + CSV bulk import** — **[Built]** upsert by name, rejects Schedule X, reports bad
  rows without aborting the batch. *Must-have.*
- **Shop onboarding + inventory-on-behalf** — **[Built]** shops created PENDING until license
  verified; ops can edit inventory for them. *Must-have.*
- **Rider management + COD visibility** — **[Built]**; live rider map **[Planned]**. *Must-have.*
- **RBAC (SuperAdmin/Ops/Pharmacist/Support/Finance) + audit log** — **[Built]**. *Must-have.*

## 5. App Flow (customer happy path)

1. **Open app → phone-OTP login** (Firebase). Returning users land straight on the catalogue.
2. **Set/confirm delivery address** with a map pin; the app resolves it to a delivery **zone**
   (determines fee, minimum order, COD cap, and which shops serve you).
3. **Search** a medicine → fuzzy results filtered to in-stock items in your zone → **add to cart**.
4. **Cart** shows item prices, delivery fee, minimum-order check → **Checkout**.
5. If any item is **Rx-required**, **upload a prescription photo**.
6. **Choose payment** — Razorpay (pay now) or COD (under the zone cap) → **place order**. Order is
   confirmed only on Razorpay's `payment.captured` webhook (or COD).
7. Order enters the **state machine**: `PLACED → RX_REVIEW (if Rx) → ACCEPTED (shop confirms
   item-by-item) → PACKED → RIDER_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED`.
8. Customer watches the **status timeline** (and live rider map once enabled) and sees the **4-digit
   delivery OTP**.
9. On arrival the **rider enters the OTP** to mark DELIVERED; COD cash (if any) lands in the rider's
   ledger. Dropped/unavailable items were auto-refunded at acceptance.

**Branches:** `RX_REJECTED`, `CANCELLED`, `UNDELIVERED` — each triggers automatic refund handling.
Payment tracked separately: `PENDING → PAID → REFUNDED/PARTIALLY_REFUNDED`, or `COD_DUE → COD_COLLECTED`.

## 6. MVP Definition

The MVP is **one town, 2–3 partner shops, 1–2 riders**, with:
- COD + Razorpay checkout, fuzzy catalogue search, per-zone pricing.
- The full order state machine with partial acceptance and automatic refunds.
- Prescription upload + pharmacist verification for Schedule H/H1.
- Admin ops console with manual override of everything (the launch safety net).
- Delivery-OTP handoff and a rider COD ledger.

Engineering for all of this is **[Built]** (M0–M5 engineering). What remains is **operational**
(M5): Razorpay live KYC, Firebase keys, AWS provisioning, Play Store internal track, legal sign-off,
and onboarding the pilot shops/riders — see the [launch checklist](../../README.md#launch-checklist-operational--needs-your-accounts-daysweeks-of-lead-time).

## 7. Success Metrics

- **Order completion rate** — orders reaching DELIVERED ÷ orders PLACED (target the friction points:
  Rx rejection, partial-acceptance drop rate, undelivered).
- **Time-to-delivery** — median PLACED → DELIVERED; the "within the hour" promise.
- **Shop acceptance latency** — PLACED → ACCEPTED (how fast partners respond to the sound alert).
- **Fill rate** — items delivered ÷ items ordered (measures the partial-acceptance / stock problem).
- **Repeat rate** — customers placing a 2nd order within 30 days.
- **Payment mix & COD leakage** — Razorpay vs COD share; rider ledger reconciliation variance.
- **Pilot scale targets** — see running-cost and volume assumptions in [PLAN.md](../PLAN.md).

## 8. Deliberately NOT in v1 (Deferred)

CloudFront CDN · Elasticsearch (pg_trgm suffices) · multi-stop route optimisation · quantity-level
low-stock alerts · Redis catalogue caching · Prometheus + Grafana · ratings & reviews (and **never**
medicine reviews) · transactional email · auto-nearest rider assignment (MVP is admin one-tap +
first-to-accept broadcast) · Schedule X medicines (**never online, ever**). Rationale for each in
[PLAN.md → "Deliberately deferred"](../PLAN.md).
