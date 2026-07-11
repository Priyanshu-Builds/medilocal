import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import '../api/client.dart';
import '../config.dart';

/// A single GPS fix. On a real device this comes from `geolocator`; the
/// simulator below stands in for it so the app runs with zero native setup.
typedef GpsFix = ({double lat, double lng});

/// Streams the rider's location to the backend while on duty.
///
/// The real pilot swaps [_source] for a `geolocator` position stream running
/// inside a `flutter_foreground_task` foreground service (so GPS keeps flowing
/// with the screen off). Everything downstream — the throttled POST to
/// /v1/rider/location and the on/off lifecycle — stays exactly as it is here.
class LocationController extends ChangeNotifier {
  LocationController(this.api, {Future<GpsFix?> Function()? source})
      : _source = source ?? _SimulatedGps().next;

  final ApiClient api;
  final Future<GpsFix?> Function() _source;

  Timer? _timer;
  bool get isStreaming => _timer != null;
  GpsFix? lastFix;
  DateTime? lastPushedAt;

  /// Start pushing fixes on [Config.locationInterval]. Safe to call repeatedly.
  void start() {
    if (_timer != null) return;
    _timer = Timer.periodic(Config.locationInterval, (_) => _tick());
    _tick(); // push one immediately so the map isn't blank
    notifyListeners();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    notifyListeners();
  }

  Future<void> _tick() async {
    final fix = await _source();
    if (fix == null) return;
    lastFix = fix;
    try {
      await api.pushLocation(fix.lat, fix.lng);
      lastPushedAt = DateTime.now();
      notifyListeners();
    } catch (_) {
      // Dropped pings are fine — the next tick catches up. Never surface this.
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

/// Dev stand-in for a real GPS stream: a slow random walk around the seed
/// city so the live-tracking pipeline is exercisable on an emulator. Replaced
/// by `geolocator` on device.
class _SimulatedGps {
  double _lat = 25.5941; // ~Patna, matching the seed zone
  double _lng = 85.1376;
  final _rng = Random();

  Future<GpsFix?> next() async {
    _lat += (_rng.nextDouble() - 0.5) * 0.0008;
    _lng += (_rng.nextDouble() - 0.5) * 0.0008;
    return (lat: _lat, lng: _lng);
  }
}
