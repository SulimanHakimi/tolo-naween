'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt } from '@/lib/format';
import { C } from '@/lib/ui';

/**
 * Taking goods back off a bill. Quantities are checked here against what is left on
 * each line and again on the server, so the same item can never be refunded twice.
 * `onDone` is called with a message once the return is written.
 */
export default function ReturnModal({ sale, onClose, onDone }) {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);

  const [qty, setQty] = useState(() => Object.fromEntries(sale.items.map((i) => [i.name, ''])));
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => sale.items.reduce((t, i) => {
    const q = Math.floor(+qty[i.name]) || 0;
    return t + i.price * Math.min(q, i.qty - (i.returned || 0));
  }, 0), [sale, qty]);

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const items = sale.items
        .map((i) => ({ name: i.name, qty: Math.floor(+qty[i.name]) || 0 }))
        .filter((i) => i.qty > 0);
      if (!items.length) throw new Error('تعداد برگشتی را وارد کنید');

      await api(`/sales/${sale._id}/return`, { method: 'POST', body: { items, restock, reason } });
      onDone('برگشتی ثبت شد.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="overlay">
      <div className="modal modal-lg">
        <h2>برگشت جنس — بل #{sale.no}</h2>
        <div className="modal-sub">
          تعداد برگشتی هر قلم را وارد کنید. فقط تا آنچه در این بل فروخته شده قابل برگشت است.
        </div>

        <div className="form-grid">
          {sale.items.map((i) => {
            const left = i.qty - (i.returned || 0);
            return (
              <div key={i.name} className="row" style={{ gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellipsis semi" style={{ fontSize: 13 }}>{i.name}</div>
                  <div className="tnum" style={{ fontSize: 11, color: C.faint }}>
                    {fmt(i.price)} · فروخته {i.qty} {i.unit}
                    {i.returned ? ` · قبلاً ${i.returned} برگشت شده` : ''}
                  </div>
                </div>
                <input value={qty[i.name]} disabled={left <= 0}
                  onChange={(e) => setQty((f) => ({ ...f, [i.name]: e.target.value }))}
                  type="number" min="0" max={left} placeholder={left > 0 ? `تا ${left}` : 'برگشت شده'}
                  className="field tnum" style={{ width: 110 }} />
              </div>
            );
          })}

          <div>
            <div className="field-label">دلیل برگشت</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="مثلاً: خراب بود، مشتری پسند نکرد" className="field" />
          </div>

          <div className="row" style={{ gap: 10, marginTop: 4 }}>
            <button onClick={() => setRestock(true)}
              className={`btn btn-md ${restock ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
              قابل فروش — به گدام برگردد
            </button>
            <button onClick={() => setRestock(false)}
              className={`btn btn-md ${!restock ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
              خراب — ضرر ثبت شود
            </button>
          </div>

          <div className="row-between" style={{ marginTop: 8, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
            <span style={{ fontWeight: 700 }}>
              {sale.payment === 'قرض' ? 'از قرض مشتری کم می‌شود' : 'مبلغ برگشتی به مشتری'}
            </span>
            <span className="tnum" style={{ fontSize: 19, fontWeight: 800, color: C.redBright }}>{fmt(total)}</span>
          </div>

          {error && <div className="banner banner-error">{error}</div>}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-ghost">انصراف</button>
          <button onClick={submit} disabled={busy || total <= 0} className="btn btn-primary">
            {busy ? 'در حال ثبت…' : 'ثبت برگشتی'}
          </button>
        </div>
      </div>
    </div>
  );
}
