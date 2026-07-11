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

/// Thin REST client for the MediLocal API. A single instance is shared through
/// Provider; [token] is set by the session after login and cleared on logout.
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

  Future<dynamic> _patch(String path, Object body) async => _decode(
        await _http.patch(_uri(path), headers: _headers, body: jsonEncode(body)),
      );

  Future<void> _delete(String path) async =>
      _decode(await _http.delete(_uri(path), headers: _headers));

  // ── Auth ────────────────────────────────────────────────────────────────

  /// Dev-only phone login (no Firebase). Swap for a Firebase ID-token exchange
  /// (POST /v1/auth/customer/firebase) once phone auth is wired in.
  Future<AuthResult> devLogin(String phone) async {
    final json = await _post('/v1/auth/dev/login', {'kind': 'customer', 'phone': phone});
    return AuthResult.fromJson(json);
  }

  // ── Catalog / zones ───────────────────────────────────────────────────────

  Future<List<Zone>> zones() async {
    final list = await _get('/v1/zones') as List;
    return list.map((z) => Zone.fromJson(z)).toList();
  }

  Future<List<Medicine>> searchMedicines({String? q, String? zoneId}) async {
    final params = <String, String>{
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      if (zoneId != null) 'zoneId': zoneId,
    };
    final query = params.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');
    final list = await _get('/v1/catalog/medicines${query.isEmpty ? '' : '?$query'}') as List;
    return list.map((m) => Medicine.fromJson(m)).toList();
  }

  // ── Profile / addresses ───────────────────────────────────────────────────

  Future<CustomerProfile> me() async =>
      CustomerProfile.fromJson(await _get('/v1/me'));

  Future<CustomerProfile> updateMe({String? name, String? email}) async =>
      CustomerProfile.fromJson(await _patch('/v1/me', {
        if (name != null) 'name': name,
        if (email != null) 'email': email,
      }));

  Future<Address> createAddress({
    required String zoneId,
    required String line1,
    String? landmark,
    String? pincode,
    required double lat,
    required double lng,
    String label = 'Home',
  }) async {
    final json = await _post('/v1/me/addresses', {
      'zoneId': zoneId,
      'label': label,
      'line1': line1,
      if (landmark != null && landmark.isNotEmpty) 'landmark': landmark,
      if (pincode != null && pincode.isNotEmpty) 'pincode': pincode,
      'lat': lat,
      'lng': lng,
    });
    return Address.fromJson(json);
  }

  Future<void> deleteAddress(String id) => _delete('/v1/me/addresses/$id');

  // ── Cart / orders ─────────────────────────────────────────────────────────

  Future<Quote> cartQuote({
    required String zoneId,
    String? shopId,
    required List<({String medicineId, int qty})> items,
  }) async {
    final json = await _post('/v1/cart/quote', {
      'zoneId': zoneId,
      if (shopId != null) 'shopId': shopId,
      'items': items.map((i) => {'medicineId': i.medicineId, 'qty': i.qty}).toList(),
    });
    return Quote.fromResponse(json);
  }

  Future<OrderDetail> createOrder({
    required String addressId,
    required String paymentMethod, // COD (RAZORPAY deferred)
    required List<({String medicineId, int qty})> items,
    List<String>? rxFileKeys,
  }) async {
    final json = await _post('/v1/orders', {
      'addressId': addressId,
      'paymentMethod': paymentMethod,
      'items': items.map((i) => {'medicineId': i.medicineId, 'qty': i.qty}).toList(),
      if (rxFileKeys != null && rxFileKeys.isNotEmpty) 'rxFileKeys': rxFileKeys,
    });
    return OrderDetail.fromJson(json['order']);
  }

  Future<List<OrderSummary>> orders() async {
    final list = await _get('/v1/orders') as List;
    return list.map((o) => OrderSummary.fromJson(o)).toList();
  }

  Future<OrderDetail> order(String id) async =>
      OrderDetail.fromJson(await _get('/v1/orders/$id'));

  Future<void> cancelOrder(String id, {String? reason}) =>
      _post('/v1/orders/$id/cancel', {if (reason != null) 'reason': reason});
}
