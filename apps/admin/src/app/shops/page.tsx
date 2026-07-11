'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { AdminShop, ShopStatus, Zone } from '@/lib/admin-types';

const STATUS_TONE: Record<ShopStatus, 'emerald' | 'amber' | 'red'> = {
  ACTIVE: 'emerald',
  PENDING: 'amber',
  SUSPENDED: 'red',
};

export default function ShopsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: shops, isLoading, error } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: () => apiGet<AdminShop[]>('/v1/admin/shops'),
  });
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: () => apiGet<Zone[]>('/v1/zones') });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: ShopStatus }) =>
      apiPatch(`/v1/admin/shops/${vars.id}`, { status: vars.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  });

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Shops</h1>
          <p className="text-sm text-slate-500">Partner pharmacies — verify the drug license before activating</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Close' : '+ Onboard shop'}</Button>
      </div>

      {showCreate && zones && (
        <CreateShopForm
          zones={zones}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
          }}
        />
      )}

      {isLoading ? (
        <Spinner label="Loading shops…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : !shops || shops.length === 0 ? (
        <EmptyState>No shops onboarded yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">License</th>
                <th className="px-4 py-3">Catalog</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/shops/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs text-slate-400">{s.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.zone?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.licenseNo}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {s._count?.inventory ?? 0} items · {s._count?.staff ?? 0} staff
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {s.status !== 'ACTIVE' ? (
                      <Button
                        variant="secondary"
                        loading={setStatus.isPending && setStatus.variables?.id === s.id}
                        onClick={() => setStatus.mutate({ id: s.id, status: 'ACTIVE' })}
                      >
                        Activate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        loading={setStatus.isPending && setStatus.variables?.id === s.id}
                        onClick={() => setStatus.mutate({ id: s.id, status: 'SUSPENDED' })}
                      >
                        Suspend
                      </Button>
                    )}
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

function CreateShopForm({ zones, onCreated }: { zones: Zone[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    zoneId: zones[0]?.id ?? '',
    licenseNo: '',
    phone: '',
    addressLine: '',
    lat: '',
    lng: '',
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const zone = zones.find((z) => z.id === form.zoneId);
      if (!zone) throw new Error('Pick a zone');
      return apiPost('/v1/admin/shops', {
        cityId: zone.city.id,
        zoneId: zone.id,
        name: form.name,
        licenseNo: form.licenseNo,
        phone: form.phone,
        addressLine: form.addressLine,
        lat: Number(form.lat),
        lng: Number(form.lng),
      });
    },
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        create.mutate();
      }}
      className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Shop name</label>
        <input required value={form.name} onChange={set('name')} className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Zone</label>
        <select value={form.zoneId} onChange={set('zoneId')} className={field}>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} — {z.city.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Drug license no.</label>
        <input required value={form.licenseNo} onChange={set('licenseNo')} className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Phone</label>
        <input required value={form.phone} onChange={set('phone')} className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Address</label>
        <input required value={form.addressLine} onChange={set('addressLine')} className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Latitude</label>
        <input required value={form.lat} onChange={set('lat')} placeholder="25.5941" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Longitude</label>
        <input required value={form.lng} onChange={set('lng')} placeholder="85.1376" className={field} />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" loading={create.isPending}>
          Create shop (PENDING)
        </Button>
      </div>
    </form>
  );
}
