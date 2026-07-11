import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../state/session.dart';

/// Add a delivery address. The map-pin picker (google_maps_flutter) is deferred;
/// for now latitude/longitude are entered directly, pre-filled with the pilot
/// town centre so the happy path works without a map.
class AddressFormScreen extends StatefulWidget {
  const AddressFormScreen({super.key});

  @override
  State<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends State<AddressFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _line1 = TextEditingController();
  final _landmark = TextEditingController();
  final _pincode = TextEditingController();
  final _lat = TextEditingController(text: '25.5941');
  final _lng = TextEditingController(text: '85.1376');
  String _label = 'Home';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_line1, _landmark, _pincode, _lat, _lng]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final session = context.read<SessionController>();
    if (session.zoneId == null) {
      setState(() => _error = 'Choose a delivery area first');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final address = await context.read<ApiClient>().createAddress(
            zoneId: session.zoneId!,
            label: _label,
            line1: _line1.text.trim(),
            landmark: _landmark.text.trim(),
            pincode: _pincode.text.trim(),
            lat: double.tryParse(_lat.text.trim()) ?? 0,
            lng: double.tryParse(_lng.text.trim()) ?? 0,
          );
      if (mounted) Navigator.pop<Address>(context, address);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add address')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Wrap(
              spacing: 8,
              children: [
                for (final l in ['Home', 'Work', 'Other'])
                  ChoiceChip(label: Text(l), selected: _label == l, onSelected: (_) => setState(() => _label = l)),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _line1,
              decoration: const InputDecoration(labelText: 'Flat / house / street'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _landmark, decoration: const InputDecoration(labelText: 'Landmark (optional)')),
            const SizedBox(height: 12),
            TextFormField(
              controller: _pincode,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Pincode (optional)'),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextFormField(controller: _lat, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Latitude'))),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(controller: _lng, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Longitude'))),
            ]),
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Map-pin selection arrives with Google Maps; enter coordinates for now.',
                  style: TextStyle(fontSize: 11, color: Colors.grey)),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save address'),
            ),
          ],
        ),
      ),
    );
  }
}
