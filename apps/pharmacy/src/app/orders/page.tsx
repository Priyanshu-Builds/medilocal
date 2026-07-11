'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isTerminalOrderState, type OrderState } from '@medilocal/shared';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPost, session } from '@/lib/api';
import { inr, timeAgo } from '@/lib/format';
import { ORDER_STATE_UI, PAYMENT_STATE_UI } from '@/lib/order-ui';
import { useOrderAlert } from '@/lib/use-order-alert';
import type { ShopOrder } from '@/lib/types';

// States where the ball is in the shop's court — these drive the sound alert.
const INCOMING: OrderState[] = ['PLACED', 'RX_REVIEW'];

export default function OrdersPage() {
  const alert = useOrderAlert();
  const [newBanner, setNewBanner] = useState(0);
  const seenIncoming = useRef<Set<string> | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['shop-orders'],
    queryFn: () => apiGet<ShopOrder[]>('/v1/shop/orders'),
    refetchInterval: 5_000,
  });

  // Detect newly-arrived incoming orders across polls → chime + banner.
  useEffect(() => {
    if (!data) return;
    const incomingIds = data.filter((o) => INCOMING.includes(o.state)).map((o) => o.id);
    if (seenIncoming.current === null) {
      seenIncoming.current = new Set(incomingIds); // prime on first load, no alert
      return;
    }
    const fresh = incomingIds.filter((id) => !seenIncoming.current!.has(id));
    if (fresh.length > 0) {
      if (alert.enabled) alert.play();
      setNewBanner((n) => n + fresh.length);
    }
    seenIncoming.current = new Set(incomingIds);
  }, [data, alert]);

  const { active, closed } = useMemo(() => {
    const list = data ?? [];
    return {
      active: list.filter((o) => !isTerminalOrderState(o.state)),
      closed: list.filter((o) => isTerminalOrderState(o.state)),
    };
  }, [data]);

  return (
    <AppShell
      right={
        <button
          onClick={() => {
            alert.enable();
            alert.play();
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
            alert.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
          }`}
          title="Browsers require a click before they allow sound"
        >
          {alert.enabled ? '🔔 Sound on' : '🔕 Enable sound'}
        </button>
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Incoming orders</h1>
          <p className="text-sm text-slate-500">Live · refreshes every 5s{isFetching ? ' · updating…' : ''}</p>
        </div>
      </div>

      {newBanner > 0 && (
        <button
          onClick={() => setNewBanner(0)}
          className="mb-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-left text-sm font-semibold text-white"
        >
          🔔 {newBanner} new order{newBanner > 1 ? 's' : ''} arrived — tap to dismiss
        </button>
      )}

      {isLoading ? (
        <Spinner label="Loading orders…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : active.length === 0 && closed.length === 0 ? (
        <EmptyState>No orders yet. New orders will chime here.</EmptyState>
      ) : (
        <div className="space-y-4">
          {active.length === 0 ? (
            <EmptyState>No active orders right now.</EmptyState>
          ) : (
            active.map((o) => <OrderCard key={o.id} order={o} />)
          )}

          {closed.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-500">
                Recently closed ({closed.length})
              </summary>
              <ul className="mt-3 space-y-1">
                {closed.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <span>{o.code}</span>
                    <Badge tone={ORDER_STATE_UI[o.state].tone}>{ORDER_STATE_UI[o.state].label}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </AppShell>
  );
}

function OrderCard({ order }: { order: ShopOrder }) {
  const qc = useQueryClient();
  const [decisions, setDecisions] = useState<Record<string, boolean>>(
    () => Object.fromEntries(order.items.map((it) => [it.id, it.accepted ?? true])),
  );
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['shop-orders'] });

  const isPharmacist = session.user<{ isPharmacist: boolean }>()?.isPharmacist ?? false;
  const pendingRx = order.prescriptions.filter((p) => p.status === 'PENDING');
  const rxBlocked = order.requiresRx && pendingRx.length > 0;
  const canAccept = order.state === 'PLACED' || order.state === 'RX_REVIEW';

  const accept = useMutation({
    mutationFn: () =>
      apiPost(`/v1/shop/orders/${order.id}/accept`, {
        items: order.items.map((it) => ({ orderItemId: it.id, accepted: decisions[it.id] })),
      }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const pack = useMutation({
    mutationFn: () => apiPost(`/v1/shop/orders/${order.id}/pack`),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const acceptedCount = Object.values(decisions).filter(Boolean).length;
  const s = ORDER_STATE_UI[order.state];
  const p = PAYMENT_STATE_UI[order.paymentState];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{order.code}</span>
            <Badge tone={s.tone}>{s.label}</Badge>
            <Badge tone={p.tone}>{p.label}</Badge>
            {order.requiresRx && <Badge tone="violet">Rx</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {order.user?.name ?? '—'} · {order.user?.phone} · {timeAgo(order.placedAt)}
          </p>
          <p className="text-xs text-slate-400">
            {order.addressSnapshot.line1}
            {order.addressSnapshot.landmark ? `, ${order.addressSnapshot.landmark}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{inr(order.grandTotalInr)}</div>
          <div className="text-xs text-slate-400">{order.paymentMethod}</div>
        </div>
      </div>

      {/* Rx verification gate */}
      {rxBlocked && (
        <div className="mt-4 rounded-lg bg-violet-50 p-3">
          <p className="text-sm font-medium text-violet-800">Prescription verification required</p>
          {isPharmacist ? (
            pendingRx.map((rx) => <RxVerify key={rx.id} rxId={rx.id} onDone={refresh} />)
          ) : (
            <p className="mt-1 text-xs text-violet-600">A registered pharmacist must verify this before you can accept.</p>
          )}
        </div>
      )}

      {/* Items with per-item accept toggles */}
      <div className="mt-4">
        <table className="w-full text-sm">
          <tbody>
            {order.items.map((it) => {
              const on = decisions[it.id];
              const editable = canAccept && !rxBlocked;
              return (
                <tr key={it.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">
                    <span className={on ? '' : 'text-slate-400 line-through'}>{it.nameSnapshot}</span>
                  </td>
                  <td className="py-2 text-slate-500">×{it.qty}</td>
                  <td className="py-2 text-right">{inr(Number(it.priceInrSnapshot) * it.qty)}</td>
                  <td className="py-2 text-right">
                    {editable ? (
                      <button
                        onClick={() => setDecisions((d) => ({ ...d, [it.id]: !d[it.id] }))}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {on ? 'Available' : 'Unavailable'}
                      </button>
                    ) : it.accepted === false ? (
                      <span className="text-xs text-red-500">dropped</span>
                    ) : it.accepted === true ? (
                      <span className="text-xs text-emerald-600">✓</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {canAccept && (
          <Button
            loading={accept.isPending}
            disabled={rxBlocked}
            onClick={() => accept.mutate()}
            title={rxBlocked ? 'Verify the prescription first' : undefined}
          >
            {acceptedCount === order.items.length
              ? 'Accept all items'
              : acceptedCount === 0
                ? 'Reject order (nothing available)'
                : `Accept ${acceptedCount} of ${order.items.length}`}
          </Button>
        )}
        {order.state === 'ACCEPTED' && (
          <Button loading={pack.isPending} onClick={() => pack.mutate()}>
            Mark packed
          </Button>
        )}
        {order.state === 'PACKED' && <span className="text-sm text-slate-500">Packed — awaiting rider pickup</span>}
        {['RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(order.state) && (
          <span className="text-sm text-slate-500">Out with the rider</span>
        )}
      </div>
    </div>
  );
}

function RxVerify({ rxId, onDone }: { rxId: string; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = useMutation({
    mutationFn: () => apiGet<{ url: string }>(`/v1/prescriptions/${rxId}/view-url`),
    onSuccess: (d) => window.open(d.url, '_blank', 'noopener'),
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const verify = useMutation({
    mutationFn: (vars: { approve: boolean; rejectionReason?: string }) =>
      apiPost(`/v1/shop/prescriptions/${rxId}/verify`, vars),
    onSuccess: () => {
      setError(null);
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={view.isPending} onClick={() => view.mutate()}>
          View Rx
        </Button>
        {!showReject ? (
          <>
            <Button loading={verify.isPending} onClick={() => verify.mutate({ approve: true })}>
              Approve
            </Button>
            <Button variant="danger" onClick={() => setShowReject(true)}>
              Reject
            </Button>
          </>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
              className="min-w-40 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={verify.isPending}
              onClick={() => verify.mutate({ approve: false, rejectionReason: reason.trim() })}
            >
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
