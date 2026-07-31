'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, fmtK, num, jDate, clock, jRelative } from '@/lib/format';
import { C } from '@/lib/ui';
import Icon, { ICON } from '@/components/icons';
import BillModal from '@/components/BillModal';
import ReportModal from '@/components/ReportModal';

const PERIODS = [['daily', 'روزانه'], ['weekly', 'هفته‌وار'], ['monthly', 'ماهوار']];
const PRINTS = [['sales', 'راپور فروش'], ['pl', 'مفاد و ضرر'], ['stock', 'راپور گدام']];

export default function ReportsPage() {
  const { settings, user } = useApp();
  const fmt = makeFmt(settings.currency);

  const [period, setPeriod] = useState('daily');
  const [d, setD] = useState(null);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [cash, setCash] = useState(null);
  const [bill, setBill] = useState(null);
  const [billSearch, setBillSearch] = useState('');
  const [printing, setPrinting] = useState(null);
  const [returnFor, setReturnFor] = useState(null);   // { sale, qty: {name: n}, restock, reason }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPeriod = (p) => api(`/reports?period=${p}`).then(setD).catch((e) => setError(e.message));

  const loadLists = () => Promise.all([api('/sales?limit=60'), api('/returns?limit=40'), api('/transactions')])
    .then(([s, r, t]) => { setSales(s); setReturns(r); setCash(t); })
    .catch((e) => setError(e.message));

  useFocusTerm(setBillSearch);
  useEffect(() => { loadPeriod(period); }, [period]);
  useEffect(() => { loadLists(); }, []);

  const visibleSales = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => [s.no, s.customer, s.phone].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [sales, billSearch]);

  const returnable = (s) => s.items.some((i) => i.qty - (i.returned || 0) > 0);

  function openReturn(sale) {
    setError('');
    setReturnFor({
      sale,
      qty: Object.fromEntries(sale.items.map((i) => [i.name, ''])),
      restock: true,
      reason: ''
    });
  }

  const returnTotal = useMemo(() => {
    if (!returnFor) return 0;
    return returnFor.sale.items.reduce((t, i) => {
      const q = Math.floor(+returnFor.qty[i.name]) || 0;
      return t + i.price * Math.min(q, i.qty - (i.returned || 0));
    }, 0);
  }, [returnFor]);

  async function submitReturn() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const items = returnFor.sale.items
        .map((i) => ({ name: i.name, qty: Math.floor(+returnFor.qty[i.name]) || 0 }))
        .filter((i) => i.qty > 0);
      if (!items.length) throw new Error('تعداد برگشتی را وارد کنید');

      await api(`/sales/${returnFor.sale._id}/return`, {
        method: 'POST',
        body: { items, restock: returnFor.restock, reason: returnFor.reason }
      });
      setNotice('برگشتی ثبت شد.');
      setReturnFor(null);
      loadPeriod(period);
      loadLists();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (error && !d) return <div className="banner banner-error">{error}</div>;
  if (!d) return <div className="empty">در حال بارگیری…</div>;

  const delta = (v, suffix = '٪') => {
    if (v == null) return { text: 'مقایسه‌ای نیست', color: C.muted };
    return { text: (v >= 0 ? '+' : '') + v + suffix, color: v >= 0 ? C.green : C.red };
  };

  const kpis = [
    { label: 'فروش کل', value: fmt(d.rev), color: C.brand, d: delta(d.revDelta), note: 'نسبت به دورهٔ قبل' },
    { label: 'مفاد خالص', value: fmt(d.netProfit), color: d.netProfit >= 0 ? C.green : C.red, d: { text: `حاشیهٔ مفاد ${d.margin}٪`, color: C.muted } },
    { label: 'اجناس فروخته‌شده', value: num(d.units) + ' قلم', color: C.text, d: { text: `در ${num(d.bills)} بل`, color: C.muted } },
    { label: 'برگشتی / ضرر', value: fmt(d.returns), color: d.returns ? C.redBright : C.faint, d: { text: `${num(d.returnUnits)} قلم در ${num(d.returnCount)} برگشتی`, color: C.muted } }
  ];

  // Bars are drawn against revenue so the largest slice fills the track.
  const plRows = [
    { label: 'فروش کل', value: d.rev, color: C.brand },
    { label: 'قیمت تمام‌شد اجناس', value: d.cogs, color: C.faint },
    { label: 'تخفیفات داده‌شده', value: d.discounts, color: C.amberBright },
    { label: 'ضرر برگشتی‌ها', value: d.returnLoss, color: C.redBright },
    { label: 'مصارف', value: d.otherExpenses, color: C.amber },
    { label: 'مفاد خالص', value: d.netProfit, color: C.greenBright }
  ];
  const plMax = Math.max(...plRows.map((r) => Math.abs(r.value)), 1);
  const peak = Math.max(...d.bars.map((b) => b.value), 1);

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="row-between gap-b" style={{ flexWrap: 'wrap' }}>
        <div className="segment">
          {PERIODS.map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)} className={period === k ? 'on' : ''}>{label}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {PRINTS.map(([t, label]) => (
            <button key={t} onClick={() => setPrinting(t)} className="btn btn-ghost btn-md">
              <Icon d={ICON.print} size={16} stroke={C.muted} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-4 gap-b">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="stat-label">{k.label}</div>
            <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
            <div className="stat-sub" style={{ color: k.d.color }}>{k.d.text}</div>
          </div>
        ))}
      </div>

      <div className="card gap-b">
        <div className="row-between" style={{ marginBottom: 22 }}>
          <div>
            <div className="card-title">روند فروش</div>
            <div className="card-note" style={{ marginTop: 2 }}>{d.range} · مجموع {fmt(d.rev)}</div>
          </div>
        </div>
        {d.bars.every((b) => b.value === 0) ? (
          <div className="empty" style={{ padding: '48px 0' }}>در این دوره فروشی ثبت نشده.</div>
        ) : (
          <div className="bars">
            {d.bars.map((b, i) => (
              <div key={i} className="bar-col">
                <div className="bar-cap">{b.value ? fmtK(b.value) : '—'}</div>
                <div className={`bar${b.value === peak && b.value > 0 ? ' peak' : ''}`}
                  style={{ height: `${Math.max(2, (b.value / peak) * 100)}%` }}></div>
                <div className="bar-lab">{b.day}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2 gap-b">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>مفاد و ضرر — {d.range}</div>
          <div className="stack" style={{ gap: 14 }}>
            {plRows.map((r) => (
              <div key={r.label}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</span>
                  <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{fmt(r.value)}</span>
                </div>
                <div className="meter">
                  <div style={{ width: `${Math.min(100, (Math.abs(r.value) / plMax) * 100)}%`, background: r.color }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="row-between" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--line)', fontSize: 12.5, color: C.muted }}>
            <span>باید بگیریم: <b className="tnum" style={{ color: C.redBright }}>{fmt(d.receivable)}</b></span>
            <span>باید بدهیم: <b className="tnum" style={{ color: C.amber }}>{fmt(d.payable)}</b></span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>پرفروش‌ترین اجناس</div>
            {d.top.length === 0 ? (
              <div className="empty" style={{ padding: '24px 0' }}>در این دوره فروشی نبوده.</div>
            ) : d.top.map((t) => (
              <div key={t.name} className="row" style={{ gap: 11, padding: '8px 0', borderBottom: '1px solid #F7F8FA' }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: C.greenSoft, color: C.green, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.rank}
                </span>
                <span className="ellipsis" style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{num(t.units)}</span>
                <span className="tnum" style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap' }}>{fmt(t.rev)}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>کم‌فروش‌ترین اجناس</div>
            <div className="card-note" style={{ marginBottom: 12 }}>سرمایه‌ای که خوابیده است</div>
            {d.slow.length === 0 ? (
              <div className="empty" style={{ padding: '24px 0' }}>همه اجناس در این دوره فروش داشته‌اند.</div>
            ) : d.slow.map((b) => (
              <div key={b.name} className="row" style={{ gap: 11, padding: '8px 0', borderBottom: '1px solid #F7F8FA' }}>
                <span className="dot" style={{ background: b.units === 0 ? C.redBright : C.amberBright }}></span>
                <span className="ellipsis" style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{b.name}</span>
                <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap' }}>
                  {b.units === 0 ? 'بدون فروش' : `${num(b.units)} فروش`}
                </span>
                {b.tied > 0 && (
                  <span className="tnum" style={{ fontSize: 11.5, color: C.red, whiteSpace: 'nowrap' }}>{fmt(b.tied)}</span>
                )}
              </div>
            ))}
          </div>

          {d.cats.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>فروش بر اساس دسته</div>
              <div className="stack" style={{ gap: 12 }}>
                {d.cats.map((c) => (
                  <div key={c.name}>
                    <div className="row-between" style={{ marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5 }}>{c.name}</span>
                      <span className="tnum" style={{ fontSize: 12, color: C.muted }}>{fmt(c.amount)} · {c.pct}٪</span>
                    </div>
                    <div className="meter"><div style={{ width: `${c.pct}%` }}></div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-table-side">
        <div className="table-wrap">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="card-title">بل‌های اخیر</div>
            <span className="card-note">برای چاپ روی بل کلیک کنید</span>
            <div className="spacer"></div>
            <div className="inline-search" style={{ width: 190 }}>
              <Icon d={ICON.search} size={16} stroke={C.faint} />
              <input value={billSearch} onChange={(e) => setBillSearch(e.target.value)} placeholder="شماره بل یا مشتری…" />
            </div>
          </div>
          {sales.length === 0 ? (
            <div className="empty">هنوز بلی ثبت نشده.</div>
          ) : visibleSales.length === 0 ? (
            <div className="empty">بلی با این مشخصات پیدا نشد.</div>
          ) : (
            <div className="table-scroll">
              <table className="data narrow">
                <thead>
                  <tr><th>بل</th><th>مشتری</th><th>تاریخ</th><th>پرداخت</th><th className="num">مبلغ</th><th></th></tr>
                </thead>
                <tbody>
                  {visibleSales.map((s) => (
                    <tr key={s._id}>
                      <td onClick={() => setBill(s)} className="semi tnum" style={{ color: C.brand, cursor: 'pointer' }}>#{s.no}</td>
                      <td onClick={() => setBill(s)} className="ellipsis" style={{ cursor: 'pointer', maxWidth: 160 }}>{s.customer}</td>
                      <td className="tnum" style={{ color: C.muted, whiteSpace: 'nowrap' }}>{jDate(s.date)} · {clock(s.date)}</td>
                      <td><span className={`pill ${s.payment === 'قرض' ? 'pill-amber' : 'pill-green'}`}>{s.payment}</span></td>
                      <td className="num semi">{fmt(s.total)}</td>
                      <td>
                        {returnable(s) && (
                          <button onClick={() => openReturn(s)} className="btn btn-ghost btn-sm" title="برگشت جنس">
                            <Icon d={ICON.undo} size={14} stroke={C.muted} />برگشت
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="stack">
          {cash && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>صندوق</div>
              <div className="row-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: C.muted }}>موجودی نقده</span>
                <span className="tnum" style={{ fontSize: 18, fontWeight: 800, color: cash.cash >= 0 ? C.brand : C.red }}>{fmt(cash.cash)}</span>
              </div>
              <div className="row-between" style={{ padding: '9px 0', fontSize: 13 }}>
                <span style={{ color: C.muted }}>درآمد ۳۰ روز</span>
                <span className="tnum semi" style={{ color: C.green }}>{fmt(cash.income30)}</span>
              </div>
              <div className="row-between" style={{ fontSize: 13 }}>
                <span style={{ color: C.muted }}>مصرف ۳۰ روز</span>
                <span className="tnum semi" style={{ color: C.red }}>{fmt(cash.expense30)}</span>
              </div>

              <div className="card-title" style={{ fontSize: 13, marginTop: 18, marginBottom: 6 }}>آخرین ثبت‌ها</div>
              {cash.transactions.slice(0, 8).map((t) => (
                <div key={t._id} className="row" style={{ gap: 9, padding: '7px 0', borderBottom: '1px solid #F7F8FA' }}>
                  <span className="dot" style={{ background: t.type === 'درآمد' ? C.greenBright : C.redBright }}></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 12.5 }}>{t.desc}</div>
                    <div style={{ fontSize: 10.5, color: C.faint }}>{jRelative(t.t)}</div>
                  </div>
                  <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: t.type === 'درآمد' ? C.green : C.red, whiteSpace: 'nowrap' }}>
                    {t.type === 'درآمد' ? '+' : '−'} {fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="table-wrap">
            <div className="card-head"><div className="card-title">برگشتی‌ها</div></div>
            {returns.length === 0 ? (
              <div className="empty" style={{ padding: '28px 16px' }}>برگشتی ثبت نشده.</div>
            ) : (
              <div style={{ padding: '4px 20px 14px' }}>
                {returns.map((r) => (
                  <div key={r._id} className="list-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>{r.rn} · بل #{r.sale}</div>
                      <div className="ellipsis" style={{ fontSize: 11, color: C.faint }}>
                        {r.items.map((i) => `${i.name} ×${i.qty}`).join('، ')}
                      </div>
                      <div style={{ fontSize: 10.5, color: r.restocked ? C.muted : C.red }}>
                        {jRelative(r.date)} · {r.restocked ? 'به گدام برگشت' : 'قابل فروش نبود'}
                      </div>
                    </div>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: C.redBright }}>{fmt(r.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {bill && <BillModal sale={bill} onClose={() => setBill(null)} />}
      {printing && <ReportModal type={printing} period={period} onClose={() => setPrinting(null)} />}

      {returnFor && (
        <div className="overlay">
          <div className="modal modal-lg">
            <h2>برگشت جنس — بل #{returnFor.sale.no}</h2>
            <div className="modal-sub">
              تعداد برگشتی هر قلم را وارد کنید. فقط تا آنچه در این بل فروخته شده قابل برگشت است.
            </div>

            <div className="form-grid">
              {returnFor.sale.items.map((i) => {
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
                    <input value={returnFor.qty[i.name]} disabled={left <= 0}
                      onChange={(e) => setReturnFor((f) => ({ ...f, qty: { ...f.qty, [i.name]: e.target.value } }))}
                      type="number" min="0" max={left} placeholder={left > 0 ? `تا ${left}` : 'برگشت شده'}
                      className="field tnum" style={{ width: 110 }} />
                  </div>
                );
              })}

              <div>
                <div className="field-label">دلیل برگشت</div>
                <input value={returnFor.reason} onChange={(e) => setReturnFor((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="مثلاً: خراب بود، مشتری پسند نکرد" className="field" />
              </div>

              <div className="row" style={{ gap: 10, marginTop: 4 }}>
                <button onClick={() => setReturnFor((f) => ({ ...f, restock: true }))}
                  className={`btn btn-md ${returnFor.restock ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
                  قابل فروش — به گدام برگردد
                </button>
                <button onClick={() => setReturnFor((f) => ({ ...f, restock: false }))}
                  className={`btn btn-md ${!returnFor.restock ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
                  خراب — ضرر ثبت شود
                </button>
              </div>

              <div className="row-between" style={{ marginTop: 8, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                <span style={{ fontWeight: 700 }}>
                  {returnFor.sale.payment === 'قرض' ? 'از قرض مشتری کم می‌شود' : 'مبلغ برگشتی به مشتری'}
                </span>
                <span className="tnum" style={{ fontSize: 19, fontWeight: 800, color: C.redBright }}>{fmt(returnTotal)}</span>
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              <button onClick={() => setReturnFor(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={submitReturn} disabled={busy || returnTotal <= 0} className="btn btn-primary">
                {busy ? 'در حال ثبت…' : 'ثبت برگشتی'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
