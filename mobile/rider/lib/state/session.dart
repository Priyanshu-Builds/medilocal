import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/client.dart';
import '../api/models.dart';

/// Holds the logged-in rider, duty status and COD cash-in-hand, persisted
/// across launches. Owns the shared [ApiClient] and keeps its bearer token in
/// sync. Duty and cash are authoritative on the server; [refresh] pulls them.
class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onUnauthorized = () => logout();
  }

  final ApiClient api;

  String? _token;
  String? riderId;
  String? phone;
  String? name;

  RiderProfile? profile;
  bool get onDuty => profile?.isOnDuty ?? false;
  double get cashInHandInr => profile?.cashInHandInr ?? 0;

  bool _loaded = false;
  bool get isReady => _loaded;
  bool get isLoggedIn => _token != null;

  static const _kToken = 'ml.rider.token';
  static const _kRiderId = 'ml.rider.id';
  static const _kPhone = 'ml.rider.phone';
  static const _kName = 'ml.rider.name';

  /// Restore any persisted session at startup.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_kToken);
    riderId = prefs.getString(_kRiderId);
    phone = prefs.getString(_kPhone);
    name = prefs.getString(_kName);
    api.token = _token;
    _loaded = true;
    notifyListeners();
    if (_token != null) unawaited(refresh());
  }

  Future<void> loginWithPhone(String phoneNumber) async {
    final result = await api.devLogin(phoneNumber);
    _token = result.accessToken;
    riderId = result.riderId;
    phone = result.phone;
    name = result.name;
    api.token = _token;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken, result.accessToken);
    await prefs.setString(_kRiderId, result.riderId);
    await prefs.setString(_kPhone, result.phone);
    if (result.name != null) await prefs.setString(_kName, result.name!);
    notifyListeners();
    await refresh();
  }

  /// Pull the latest profile (duty status, cash-in-hand, active task count).
  Future<void> refresh() async {
    try {
      profile = await api.me();
      name = profile!.name;
      notifyListeners();
    } catch (_) {
      // A transient failure shouldn't blow away the session; UI keeps last state.
    }
  }

  /// Flip duty on the server, then reflect the confirmed value locally.
  Future<void> setDuty(bool value) async {
    final confirmed = await api.setDuty(value);
    if (profile != null) {
      profile = RiderProfile(
        id: profile!.id,
        name: profile!.name,
        phone: profile!.phone,
        vehicleNo: profile!.vehicleNo,
        isActive: profile!.isActive,
        isOnDuty: confirmed,
        cashInHandInr: profile!.cashInHandInr,
        activeTasks: profile!.activeTasks,
      );
    }
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    riderId = phone = name = null;
    profile = null;
    api.token = null;
    final prefs = await SharedPreferences.getInstance();
    for (final k in [_kToken, _kRiderId, _kPhone, _kName]) {
      await prefs.remove(k);
    }
    notifyListeners();
  }
}
