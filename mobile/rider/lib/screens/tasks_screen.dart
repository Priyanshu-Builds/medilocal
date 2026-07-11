import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/models.dart';
import '../format.dart';
import '../state/session.dart';
import 'task_detail_screen.dart';

/// The rider's active work list. Empty when off duty or idle; each card opens
/// the task detail where pickup/drop status is progressed.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  Future<List<RiderTask>>? _future;

  void _load() {
    _future = context.read<ApiClient>().tasks();
  }

  Future<void> _reload() async {
    setState(_load);
    // Keep the profile (duty, cash, active-task badge) in step with the list.
    await context.read<SessionController>().refresh();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    _future ??= context.read<ApiClient>().tasks();

    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureBuilder<List<RiderTask>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(children: [
              const SizedBox(height: 120),
              Center(child: Text('Could not load tasks.\n${snap.error}', textAlign: TextAlign.center)),
            ]);
          }
          final tasks = snap.data ?? [];
          if (tasks.isEmpty) return _EmptyState(onDuty: session.onDuty);
          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: tasks.length,
            itemBuilder: (context, i) =>
                _TaskCard(task: tasks[i], onDuty: session.onDuty, onChanged: _reload),
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool onDuty;
  const _EmptyState({required this.onDuty});

  @override
  Widget build(BuildContext context) => ListView(
        children: [
          const SizedBox(height: 120),
          Icon(onDuty ? Icons.hourglass_top : Icons.power_settings_new, size: 56, color: Colors.grey),
          const SizedBox(height: 12),
          Center(child: Text(onDuty ? 'Waiting for delivery tasks…' : 'You are off duty')),
          Center(
            child: Text(
              onDuty
                  ? 'New tasks assigned by the pharmacy team appear here'
                  : 'Go on duty (top right) to receive tasks',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      );
}

class _TaskCard extends StatelessWidget {
  final RiderTask task;
  final bool onDuty;
  final Future<void> Function() onChanged;
  const _TaskCard({required this.task, required this.onDuty, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final ui = taskStateUi(task.state);
    // A new offer you can't take until you're on duty.
    final needsDuty = !task.isAccepted && !onDuty;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => TaskDetailScreen(orderId: task.orderId)),
          );
          await onChanged();
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(task.code, style: const TextStyle(fontWeight: FontWeight.bold)),
                  StateChip(label: ui.label, color: ui.color),
                ],
              ),
              const SizedBox(height: 6),
              _line(Icons.store, 'Pick up', task.shop?.name ?? 'Pharmacy'),
              const SizedBox(height: 2),
              _line(Icons.location_on, 'Drop', task.dropAddress),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(timeAgo(task.offeredAt), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  if (task.isCod)
                    StateChip(label: 'COD ${inr(task.grandTotalInr)}', color: Colors.green)
                  else
                    const StateChip(label: 'Prepaid', color: Colors.blueGrey),
                ],
              ),
              if (needsDuty) ...[
                const SizedBox(height: 8),
                Row(
                  children: const [
                    Icon(Icons.power_settings_new, size: 14, color: Colors.grey),
                    SizedBox(width: 4),
                    Text('Go on duty to accept',
                        style: TextStyle(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _line(IconData icon, String label, String value) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: Colors.grey),
          const SizedBox(width: 6),
          SizedBox(width: 52, child: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey))),
          Expanded(
            child: Text(value, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
          ),
        ],
      );
}

/// Small rounded status pill, shared across the rider screens.
class StateChip extends StatelessWidget {
  final String label;
  final Color color;
  const StateChip({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}
