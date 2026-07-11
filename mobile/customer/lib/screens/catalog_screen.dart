import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../main.dart';
import '../state/cart.dart';
import '../state/session.dart';
import '../widgets/qty_stepper.dart';
import 'cart_screen.dart';
import 'zone_picker.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _query = '';
  Future<List<Medicine>>? _future;
  String? _loadedZoneId;

  static const _categories = ['Fever', 'Antibiotic', 'Allergy', 'Antacid', 'ORS', 'Vitamin'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureZoneThenLoad());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _ensureZoneThenLoad() async {
    final session = context.read<SessionController>();
    if (!session.hasZone) {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => const ZonePickerScreen()));
    }
    if (mounted && context.read<SessionController>().hasZone) _reload();
  }

  void _reload() {
    final session = context.read<SessionController>();
    final api = context.read<ApiClient>();
    setState(() {
      _loadedZoneId = session.zoneId;
      _future = api.searchMedicines(q: _query, zoneId: session.zoneId);
    });
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _query = v;
      _reload();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final cart = context.watch<CartController>();

    // Zone changed elsewhere (e.g. Account) → refresh.
    if (session.hasZone && session.zoneId != _loadedZoneId) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('MediLocal', style: TextStyle(fontWeight: FontWeight.bold, color: brandGreenDark)),
            InkWell(
              onTap: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const ZonePickerScreen()));
                if (mounted) _reload();
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.location_on, size: 14, color: Colors.grey),
                  const SizedBox(width: 2),
                  Text(session.zoneName ?? 'Choose area',
                      style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  const Icon(Icons.arrow_drop_down, size: 16, color: Colors.grey),
                ],
              ),
            ),
          ],
        ),
        actions: [_CartButton(count: cart.totalQty)],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search medicines… (try "dollo")',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _searchCtrl.clear();
                          _query = '';
                          _reload();
                        },
                      ),
              ),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final c in _categories)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ActionChip(
                      label: Text(c),
                      onPressed: () {
                        _searchCtrl.text = c;
                        _query = c;
                        _reload();
                      },
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Expanded(child: _buildList()),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_future == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: FutureBuilder<List<Medicine>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _CenteredMessage(
              icon: Icons.wifi_off,
              title: 'Could not reach the store',
              subtitle: '${snap.error}',
            );
          }
          final meds = snap.data ?? [];
          if (meds.isEmpty) {
            return _CenteredMessage(
              icon: Icons.search_off,
              title: _query.isEmpty ? 'Nothing stocked nearby yet' : 'No matches for "$_query"',
              subtitle: 'Try a different search or change your area.',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
            itemCount: meds.length,
            itemBuilder: (context, i) => _MedicineCard(medicine: meds[i]),
          );
        },
      ),
    );
  }
}

class _MedicineCard extends StatelessWidget {
  final Medicine medicine;
  const _MedicineCard({required this.medicine});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final qty = cart.qtyOf(medicine.id);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(medicine.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                  if (medicine.genericName != null)
                    Text(medicine.genericName!, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(inr(medicine.displayPrice), style: const TextStyle(fontWeight: FontWeight.bold, color: brandGreenDark)),
                      if (medicine.minPriceInr != null && medicine.minPriceInr! < medicine.mrpInr) ...[
                        const SizedBox(width: 6),
                        Text(inr(medicine.mrpInr),
                            style: const TextStyle(fontSize: 12, color: Colors.grey, decoration: TextDecoration.lineThrough)),
                      ],
                    ],
                  ),
                  if (medicine.rxRequired)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text('Prescription required',
                          style: TextStyle(fontSize: 11, color: Colors.deepPurple, fontWeight: FontWeight.w500)),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            qty == 0
                ? OutlinedButton(
                    onPressed: () => context.read<CartController>().add(medicine),
                    child: const Text('Add'),
                  )
                : QtyStepper(qty: qty, onChanged: (q) => context.read<CartController>().setQty(medicine.id, q)),
          ],
        ),
      ),
    );
  }
}

class _CartButton extends StatelessWidget {
  final int count;
  const _CartButton({required this.count});

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.shopping_cart_outlined),
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen())),
        ),
        if (count > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              child: Text('$count', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ),
      ],
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _CenteredMessage({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        Icon(icon, size: 56, color: Colors.grey[400]),
        const SizedBox(height: 12),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(subtitle, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
        ),
      ],
    );
  }
}
