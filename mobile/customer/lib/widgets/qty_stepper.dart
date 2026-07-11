import 'package:flutter/material.dart';
import '../main.dart';

/// Compact +/- quantity control used on catalog cards and the cart.
class QtyStepper extends StatelessWidget {
  final int qty;
  final ValueChanged<int> onChanged;
  const QtyStepper({super.key, required this.qty, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: brandGreen),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _btn(Icons.remove, () => onChanged(qty - 1)),
          SizedBox(
            width: 28,
            child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold, color: brandGreenDark)),
          ),
          _btn(Icons.add, () => onChanged(qty + 1)),
        ],
      ),
    );
  }

  Widget _btn(IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: Padding(padding: const EdgeInsets.all(4), child: Icon(icon, size: 18, color: brandGreen)),
      );
}
