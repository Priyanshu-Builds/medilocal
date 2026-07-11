/// Typed models mirroring the MediLocal rider API responses. Money fields
/// arrive as DECIMAL strings ("33.60") and are parsed to double here.
library;

double _money(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

double? _coord(dynamic v) => v == null ? null : (v as num).toDouble();

class RiderAuthResult {
  final String accessToken;
  final String refreshToken;
  final String riderId;
  final String phone;
  final String? name;

  RiderAuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.riderId,
    required this.phone,
    this.name,
  });

  factory RiderAuthResult.fromJson(Map<String, dynamic> j) => RiderAuthResult(
        accessToken: j['accessToken'],
        refreshToken: j['refreshToken'],
        riderId: j['user']['id'],
        phone: j['user']['phone'],
        name: j['user']['name'],
      );
}

class RiderProfile {
  final String id;
  final String name;
  final String phone;
  final String? vehicleNo;
  final bool isActive;
  final bool isOnDuty;
  final double cashInHandInr;
  final int activeTasks;

  RiderProfile({
    required this.id,
    required this.name,
    required this.phone,
    this.vehicleNo,
    required this.isActive,
    required this.isOnDuty,
    required this.cashInHandInr,
    required this.activeTasks,
  });

  factory RiderProfile.fromJson(Map<String, dynamic> j) => RiderProfile(
        id: j['id'],
        name: j['name'] ?? '',
        phone: j['phone'] ?? '',
        vehicleNo: j['vehicleNo'],
        isActive: j['isActive'] ?? true,
        isOnDuty: j['isOnDuty'] ?? false,
        cashInHandInr: _money(j['cashInHandInr']),
        activeTasks: j['activeTasks'] is int ? j['activeTasks'] : 0,
      );
}

class TaskItem {
  final String nameSnapshot;
  final int qty;
  TaskItem({required this.nameSnapshot, required this.qty});
  factory TaskItem.fromJson(Map<String, dynamic> j) =>
      TaskItem(nameSnapshot: j['nameSnapshot'], qty: j['qty']);
}

class TaskShop {
  final String name;
  final String? addressLine;
  final String? phone;
  final double? lat;
  final double? lng;

  TaskShop({required this.name, this.addressLine, this.phone, this.lat, this.lng});

  factory TaskShop.fromJson(Map<String, dynamic> j) => TaskShop(
        name: j['name'] ?? '',
        addressLine: j['addressLine'],
        phone: j['phone'],
        lat: _coord(j['lat']),
        lng: _coord(j['lng']),
      );
}

class TaskCustomer {
  final String name;
  final String phone;
  TaskCustomer({required this.name, required this.phone});
  factory TaskCustomer.fromJson(Map<String, dynamic> j) =>
      TaskCustomer(name: j['name'] ?? 'Customer', phone: j['phone'] ?? '');
}

/// A delivery task = one DeliveryAssignment with its order embedded. The
/// delivery OTP is never sent to the rider — the customer reads it out at
/// handoff and the rider types it to complete delivery.
class RiderTask {
  final String assignmentId;
  final String status; // OFFERED | ACCEPTED | PICKED_UP | ...
  final DateTime offeredAt;
  final String orderId;
  final String code;
  final String state;
  final String paymentState;
  final String paymentMethod;
  final double grandTotalInr;
  final Map<String, dynamic> addressSnapshot;
  final List<TaskItem> items;
  final TaskShop? shop;
  final TaskCustomer? customer;

  RiderTask({
    required this.assignmentId,
    required this.status,
    required this.offeredAt,
    required this.orderId,
    required this.code,
    required this.state,
    required this.paymentState,
    required this.paymentMethod,
    required this.grandTotalInr,
    required this.addressSnapshot,
    required this.items,
    this.shop,
    this.customer,
  });

  /// COD orders still owe cash at handoff; prepaid orders don't.
  bool get isCod => paymentMethod == 'COD' && paymentState == 'COD_DUE';

  bool get isAccepted => status != 'OFFERED';

  String get dropAddress {
    final a = addressSnapshot;
    return [a['line1'], a['landmark'], a['pincode']]
        .where((s) => s != null && s.toString().isNotEmpty)
        .join(', ');
  }

  double? get dropLat => _coord(addressSnapshot['lat']);
  double? get dropLng => _coord(addressSnapshot['lng']);

  factory RiderTask.fromJson(Map<String, dynamic> j) {
    final order = (j['order'] ?? {}) as Map<String, dynamic>;
    final shop = order['shop'] as Map<String, dynamic>?;
    final customer = order['user'] as Map<String, dynamic>?;
    return RiderTask(
      assignmentId: j['id'],
      status: j['status'] ?? 'OFFERED',
      offeredAt: DateTime.tryParse(j['offeredAt'] ?? '') ?? DateTime.now(),
      orderId: order['id'],
      code: order['code'] ?? '',
      state: order['state'] ?? '',
      paymentState: order['paymentState'] ?? '',
      paymentMethod: order['paymentMethod'] ?? 'COD',
      grandTotalInr: _money(order['grandTotalInr']),
      addressSnapshot: (order['addressSnapshot'] ?? {}) as Map<String, dynamic>,
      items: ((order['items'] ?? []) as List).map((i) => TaskItem.fromJson(i)).toList(),
      shop: shop != null ? TaskShop.fromJson(shop) : null,
      customer: customer != null ? TaskCustomer.fromJson(customer) : null,
    );
  }
}
