import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../state/cart.dart';
import '../state/session.dart';
import '../widgets/qty_stepper.dart';
import 'checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  Future<Quote>? _quoteFuture;
  String _signature = '';

  /// A stable key for the current cart contents so we only re-quote on change.
  String _cartSignature(CartController cart) =>
      (cart.toItems()..sort((a, b) => a.medicineId.compareTo(b.medicineId)))
          .map((i) => '${i.medicineId}:${i.qty}')
          .join(',');

  void _refreshQuote() {
    final cart = context.read<CartController>();
    final session = context.read<SessionController>();
    if (cart.isEmpty || session.zoneId == null) {
      _quoteFuture = null;
      return;
    }
    _quoteFuture = context.read<ApiClient>().cartQuote(
          zoneId: session.zoneId!,
          items: cart.toItems(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final sig = _cartSignature(cart);
    if (sig != _signature) {
      _signature = sig;
      _refreshQuote();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Your cart')),
      body: cart.isEmpty
          ? const Center(child: Text('Your cart is empty'))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      for (final line in cart.lines) _cartLineTile(context, line),
                    ],
                  ),
                ),
                _QuoteSummary(future: _quoteFuture),
              ],
            ),
    );
  }

  Widget _cartLineTile(BuildContext context, CartLine line) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(line.medicine.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(inr(line.medicine.displayPrice), style: TextStyle(color: Colors.grey[700], fontSize: 13)),
                  if (line.medicine.rxRequired)
                    const Text('Prescription required', style: TextStyle(fontSize: 11, color: Colors.deepPurple)),
                ],
              ),
            ),
            QtyStepper(qty: line.qty, onChanged: (q) => context.read<CartController>().setQty(line.medicine.id, q)),
          ],
        ),
      ),
    );
  }
}

class _QuoteSummary extends StatelessWidget {
  final Future<Quote>? future;
  const _QuoteSummary({required this.future});

  @override
  Widget build(BuildContext context) {
    if (future == null) return const SizedBox.shrink();
    return Material(
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FutureBuilder<Quote>(
            future: future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const SizedBox(height: 48, child: Center(child: CircularProgressIndicator()));
              }
              if (snap.hasError) {
                return Text('Could not price your cart: ${snap.error}', style: const TextStyle(color: Colors.red));
              }
              final q = snap.data!;
              return _summaryBody(context, q);
            },
          ),
        ),
      ),
    );
  }

  Widget _summaryBody(BuildContext context, Quote q) {
    final noShop = q.shopId == null;
    final blockingReasons = <String>[
      if (noShop) 'No pharmacy near you stocks these items right now.',
      if (!noShop && !q.meetsMinOrder) 'Add ${inr(q.minOrderInr - q.itemsTotalInr)} more to reach the ${inr(q.minOrderInr)} minimum.',
    ];
    final canCheckout = !noShop && q.meetsMinOrder && q.items.isNotEmpty;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (q.shopName != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text('From ${q.shopName}', style: TextStyle(color: Colors.grey[700], fontSize: 13)),
          ),
        for (final u in q.unavailable)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: [
              const Icon(Icons.info_outline, size: 14, color: Colors.orange),
              const SizedBox(width: 4),
              Expanded(child: Text('An item is ${u.label.toLowerCase()} and was skipped', style: const TextStyle(fontSize: 12, color: Colors.orange))),
            ]),
          ),
        _row('Items', inr(q.itemsTotalInr)),
        _row('Delivery', inr(q.deliveryFeeInr)),
        const Divider(),
        _row('Total', inr(q.grandTotalInr), bold: true),
        if (q.requiresRx)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Row(children: [
              Icon(Icons.medical_information_outlined, size: 16, color: Colors.deepPurple),
              SizedBox(width: 6),
              Expanded(child: Text('Contains prescription medicines — a pharmacist will verify your Rx.',
                  style: TextStyle(fontSize: 12, color: Colors.deepPurple))),
            ]),
          ),
        for (final reason in blockingReasons)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(reason, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: canCheckout
              ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => CheckoutScreen(quote: q)))
              : null,
          style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
          child: Text(canCheckout ? 'Proceed to checkout · ${inr(q.grandTotalInr)}' : 'Cannot checkout'),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    final style = TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal, fontSize: bold ? 16 : 14);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: style), Text(value, style: style)]),
    );
  }
}
