import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../main.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  final bool justPlaced;
  const OrderDetailScreen({super.key, required this.orderId, this.justPlaced = false});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  OrderDetail? _order;
  Object? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _fetch();
    // Live tracking: poll while the order is still in flight.
    _poll = Timer.periodic(const Duration(seconds: 12), (_) => _fetch());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final order = await context.read<ApiClient>().order(widget.orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _error = null;
      });
      if (isTerminal(order.state)) _poll?.cancel();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _cancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel order?'),
        content: const Text('This cannot be undone. Any online payment would be refunded.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep order')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cancel order')),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await context.read<ApiClient>().cancelOrder(widget.orderId, reason: 'Cancelled from app');
      await _fetch();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      appBar: AppBar(title: Text(order?.code ?? 'Order')),
      body: order == null
          ? Center(child: _error != null ? Text('Could not load order.\n$_error', textAlign: TextAlign.center) : const CircularProgressIndicator())
          : RefreshIndicator(onRefresh: _fetch, child: _body(order)),
    );
  }

  Widget _body(OrderDetail o) {
    final ui = orderStateUi(o.state);
    final cancellable = const {'PLACED', 'RX_REVIEW', 'ACCEPTED'}.contains(o.state);
    final showOtp = !isTerminal(o.state) && const {'RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'}.contains(o.state);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.justPlaced)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(12)),
            child: const Row(children: [
              Icon(Icons.check_circle, color: Colors.green),
              SizedBox(width: 8),
              Expanded(child: Text('Order placed! The pharmacy will confirm shortly.')),
            ]),
          ),

        // Current status
        Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: ui.color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text(ui.label, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: ui.color)),
        ]),
        const SizedBox(height: 16),

        if (isTerminal(o.state) && o.state != 'DELIVERED')
          _terminalNotice(o)
        else
          _tracker(o),

        if (showOtp) _otpCard(o),
        if (o.rider != null) _riderCard(o.rider!),

        const SizedBox(height: 16),
        _card('Items', [
          for (final item in o.items) _itemRow(item),
          const Divider(),
          _kv('Items total', inr(o.itemsTotalInr)),
          _kv('Delivery', inr(o.deliveryFeeInr)),
          _kv('Total', inr(o.grandTotalInr), bold: true),
          const SizedBox(height: 4),
          Text(
            o.paymentMethod == 'COD'
                ? (o.paymentState == 'COD_COLLECTED' ? 'Paid by cash on delivery' : 'Pay ${inr(o.grandTotalInr)} in cash on delivery')
                : 'Paid online',
            style: TextStyle(fontSize: 12, color: Colors.grey[700]),
          ),
        ]),

        const SizedBox(height: 12),
        _card('Delivering to', [
          Text('${o.addressSnapshot['line1'] ?? ''}'),
          if ((o.addressSnapshot['landmark'] ?? '').toString().isNotEmpty)
            Text('${o.addressSnapshot['landmark']}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          if (o.shopName != null) Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('From ${o.shopName}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          ),
        ]),

        if (cancellable) ...[
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _cancel,
            icon: const Icon(Icons.close, color: Colors.red),
            label: const Text('Cancel order', style: TextStyle(color: Colors.red)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _tracker(OrderDetail o) {
    final currentIndex = trackingIndexOf(o.state);
    return Column(
      children: [
        for (var i = 0; i < trackingSteps.length; i++)
          _trackerStep(
            label: trackingSteps[i].label,
            done: i <= currentIndex,
            current: i == currentIndex,
            last: i == trackingSteps.length - 1,
          ),
      ],
    );
  }

  Widget _trackerStep({required String label, required bool done, required bool current, required bool last}) {
    final color = done ? brandGreen : Colors.grey.shade300;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(color: done ? brandGreen : Colors.white, shape: BoxShape.circle, border: Border.all(color: color, width: 2)),
              child: done ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
            ),
            if (!last) Expanded(child: Container(width: 2, color: color)),
          ]),
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(bottom: 16, top: 1),
            child: Text(label, style: TextStyle(fontWeight: current ? FontWeight.bold : FontWeight.normal, color: done ? Colors.black87 : Colors.grey)),
          ),
        ],
      ),
    );
  }

  Widget _terminalNotice(OrderDetail o) {
    final ui = orderStateUi(o.state);
    final msg = switch (o.state) {
      'CANCELLED' => 'This order was cancelled. Any online payment is refunded.',
      'RX_REJECTED' => 'The pharmacist could not approve your prescription. Any payment is refunded.',
      'UNDELIVERED' => 'We could not complete delivery. Our team will reach out.',
      _ => '',
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: ui.color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(Icons.info_outline, color: ui.color),
        const SizedBox(width: 8),
        Expanded(child: Text(msg)),
      ]),
    );
  }

  Widget _otpCard(OrderDetail o) => Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: brandGreen.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
        child: Column(children: [
          const Text('Delivery code', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(o.deliveryOtp, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, letterSpacing: 8, color: brandGreenDark)),
          const SizedBox(height: 4),
          const Text('Share this with your rider at handoff', style: TextStyle(fontSize: 12, color: Colors.grey)),
        ]),
      );

  Widget _riderCard(RiderInfo rider) => Container(
        margin: const EdgeInsets.only(top: 12),
        child: _card('Your rider', [
          Row(children: [
            const CircleAvatar(child: Icon(Icons.delivery_dining)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(rider.name, style: const TextStyle(fontWeight: FontWeight.bold)),
              Text(rider.phone, style: TextStyle(color: Colors.grey[700], fontSize: 13)),
            ])),
            const Icon(Icons.phone, color: brandGreen),
          ]),
        ]),
      );

  Widget _itemRow(OrderItem item) {
    final dropped = item.accepted == false;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(children: [
        Expanded(child: Text(
          item.nameSnapshot,
          style: TextStyle(decoration: dropped ? TextDecoration.lineThrough : null, color: dropped ? Colors.grey : null),
        )),
        Text('×${item.qty}', style: const TextStyle(color: Colors.grey)),
        const SizedBox(width: 12),
        dropped
            ? const Text('unavailable', style: TextStyle(fontSize: 12, color: Colors.red))
            : Text(inr(item.priceInrSnapshot * item.qty)),
      ]),
    );
  }

  Widget _card(String title, List<Widget> children) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: brandGreenDark)),
            const SizedBox(height: 8),
            ...children,
          ]),
        ),
      );

  Widget _kv(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 1),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(k, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        ]),
      );
}
