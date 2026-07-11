'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { inr } from '@/lib/format';
import type { Rider } from '@/lib/types';

export default function RidersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', vehicleNo: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: riders, isLoading, error: loadError } = useQuery({
    queryKey: ['admin-riders'],
    queryFn: () => apiGet<Rider[]>('/v1/admin/riders'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/v1/admin/riders', {
        name: form.name,
        phone: form.phone,
        vehicleNo: form.vehicleNo || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: '', phone: '', vehicleNo: '' });
      setError(null);
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Riders</h1>
          <p className="text-sm text-slate-500">Delivery partners log in via phone OTP on the rider app</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{open ? 'Close' : '+ Add rider'}</Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
          className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3"
        >
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          <input required placeholder="Phone (10 digits)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
          <input placeholder="Vehicle no. (optional)" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} className={field} />
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <div className="sm:col-span-3">
            <Button type="submit" loading={create.isPending}>Register rider</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <Spinner label="Loading riders…" />
      ) : loadError ? (
        <ErrorText error={loadError} />
      ) : !riders || riders.length === 0 ? (
        <EmptyState>No riders registered yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Rider</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3 text-right">Cash in hand</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {riders.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{r.vehicleNo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    <span className={Number(r.cashInHandInr) > 0 ? 'text-amber-700' : 'text-slate-400'}>
                      {inr(r.cashInHandInr)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.isActive ? 'emerald' : 'slate'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
