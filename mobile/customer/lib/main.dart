import 'package:flutter/material.dart';

void main() {
  runApp(const MediLocalCustomerApp());
}

class MediLocalCustomerApp extends StatelessWidget {
  const MediLocalCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediLocal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF059669)),
        useMaterial3: true,
      ),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: switch (_index) {
        0 => const HomeTab(),
        1 => const OrdersTab(),
        _ => const AccountTab(),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }
}

/// Demo catalog matching the backend seed. Replaced in M3 by the generated
/// Dart API client calling GET /v1/catalog/medicines.
const _demoMedicines = <(String, String, double, bool)>[
  ('Dolo 650', 'Paracetamol 650mg · Micro Labs', 33.60, false),
  ('Crocin Advance', 'Paracetamol 500mg · GSK', 20.00, false),
  ('Azithral 500', 'Azithromycin 500mg · Alembic', 132.00, true),
  ('Augmentin 625 Duo', 'Amoxicillin + Clavulanate · GSK', 223.00, true),
  ('Pan 40', 'Pantoprazole 40mg · Alkem', 128.00, true),
  ('Okacet 10', 'Cetirizine 10mg · Cipla', 17.00, false),
  ('Electral Powder', 'ORS · FDC', 22.00, false),
  ('Betadine 10% Ointment', 'Povidone Iodine · Win-Medicare', 135.00, false),
  ('Volini Spray', 'Pain relief spray · Sun Pharma', 335.00, false),
  ('Digene Gel Mint', 'Antacid · Abbott', 128.00, false),
  ('Ecosprin 75', 'Aspirin 75mg · USV', 8.00, true),
  ('Zincovit', 'Multivitamin + Zinc · Apex', 105.00, false),
];

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final results = _demoMedicines
        .where((m) =>
            _query.isEmpty ||
            m.$1.toLowerCase().contains(_query.toLowerCase()) ||
            m.$2.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('MediLocal', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF047857))),
          const SizedBox(height: 4),
          Text('Medicines from your local pharmacy, delivered', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Search medicines… (e.g. Dolo)',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final c in ['Fever', 'Antibiotics', 'Digestive', 'First aid', 'Vitamins'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(label: Text(c), onSelected: (_) {}),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (final m in results)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(m.$1),
                subtitle: Text(m.$2),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('₹${m.$3.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (m.$4)
                      const Text('Rx required', style: TextStyle(fontSize: 11, color: Colors.orange)),
                  ],
                ),
              ),
            ),
          if (results.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 32),
              child: Center(child: Text('No medicines found')),
            ),
        ],
      ),
    );
  }
}

class OrdersTab extends StatelessWidget {
  const OrdersTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey),
            SizedBox(height: 12),
            Text('No orders yet'),
            Text('Your orders and live tracking will appear here', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class AccountTab extends StatelessWidget {
  const AccountTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_outline, size: 56, color: Colors.grey),
            SizedBox(height: 12),
            Text('Login with phone OTP arrives in M3'),
            Text('(Firebase Phone Auth → MediLocal account)', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
