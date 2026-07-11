'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { inr } from '@/lib/format';
import type { AdminShop, InventoryRow, Medicine, ShopStaff } from '@/lib/admin-types';

type ShopDetail = AdminShop & { staff: ShopStaff[]; inventory: InventoryRow[] };

export default function ShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-shop', id] });

  const { data: shop, isLoading, error } = useQuery({
    queryKey: ['admin-shop', id],
    queryFn: () => apiGet<ShopDetail>(`/v1/admin/shops/${id}`),
  });

  return (
    <AppShell>
      <Link href="/shops" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Back to shops
      </Link>
      {isLoading ? (
        <Spinner label="Loading shop…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : !shop ? null : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{shop.name}</h1>
                <p className="text-sm text-slate-500">
                  {shop.addressLine} · {shop.phone}
                </p>
              </div>
              <Badge tone={shop.status === 'ACTIVE' ? 'emerald' : shop.status === 'PENDING' ? 'amber' : 'red'}>
                {shop.status}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              License {shop.licenseNo} · Commission {shop.commissionPct}%
            </p>
          </div>

          <StaffPanel shopId={id} staff={shop.staff} onChange={invalidate} />
          <InventoryPanel shopId={id} inventory={shop.inventory} onChange={invalidate} />
        </div>
      )}
    </AppShell>
  );
}

function StaffPanel({ shopId, staff, onChange }: { shopId: string; staff: ShopStaff[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', isPharmacist: false, pharmacistRegNo: '' });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      apiPost(`/v1/admin/shops/${shopId}/staff`, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        isPharmacist: form.isPharmacist,
        pharmacistRegNo: form.isPharmacist ? form.pharmacistRegNo || undefined : undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: '', email: '', phone: '', password: '', isPharmacist: false, pharmacistRegNo: '' });
      setError(null);
      onChange();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Staff logins</h2>
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : '+ Add staff'}
        </Button>
      </div>
      {staff.length === 0 ? (
        <p className="text-sm text-slate-400">No staff logins yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium">{s.name}</span> · {s.email}
                <div className="text-xs text-slate-400">{s.phone}</div>
              </div>
              {s.isPharmacist && <Badge tone="violet">Pharmacist</Badge>}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
          className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"
        >
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
          <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
          <input required type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPharmacist} onChange={(e) => setForm({ ...form, isPharmacist: e.target.checked })} />
            Registered pharmacist
          </label>
          {form.isPharmacist && (
            <input placeholder="Pharmacist reg. no." value={form.pharmacistRegNo} onChange={(e) => setForm({ ...form, pharmacistRegNo: e.target.value })} className={field} />
          )}
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" loading={create.isPending}>Create login</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function InventoryPanel({ shopId, inventory, onChange }: { shopId: string; inventory: InventoryRow[]; onChange: () => void }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: searchResults } = useQuery({
    queryKey: ['admin-medicines', query],
    queryFn: () => apiGet<Medicine[]>(`/v1/admin/medicines?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  const upsert = useMutation({
    mutationFn: (vars: { medicineId: string; priceInr: number; inStock: boolean }) =>
      apiPost(`/v1/admin/shops/${shopId}/inventory`, vars),
    onSuccess: () => {
      setError(null);
      onChange();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const stocked = new Set(inventory.map((i) => i.medicineId));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 font-semibold">Inventory (on the shop’s behalf)</h2>
      <p className="mb-3 text-xs text-slate-400">Ops-assisted stock — price must be ≤ MRP.</p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search catalog to add a medicine…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {query.trim().length >= 2 && searchResults && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
            {searchResults.filter((m) => !stocked.has(m.id)).length === 0 ? (
              <p className="p-3 text-sm text-slate-400">No new matches (already stocked or none found).</p>
            ) : (
              searchResults
                .filter((m) => !stocked.has(m.id))
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between border-b border-slate-100 p-2 text-sm last:border-0">
                    <div>
                      {m.name} <span className="text-xs text-slate-400">MRP {inr(m.mrpInr)}</span>
                    </div>
                    <Button
                      variant="secondary"
                      loading={upsert.isPending && upsert.variables?.medicineId === m.id}
                      onClick={() => upsert.mutate({ medicineId: m.id, priceInr: Number(m.mrpInr), inStock: true })}
                    >
                      Add at MRP
                    </Button>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {inventory.length === 0 ? (
        <p className="text-sm text-slate-400">No inventory yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="py-2">Medicine</th>
              <th className="py-2 text-right">MRP</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-center">Stock</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((row) => (
              <InventoryEditRow
                key={row.id}
                row={row}
                busy={upsert.isPending && upsert.variables?.medicineId === row.medicineId}
                onSave={(priceInr, inStock) => upsert.mutate({ medicineId: row.medicineId, priceInr, inStock })}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InventoryEditRow({
  row,
  busy,
  onSave,
}: {
  row: InventoryRow;
  busy: boolean;
  onSave: (priceInr: number, inStock: boolean) => void;
}) {
  const [price, setPrice] = useState(row.priceInr);
  const dirty = Number(price) !== Number(row.priceInr);
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2">
        {row.medicine.name}
        {row.medicine.rxRequired && <span className="ml-1 text-xs text-violet-600">Rx</span>}
      </td>
      <td className="py-2 text-right text-slate-500">{inr(row.medicine.mrpInr)}</td>
      <td className="py-2 text-right">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
        />
      </td>
      <td className="py-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onSave(Number(row.priceInr), !row.inStock)}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.inStock ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {row.inStock ? 'In stock' : 'Out'}
          </button>
          {dirty && (
            <Button variant="secondary" loading={busy} onClick={() => onSave(Number(price), row.inStock)}>
              Save
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
