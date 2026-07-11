'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATE_TRANSITIONS, type OrderState } from '@medilocal/shared';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { dateTime, inr } from '@/lib/format';
import { ORDER_STATE_UI, PAYMENT_STATE_UI } from '@/lib/order-ui';
import type { OrderDetail, Rider } from '@/lib/types';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => apiGet<OrderDetail>(`/v1/admin/orders/${id}`),
    refetchInterval: 8_000,
  });

  const { data: riders } = useQuery({
    queryKey: ['admin-riders'],
    queryFn: () => apiGet<Rider[]>('/v1/admin/riders'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-order', id] });
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const assign = useMutation({
    mutationFn: (riderId: string) => apiPost(`/v1/admin/orders/${id}/assign-rider`, { riderId }),
    onSuccess: () => {
      setActionError(null);
      refresh();
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'Failed'),
  });

  const transition = useMutation({
    mutationFn: (vars: { toState: OrderState; note: string }) =>
      apiPost(`/v1/admin/orders/${id}/transition`, vars),
    onSuccess: () => {
      setActionError(null);
      refresh();
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <AppShell>
      <Link href="/orders" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Back to orders
      </Link>

      {isLoading ? (
        <Spinner label="Loading order…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : !order ? null : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: order content */}
          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold">{order.code}</h1>
                  <p className="text-sm text-slate-500">Placed {dateTime(order.placedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ORDER_STATE_UI[order.state].tone}>{ORDER_STATE_UI[order.state].label}</Badge>
                  <Badge tone={PAYMENT_STATE_UI[order.paymentState].tone}>
                    {PAYMENT_STATE_UI[order.paymentState].label}
                  </Badge>
                  {order.requiresRx && <Badge tone="violet">Prescription</Badge>}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400">Customer</h3>
                  <p className="text-sm">{order.user?.name ?? '—'}</p>
                  <p className="text-sm text-slate-500">{order.user?.phone}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400">Deliver to</h3>
                  <p className="text-sm">
                    {order.addressSnapshot.line1}
                    {order.addressSnapshot.landmark ? `, ${order.addressSnapshot.landmark}` : ''}
                  </p>
                  <p className="text-sm text-slate-500">{order.addressSnapshot.pincode}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400">Pharmacy</h3>
                  <p className="text-sm">{order.shop?.name}</p>
                  <p className="text-sm text-slate-500">{order.shop?.phone}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400">Delivery code</h3>
                  <p className="font-mono text-lg font-bold tracking-widest">{order.deliveryOtp}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-semibold">Items</h2>
              <table className="w-full text-sm">
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2">
                        {it.nameSnapshot}
                        {it.accepted === false && (
                          <span className="ml-2 text-xs text-red-500">dropped</span>
                        )}
                        {it.accepted === true && <span className="ml-2 text-xs text-emerald-600">✓</span>}
                      </td>
                      <td className="py-2 text-slate-500">×{it.qty}</td>
                      <td className="py-2 text-right">{inr(Number(it.priceInrSnapshot) * it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr>
                    <td className="pt-3 text-slate-500" colSpan={2}>Items</td>
                    <td className="pt-3 text-right">{inr(order.itemsTotalInr)}</td>
                  </tr>
                  <tr>
                    <td className="text-slate-500" colSpan={2}>Delivery</td>
                    <td className="text-right">{inr(order.deliveryFeeInr)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="pt-1" colSpan={2}>Total</td>
                    <td className="pt-1 text-right">{inr(order.grandTotalInr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payments & refunds */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-semibold">Payments</h2>
              {order.payments.length === 0 ? (
                <p className="text-sm text-slate-400">No payment records.</p>
              ) : (
                order.payments.map((p) => (
                  <div key={p.id} className="border-b border-slate-100 py-2 text-sm last:border-0">
                    <div className="flex justify-between">
                      <span>{p.method} · {p.status}</span>
                      <span className="font-medium">{inr(p.amountInr)}</span>
                    </div>
                    {p.refunds?.map((r) => (
                      <div key={r.id} className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>↩ refund ({r.status}){r.reason ? ` — ${r.reason}` : ''}</span>
                        <span>{inr(r.amountInr)}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* History */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-semibold">Status history</h2>
              <ol className="space-y-2">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex gap-3 text-sm">
                    <span className="w-32 shrink-0 text-xs text-slate-400">{dateTime(h.createdAt)}</span>
                    <span className="font-medium">{h.toState}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      {h.actorType}
                      {h.note ? ` — ${h.note}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Right: ops actions */}
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-1 font-semibold">Ops actions</h2>
              <p className="mb-3 text-xs text-slate-400">
                Manual override — obeys the state machine; refunds/COD apply automatically.
              </p>
              {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

              <RiderAssign
                order={order}
                riders={riders ?? []}
                onAssign={(riderId) => assign.mutate(riderId)}
                busy={assign.isPending}
              />

              <TransitionControl
                state={order.state}
                onTransition={(toState, note) => transition.mutate({ toState, note })}
                busy={transition.isPending}
              />

              {order.assignment?.rider && (
                <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
                  <h3 className="text-xs font-semibold uppercase text-slate-400">Rider</h3>
                  <p>{order.assignment.rider.name}</p>
                  <p className="text-slate-500">{order.assignment.rider.phone}</p>
                  {order.assignment.codCollectedInr && (
                    <p className="mt-1 text-emerald-600">COD collected {inr(order.assignment.codCollectedInr)}</p>
                  )}
                </div>
              )}
            </div>

            {order.prescriptions.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-2 font-semibold">Prescriptions</h2>
                {order.prescriptions.map((rx) => (
                  <div key={rx.id} className="flex items-center justify-between py-1 text-sm">
                    <Badge tone={rx.status === 'APPROVED' ? 'emerald' : rx.status === 'REJECTED' ? 'red' : 'amber'}>
                      {rx.status}
                    </Badge>
                    {rx.rejectionReason && <span className="text-xs text-slate-500">{rx.rejectionReason}</span>}
                  </div>
                ))}
                <Link href="/prescriptions" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
                  Open Rx queue →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RiderAssign({
  order,
  riders,
  onAssign,
  busy,
}: {
  order: OrderDetail;
  riders: Rider[];
  onAssign: (riderId: string) => void;
  busy: boolean;
}) {
  const [riderId, setRiderId] = useState('');
  // Assignment is meaningful from PACKED onward; before that the shop hasn't finished.
  const canAssign = ['PACKED', 'RIDER_ASSIGNED'].includes(order.state);
  if (!canAssign) return null;
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
        {order.assignment?.rider ? 'Reassign rider' : 'Assign rider'}
      </label>
      <div className="flex gap-2">
        <select
          value={riderId}
          onChange={(e) => setRiderId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Select rider…</option>
          {riders.filter((r) => r.isActive).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.phone})
            </option>
          ))}
        </select>
        <Button disabled={!riderId} loading={busy} onClick={() => onAssign(riderId)}>
          Assign
        </Button>
      </div>
    </div>
  );
}

function TransitionControl({
  state,
  onTransition,
  busy,
}: {
  state: OrderState;
  onTransition: (toState: OrderState, note: string) => void;
  busy: boolean;
}) {
  // RIDER_ASSIGNED is driven by the assign-rider control, not a raw transition.
  const options = ORDER_STATE_TRANSITIONS[state].filter((s) => s !== 'RIDER_ASSIGNED');
  const [toState, setToState] = useState<OrderState | ''>('');
  const [note, setNote] = useState('');
  if (options.length === 0) {
    return <p className="text-xs text-slate-400">Terminal state — no further transitions.</p>;
  }
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Move to state</label>
      <select
        value={toState}
        onChange={(e) => setToState(e.target.value as OrderState)}
        className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Select next state…</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATE_UI[s].label}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason / note (required)"
        className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      <Button
        variant="secondary"
        className="w-full"
        disabled={!toState || note.trim().length < 3}
        loading={busy}
        onClick={() => toState && onTransition(toState, note.trim())}
      >
        Apply override
      </Button>
    </div>
  );
}
