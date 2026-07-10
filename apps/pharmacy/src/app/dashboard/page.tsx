'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, session } from '@/lib/api';

interface ShopUser {
  name: string;
  isPharmacist: boolean;
  shop: { name: string };
}

const UPCOMING = [
  ['Incoming orders', 'New-order alert with sound; accept items one by one (M2)'],
  ['Rx checks', 'Approve or reject uploaded prescriptions (M2)'],
  ['My stock & prices', 'Mark items in/out of stock, set price up to MRP (M2)'],
  ['Settlements', 'Order payouts and commission statements (M3+)'],
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<ShopUser | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    const u = session.user<ShopUser>();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    apiGet<{ status: string }>('/health')
      .then((h) => setApiStatus(h.status === 'ok' ? 'ok' : 'down'))
      .catch(() => setApiStatus('down'));
  }, [router]);

  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-emerald-700">{user.shop.name}</h1>
          <p className="text-sm text-slate-500">
            {user.name}
            {user.isPharmacist ? ' · Registered pharmacist' : ''}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              apiStatus === 'ok'
                ? 'bg-emerald-100 text-emerald-700'
                : apiStatus === 'down'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            API {apiStatus === 'checking' ? '…' : apiStatus}
          </span>
          <button
            onClick={() => {
              session.clear();
              router.replace('/login');
            }}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {UPCOMING.map(([title, desc]) => (
          <div key={title} className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
