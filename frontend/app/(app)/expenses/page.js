'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, num, jDate } from '@/lib/format';
import { C } from '@/lib/ui';
import { EXPENSE_CATEGORIES, SHOP_PURSE } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';
import JDateField from '@/components/JDateField';

const EMPTY = {
  category: EXPENSE_CATEGORIES[0], desc: '', amount: '',
  paidBy: '', note: '', date: ''
};

export default function ExpensesPage() {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);

  const [d, setD] = useState(null);                  // { expenses, today, month, cats, owed }
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');                // '' = every category
  const [onlyOwed, setOnlyOwed] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/expenses').then(setD)
    .catch((e) => setError(e.message)).finally(() => setLoaded(true));

  useFocusTerm(setSearch);
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!d) return [];
    const q = search.trim().toLowerCase();
    return d.expenses.filter((e) => {
      if (cat && e.category !== cat) return false;
      if (onlyOwed && (e.reimbursed || e.paidBy === SHOP_PURSE)) return false;
      if (!q) return true;
      return [e.no, e.desc, e.category, e.paidBy, e.note]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [d, search, cat, onlyOwed]);

  // Categories actually used, so the filter never offers an empty one.
  const usedCats = useMemo(
    () => [...new Set((d?.expenses || []).map((e) => e.category))],
    [d]
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const path = form._id ? `/expenses/${form._id}` : '/expenses';
      await api(path, { method: form._id ? 'PUT' : 'POST', body: form });
      setNotice(form._id ? 'مصرف تغییر یافت.' : 'مصرف ثبت شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/expenses/${form._id}`, { method: 'DELETE' });
      setNotice('مصرف حذف شد و از صندوق هم برداشته شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function reimburse(e) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/expenses/${e._id}`, { method: 'PUT', body: { reimbursed: true } });
      setNotice(`پول «${e.paidBy}» بازپرداخت شد.`);
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  const biggest = d?.cats[0];

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !form && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-4 gap-b">
        <div className="card">
          <div className="stat-label">مصارف امروز</div>
          <div className="stat-value" style={{ color: d?.today.amount ? C.amber : C.green }}>
            {fmt(d?.today.amount || 0)}
          </div>
          <div className="stat-sub" style={{ color: C.muted }}>{num(d?.today.count || 0)} ثبت</div>
        </div>
        <div className="card">
          <div className="stat-label">مصارف ۳۰ روز</div>
          <div className="stat-value" style={{ color: C.brand }}>{fmt(d?.month.amount || 0)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>{num(d?.month.count || 0)} ثبت</div>
        </div>
        <div className="card">
          <div className="stat-label">باید بازپرداخت شود</div>
          <div className="stat-value" style={{ color: d?.owed ? C.redBright : C.green }}>{fmt(d?.owed || 0)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>
            {d?.owed ? `${num(d.owedCount)} مصرف از جیب شخصی` : 'کسی از جیب خود نداده'}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">بیشترین مصرف ۳۰ روز</div>
          <div className="stat-value" style={{ color: C.text, fontSize: 19 }}>
            {biggest ? biggest.name : '—'}
          </div>
          <div className="stat-sub tnum" style={{ color: C.muted }}>
            {biggest ? `${fmt(biggest.amount)} · ${biggest.pct}٪ مصارف` : 'هنوز مصرفی ثبت نشده'}
          </div>
        </div>
      </div>

      <div className="grid-table-side">
        <div className="table-wrap">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="card-title">مصارف دکان</div>
            <span className="card-note tnum">{num(rows.length)}</span>
            <div className="spacer"></div>

            <div className="segment segment-flat">
              <button onClick={() => setOnlyOwed(false)} className={!onlyOwed ? 'on' : ''}>همه</button>
              <button onClick={() => setOnlyOwed(true)} className={onlyOwed ? 'on' : ''}>
                بازپرداخت نشده{d?.owedCount ? ` (${d.owedCount})` : ''}
              </button>
            </div>

            <div className="inline-search" style={{ width: 190 }}>
              <Icon d={ICON.search} size={16} stroke={C.faint} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="شرح یا پرداخت‌کننده…" />
            </div>

            <button onClick={() => { setForm({ ...EMPTY }); setError(''); }} className="btn btn-primary btn-md">
              <Icon d={ICON.plus} size={16} width={2} />مصرف جدید
            </button>
          </div>

          {usedCats.length > 1 && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', padding: '0 20px 14px' }}>
              <button onClick={() => setCat('')} className={`chip${cat === '' ? ' on' : ''}`}>همه دسته‌ها</button>
              {usedCats.map((c) => (
                <button key={c} onClick={() => setCat(c)} className={`chip${cat === c ? ' on' : ''}`}>{c}</button>
              ))}
            </div>
          )}

          {loaded && (!d || d.expenses.length === 0) ? (
            <div className="empty">
              هنوز مصرفی ثبت نشده. کرایه، برق، معاش، ترانسپورت و هر خریداری برای دکان را اینجا
              ثبت کنید تا در مفاد خالص حساب شود.
            </div>
          ) : rows.length === 0 ? (
            <div className="empty">مصرفی با این مشخصات پیدا نشد.</div>
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>شماره</th><th>شرح</th><th>تاریخ</th><th>پرداخت‌کننده</th>
                    <th className="num">مبلغ</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const pending = !e.reimbursed && e.paidBy !== SHOP_PURSE;
                    return (
                      <tr key={e._id}>
                        <td className="semi tnum" style={{ color: C.brand }}>{e.no}</td>
                        <td>
                          <div className="ellipsis semi" style={{ maxWidth: 220 }}>{e.desc}</div>
                          <div className="ellipsis" style={{ fontSize: 11, color: C.faint }}>
                            {e.category}{e.note ? ` · ${e.note}` : ''}
                          </div>
                        </td>
                        <td className="tnum" style={{ color: C.muted, whiteSpace: 'nowrap' }}>{jDate(e.date)}</td>
                        <td>
                          <div className="ellipsis" style={{ maxWidth: 130 }}>{e.paidBy}</div>
                          {pending && <span className="pill pill-amber">بازپرداخت نشده</span>}
                        </td>
                        <td className="num strong" style={{ color: C.redBright }}>{fmt(e.amount)}</td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            {pending && (
                              <button onClick={() => reimburse(e)} disabled={busy} className="btn btn-soft btn-sm">
                                بازپرداخت
                              </button>
                            )}
                            <button onClick={() => { setForm({ ...e, date: e.date?.slice(0, 10) || '' }); setError(''); }}
                              className="btn btn-ghost btn-sm btn-icon" title="تغییر">
                              <Icon d={ICON.edit} size={15} stroke={C.muted} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>مصارف بر اساس دسته</div>
            <div className="card-note" style={{ marginBottom: 14 }}>۳۰ روز گذشته</div>

            {!d || d.cats.length === 0 ? (
              <div className="empty" style={{ padding: '28px 0' }}>در ۳۰ روز گذشته مصرفی ثبت نشده.</div>
            ) : (
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
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>این صفحه چطور کار می‌کند</div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 2 }}>
              هر مصرف همان روز در صندوق ثبت می‌شود و از مفاد خالص کم می‌گردد.
              <br />
              اگر یکی از کارمندان از جیب خود چیزی برای دکان خریده، نام او را در
              «پرداخت‌کننده» بنویسید — تا وقتی پولش را نگرفته، در فهرست بالا
              «بازپرداخت نشده» می‌ماند.
              <br />
              خرید اجناس دکان از تهیه‌کنندگان اینجا ثبت نمی‌شود؛ آن در
              «خرید و تهیه‌کنندگان» است و در قیمت تمام‌شد اجناس حساب می‌گردد.
            </div>
          </div>
        </div>
      </div>

      {form && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>{form._id ? `تغییر مصرف ${form.no}` : 'مصرف جدید'}</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-row">
                <div>
                  <div className="field-label">دستهٔ مصرف</div>
                  <select value={form.category} onChange={set('category')} className="field">
                    {[...new Set([...EXPENSE_CATEGORIES, form.category])].filter(Boolean).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="field-label">مبلغ</div>
                  <input value={form.amount} onChange={set('amount')} type="number" min="0"
                    placeholder="0" className="field tnum" />
                </div>
              </div>

              <div>
                <div className="field-label">شرح</div>
                <input value={form.desc} onChange={set('desc')}
                  placeholder="مثلاً: کرایه ماه سنبله، یا خرید جاروب و صابون" className="field" />
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">پرداخت‌کننده</div>
                  <input value={form.paidBy || ''} onChange={set('paidBy')}
                    placeholder={SHOP_PURSE} className="field" />
                </div>
                <div>
                  <div className="field-label">تاریخ (اختیاری)</div>
                  <JDateField value={form.date || ''} onChange={(iso) => setForm((f) => ({ ...f, date: iso }))} />
                </div>
              </div>

              <div>
                <div className="field-label">یادداشت</div>
                <input value={form.note || ''} onChange={set('note')}
                  placeholder="مثلاً: رسید دارد" className="field" />
              </div>

              <div style={{ fontSize: 11.5, color: C.faint }}>
                اگر کسی از جیب خود پرداخته، نام او را بنویسید تا بازپرداخت آن پیگیری شود؛
                خالی گذاشتن یعنی از {SHOP_PURSE} رفته است.
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              {form._id && (
                <button onClick={remove} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>
              )}
              <button onClick={() => setForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
