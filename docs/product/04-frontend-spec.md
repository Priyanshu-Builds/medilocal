# MediLocal — Frontend Specification Document

> Reverse-documented on 2026-07-12. The mobile design system is the real, shipped one in
> `mobile/customer/lib/theme.dart` (shared shape in `mobile/rider/lib/theme.dart`). Integration
> specs come from the built backend modules and [PLAN.md](../PLAN.md).

---

## 1. Design System — Mobile (Flutter)

A warm **"medicine store"** aesthetic: an orange primary on soft peach, white rounded cards, pill
buttons and chips. Material 3 (`useMaterial3: true`), seeded from the primary colour. Both apps share
this shape.

### Color Palette (exact tokens from `theme.dart`)
| Token | Hex | Role |
|---|---|---|
| `kPrimary` | `#F0682B` | Warm orange — buttons, accents, FAB, focused fields, selected chips |
| `kPrimaryDark` | `#CF5518` | Pressed states, text buttons, selected nav label/icon |
| `kBg` | `#FFF6EF` | Soft peach app/scaffold background |
| `kSurface` | `#FFFFFF` | Cards, sheets, nav bar, input fill |
| `kChipBg` | `#FCE7D7` | Light peach — inactive chips, soft fills, nav indicator |
| `kInk` | `#241A15` | Near-black headings / primary text |
| `kInkSoft` | `#8C8177` | Warm grey secondary text, hints, labels |
| Divider | `#F0E6DD` | 1px dividers |
| Card shadow | `#22D9885E` (elev 6) / hand-rolled `#0F241A15`, blur 18, y+8 | Soft warm lift |

### Typography
Material 3 default type scale (system font). Weights carry the hierarchy:
- **AppBar title** — 20px, `w700`, `kInk`.
- **Headings** — `w700`, `kInk`.
- **Body** — default weight, `kInk`; **secondary text** `kInkSoft`.
- **Buttons** — 15px, `w700`, white on orange.
- **Chips** — 13px, `w500` (`kInk`) unselected / `w600` white selected.
- **Nav labels** — 12px, `w600`.

### Component Styles
- **Buttons** — **pill / stadium** shape everywhere. Filled: orange bg, white text, 16px vertical
  padding; disabled = 40% orange. Outlined: orange border + text, 14px pad. Text button: `kPrimaryDark`.
- **Inputs** — filled white, 16px radius (`kRadiusField`), no border at rest (`kChipBg` 0-width),
  **1.5px orange border on focus**; hint/label `kInkSoft`; 16×15 content padding.
- **Cards** — white, **20px radius** (`kRadiusCard`), elevation 6 with soft warm shadow, zero margin;
  hand-rolled containers use `cardShadow()` to match.
- **Chips** — stadium, `kChipBg` bg / orange when selected, no checkmark, 12×8 padding.
- **Nav bar** — white, 66px tall, `kChipBg` indicator pill, `kPrimaryDark` selected icon+label.
- **Dialogs** — white, 24px radius.

### Spacing & Layout Rules
- Corner radii: **cards 20**, fields 16, dialogs 24, buttons/chips = stadium (fully rounded).
- Button vertical padding 14–16; input 16h/15v; chip 12h/8v.
- Flat surfaces: AppBar and background share `kBg` with **zero elevation** (no scroll tint); lift comes
  only from white cards + soft shadow. Keep generous whitespace on the peach background.

## 2. Design System — Dashboards (Next.js)

`apps/admin` and `apps/pharmacy` use **Tailwind + shadcn/ui**, sharing components via `packages/ui`.
shadcn/ui default primitives (Radix + Tailwind tokens); TanStack Table for the order boards, TanStack
Query for data. These are function-first operational tools (dense tables, live-refresh boards, sound
alerts) rather than the warm consumer aesthetic of the mobile apps.

## 3. API & Integration Spec

Base URL `http://localhost:3000` (dev) / behind Nginx TLS (prod). Versioned under `/v1`. Auth =
`Authorization: Bearer <backend-JWT>`. Full contract: `apps/api/openapi.json` + Swagger at `/docs`.

### Internal API (representative endpoints)
| Area | Endpoint(s) | In → Out |
|---|---|---|
| Health | `GET /health` | — → `{ ok }` |
| Auth | `POST /v1/auth/dev/login` (dev), `/v1/auth/shop/login`, `/v1/auth/admin/login`, Firebase-token exchange | creds/token → backend JWT (access+refresh) |
| Zones | `GET /v1/zones` | — → zones with fee/min-order/COD-cap |
| Addresses | `POST /v1/me/addresses` | `{line1, lat, lng, zoneId}` → address id |
| Catalogue | `GET /v1/catalog/medicines?q=` | fuzzy query → in-stock medicines in zone |
| Cart | `POST /v1/cart/quote` | `{zoneId, items:[{medicineId, qty}]}` → priced quote (items, fee, total) |
| Orders | `POST /v1/orders` | `{addressId, paymentMethod, items}` → order + 4-digit delivery OTP |
| Shop | `GET /v1/shop/orders`, `POST /v1/shop/orders/:id/accept`, `/pack` | item-by-item accept → updated order |
| Admin | `GET /v1/admin/riders`, `POST /v1/admin/orders/:id/assign-rider` | → assignment |
| Rider | `/pickup`, `/out-for-delivery`, `/deliver` (with OTP) | OTP → DELIVERED / COD to ledger |
| Payments | `POST /v1/payments/razorpay/webhook` | Razorpay `payment.captured` (HMAC-verified) → order PAID |
| Prescriptions | upload + verify endpoints | image → S3 key; approve/reject |

### Third-party Integrations
| Service | Role in app | Data in → out | Gate |
|---|---|---|---|
| **Firebase Phone Auth** | Customer/rider OTP login | phone → OTP → Firebase **ID token**; backend verifies via Admin SDK → own JWT | `FIREBASE_*` |
| **Firebase Cloud Messaging (FCM)** | Push (new-order, status, rider offers) | `fcmToken` per user/rider → push messages | `FIREBASE_*` |
| **Firebase Analytics** | Funnels / usage | client events → dashboards | app config |
| **Razorpay** | Online payment (UPI/cards/netbanking/wallets) | checkout order → hosted checkout → **`payment.captured` webhook** (HMAC-verified) → order confirmed. Refunds via Razorpay refund API. | `RAZORPAY_*` |
| **Amazon S3 (ap-south-1)** | Private storage — prescriptions, medicine images, license docs | upload → object key; read via **time-limited signed URL** only | `S3_*` |
| **Google Maps Platform** | Map pin (address), rider map, Directions ETA | lat/lng → map tiles / route ETA (cached at assign + pickup) | Maps key (**[Planned]** in-app) |
| **Socket.IO (own pipeline)** | Live rider tracking | rider GPS → Redis → customer order room | **[Planned]** at pilot |
| **Sentry** | Error monitoring (API + apps) | exceptions → Sentry | `SENTRY_DSN` (inert without) |

**Feature-gated:** COD orders, catalogue, cart and the full state machine run with **no external
keys**. Firebase enables phone login + push, Razorpay enables online pay, S3 enables Rx upload,
Maps/Socket.IO enable the live map — each switches on independently when its keys are present.
