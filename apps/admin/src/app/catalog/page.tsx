'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, ErrorText, Spinner } from '@/components/ui';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { inr } from '@/lib/format';
import type { Medicine } from '@/lib/admin-types';

const SCHEDULES = ['NONE', 'H', 'H1'] as const;

interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export default function CatalogPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'none' | 'create' | 'import'>('none');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-catalog', query],
    queryFn: () => apiGet<Medicine[]>(`/v1/admin/medicines${query.trim() ? `?q=${encodeURIComponent(query)}` : ''}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-catalog'] });

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Catalog</h1>
          <p className="text-sm text-slate-500">Master medicine list · {data?.length ?? 0} shown</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setMode(mode === 'import' ? 'none' : 'import')}>
            {mode === 'import' ? 'Close' : 'Import CSV'}
          </Button>
          <Button onClick={() => setMode(mode === 'create' ? 'none' : 'create')}>
            {mode === 'create' ? 'Close' : '+ Add medicine'}
          </Button>
        </div>
      </div>

      {mode === 'create' && (
        <MedicineForm
          onDone={() => {
            setMode('none');
            invalidate();
          }}
        />
      )}
      {mode === 'import' && <CsvImport onDone={invalidate} />}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, brand, or salt…"
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {isLoading ? (
        <Spinner label="Loading catalog…" />
      ) : error ? (
        <ErrorText error={error} />
      ) : !data || data.length === 0 ? (
        <EmptyState>No medicines found.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Salt / brand</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <MedicineRow key={m.id} m={m} onChange={invalidate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function MedicineRow({ m, onChange }: { m: Medicine; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const toggle = useMutation({
    mutationFn: () => apiPatch(`/v1/admin/medicines/${m.id}`, { isActive: !m.isActive }),
    onSuccess: onChange,
  });
  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-3 font-medium">{m.name}</td>
        <td className="px-4 py-3 text-slate-500">
          {m.genericName ?? '—'}
          {m.brand ? ` · ${m.brand}` : ''}
        </td>
        <td className="px-4 py-3 text-right">{inr(m.mrpInr)}</td>
        <td className="px-4 py-3">
          {m.schedule === 'NONE' ? (
            <span className="text-xs text-slate-400">OTC</span>
          ) : (
            <Badge tone="violet">Schedule {m.schedule}</Badge>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge tone={m.isActive ? 'emerald' : 'slate'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" onClick={() => setEditing((v) => !v)}>Edit</Button>
            <Button variant="ghost" loading={toggle.isPending} onClick={() => toggle.mutate()}>
              {m.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="bg-slate-50 px-4 py-4">
            <MedicineForm medicine={m} onDone={() => { setEditing(false); onChange(); }} />
          </td>
        </tr>
      )}
    </>
  );
}

function MedicineForm({ medicine, onDone }: { medicine?: Medicine; onDone: () => void }) {
  const editing = !!medicine;
  const [form, setForm] = useState({
    name: medicine?.name ?? '',
    brand: medicine?.brand ?? '',
    genericName: medicine?.genericName ?? '',
    manufacturer: medicine?.manufacturer ?? '',
    mrpInr: medicine?.mrpInr ?? '',
    packSize: medicine?.packSize ?? '',
    schedule: (medicine?.schedule as (typeof SCHEDULES)[number]) ?? 'NONE',
    rxRequired: medicine?.rxRequired ?? false,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        brand: form.brand || undefined,
        genericName: form.genericName || undefined,
        manufacturer: form.manufacturer || undefined,
        mrpInr: Number(form.mrpInr),
        packSize: form.packSize || undefined,
        schedule: form.schedule,
        rxRequired: form.rxRequired,
      };
      return editing
        ? apiPatch(`/v1/admin/medicines/${medicine!.id}`, body)
        : apiPost('/v1/admin/medicines', body);
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const rxForced = form.schedule === 'H' || form.schedule === 'H1';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
    >
      {!editing && <h2 className="font-semibold sm:col-span-2">New medicine</h2>}
      <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
      <input placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={field} />
      <input placeholder="Generic / salt" value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} className={field} />
      <input placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className={field} />
      <input required type="number" step="0.01" placeholder="MRP (₹)" value={form.mrpInr} onChange={(e) => setForm({ ...form, mrpInr: e.target.value })} className={field} />
      <input placeholder="Pack size" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} className={field} />
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Schedule</label>
        <select
          value={form.schedule}
          onChange={(e) => setForm({ ...form, schedule: e.target.value as (typeof SCHEDULES)[number] })}
          className={field}
        >
          {SCHEDULES.map((s) => (
            <option key={s} value={s}>{s === 'NONE' ? 'NONE (OTC)' : s}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          checked={rxForced || form.rxRequired}
          disabled={rxForced}
          onChange={(e) => setForm({ ...form, rxRequired: e.target.checked })}
        />
        Prescription required{rxForced ? ' (forced for H/H1)' : ''}
      </label>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Create medicine'}</Button>
      </div>
    </form>
  );
}

function CsvImport({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doImport = useMutation({
    mutationFn: () => apiPost<ImportResult>('/v1/admin/medicines/import', { csv }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Import failed'),
  });

  const sample =
    'name,brand,genericName,manufacturer,mrpInr,packSize,schedule,rxRequired\n' +
    'Saridon,Saridon,Paracetamol + Caffeine,Bayer,35,Strip of 10 tablets,NONE,false\n' +
    'Allegra 120,Allegra,Fexofenadine 120mg,Sanofi,220,Strip of 10 tablets,H1,true';

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Bulk import (CSV)</h2>
      <p className="mt-1 text-xs text-slate-400">
        Header row required. Columns: name, brand, genericName, manufacturer, mrpInr, packSize, schedule, rxRequired.
        Rows are upserted by name; Schedule X is rejected; bad rows are skipped and reported.
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={7}
        placeholder={sample}
        className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button loading={doImport.isPending} disabled={csv.trim().length === 0} onClick={() => doImport.mutate()}>
          Import
        </Button>
        <Button variant="ghost" onClick={() => setCsv(sample)}>Load sample</Button>
        <label className="cursor-pointer text-sm text-indigo-600 hover:underline">
          Upload .csv
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setCsv(await file.text());
            }}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-medium">
            {result.created} created · {result.updated} updated · {result.failed} failed of {result.totalRows} rows
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-600">
              {result.errors.map((err, i) => (
                <li key={i}>Row {err.row}: {err.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
