import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'models.dart';

/// Thrown for any non-2xx response. [status] 401 means the session expired.
class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
  @override
  String toString() => message;
}

/// Thin REST client for the MediLocal rider API. A single instance is shared
/// through Provider; [token] is set by the session after login and cleared on
/// logout.
class ApiClient {
  ApiClient({http.Client? httpClient}) : _http = httpClient ?? http.Client();

  final http.Client _http;
  String? token;

  /// Called when any request comes back 401 so the app can drop the session.
  void Function()? onUnauthorized;

  Uri _uri(String path) => Uri.parse('${Config.apiBaseUrl}$path');

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _decode(http.Response res) async {
    if (res.statusCode == 401) {
      onUnauthorized?.call();
      throw ApiException('Session expired — please sign in again', 401);
    }
    final body = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    final msg = body is Map && body['message'] != null
        ? (body['message'] is List
            ? (body['message'] as List).join(', ')
            : body['message'].toString())
        : 'Request failed (${res.statusCode})';
    throw ApiException(msg, res.statusCode);
  }

  Future<dynamic> _get(String path) async =>
      _decode(await _http.get(_uri(path), headers: _headers));

  Future<dynamic> _post(String path, [Object? body]) async => _decode(
        await _http.post(_uri(path), headers: _headers, body: jsonEncode(body ?? {})),
      );

  // ── Auth ──────────────────────────────────────────────────────────────────

  /// Dev-only phone login (no Firebase). The backend rejects any phone that
  /// isn't a pre-registered active rider. Swap for a Firebase ID-token exchange
  /// (POST /v1/auth/rider/firebase) once phone auth is wired in.
  Future<RiderAuthResult> devLogin(String phone) async {
    final json = await _post('/v1/auth/dev/login', {'kind': 'rider', 'phone': phone});
    return RiderAuthResult.fromJson(json);
  }

  // ── Profile / duty / location ───────────────────────────────────────────

  Future<RiderProfile> me() async => RiderProfile.fromJson(await _get('/v1/rider/me'));

  Future<bool> setDuty(bool onDuty) async {
    final json = await _post('/v1/rider/duty', {'onDuty': onDuty});
    return json['isOnDuty'] ?? onDuty;
  }

  Future<void> pushLocation(double lat, double lng) =>
      _post('/v1/rider/location', {'lat': lat, 'lng': lng});

  // ── Tasks / status progression ──────────────────────────────────────────

  Future<List<RiderTask>> tasks() async {
    final list = await _get('/v1/rider/tasks') as List;
    return list.map((t) => RiderTask.fromJson(t)).toList();
  }

  Future<void> acceptTask(String orderId) => _post('/v1/rider/orders/$orderId/accept');

  Future<void> pickup(String orderId) => _post('/v1/rider/orders/$orderId/pickup');

  Future<void> outForDelivery(String orderId) =>
      _post('/v1/rider/orders/$orderId/out-for-delivery');

  /// Complete delivery — the 4-digit code comes from the customer's app; wrong
  /// code fails with a 400 and nothing changes (COD cash is credited on success).
  Future<void> deliver(String orderId, String otp) =>
      _post('/v1/rider/orders/$orderId/deliver', {'otp': otp});

  Future<void> undelivered(String orderId, String reason) =>
      _post('/v1/rider/orders/$orderId/undelivered', {'reason': reason});
}
