'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt, jStamp } from '@/lib/format';
import Icon, { ICON } from './icons';

const KIND_LABEL = { product: 'جنس', customer: 'مشتری', sale: 'بل', supplier: 'تهیه‌کننده' };
const KIND_PATH = { product: '/inventory', customer: '/customers', sale: '/reports', supplier: '/purchasing' };

export default function Topbar({ title, sub, onMenu = () => {} }) {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  // On phones the search box is folded behind an icon — a permanently visible
  // full-width field cost a whole row of a 375px screen.
  const [searchOn, setSearchOn] = useState(false);
  const box = useRef(null);
  const field = useRef(null);

  // Debounced so a fast typist does not fire a request per keystroke.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setHits([]); return; }
    const timer = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(text)}`)
        .then((r) => { setHits(r.hits || []); setOpen(true); })
        .catch(() => setHits([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  function goTo(hit) {
    setOpen(false);
    setQ('');
    // The target page picks the term up and filters itself down to the match.
    sessionStorage.setItem('tn_focus', hit.label);
    router.push(KIND_PATH[hit.kind] || '/dashboard');
  }

  function startScan() {
    sessionStorage.setItem('tn_scan', '1');
    router.push('/pos');
  }

  return (
    <header className="topbar">
      {/* Shown under 1000px, where the sidebar has become a drawer. */}
      <button className="hamburger" onClick={onMenu} aria-label="باز کردن منو">
        <Icon d={ICON.menu} size={21} width={1.9} />
      </button>

      <div className="topbar-title">
        <h1 className="ellipsis">{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="spacer desktop-only"></div>

      {/* Toggles the folded search on phones; hidden on desktop where it is always open. */}
      <button className="search-toggle" aria-label="جستجو"
        onClick={() => { setSearchOn((v) => !v); setTimeout(() => field.current?.focus(), 0); }}>
        <Icon d={searchOn ? ICON.close : ICON.search} size={19} width={1.9} />
      </button>

      <div className={`topsearch${searchOn ? ' show' : ''}`} ref={box}>
        <Icon d={ICON.search} size={18} stroke="#9CA3AF" />
        <input ref={field} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)}
          placeholder="جستجوی جنس، مشتری، بل…" />

        {open && (
          <div className="search-pop">
            {hits.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--faint)' }}>چیزی پیدا نشد.</div>
            ) : hits.map((h) => (
              <button key={h.kind + h.id} className="search-row" onClick={() => goTo(h)}>
                <span className="search-kind">{KIND_LABEL[h.kind]}</span>
                <span style={{ flex: 1, fontWeight: 600 }} className="ellipsis">{h.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }} className="tnum">
                  {h.amount != null ? fmt(h.amount) : h.date ? jStamp(h.date) : h.note}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={startScan} className="btn btn-ghost desktop-only" title="کرسر را در خانهٔ اسکن بارکد صندوق می‌گذارد">
        <Icon d={ICON.barcode} size={17} />
        اسکن بارکد
      </button>
      <button onClick={() => router.push('/pos')} className="btn btn-primary" title="فروش جدید">
        <Icon d={ICON.plus} size={18} width={2} />
        <span className="btn-label">فروش جدید</span>
      </button>
    </header>
  );
}
