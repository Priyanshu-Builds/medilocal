import 'package:flutter/foundation.dart';
import '../api/models.dart';

class CartLine {
  final Medicine medicine;
  int qty;
  CartLine(this.medicine, this.qty);
}

/// In-memory cart. The authoritative price is always the server quote at
/// checkout; the running subtotal here is only an at-a-glance estimate.
class CartController extends ChangeNotifier {
  final Map<String, CartLine> _lines = {};

  List<CartLine> get lines => _lines.values.toList();
  bool get isEmpty => _lines.isEmpty;
  int get distinctCount => _lines.length;
  int get totalQty => _lines.values.fold(0, (sum, l) => sum + l.qty);
  bool get hasRxItem => _lines.values.any((l) => l.medicine.rxRequired);

  /// Rough estimate from the cheapest in-zone price (or MRP). Excludes delivery.
  double get estimatedSubtotal =>
      _lines.values.fold(0, (sum, l) => sum + l.medicine.displayPrice * l.qty);

  int qtyOf(String medicineId) => _lines[medicineId]?.qty ?? 0;

  void add(Medicine m) {
    final line = _lines[m.id];
    if (line != null) {
      line.qty += 1;
    } else {
      _lines[m.id] = CartLine(m, 1);
    }
    notifyListeners();
  }

  void setQty(String medicineId, int qty) {
    if (qty <= 0) {
      _lines.remove(medicineId);
    } else {
      final line = _lines[medicineId];
      if (line != null) line.qty = qty;
    }
    notifyListeners();
  }

  void remove(String medicineId) {
    _lines.remove(medicineId);
    notifyListeners();
  }

  void clear() {
    _lines.clear();
    notifyListeners();
  }

  List<({String medicineId, int qty})> toItems() =>
      _lines.values.map((l) => (medicineId: l.medicine.id, qty: l.qty)).toList();
}
