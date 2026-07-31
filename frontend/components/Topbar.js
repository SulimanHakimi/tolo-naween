'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt, jStamp } from '@/lib/format';
import Icon, { ICON } from './icons';

const KIND_LABEL = { product: 'جنس', customer: 'مشتری', sale: 'بل', supplier: 'تهیه‌کننده' };
const KIND_PATH = { product: '/inventory', customer: '/customers', sale: '/reports', supplier: '/purchasing' };

export default function Topbar({ title, sub }) {
  const { user, settings } = useApp();
  const fmt = makeFmt(settings.currency);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const canPos = !!user?.perms?.pos;

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
      <div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="spacer desktop-only"></div>

      <div className="topsearch" ref={box}>
        <Icon d={ICON.search} size={18} stroke="#9CA3AF" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)}
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

      {canPos && (
        <>
          <button onClick={startScan} className="btn btn-ghost desktop-only" title="کرسر را در خانهٔ اسکن بارکد صندوق می‌گذارد">
            <Icon d={ICON.barcode} size={17} />
            اسکن بارکد
          </button>
          <button onClick={() => router.push('/pos')} className="btn btn-primary">
            <Icon d={ICON.plus} size={18} width={2} />
            فروش جدید
          </button>
        </>
      )}
    </header>
  );
}
