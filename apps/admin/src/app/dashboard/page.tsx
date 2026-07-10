'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, session } from '@/lib/api';

interface AdminUser {
  name: string;
  email: string;
  role: string;
}

const UPCOMING = [
  ['Live orders board', 'Track and manually override every order (M2)'],
  ['Rx verification queue', 'Pharmacist approval for Schedule H/H1 orders (M2)'],
  ['Catalog & CSV import', 'Master medicine list and bulk upload (M2)'],
  ['Shops & inventory', 'Onboarding, licenses, on-behalf stock edits (M2)'],
  ['Riders & live map', 'Assignment and tracking (M2)'],
  ['Zones & fees', 'Delivery fee, min order, COD cap per zone (M2)'],
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    const u = session.user<AdminUser>();
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
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-indigo-700">MediLocal Admin</h1>
          <p className="text-sm text-slate-500">
            {user.name} · {user.role}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
