import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../main.dart';
import '../state/cart.dart';
import 'address_form.dart';
import 'order_detail_screen.dart';

class CheckoutScreen extends StatefulWidget {
  final Quote quote;
  const CheckoutScreen({super.key, required this.quote});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  Future<CustomerProfile>? _profileFuture;
  String? _selectedAddressId;
  bool _placing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  void _loadProfile() {
    _profileFuture = context.read<ApiClient>().me().then((p) {
      _selectedAddressId ??= p.addresses.isNotEmpty ? p.addresses.first.id : null;
      return p;
    });
  }

  Future<void> _addAddress() async {
    final created = await Navigator.push<Address>(
      context,
      MaterialPageRoute(builder: (_) => const AddressFormScreen()),
    );
    if (created != null && mounted) {
      setState(() {
        _selectedAddressId = created.id;
        _loadProfile();
      });
    }
  }

  Future<void> _placeOrder() async {
    if (_selectedAddressId == null) {
      setState(() => _error = 'Add a delivery address first');
      return;
    }
    setState(() {
      _placing = true;
      _error = null;
    });
    try {
      final order = await context.read<ApiClient>().createOrder(
            addressId: _selectedAddressId!,
            paymentMethod: 'COD',
            items: context.read<CartController>().toItems(),
          );
      if (!mounted) return;
      context.read<CartController>().clear();
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: order.id, justPlaced: true)),
        (route) => route.isFirst,
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = widget.quote;
    // Rx image upload needs S3 + image_picker (deferred), and the backend
    // requires an uploaded prescription for Rx orders — so block those here.
    final rxBlocked = q.requiresRx;

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: FutureBuilder<CustomerProfile>(
        future: _profileFuture,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Could not load your profile.\n${snap.error}', textAlign: TextAlign.center));
          }
          final profile = snap.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _sectionTitle('Delivery address'),
              if (profile.addresses.isEmpty)
                const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('No saved addresses yet.')),
              if (profile.addresses.isNotEmpty)
                RadioGroup<String>(
                  groupValue: _selectedAddressId,
                  onChanged: (v) => setState(() => _selectedAddressId = v),
                  child: Column(
                    children: [
                      for (final a in profile.addresses)
                        RadioListTile<String>(
                          value: a.id,
                          title: Text('${a.label} · ${a.line1}'),
                          subtitle: Text(a.summary),
                          contentPadding: EdgeInsets.zero,
                        ),
                    ],
                  ),
                ),
              TextButton.icon(
                onPressed: _addAddress,
                icon: const Icon(Icons.add),
                label: const Text('Add address'),
              ),
              const Divider(height: 24),
              _sectionTitle('Payment'),
              RadioGroup<String>(
                groupValue: 'COD',
                onChanged: (_) {},
                child: const RadioListTile<String>(
                  value: 'COD',
                  title: Text('Cash on delivery'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const ListTile(
                enabled: false,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.credit_card, color: Colors.grey),
                title: Text('Pay online (Razorpay)', style: TextStyle(color: Colors.grey)),
                subtitle: Text('Arrives with Razorpay keys', style: TextStyle(fontSize: 12, color: Colors.grey)),
              ),
              const Divider(height: 24),
              _sectionTitle('Summary'),
              if (q.shopName != null) Text('From ${q.shopName}', style: TextStyle(color: Colors.grey[700])),
              const SizedBox(height: 8),
              _row('Items', inr(q.itemsTotalInr)),
              _row('Delivery', inr(q.deliveryFeeInr)),
              const Divider(),
              _row('Total (pay on delivery)', inr(q.grandTotalInr), bold: true),
              if (rxBlocked)
                Container(
                  margin: const EdgeInsets.only(top: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.deepPurple.shade50, borderRadius: BorderRadius.circular(12)),
                  child: const Row(children: [
                    Icon(Icons.medical_information_outlined, color: Colors.deepPurple),
                    SizedBox(width: 8),
                    Expanded(child: Text(
                      'This cart has prescription medicines. Prescription photo upload arrives with '
                      'the Rx feature — remove Rx items to place a cash order now.',
                      style: TextStyle(fontSize: 12, color: Colors.deepPurple),
                    )),
                  ]),
                ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: (_placing || rxBlocked) ? null : _placeOrder,
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: _placing
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(rxBlocked ? 'Prescription required' : 'Place order · ${inr(q.grandTotalInr)}'),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(t, style: const TextStyle(fontWeight: FontWeight.bold, color: brandGreenDark)),
      );

  Widget _row(String label, String value, {bool bold = false}) {
    final style = TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal, fontSize: bold ? 16 : 14);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: style), Text(value, style: style)]),
    );
  }
}
