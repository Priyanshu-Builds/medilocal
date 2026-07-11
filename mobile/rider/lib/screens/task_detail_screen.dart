import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../state/session.dart';
import 'tasks_screen.dart' show StateChip;

/// One delivery, start to finish. Shows the pickup and drop cards and the
/// single "what's next" action that walks the order through the state machine:
/// accept → picked up → out for delivery → delivered (OTP handoff).
class TaskDetailScreen extends StatefulWidget {
  const TaskDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  RiderTask? _task;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// There's no single-task endpoint — the active list is small, so we pull it
  /// and pick ours out. When it's gone the order left the active set (delivered
  /// or failed) and we bounce back to the list.
  Future<void> _load() async {
    try {
      final tasks = await context.read<ApiClient>().tasks();
      final matches = tasks.where((t) => t.orderId == widget.orderId);
      final match = matches.isEmpty ? null : matches.first;
      if (!mounted) return;
      setState(() {
        _task = match;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action, {String? doneMessage}) async {
    // Capture context-bound objects up front so we never touch context after an await.
    final session = context.read<SessionController>();
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      await session.refresh();
      await _load();
      if (!mounted) return;
      if (_task == null && doneMessage != null) {
        messenger.showSnackBar(SnackBar(content: Text(doneMessage)));
        navigator.pop();
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_task?.code ?? 'Task')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _task == null
              ? _gone()
              : _detail(_task!),
    );
  }

  Widget _gone() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_outline, size: 56, color: Colors.green),
              const SizedBox(height: 12),
              Text(_error ?? 'This task is complete or no longer assigned to you.',
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Back to tasks')),
            ],
          ),
        ),
      );

  Widget _detail(RiderTask task) {
    final ui = taskStateUi(task.state);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(task.code, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            StateChip(label: ui.label, color: ui.color),
          ],
        ),
        const SizedBox(height: 16),

        _PlaceCard(
          icon: Icons.store,
          title: 'Pick up',
          name: task.shop?.name ?? 'Pharmacy',
          address: task.shop?.addressLine,
          phone: task.shop?.phone,
        ),
        const SizedBox(height: 10),
        _PlaceCard(
          icon: Icons.location_on,
          title: 'Deliver to',
          name: task.customer?.name ?? 'Customer',
          address: task.dropAddress,
          phone: task.customer?.phone,
        ),
        const SizedBox(height: 16),

        Text('Items', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 6),
        ...task.items.map((i) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  const Icon(Icons.medication_outlined, size: 16, color: Colors.grey),
                  const SizedBox(width: 8),
                  Expanded(child: Text(i.nameSnapshot)),
                  Text('×${i.qty}', style: const TextStyle(color: Colors.grey)),
                ],
              ),
            )),
        const SizedBox(height: 16),

        _PaymentBanner(task: task),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.red)),
        ],
        const SizedBox(height: 16),
        ..._actions(task),
      ],
    );
  }

  List<Widget> _actions(RiderTask task) {
    // Not yet accepted → the only action is to claim it (first-accept-wins).
    if (!task.isAccepted) {
      return [
        _primary('Accept task', Icons.check, () => _run(
              () => context.read<ApiClient>().acceptTask(task.orderId),
            )),
      ];
    }

    final step = nextRiderStep(task.state);
    final widgets = <Widget>[];
    if (step != null) {
      if (step.next == 'DELIVERED') {
        widgets.add(_primary(
          task.isCod ? 'Collect ${inr(task.grandTotalInr)} & deliver' : 'Enter code & deliver',
          step.icon,
          () => _deliverFlow(task),
        ));
      } else {
        widgets.add(_primary(step.label, step.icon, () => _run(() async {
              final api = context.read<ApiClient>();
              if (step.next == 'PICKED_UP') return api.pickup(task.orderId);
              return api.outForDelivery(task.orderId);
            })));
      }
    }
    // Escape hatch available any time after acceptance until it's delivered.
    widgets.add(const SizedBox(height: 8));
    widgets.add(OutlinedButton.icon(
      onPressed: _busy ? null : () => _undeliveredFlow(task),
      icon: const Icon(Icons.report_problem_outlined),
      label: const Text("Couldn't deliver"),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.red,
        padding: const EdgeInsets.symmetric(vertical: 14),
      ),
    ));
    return widgets;
  }

  Widget _primary(String label, IconData icon, VoidCallback onTap) => FilledButton.icon(
        onPressed: _busy ? null : onTap,
        icon: _busy
            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Icon(icon),
        label: Text(label),
        style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
      );

  Future<void> _deliverFlow(RiderTask task) async {
    final api = context.read<ApiClient>();
    final otp = await showDialog<String>(
      context: context,
      builder: (_) => _OtpDialog(task: task),
    );
    if (otp == null || otp.isEmpty) return;
    await _run(
      () => api.deliver(task.orderId, otp),
      doneMessage: task.isCod
          ? 'Delivered. ${inr(task.grandTotalInr)} added to your cash-in-hand.'
          : 'Delivered. Nice work!',
    );
  }

  Future<void> _undeliveredFlow(RiderTask task) async {
    final api = context.read<ApiClient>();
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _ReasonDialog(),
    );
    if (reason == null) return;
    await _run(
      () => api.undelivered(task.orderId, reason),
      doneMessage: 'Marked as undelivered. Ops will follow up.',
    );
  }
}

class _PlaceCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String name;
  final String? address;
  final String? phone;

  const _PlaceCard({
    required this.icon,
    required this.title,
    required this.name,
    this.address,
    this.phone,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title.toUpperCase(),
                      style: const TextStyle(fontSize: 11, color: Colors.grey, letterSpacing: 0.5)),
                  const SizedBox(height: 2),
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (address != null && address!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(address!, style: TextStyle(color: Colors.grey[700], fontSize: 13)),
                  ],
                  if (phone != null && phone!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.phone, size: 14, color: Colors.grey),
                        const SizedBox(width: 4),
                        Text(phone!, style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentBanner extends StatelessWidget {
  final RiderTask task;
  const _PaymentBanner({required this.task});

  @override
  Widget build(BuildContext context) {
    final cod = task.isCod;
    final color = cod ? Colors.green : Colors.blueGrey;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(cod ? Icons.payments : Icons.check_circle, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              cod
                  ? 'Collect ${inr(task.grandTotalInr)} in cash on delivery'
                  : 'Prepaid — no cash to collect',
              style: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// 4-digit handoff code entry. The customer reads it from their app; a wrong
/// code is rejected by the server, so DELIVERED can't be faked.
class _OtpDialog extends StatefulWidget {
  const _OtpDialog({required this.task});
  final RiderTask task;

  @override
  State<_OtpDialog> createState() => _OtpDialogState();
}

class _OtpDialogState extends State<_OtpDialog> {
  final _otp = TextEditingController();

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Delivery code'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.task.isCod)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text('Collect ${inr(widget.task.grandTotalInr)} in cash first.',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          const Text('Ask the customer for the 4-digit code shown in their app.',
              style: TextStyle(fontSize: 13, color: Colors.grey)),
          const SizedBox(height: 12),
          TextField(
            controller: _otp,
            autofocus: true,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, letterSpacing: 8),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
            decoration: const InputDecoration(hintText: '••••', counterText: ''),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, _otp.text.trim()),
          child: const Text('Confirm delivery'),
        ),
      ],
    );
  }
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog();

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text("Couldn't deliver"),
      content: TextField(
        controller: _reason,
        autofocus: true,
        maxLines: 3,
        decoration: const InputDecoration(hintText: 'e.g. Customer not reachable at the address'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          onPressed: () {
            final r = _reason.text.trim();
            if (r.length < 3) return;
            Navigator.pop(context, r);
          },
          child: const Text('Mark undelivered'),
        ),
      ],
    );
  }
}
