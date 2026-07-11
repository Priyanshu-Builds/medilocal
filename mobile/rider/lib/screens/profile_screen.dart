import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/session.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final profile = session.profile;
    final name = profile?.name ?? session.name ?? 'Rider';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SizedBox(height: 8),
        Center(
          child: CircleAvatar(
            radius: 36,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : 'R',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(child: Text(name, style: Theme.of(context).textTheme.titleLarge)),
        Center(
          child: Text('+91 ${session.phone ?? ''}',
              style: TextStyle(color: Colors.grey[600])),
        ),
        const SizedBox(height: 24),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.two_wheeler_outlined),
                title: const Text('Vehicle'),
                trailing: Text(profile?.vehicleNo ?? '—'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(session.onDuty ? Icons.check_circle : Icons.power_settings_new,
                    color: session.onDuty ? Colors.green : Colors.grey),
                title: const Text('Duty status'),
                trailing: Text(session.onDuty ? 'On duty' : 'Off duty'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _confirmLogout(context, session),
          icon: const Icon(Icons.logout),
          label: const Text('Log out'),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.red,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ],
    );
  }

  Future<void> _confirmLogout(BuildContext context, SessionController session) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will stop receiving delivery tasks until you sign in again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (ok == true) await session.logout();
  }
}
