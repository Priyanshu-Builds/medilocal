import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
String inr(double v) => _inr.format(v);

String shortDateTime(DateTime dt) => DateFormat('d MMM, h:mm a').format(dt.toLocal());

String timeAgo(DateTime dt) {
  final secs = DateTime.now().difference(dt).inSeconds;
  if (secs < 60) return '${secs}s ago';
  if (secs < 3600) return '${secs ~/ 60}m ago';
  if (secs < 86400) return '${secs ~/ 3600}h ago';
  return DateFormat('d MMM').format(dt.toLocal());
}

/// Rider-facing label + colour per order state (only states a rider ever sees).
({String label, Color color}) taskStateUi(String state) => switch (state) {
      'RIDER_ASSIGNED' => (label: 'New task', color: Colors.orange),
      'PICKED_UP' => (label: 'Picked up', color: Colors.blue),
      'OUT_FOR_DELIVERY' => (label: 'On the way', color: Colors.indigo),
      'DELIVERED' => (label: 'Delivered', color: Colors.green),
      'UNDELIVERED' => (label: 'Delivery failed', color: Colors.red),
      _ => (label: state, color: Colors.grey),
    };

/// The action a rider takes to move a task forward, keyed by its current state.
/// `null` = nothing to do (terminal, or waiting on acceptance handled elsewhere).
({String label, IconData icon, String next})? nextRiderStep(String state) => switch (state) {
      'RIDER_ASSIGNED' => (label: 'Picked up from pharmacy', icon: Icons.store, next: 'PICKED_UP'),
      'PICKED_UP' => (label: 'Start delivery', icon: Icons.directions_bike, next: 'OUT_FOR_DELIVERY'),
      'OUT_FOR_DELIVERY' => (label: 'Delivered', icon: Icons.check_circle, next: 'DELIVERED'),
      _ => null,
    };
