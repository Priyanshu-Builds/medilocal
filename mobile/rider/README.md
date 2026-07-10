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

## M4 scope (see root plan)

Duty shifts, task offers with first-accept-wins, pickup/drop status progression, background GPS streaming (foreground service) for live tracking, COD collection marking.
