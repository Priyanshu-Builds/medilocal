import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'api/client.dart';
import 'state/cart.dart';
import 'state/session.dart';
import 'screens/account_screen.dart';
import 'screens/catalog_screen.dart';
import 'screens/login_screen.dart';
import 'screens/orders_screen.dart';

/// Error monitoring is off unless a DSN is supplied at build time:
///   flutter run --dart-define=SENTRY_DSN=https://...
const _sentryDsn = String.fromEnvironment('SENTRY_DSN');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  final session = SessionController(api);
  await session.load();

  final app = MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: api),
      ChangeNotifierProvider<SessionController>.value(value: session),
      ChangeNotifierProvider<CartController>(create: (_) => CartController()),
    ],
    child: const MediLocalCustomerApp(),
  );

  if (_sentryDsn.isEmpty) {
    runApp(app);
  } else {
    await SentryFlutter.init(
      (options) => options
        ..dsn = _sentryDsn
        ..tracesSampleRate = 0.0,
      appRunner: () => runApp(app),
    );
  }
}

const brandGreen = Color(0xFF059669);
const brandGreenDark = Color(0xFF047857);

class MediLocalCustomerApp extends StatelessWidget {
  const MediLocalCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediLocal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: brandGreen),
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
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [CatalogScreen(), OrdersScreen(), AccountScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'Orders'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Account'),
        ],
      ),
    );
  }
}
