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

/// Customer-facing label + colour per order state.
({String label, Color color}) orderStateUi(String state) => switch (state) {
      'PLACED' => (label: 'Placed', color: Colors.blue),
      'RX_REVIEW' => (label: 'Prescription review', color: Colors.deepPurple),
      'ACCEPTED' => (label: 'Confirmed', color: Colors.indigo),
      'PACKED' => (label: 'Packed', color: Colors.indigo),
      'RIDER_ASSIGNED' => (label: 'Rider assigned', color: Colors.orange),
      'PICKED_UP' => (label: 'Picked up', color: Colors.orange),
      'OUT_FOR_DELIVERY' => (label: 'Out for delivery', color: Colors.orange),
      'DELIVERED' => (label: 'Delivered', color: Colors.green),
      'RX_REJECTED' => (label: 'Prescription rejected', color: Colors.red),
      'CANCELLED' => (label: 'Cancelled', color: Colors.red),
      'UNDELIVERED' => (label: 'Delivery failed', color: Colors.red),
      _ => (label: state, color: Colors.grey),
    };

const terminalStates = {'DELIVERED', 'RX_REJECTED', 'CANCELLED', 'UNDELIVERED'};
bool isTerminal(String state) => terminalStates.contains(state);

/// The happy-path delivery journey shown as a tracker on the order screen.
const trackingSteps = <({String state, String label})>[
  (state: 'PLACED', label: 'Order placed'),
  (state: 'ACCEPTED', label: 'Confirmed by pharmacy'),
  (state: 'PACKED', label: 'Packed'),
  (state: 'RIDER_ASSIGNED', label: 'Rider assigned'),
  (state: 'PICKED_UP', label: 'Picked up'),
  (state: 'OUT_FOR_DELIVERY', label: 'Out for delivery'),
  (state: 'DELIVERED', label: 'Delivered'),
];

/// Index of a state within [trackingSteps]; RX_REVIEW maps just before PLACED's
/// completion (treated as still at "placed"). Returns -1 for off-path states.
int trackingIndexOf(String state) {
  if (state == 'RX_REVIEW') return 0;
  return trackingSteps.indexWhere((s) => s.state == state);
}
