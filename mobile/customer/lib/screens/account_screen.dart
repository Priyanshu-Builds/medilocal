import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../main.dart';
import '../state/session.dart';
import 'address_form.dart';
import 'zone_picker.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  Future<CustomerProfile>? _future;

  void _load() => _future = context.read<ApiClient>().me();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    _future ??= context.read<ApiClient>().me();

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: RefreshIndicator(
        onRefresh: () async => setState(_load),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FutureBuilder<CustomerProfile>(
              future: _future,
              builder: (context, snap) {
                final profile = snap.data;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const CircleAvatar(radius: 28, child: Icon(Icons.person, size: 28)),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(profile?.name ?? session.name ?? 'MediLocal customer',
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            Text('+91 ${profile?.phone ?? session.phone ?? ''}', style: TextStyle(color: Colors.grey[700])),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit_outlined),
                        onPressed: profile == null ? null : () => _editName(profile),
                      ),
                    ]),
                    const SizedBox(height: 24),

                    _sectionTitle('Delivery area'),
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.location_on_outlined),
                        title: Text(session.zoneName ?? 'Not set'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () async {
                          await Navigator.push(context, MaterialPageRoute(builder: (_) => const ZonePickerScreen()));
                          if (mounted) setState(() {});
                        },
                      ),
                    ),
                    const SizedBox(height: 16),

                    _sectionTitle('Saved addresses'),
                    if (snap.connectionState != ConnectionState.done)
                      const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
                    else if (profile == null)
                      const Text('Could not load addresses.')
                    else ...[
                      for (final a in profile.addresses)
                        Card(
                          child: ListTile(
                            leading: const Icon(Icons.home_outlined),
                            title: Text('${a.label} · ${a.line1}'),
                            subtitle: Text(a.summary),
                          ),
                        ),
                      TextButton.icon(
                        onPressed: () async {
                          final added = await Navigator.push<Address>(
                              context, MaterialPageRoute(builder: (_) => const AddressFormScreen()));
                          if (added != null && mounted) setState(_load);
                        },
                        icon: const Icon(Icons.add),
                        label: const Text('Add address'),
                      ),
                    ],
                  ],
                );
              },
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () => context.read<SessionController>().logout(),
              icon: const Icon(Icons.logout),
              label: const Text('Log out'),
            ),
            const SizedBox(height: 24),
            const Center(child: Text('MediLocal · dev build', style: TextStyle(fontSize: 11, color: Colors.grey))),
          ],
        ),
      ),
    );
  }

  Future<void> _editName(CustomerProfile profile) async {
    final ctrl = TextEditingController(text: profile.name ?? '');
    final saved = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Your name'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(hintText: 'Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    if (saved == null || saved.isEmpty) return;
    try {
      await context.read<ApiClient>().updateMe(name: saved);
      if (!mounted) return;
      context.read<SessionController>().setName(saved);
      setState(_load);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t, style: const TextStyle(fontWeight: FontWeight.bold, color: brandGreenDark)),
      );
}
