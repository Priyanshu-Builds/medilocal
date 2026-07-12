# MediLocal Rider App (Flutter)

Source-only for now — platform folders are generated on your machine.

## One-time setup

1. Install the [Flutter SDK](https://docs.flutter.dev/get-started/install/windows) and run `flutter doctor`.
2. From this directory, generate the Android platform folder (keeps existing `lib/` and `pubspec.yaml`):

   ```
   flutter create . --org com.medilocal --platforms android
   flutter pub get
   flutter run
   ```

3. Commit the generated `android/` folder. (Riders are Android-only for the pilot.)

## Running against the API

The app talks to the NestJS API. Dev builds sign in through `POST /v1/auth/dev/login`
(no Firebase project needed) — but a rider phone must already exist and be active
(admin pre-registers riders; the seed ships `Demo Rider`, phone `9800000003`).

```
# Android emulator (default): API at 10.0.2.2:3000 → host localhost
flutter run

# Physical device: point at your machine's LAN IP
flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3000
```

## What M4 ships (built)

- **Duty shifts** — on/off toggle in the app bar. Off-duty riders can't be assigned
  or accept new tasks (enforced server-side), but can still finish a delivery already
  in hand — the app shows "Go on duty to accept" on new offers. Server-authoritative
  (`POST /v1/rider/duty`), restored on relaunch.
- **Tasks** — active delivery list from `GET /v1/rider/tasks` with pickup (pharmacy) and
  drop (customer) cards, items, and a COD/prepaid banner. The delivery OTP is never sent
  to the rider.
- **First-accept-wins accept** — `POST /v1/rider/orders/:id/accept` (atomic; a losing accept
  gets a clean 409).
- **Status progression** — picked up → out for delivery → delivered, each a one-tap action
  that walks the order state machine.
- **Delivery OTP handoff** — the rider types the 4-digit code the customer reads from their
  app; a wrong code is rejected server-side, so `DELIVERED` can't be faked. `Couldn't deliver`
  path for failed attempts (prepaid orders auto-refund).
- **COD collection** — delivering a COD order credits the amount to the rider's cash-in-hand
  ledger (Cash tab), reconciled daily by ops in admin.
- **Live location** — `LocationController` streams GPS fixes to `POST /v1/rider/location` on a
  timer while on duty (see below).

## Deferred to the device phase (needs native plugins / keys)

The app runs today with **zero external setup** (http + provider only), mirroring the customer
app. These switch on when keys and a real device are available — none change the app's logic,
only the source of a value:

- **Background GPS** — `LocationController` currently uses a simulated position source so the
  live-tracking pipeline is exercisable on an emulator. Swap `_SimulatedGps` for a `geolocator`
  stream inside a `flutter_foreground_task` foreground service so fixes keep flowing with the
  screen off. Everything downstream (the throttled POST, the on/off lifecycle) stays as-is.
- **Firebase Phone Auth** — replace dev-login with send-OTP → verify → exchange the Firebase ID
  token at `POST /v1/auth/rider/firebase`.
- **FCM push** — new-task-offer notifications (`firebase_messaging`).
- **Maps / navigation** — `google_maps_flutter` pickup/drop pins and turn-by-turn hand-off.
- **Socket.IO** — push the rider's live location straight to the customer's order room (the REST
  ingest endpoint stays as the durable/ sampled path).

## Release build (Android) — M5 native config

Platform folders are regenerated (not committed), so apply this native config to the
generated `android/` when cutting a release build.

**1. Permissions** — add to `android/app/src/main/AndroidManifest.xml`, above `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
```

The `flutter_foreground_task` service also needs, inside `<application>`:

```xml
<service android:name="com.pravera.flutter_foreground_task.service.ForegroundService"
         android:foregroundServiceType="location" android:exported="false"/>
```

`ACCESS_BACKGROUND_LOCATION` is intentionally **not** requested — GPS only streams during an
active delivery via the foreground service, which keeps the Play Store location review simple.

**2. FCM** — drop `google-services.json` into `android/app/` and add the Google Services
Gradle plugin (Firebase console gives the exact lines) once `firebase_messaging` is added.

**3. Signing** — create an upload keystore, reference it from `android/key.properties`
(gitignored) and `android/app/build.gradle.kts`. Never commit the keystore or `key.properties`.

**4. Versioning** — bump `version:` in `pubspec.yaml` (`x.y.z+build`); the `+build` is the
Play Store `versionCode` and must increase every upload.

**5. Build** — `flutter build appbundle --release --dart-define=API_BASE_URL=https://api.yourdomain
--dart-define=USE_DEV_LOGIN=false --dart-define=SENTRY_DSN=<dsn>` → upload the `.aab` to the
Play Console internal track.
