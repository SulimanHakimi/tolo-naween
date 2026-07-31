'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { useApp, screenKeyFor, firstScreen } from '@/lib/store';

export default function AppLayout({ children }) {
  const { user, L, SUB, setAlertCount } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  const key = screenKeyFor(pathname);
  const allowed = !key || !!user?.perms?.[key];

  useEffect(() => {
    if (user === undefined) return;                  // session still loading
    if (!user) { router.replace('/'); return; }
    if (!allowed) router.replace(firstScreen(user));
  }, [user, allowed, router]);

  // Keeps the sidebar badge honest as stock moves, on whichever page you are.
  useEffect(() => {
    if (!user) return;
    const canSee = ['inv', 'dash', 'pur', 'price'].some((p) => user.perms?.[p]);
    if (!canSee) return;
    api('/products/alerts').then((r) => setAlertCount(r.count)).catch(() => {});
  }, [user, pathname, setAlertCount]);

  if (!user || !allowed) return null;

  return (
    <div className="app">
      <Sidebar />
      <div className="shell">
        <Topbar title={L[key] || 'طلوع ناوین'} sub={SUB[key] || ''} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
