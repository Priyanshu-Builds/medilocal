import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/client.dart';

/// Holds the logged-in customer + selected delivery zone, persisted across
/// launches. Owns the shared [ApiClient] and keeps its bearer token in sync.
class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onUnauthorized = () => logout();
  }

  final ApiClient api;

  String? _token;
  String? userId;
  String? phone;
  String? name;
  String? zoneId;
  String? zoneName;

  bool _loaded = false;
  bool get isReady => _loaded;
  bool get isLoggedIn => _token != null;
  bool get hasZone => zoneId != null;

  static const _kToken = 'ml.token';
  static const _kUserId = 'ml.userId';
  static const _kPhone = 'ml.phone';
  static const _kName = 'ml.name';
  static const _kZoneId = 'ml.zoneId';
  static const _kZoneName = 'ml.zoneName';

  /// Restore any persisted session at startup.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_kToken);
    userId = prefs.getString(_kUserId);
    phone = prefs.getString(_kPhone);
    name = prefs.getString(_kName);
    zoneId = prefs.getString(_kZoneId);
    zoneName = prefs.getString(_kZoneName);
    api.token = _token;
    _loaded = true;
    notifyListeners();
  }

  Future<void> loginWithPhone(String phoneNumber) async {
    final result = await api.devLogin(phoneNumber);
    _token = result.accessToken;
    userId = result.userId;
    phone = result.phone;
    name = result.name;
    api.token = _token;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken, result.accessToken);
    await prefs.setString(_kUserId, result.userId);
    await prefs.setString(_kPhone, result.phone);
    if (result.name != null) await prefs.setString(_kName, result.name!);
    notifyListeners();
  }

  Future<void> setZone(String id, String zName) async {
    zoneId = id;
    zoneName = zName;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kZoneId, id);
    await prefs.setString(_kZoneName, zName);
    notifyListeners();
  }

  void setName(String? newName) {
    name = newName;
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    userId = phone = name = null;
    api.token = null;
    final prefs = await SharedPreferences.getInstance();
    // Keep the chosen zone so browsing still works after logout.
    for (final k in [_kToken, _kUserId, _kPhone, _kName]) {
      await prefs.remove(k);
    }
    notifyListeners();
  }
}
