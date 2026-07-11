'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RxStatus } from '@medilocal/shared';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { dateTime } from '@/lib/format';

interface RxQueueEntry {
  id: string;
  status: RxStatus;
  rejectionReason: string | null;
  createdAt: string;
  order: {
    id: string;
    code: string;
    state: string;
    placedAt: string;
    user: { name: string | null; phone: string } | null;
    shop: { id: string; name: string } | null;
    items: { nameSnapshot: string; qty: number; medicineId: string }[];
  };
}

const TABS: RxStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export default function PrescriptionsPage() {
  const [tab, setTab] = useState<RxStatus>('PENDING');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['rx-queue', tab],
    queryFn: () => apiGet<RxQueueEntry[]>(`/v1/admin/prescriptions?status=${tab}`),
    refetchInterval: tab === 'PENDING' ? 8_000 : false,
  });

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Prescription queue</h1>
        <p className="text-sm text-slate-500">Pharmacist verification for Schedule H/H1 orders</p>
      </div>

      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner label="Loading queue…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data || data.length === 0 ? (
        <EmptyState>No {tab.toLowerCase()} prescriptions.</EmptyState>
      ) : (
        <div className="space-y-4">
          {data.map((rx) => (
            <RxCard key={rx.id} rx={rx} onDone={() => qc.invalidateQueries({ queryKey: ['rx-queue'] })} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function RxCard({ rx, onDone }: { rx: RxQueueEntry; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewUrl = useMutation({
    mutationFn: () => apiGet<{ url: string }>(`/v1/prescriptions/${rx.id}/view-url`),
    onSuccess: (d) => window.open(d.url, '_blank', 'noopener'),
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to load image'),
  });

  const verify = useMutation({
    mutationFn: (vars: { approve: boolean; rejectionReason?: string }) =>
      apiPost(`/v1/admin/prescriptions/${rx.id}/verify`, vars),
    onSuccess: () => {
      setError(null);
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Verification failed'),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/orders/${rx.order.id}`} className="font-semibold text-indigo-600 hover:underline">
              {rx.order.code}
            </Link>
            <Badge tone={rx.status === 'APPROVED' ? 'emerald' : rx.status === 'REJECTED' ? 'red' : 'amber'}>
              {rx.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {rx.order.user?.name ?? '—'} · {rx.order.user?.phone} · {rx.order.shop?.name}
          </p>
          <p className="text-xs text-slate-400">Placed {dateTime(rx.order.placedAt)}</p>
        </div>
        <Button variant="secondary" loading={viewUrl.isPending} onClick={() => viewUrl.mutate()}>
          View prescription
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {rx.order.items.map((it, i) => (
          <span key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {it.nameSnapshot} ×{it.qty}
          </span>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {rx.status === 'PENDING' && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {!showReject ? (
            <div className="flex gap-2">
              <Button variant="primary" loading={verify.isPending} onClick={() => verify.mutate({ approve: true })}>
                Approve
              </Button>
              <Button variant="danger" onClick={() => setShowReject(true)}>
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rejection reason (shown to customer)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  disabled={reason.trim().length < 3}
                  loading={verify.isPending}
                  onClick={() => verify.mutate({ approve: false, rejectionReason: reason.trim() })}
                >
                  Confirm rejection
                </Button>
                <Button variant="ghost" onClick={() => setShowReject(false)}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-slate-400">Rejecting also cancels & refunds the order.</p>
            </div>
          )}
        </div>
      )}

      {rx.status === 'REJECTED' && rx.rejectionReason && (
        <p className="mt-3 text-sm text-red-600">Reason: {rx.rejectionReason}</p>
      )}
    </div>
  );
}
