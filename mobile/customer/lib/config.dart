/// App-wide configuration.
///
/// The API base URL defaults to the Android-emulator loopback alias
/// (10.0.2.2 → the host's localhost). Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3000
/// (use your machine's LAN IP for a physical device).
class Config {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// Dev builds authenticate through POST /v1/auth/dev/login (no Firebase
  /// project needed). Flip to false once Firebase Phone Auth is wired in.
  static const bool useDevLogin = bool.fromEnvironment(
    'USE_DEV_LOGIN',
    defaultValue: true,
  );
}
