'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { session } from '@/lib/api';

interface ShopUser {
  id: string;
  name: string;
  isPharmacist: boolean;
  shop: { id: string; name: string };
}

const NAV = [
  { href: '/orders', label: 'Orders' },
  { href: '/inventory', label: 'Stock & prices' },
] as const;

export function AppShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ShopUser | null>(null);

  useEffect(() => {
    const u = session.user<ShopUser>();
    if (!u || !session.token()) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-bold text-emerald-700">{user.shop.name}</h1>
            <p className="text-xs text-slate-400">
              {user.name}
              {user.isPharmacist ? ' · Pharmacist' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {right}
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
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-3 pb-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
