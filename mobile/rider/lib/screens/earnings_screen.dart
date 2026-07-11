import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../state/session.dart';

/// COD cash-in-hand. Every cash-on-delivery order the rider completes adds to
/// this ledger; ops reconciles it daily in the admin dashboard (a rider hands
/// the collected cash back and the balance is cleared server-side).
class EarningsScreen extends StatelessWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final profile = session.profile;

    return RefreshIndicator(
      onRefresh: () => session.refresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('COD cash in hand', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    inr(session.cashInHandInr),
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Cash you have collected on delivery. Hand it to ops during daily '
                    'reconciliation to clear this balance.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (profile != null)
            Card(
              child: ListTile(
                leading: const Icon(Icons.local_shipping_outlined),
                title: const Text('Active tasks'),
                trailing: Text('${profile.activeTasks}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
            ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'Per-delivery payouts and settlement history arrive with the finance module.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }
}
