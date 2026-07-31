'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { useApp, screenKeyFor } from '@/lib/store';

export default function AppLayout({ children }) {
  const { user, L, SUB, setAlertCount } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const key = screenKeyFor(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user === undefined) return;                  // session still loading
    if (!user) router.replace('/');
  }, [user, router]);

  // Keeps the sidebar badge honest as stock moves, on whichever page you are.
  useEffect(() => {
    if (!user) return;
    api('/products/alerts').then((r) => setAlertCount(r.count)).catch(() => { });
  }, [user, pathname, setAlertCount]);

  // Navigating away closes the drawer, so tapping a nav item does not leave it
  // sitting open over the page that just loaded.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Escape closes it, and the page behind it must not scroll while it is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('drawer-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('drawer-open');
    };
  }, [menuOpen]);

  if (!user) return null;

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* Sits between the page and the drawer; tapping it dismisses. */}
      <button className={`scrim${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}
        aria-label="بستن منو" tabIndex={menuOpen ? 0 : -1} />
      <div className="shell">
        <Topbar title={L[key] || 'طلوع نوین'} sub={SUB[key] || ''} onMenu={() => setMenuOpen(true)} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
