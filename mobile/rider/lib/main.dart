import 'package:flutter/material.dart';

void main() {
  runApp(const MediLocalRiderApp());
}

class MediLocalRiderApp extends StatelessWidget {
  const MediLocalRiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediLocal Rider',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFEA580C)),
        useMaterial3: true,
      ),
      home: const RiderShell(),
    );
  }
}

class RiderShell extends StatefulWidget {
  const RiderShell({super.key});

  @override
  State<RiderShell> createState() => _RiderShellState();
}

class _RiderShellState extends State<RiderShell> {
  int _index = 0;
  bool _onDuty = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MediLocal Rider'),
        actions: [
          Row(
            children: [
              Text(_onDuty ? 'On duty' : 'Off duty', style: const TextStyle(fontSize: 13)),
              Switch(
                value: _onDuty,
                onChanged: (v) => setState(() => _onDuty = v),
              ),
              const SizedBox(width: 8),
            ],
          ),
        ],
      ),
      body: switch (_index) {
        0 => TasksTab(onDuty: _onDuty),
        1 => const EarningsTab(),
        _ => const ProfileTab(),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.delivery_dining_outlined), selectedIcon: Icon(Icons.delivery_dining), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.currency_rupee_outlined), selectedIcon: Icon(Icons.currency_rupee), label: 'Cash'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class TasksTab extends StatelessWidget {
  const TasksTab({super.key, required this.onDuty});

  final bool onDuty;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            onDuty ? Icons.hourglass_top : Icons.power_settings_new,
            size: 56,
            color: Colors.grey,
          ),
          const SizedBox(height: 12),
          Text(onDuty ? 'Waiting for delivery tasks…' : 'Go on duty to receive tasks'),
          const Text(
            'Task offers, pickup/drop navigation and status updates arrive in M4',
            style: TextStyle(fontSize: 12, color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class EarningsTab extends StatelessWidget {
  const EarningsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('COD cash in hand', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('₹0.00', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                const Text(
                  'Cash collected on delivery shows here and is reconciled daily with ops (M4)',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.person_outline, size: 56, color: Colors.grey),
          SizedBox(height: 12),
          Text('Rider login arrives in M4'),
        ],
      ),
    );
  }
}
