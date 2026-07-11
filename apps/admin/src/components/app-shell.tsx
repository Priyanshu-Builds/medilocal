'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { session } from '@/lib/api';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const NAV = [
  { href: '/orders', label: 'Orders', icon: '📋' },
  { href: '/prescriptions', label: 'Rx queue', icon: '💊' },
  { href: '/catalog', label: 'Catalog', icon: '🗂️' },
  { href: '/shops', label: 'Shops', icon: '🏥' },
  { href: '/riders', label: 'Riders', icon: '🛵' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const u = session.user<AdminUser>();
    if (!u || !session.token()) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <div className="mb-6 px-2">
          <h1 className="text-lg font-bold text-indigo-700">MediLocal</h1>
          <p className="text-xs text-slate-400">Admin console</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="px-3 text-sm font-medium text-slate-700">{user.name}</p>
          <p className="px-3 text-xs text-slate-400">{user.role}</p>
          <button
            onClick={() => {
              session.clear();
              router.replace('/login');
            }}
            className="mt-2 px-3 text-xs text-slate-500 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
          <h1 className="font-bold text-indigo-700">MediLocal Admin</h1>
          <button
            onClick={() => {
              session.clear();
              router.replace('/login');
            }}
            className="text-xs text-slate-500"
          >
            Log out
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 bg-slate-50 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
