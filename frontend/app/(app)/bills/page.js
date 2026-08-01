'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, num, jDate, clock } from '@/lib/format';
import { C } from '@/lib/ui';
import { PAYMENTS } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';
import JDateField from '@/components/JDateField';
import BillModal from '@/components/BillModal';
import ReturnModal from '@/components/ReturnModal';

const PAY_PILL = { 'نقد': 'pill-green', 'کارت': 'pill-blue', 'موبایل': 'pill-blue', 'قرض': 'pill-amber' };
const PER_PAGE = 50;

// Whole-day ISO stamps, so the quick ranges line up with the calendar rather than
// with the clock at the moment the button was pressed.
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const daysAgo = (n) => {
  const t = new Date();
  return iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n));
};

const RANGES = [
  ['همه', () => ({ from: '', to: '' })],
  ['امروز', () => ({ from: daysAgo(0), to: daysAgo(0) })],
  ['۷ روز', () => ({ from: daysAgo(6), to: '' })],
  ['۳۰ روز', () => ({ from: daysAgo(29), to: '' })]
];

export default function BillsPage() {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);

  const [d, setD] = useState(null);                  // { sales, total, pages, sum, profit, units }
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [payment, setPayment] = useState('');        // '' = every payment type
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [bill, setBill] = useState(null);
  const [returnFor, setReturnFor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useFocusTerm(setQ);

  const load = useCallback(() => {
    const p = new URLSearchParams({ limit: String(PER_PAGE), page: String(page) });
    if (q.trim()) p.set('q', q.trim());
    if (payment) p.set('payment', payment);
    if (from) p.set('from', from);
    if (to) p.set('to', to);

    setLoading(true);
    return api(`/sales?${p}`).then(setD).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [q, payment, from, to, page]);

  // Debounced: typing a bill number should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);

  // Any change to the filter puts the list back on the first page, or a narrow filter
  // would land on a page that no longer exists.
  useEffect(() => { setPage(1); }, [q, payment, from, to]);

  const setRange = (make) => {
    const r = make();
    setFrom(r.from); setTo(r.to);
  };
  const activeRange = RANGES.find(([, make]) => {
    const r = make();
    return r.from === from && r.to === to;
  });

  const filtered = !!(q.trim() || payment || from || to);

  function afterReturn(message) {
    setNotice(message);
    setReturnFor(null);
    load();
  }

  const returnable = (s) => s.items.some((i) => i.qty - (i.returned || 0) > 0);

  if (error && !d) return <div className="banner banner-error">{error}</div>;

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="grid-4 gap-b">
        <div className="card">
          <div className="stat-label">{filtered ? 'بل‌های این فهرست' : 'مجموع بل‌ها'}</div>
          <div className="stat-value" style={{ color: C.brand }}>{num(d?.total || 0)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>
            {filtered ? 'با فلتر فعلی' : 'از اول تا حال'}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">مجموع فروش</div>
          <div className="stat-value" style={{ color: C.text }}>{fmt(d?.sum || 0)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>{num(d?.units || 0)} قلم فروخته شده</div>
        </div>
        <div className="card">
          <div className="stat-label">مفاد این بل‌ها</div>
          <div className="stat-value" style={{ color: (d?.profit || 0) >= 0 ? C.green : C.red }}>{fmt(d?.profit || 0)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>بدون کسر مصارف دکان</div>
        </div>
        <div className="card">
          <div className="stat-label">اوسط هر بل</div>
          <div className="stat-value" style={{ color: C.text }}>{fmt(d?.total ? d.sum / d.total : 0)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>در همین فهرست</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="card-title">بل‌های فروش</div>
          <span className="card-note">برای دیدن و چاپ روی بل کلیک کنید</span>
          <div className="spacer"></div>

          <div className="segment segment-flat">
            <button onClick={() => setPayment('')} className={payment === '' ? 'on' : ''}>همه</button>
            {PAYMENTS.map((p) => (
              <button key={p} onClick={() => setPayment(p)} className={payment === p ? 'on' : ''}>{p}</button>
            ))}
          </div>

          <div className="inline-search" style={{ width: 210 }}>
            <Icon d={ICON.search} size={16} stroke={C.faint} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شماره بل، مشتری یا فروشنده…" />
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', padding: '0 20px 16px' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {RANGES.map(([label, make]) => (
              <button key={label} onClick={() => setRange(make)}
                className={`chip${activeRange?.[0] === label ? ' on' : ''}`}>{label}</button>
            ))}
          </div>
          <div style={{ width: 150 }}>
            <div className="field-label">از تاریخ</div>
            <JDateField value={from} onChange={setFrom} />
          </div>
          <div style={{ width: 150 }}>
            <div className="field-label">تا تاریخ</div>
            <JDateField value={to} onChange={setTo} />
          </div>
        </div>

        {loading && !d ? (
          <div className="empty">در حال بارگیری…</div>
        ) : d?.sales.length === 0 ? (
          <div className="empty">
            {filtered
              ? 'بلی با این مشخصات پیدا نشد — فلتر را تغییر دهید.'
              : 'هنوز بلی ثبت نشده. از «صندوق فروش» شروع کنید.'}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>بل</th><th>مشتری</th><th>تاریخ</th><th>اقلام</th>
                    <th>فروشنده</th><th>پرداخت</th><th className="num">مبلغ</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {d.sales.map((s) => (
                    <tr key={s._id}>
                      <td onClick={() => setBill(s)} className="semi tnum" style={{ color: C.brand, cursor: 'pointer' }}>#{s.no}</td>
                      <td onClick={() => setBill(s)} style={{ cursor: 'pointer' }}>
                        <div className="ellipsis" style={{ maxWidth: 170 }}>{s.customer}</div>
                        {s.phone && <div className="tnum ltr" style={{ fontSize: 11, color: C.faint }}>{s.phone}</div>}
                      </td>
                      <td className="tnum" style={{ color: C.muted, whiteSpace: 'nowrap' }}>
                        {jDate(s.date)} · {clock(s.date)}
                      </td>
                      <td className="tnum" style={{ color: C.muted }}>{s.items.length} قلم</td>
                      <td className="ellipsis" style={{ maxWidth: 120, color: C.muted }}>{s.servedBy || '—'}</td>
                      <td><span className={`pill ${PAY_PILL[s.payment] || 'pill-grey'}`}>{s.payment}</span></td>
                      <td className="num strong">{fmt(s.total)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button onClick={() => setBill(s)} className="btn btn-ghost btn-sm btn-icon" title="دیدن و چاپ بل">
                            <Icon d={ICON.print} size={15} stroke={C.muted} />
                          </button>
                          {returnable(s) && (
                            <button onClick={() => setReturnFor(s)} className="btn btn-ghost btn-sm" title="برگشت جنس">
                              <Icon d={ICON.undo} size={14} stroke={C.muted} />برگشت
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {d.pages > 1 && (
              <div className="row-between" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                <span className="tnum" style={{ fontSize: 12.5, color: C.muted }}>
                  صفحهٔ {num(d.page)} از {num(d.pages)} · {num(d.total)} بل
                </span>
                <div className="row" style={{ gap: 8 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={d.page <= 1 || loading}
                    className="btn btn-ghost btn-md">جدیدتر</button>
                  <button onClick={() => setPage((p) => Math.min(d.pages, p + 1))} disabled={d.page >= d.pages || loading}
                    className="btn btn-ghost btn-md">قدیمی‌تر</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {bill && <BillModal sale={bill} onClose={() => setBill(null)} />}
      {returnFor && (
        <ReturnModal sale={returnFor} onClose={() => setReturnFor(null)} onDone={afterReturn} />
      )}
    </>
  );
}
