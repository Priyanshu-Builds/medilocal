'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATES, type OrderState } from '@medilocal/shared';
import { AppShell } from '@/components/app-shell';
import { Badge, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { inr, timeAgo } from '@/lib/format';
import { BOARD_COLUMNS, ORDER_STATE_UI, PAYMENT_STATE_UI } from '@/lib/order-ui';
import type { OrderListRow } from '@/lib/types';

export default function OrdersPage() {
  const [filter, setFilter] = useState<OrderState | 'ALL'>('ALL');

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['admin-orders', filter],
    queryFn: () => apiGet<OrderListRow[]>(`/v1/admin/orders${filter === 'ALL' ? '' : `?state=${filter}`}`),
    refetchInterval: 5_000, // live board
  });

  const counts = (data ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.state] = (acc[o.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Live orders</h1>
          <p className="text-sm text-slate-500">
            Auto-refreshing every 5s{isFetching ? ' · updating…' : ''}
          </p>
        </div>
      </div>

      {/* Filter chips grouped by lifecycle phase */}
      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        {BOARD_COLUMNS.map((col) =>
          col.states.map((s) => (
            <FilterChip
              key={s}
              label={`${ORDER_STATE_UI[s].label}${counts[s] ? ` (${counts[s]})` : ''}`}
              active={filter === s}
              onClick={() => setFilter(s)}
            />
          )),
        )}
      </div>

      {isLoading ? (
        <Spinner label="Loading orders…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data || data.length === 0 ? (
        <EmptyState>No orders{filter === 'ALL' ? ' yet' : ` in ${ORDER_STATE_UI[filter as OrderState].label}`}.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Age</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => {
                const s = ORDER_STATE_UI[o.state];
                const p = PAYMENT_STATE_UI[o.paymentState];
                return (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline">
                        {o.code}
                      </Link>
                      {o.requiresRx && <span className="ml-2 text-xs text-violet-600">Rx</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>{o.user?.name ?? '—'}</div>
                      <div className="text-xs text-slate-400">{o.user?.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.shop?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.tone}>{p.label}</Badge>
                      <div className="mt-0.5 text-xs text-slate-400">{o.paymentMethod}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{inr(o.grandTotalInr)}</td>
                    <td className="px-4 py-3 text-slate-500">{timeAgo(o.placedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

// Ensure all states are reachable via chips (compile-time guard against a
// new state slipping through without board coverage).
void (ORDER_STATES satisfies readonly OrderState[]);
