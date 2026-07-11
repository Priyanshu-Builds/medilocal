import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../state/session.dart';

/// Lets the customer choose their delivery zone. The zone drives which shops'
/// stock is visible and the delivery fee / min-order / COD cap that apply.
class ZonePickerScreen extends StatelessWidget {
  const ZonePickerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiClient>();
    return Scaffold(
      appBar: AppBar(title: const Text('Choose delivery area')),
      body: FutureBuilder<List<Zone>>(
        future: api.zones(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load areas.\n${snap.error}', textAlign: TextAlign.center),
            ));
          }
          final zones = snap.data ?? [];
          if (zones.isEmpty) {
            return const Center(child: Text('No serviceable areas yet.'));
          }
          return ListView.separated(
            itemCount: zones.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final z = zones[i];
              return ListTile(
                leading: const Icon(Icons.location_on_outlined),
                title: Text(z.name),
                subtitle: Text(
                  '${z.city?.name ?? ''} · delivery ${inr(z.deliveryFeeInr)} · '
                  'min order ${inr(z.minOrderInr)}',
                ),
                onTap: () async {
                  await context.read<SessionController>().setZone(z.id, z.name);
                  if (context.mounted) Navigator.pop(context);
                },
              );
            },
          );
        },
      ),
    );
  }
}
