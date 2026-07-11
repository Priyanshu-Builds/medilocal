/// Typed models mirroring the MediLocal API responses. Money fields arrive as
/// DECIMAL strings ("33.60") and are parsed to double here.
library;

double _money(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

double? _moneyOrNull(dynamic v) => v == null ? null : _money(v);

class City {
  final String id;
  final String name;
  final String state;
  City({required this.id, required this.name, required this.state});
  factory City.fromJson(Map<String, dynamic> j) =>
      City(id: j['id'], name: j['name'], state: j['state'] ?? '');
}

class Zone {
  final String id;
  final String name;
  final double deliveryFeeInr;
  final double minOrderInr;
  final double codCapInr;
  final City? city;

  Zone({
    required this.id,
    required this.name,
    required this.deliveryFeeInr,
    required this.minOrderInr,
    required this.codCapInr,
    this.city,
  });

  factory Zone.fromJson(Map<String, dynamic> j) => Zone(
        id: j['id'],
        name: j['name'],
        deliveryFeeInr: _money(j['deliveryFeeInr']),
        minOrderInr: _money(j['minOrderInr']),
        codCapInr: _money(j['codCapInr']),
        city: j['city'] != null ? City.fromJson(j['city']) : null,
      );
}

class Medicine {
  final String id;
  final String name;
  final String? brand;
  final String? genericName;
  final String? manufacturer;
  final double mrpInr;
  final String? packSize;
  final String schedule; // NONE | H | H1
  final bool rxRequired;
  final String? imageUrl;
  // Present only on zone-scoped search:
  final double? minPriceInr;
  final int? shopCount;

  Medicine({
    required this.id,
    required this.name,
    this.brand,
    this.genericName,
    this.manufacturer,
    required this.mrpInr,
    this.packSize,
    required this.schedule,
    required this.rxRequired,
    this.imageUrl,
    this.minPriceInr,
    this.shopCount,
  });

  /// Best price to show: the cheapest in-zone price if available, else MRP.
  double get displayPrice => minPriceInr ?? mrpInr;

  factory Medicine.fromJson(Map<String, dynamic> j) => Medicine(
        id: j['id'],
        name: j['name'],
        brand: j['brand'],
        genericName: j['genericName'],
        manufacturer: j['manufacturer'],
        mrpInr: _money(j['mrpInr']),
        packSize: j['packSize'],
        schedule: j['schedule'] ?? 'NONE',
        rxRequired: j['rxRequired'] ?? false,
        imageUrl: j['imageUrl'],
        minPriceInr: _moneyOrNull(j['minPriceInr']),
        shopCount: j['shopCount'] is int ? j['shopCount'] : null,
      );
}

class Address {
  final String id;
  final String zoneId;
  final String label;
  final String line1;
  final String? line2;
  final String? landmark;
  final String? pincode;
  final double lat;
  final double lng;

  Address({
    required this.id,
    required this.zoneId,
    required this.label,
    required this.line1,
    this.line2,
    this.landmark,
    this.pincode,
    required this.lat,
    required this.lng,
  });

  String get summary => [line1, landmark, pincode]
      .where((s) => s != null && s.isNotEmpty)
      .join(', ');

  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: j['id'],
        zoneId: j['zoneId'] ?? '',
        label: j['label'] ?? 'Home',
        line1: j['line1'] ?? '',
        line2: j['line2'],
        landmark: j['landmark'],
        pincode: j['pincode'],
        lat: (j['lat'] as num?)?.toDouble() ?? 0,
        lng: (j['lng'] as num?)?.toDouble() ?? 0,
      );
}

class CustomerProfile {
  final String id;
  final String phone;
  final String? name;
  final String? email;
  final List<Address> addresses;

  CustomerProfile({
    required this.id,
    required this.phone,
    this.name,
    this.email,
    required this.addresses,
  });

  factory CustomerProfile.fromJson(Map<String, dynamic> j) => CustomerProfile(
        id: j['id'],
        phone: j['phone'],
        name: j['name'],
        email: j['email'],
        addresses: ((j['addresses'] ?? []) as List)
            .map((a) => Address.fromJson(a))
            .toList(),
      );
}

// ── Cart quote ────────────────────────────────────────────────────────────

class QuoteLine {
  final String medicineId;
  final String name;
  final int qty;
  final double unitPriceInr;
  final double lineTotalInr;
  final bool rxRequired;

  QuoteLine({
    required this.medicineId,
    required this.name,
    required this.qty,
    required this.unitPriceInr,
    required this.lineTotalInr,
    required this.rxRequired,
  });

  factory QuoteLine.fromJson(Map<String, dynamic> j) => QuoteLine(
        medicineId: j['medicineId'],
        name: j['name'],
        qty: j['qty'],
        unitPriceInr: _money(j['unitPriceInr']),
        lineTotalInr: _money(j['lineTotalInr']),
        rxRequired: j['rxRequired'] ?? false,
      );
}

class UnavailableItem {
  final String medicineId;
  final String reason; // NOT_STOCKED | OUT_OF_STOCK | SCHEDULE_X
  UnavailableItem({required this.medicineId, required this.reason});
  factory UnavailableItem.fromJson(Map<String, dynamic> j) =>
      UnavailableItem(medicineId: j['medicineId'], reason: j['reason']);

  String get label => switch (reason) {
        'OUT_OF_STOCK' => 'Out of stock',
        'NOT_STOCKED' => 'Not available nearby',
        'SCHEDULE_X' => 'Cannot be sold online',
        _ => 'Unavailable',
      };
}

class Quote {
  final String? shopId;
  final String? shopName;
  final List<QuoteLine> items;
  final List<UnavailableItem> unavailable;
  final double itemsTotalInr;
  final double deliveryFeeInr;
  final double grandTotalInr;
  final double minOrderInr;
  final bool meetsMinOrder;
  final double codCapInr;
  final bool codAllowed;
  final bool requiresRx;

  Quote({
    this.shopId,
    this.shopName,
    required this.items,
    required this.unavailable,
    required this.itemsTotalInr,
    required this.deliveryFeeInr,
    required this.grandTotalInr,
    required this.minOrderInr,
    required this.meetsMinOrder,
    required this.codCapInr,
    required this.codAllowed,
    required this.requiresRx,
  });

  factory Quote.fromResponse(Map<String, dynamic> j) {
    final shop = j['shop'] as Map<String, dynamic>?;
    final q = j['quote'] as Map<String, dynamic>;
    return Quote(
      shopId: shop?['id'],
      shopName: shop?['name'],
      items: ((q['items'] ?? []) as List).map((i) => QuoteLine.fromJson(i)).toList(),
      unavailable:
          ((q['unavailable'] ?? []) as List).map((u) => UnavailableItem.fromJson(u)).toList(),
      itemsTotalInr: _money(q['itemsTotalInr']),
      deliveryFeeInr: _money(q['deliveryFeeInr']),
      grandTotalInr: _money(q['grandTotalInr']),
      minOrderInr: _money(q['minOrderInr']),
      meetsMinOrder: q['meetsMinOrder'] ?? false,
      codCapInr: _money(q['codCapInr']),
      codAllowed: q['codAllowed'] ?? false,
      requiresRx: q['requiresRx'] ?? false,
    );
  }
}

// ── Orders ──────────────────────────────────────────────────────────────

class OrderItem {
  final String id;
  final String nameSnapshot;
  final double priceInrSnapshot;
  final int qty;
  final bool? accepted; // null until shop confirms; false = dropped

  OrderItem({
    required this.id,
    required this.nameSnapshot,
    required this.priceInrSnapshot,
    required this.qty,
    this.accepted,
  });

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'] ?? '',
        nameSnapshot: j['nameSnapshot'],
        priceInrSnapshot: _money(j['priceInrSnapshot']),
        qty: j['qty'],
        accepted: j['accepted'],
      );
}

class StatusEvent {
  final String toState;
  final String? note;
  final String actorType;
  final DateTime createdAt;

  StatusEvent({
    required this.toState,
    this.note,
    required this.actorType,
    required this.createdAt,
  });

  factory StatusEvent.fromJson(Map<String, dynamic> j) => StatusEvent(
        toState: j['toState'],
        note: j['note'],
        actorType: j['actorType'] ?? 'SYSTEM',
        createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
      );
}

class RiderInfo {
  final String name;
  final String phone;
  RiderInfo({required this.name, required this.phone});
  factory RiderInfo.fromJson(Map<String, dynamic> j) =>
      RiderInfo(name: j['name'] ?? '', phone: j['phone'] ?? '');
}

class OrderSummary {
  final String id;
  final String code;
  final String state;
  final String paymentState;
  final String paymentMethod;
  final double grandTotalInr;
  final DateTime placedAt;
  final String? shopName;
  final List<OrderItem> items;

  OrderSummary({
    required this.id,
    required this.code,
    required this.state,
    required this.paymentState,
    required this.paymentMethod,
    required this.grandTotalInr,
    required this.placedAt,
    this.shopName,
    required this.items,
  });

  factory OrderSummary.fromJson(Map<String, dynamic> j) => OrderSummary(
        id: j['id'],
        code: j['code'],
        state: j['state'],
        paymentState: j['paymentState'],
        paymentMethod: j['paymentMethod'],
        grandTotalInr: _money(j['grandTotalInr']),
        placedAt: DateTime.tryParse(j['placedAt'] ?? '') ?? DateTime.now(),
        shopName: (j['shop'] as Map<String, dynamic>?)?['name'],
        items: ((j['items'] ?? []) as List).map((i) => OrderItem.fromJson(i)).toList(),
      );
}

class OrderDetail {
  final String id;
  final String code;
  final String state;
  final String paymentState;
  final String paymentMethod;
  final bool requiresRx;
  final String deliveryOtp;
  final Map<String, dynamic> addressSnapshot;
  final double itemsTotalInr;
  final double deliveryFeeInr;
  final double grandTotalInr;
  final DateTime placedAt;
  final List<OrderItem> items;
  final List<StatusEvent> statusHistory;
  final RiderInfo? rider;
  final String? shopName;
  final String? shopPhone;

  OrderDetail({
    required this.id,
    required this.code,
    required this.state,
    required this.paymentState,
    required this.paymentMethod,
    required this.requiresRx,
    required this.deliveryOtp,
    required this.addressSnapshot,
    required this.itemsTotalInr,
    required this.deliveryFeeInr,
    required this.grandTotalInr,
    required this.placedAt,
    required this.items,
    required this.statusHistory,
    this.rider,
    this.shopName,
    this.shopPhone,
  });

  factory OrderDetail.fromJson(Map<String, dynamic> j) {
    final shop = j['shop'] as Map<String, dynamic>?;
    final assignment = j['assignment'] as Map<String, dynamic>?;
    final riderJson = assignment?['rider'] as Map<String, dynamic>?;
    return OrderDetail(
      id: j['id'],
      code: j['code'],
      state: j['state'],
      paymentState: j['paymentState'],
      paymentMethod: j['paymentMethod'],
      requiresRx: j['requiresRx'] ?? false,
      deliveryOtp: j['deliveryOtp'] ?? '',
      addressSnapshot: (j['addressSnapshot'] ?? {}) as Map<String, dynamic>,
      itemsTotalInr: _money(j['itemsTotalInr']),
      deliveryFeeInr: _money(j['deliveryFeeInr']),
      grandTotalInr: _money(j['grandTotalInr']),
      placedAt: DateTime.tryParse(j['placedAt'] ?? '') ?? DateTime.now(),
      items: ((j['items'] ?? []) as List).map((i) => OrderItem.fromJson(i)).toList(),
      statusHistory:
          ((j['statusHistory'] ?? []) as List).map((s) => StatusEvent.fromJson(s)).toList(),
      rider: riderJson != null ? RiderInfo.fromJson(riderJson) : null,
      shopName: shop?['name'],
      shopPhone: shop?['phone'],
    );
  }
}

class AuthResult {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String phone;
  final String? name;

  AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.phone,
    this.name,
  });

  factory AuthResult.fromJson(Map<String, dynamic> j) => AuthResult(
        accessToken: j['accessToken'],
        refreshToken: j['refreshToken'],
        userId: j['user']['id'],
        phone: j['user']['phone'],
        name: j['user']['name'],
      );
}
