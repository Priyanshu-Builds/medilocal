# MediLocal Customer App (Flutter)

Source-only for now — platform folders are generated on your machine.

## What's built (M3)

A working **cash-on-delivery** ordering flow against the live MediLocal API:

- **Login** — phone number → dev-login token (no OTP). *(Firebase Phone Auth seam is in place; see below.)*
- **Zone picker** — choose your delivery area; drives which shops' stock you see and the fee / min-order / COD cap.
- **Browse & search** — zone-scoped fuzzy catalog (tolerant of misspellings), category chips, Rx badges, cheapest-nearby price.
- **Cart** — running estimate, live server quote (per-item availability, delivery fee, min-order and COD-cap checks, Rx flag).
- **Checkout** — pick/add a delivery address, **COD** place-order. Server re-prices everything; nothing is trusted from the client.
- **Orders & live tracking** — order list, a status tracker that polls the backend, the **delivery code** to read to your rider, rider details once assigned, and cancel-while-cancellable.
- **Account** — profile (edit name), delivery area, saved addresses, logout.

State: `provider`; REST via a hand-written typed client in `lib/api/`; session + selected zone persisted with `shared_preferences`.

## Deferred (need external keys / a device — clean seams left in code)

| Feature | Package | Seam |
|---|---|---|
| Phone OTP login | `firebase_auth` | `SessionController.loginWithPhone` / `ApiClient.devLogin` → swap for `POST /v1/auth/customer/firebase` |
| Online payment | `razorpay_flutter` | Checkout shows COD only; `createOrder` already accepts `RAZORPAY` |
| Prescription upload | `image_picker` + S3 | Rx carts are detected and blocked at checkout with a clear notice |
| Address map pin | `google_maps_flutter` | Address form takes lat/lng directly for now |
| Live rider map | `google_maps_flutter` + `socket_io_client` | Tracking uses status polling; the GPS pipeline is M4 (rider side) |
| Push notifications | `firebase_messaging` | — |

## One-time setup

1. Install the [Flutter SDK](https://docs.flutter.dev/get-started/install/windows) and run `flutter doctor`.
2. Generate the Android/iOS platform folders (keeps existing `lib/` and `pubspec.yaml`):

   ```
   flutter create . --org com.medilocal --platforms android,ios
   flutter pub get
   ```

3. Start the backend (`pnpm dev` at the repo root, with Docker up) and set `DEV_LOGIN_ENABLED=true` in `apps/api/.env`.
4. Run, pointing at your API. On the Android emulator the host is `10.0.2.2` (the default); on a physical device use your machine's LAN IP:

   ```
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
   ```

5. Commit the generated `android/` and `ios/` folders.
