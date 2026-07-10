# MediLocal Customer App (Flutter)

Source-only for now — platform folders are generated on your machine.

## One-time setup

1. Install the [Flutter SDK](https://docs.flutter.dev/get-started/install/windows) and run `flutter doctor`.
2. From this directory, generate the Android/iOS platform folders (keeps existing `lib/` and `pubspec.yaml`):

   ```
   flutter create . --org com.medilocal --platforms android,ios
   flutter pub get
   flutter run
   ```

3. Commit the generated `android/` and `ios/` folders.

## M3 scope (see root plan)

Browse/search via the generated Dart API client, cart, address with map pin, Firebase phone login, Razorpay/COD checkout, prescription upload, live order tracking.
