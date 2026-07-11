'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { inr } from '@/lib/format';
import type { InventoryRow, Medicine } from '@/lib/types';

export default function InventoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shop-inventory'] });

  const { data, isLoading, error } = useQuery({
    queryKey: ['shop-inventory'],
    queryFn: () => apiGet<InventoryRow[]>('/v1/shop/inventory'),
  });

  const visible = (data ?? []).filter((r) =>
    filter.trim() ? r.medicine.name.toLowerCase().includes(filter.trim().toLowerCase()) : true,
  );

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Stock & prices</h1>
        <p className="text-sm text-slate-500">Toggle availability and set your price (up to MRP)</p>
      </div>

      <AddMedicine stocked={new Set((data ?? []).map((r) => r.medicineId))} onAdded={invalidate} />

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter my stock…"
        className="mb-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {isLoading ? (
        <Spinner label="Loading inventory…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : visible.length === 0 ? (
        <EmptyState>{data && data.length > 0 ? 'No matches.' : 'No inventory yet — add medicines above.'}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">My price</th>
                <th className="px-4 py-3 text-center">Availability</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <Row key={row.id} row={row} onChange={invalidate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function Row({ row, onChange }: { row: InventoryRow; onChange: () => void }) {
  const [price, setPrice] = useState(row.priceInr);
  const [error, setError] = useState<string | null>(null);
  const dirty = Number(price) !== Number(row.priceInr);

  const update = useMutation({
    mutationFn: (body: { priceInr?: number; inStock?: boolean }) =>
      apiPut(`/v1/shop/inventory/${row.medicineId}`, body),
    onSuccess: () => {
      setError(null);
      onChange();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium">{row.medicine.name}</div>
        <div className="text-xs text-slate-400">
          {row.medicine.genericName ?? row.medicine.brand ?? ''}
          {row.medicine.rxRequired && <span className="ml-1 text-violet-600">· Rx</span>}
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </td>
      <td className="px-4 py-3 text-right text-slate-500">{inr(row.medicine.mrpInr)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
          />
          {dirty && (
            <Button
              variant="secondary"
              loading={update.isPending}
              onClick={() => update.mutate({ priceInr: Number(price) })}
            >
              Save
            </Button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => update.mutate({ inStock: !row.inStock })}
          disabled={update.isPending}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            row.inStock ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {row.inStock ? 'In stock' : 'Out of stock'}
        </button>
      </td>
    </tr>
  );
}

function AddMedicine({ stocked, onAdded }: { stocked: Set<string>; onAdded: () => void }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: results } = useQuery({
    queryKey: ['catalog-search', query],
    queryFn: () => apiGet<Medicine[]>(`/v1/catalog/medicines?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: (m: Medicine) =>
      apiPost('/v1/shop/inventory', { medicineId: m.id, priceInr: Number(m.mrpInr), inStock: true }),
    onSuccess: () => {
      setError(null);
      onAdded();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const candidates = (results ?? []).filter((m) => !stocked.has(m.id));

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 font-semibold">Add a medicine to your shelf</h2>
      <p className="mb-3 text-xs text-slate-400">Search the master catalog; it’s added at MRP and you can adjust the price below.</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search catalog (e.g. dolo, azithral)…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {query.trim().length >= 2 && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
          {candidates.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">No new matches (already stocked or none found).</p>
          ) : (
            candidates.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-slate-100 p-2 text-sm last:border-0">
                <div>
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-1 text-xs text-slate-400">MRP {inr(m.mrpInr)}</span>
                  {m.schedule !== 'NONE' && <Badge tone="violet">Schedule {m.schedule}</Badge>}
                </div>
                <Button
                  variant="secondary"
                  loading={add.isPending && add.variables?.id === m.id}
                  onClick={() => add.mutate(m)}
                >
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
