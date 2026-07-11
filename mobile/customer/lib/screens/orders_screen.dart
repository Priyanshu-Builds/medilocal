import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../state/session.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  Future<List<OrderSummary>>? _future;
  String? _loadedFor;

  void _load() {
    _future = context.read<ApiClient>().orders();
    _loadedFor = context.read<SessionController>().userId;
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    // (Re)load when the tab first shows or the user changed.
    if (_future == null || _loadedFor != session.userId) {
      _load();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: RefreshIndicator(
        onRefresh: () async => setState(_load),
        child: FutureBuilder<List<OrderSummary>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: [
                const SizedBox(height: 120),
                Center(child: Text('Could not load orders.\n${snap.error}', textAlign: TextAlign.center)),
              ]);
            }
            final orders = snap.data ?? [];
            if (orders.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey),
                SizedBox(height: 12),
                Center(child: Text('No orders yet')),
                Center(child: Text('Your orders and live tracking appear here', style: TextStyle(fontSize: 12, color: Colors.grey))),
              ]);
            }
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: orders.length,
              itemBuilder: (context, i) => _OrderCard(order: orders[i], onChanged: () => setState(_load)),
            );
          },
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final OrderSummary order;
  final VoidCallback onChanged;
  const _OrderCard({required this.order, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final ui = orderStateUi(order.state);
    final acceptedItems = order.items.where((i) => i.accepted != false).toList();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: order.id)));
          onChanged();
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(order.code, style: const TextStyle(fontWeight: FontWeight.bold)),
                  _StateChip(label: ui.label, color: ui.color),
                ],
              ),
              const SizedBox(height: 4),
              Text(order.shopName ?? '', style: TextStyle(color: Colors.grey[700], fontSize: 13)),
              const SizedBox(height: 6),
              Text(
                acceptedItems.map((i) => '${i.nameSnapshot} ×${i.qty}').join(', '),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(timeAgo(order.placedAt), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  Text(inr(order.grandTotalInr), style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StateChip extends StatelessWidget {
  final String label;
  final Color color;
  const _StateChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}
