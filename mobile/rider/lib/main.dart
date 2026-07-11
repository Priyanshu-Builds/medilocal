import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'api/client.dart';
import 'state/location_controller.dart';
import 'state/session.dart';
import 'screens/earnings_screen.dart';
import 'screens/login_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/tasks_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  final session = SessionController(api);
  await session.load();

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<SessionController>.value(value: session),
        ChangeNotifierProvider<LocationController>(create: (_) => LocationController(api)),
      ],
      child: const MediLocalRiderApp(),
    ),
  );
}

const brandOrange = Color(0xFFEA580C);
const brandOrangeDark = Color(0xFFC2410C);

class MediLocalRiderApp extends StatelessWidget {
  const MediLocalRiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediLocal Rider',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: brandOrange),
        useMaterial3: true,
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
      home: const _AuthGate(),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    if (!session.isReady) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!session.isLoggedIn) return const LoginScreen();
    return const HomeShell();
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
  void initState() {
    super.initState();
    // If a shift was already on when the app restarted, resume GPS streaming.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = context.read<SessionController>();
      if (session.onDuty) context.read<LocationController>().start();
    });
  }

  Future<void> _toggleDuty(bool value) async {
    final session = context.read<SessionController>();
    final location = context.read<LocationController>();
    try {
      await session.setDuty(value);
      if (value) {
        location.start();
      } else {
        location.stop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not update duty: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    const titles = ['Tasks', 'Cash', 'Profile'];

    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index]),
        actions: [
          Row(
            children: [
              Text(session.onDuty ? 'On duty' : 'Off duty', style: const TextStyle(fontSize: 13)),
              Switch(value: session.onDuty, onChanged: _toggleDuty),
              const SizedBox(width: 8),
            ],
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: const [TasksScreen(), EarningsScreen(), ProfileScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.delivery_dining_outlined),
              selectedIcon: Icon(Icons.delivery_dining),
              label: 'Tasks'),
          NavigationDestination(
              icon: Icon(Icons.currency_rupee_outlined),
              selectedIcon: Icon(Icons.currency_rupee),
              label: 'Cash'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
