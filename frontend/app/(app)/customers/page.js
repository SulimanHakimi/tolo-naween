'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, num, jDate, clock } from '@/lib/format';
import { C, abbr } from '@/lib/ui';
import Icon, { ICON } from '@/components/icons';
import BillModal from '@/components/BillModal';

const EMPTY = { name: '', phone: '', note: '', credit: '' };

export default function CustomersPage() {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);

  const [customers, setCustomers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [form, setForm] = useState(null);
  const [settleFor, setSettleFor] = useState(null);
  const [history, setHistory] = useState(null);      // { customer, sales }
  const [bill, setBill] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/customers').then(setCustomers)
    .catch((e) => setError(e.message)).finally(() => setLoaded(true));

  useFocusTerm(setSearch);
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (onlyDebt && c.credit <= 0) return false;
      if (!q) return true;
      return [c.name, c.phone, c.note].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [customers, search, onlyDebt]);

  const totalCredit = customers.reduce((t, c) => t + c.credit, 0);
  const debtors = customers.filter((c) => c.credit > 0).length;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const path = form._id ? `/customers/${form._id}` : '/customers';
      await api(path, { method: form._id ? 'PUT' : 'POST', body: form });
      setNotice(form._id ? 'معلومات مشتری تغییر یافت.' : 'مشتری ثبت شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/customers/${form._id}`, { method: 'DELETE' });
      setNotice('مشتری حذف شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function settle() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const updated = await api(`/customers/${settleFor._id}/settle`, {
        method: 'POST', body: { amount: +settleFor.amount || 0 }
      });
      setNotice(updated.credit > 0
        ? `پرداخت ثبت شد — ${fmt(updated.credit)} قرض باقی است.`
        : 'قرض این مشتری کاملاً تسویه شد.');
      setSettleFor(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function openHistory(c) {
    setError('');
    setHistory({ customer: c, sales: null });
    try {
      const r = await api(`/sales?customer=${encodeURIComponent(c.name)}&limit=50`);
      setHistory({ customer: c, sales: r.sales });
    } catch (e) {
      setHistory({ customer: c, sales: [] });
      setError(e.message);
    }
  }

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !form && !settleFor && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-3 gap-b">
        <div className="card">
          <div className="stat-label">مجموع قرض مشتریان</div>
          <div className="stat-value" style={{ color: totalCredit ? C.redBright : C.green }}>{fmt(totalCredit)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>پولی که سوپرمارکت باید بگیرد</div>
        </div>
        <div className="card">
          <div className="stat-label">مشتریان قرضدار</div>
          <div className="stat-value" style={{ color: debtors ? C.amber : C.green }}>{num(debtors)} نفر</div>
          <div className="stat-sub" style={{ color: C.muted }}>
            {debtors ? `اوسط ${fmt(totalCredit / debtors)} هر نفر` : 'هیچ‌کس قرضدار نیست'}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">مشتریان ثبت‌شده</div>
          <div className="stat-value" style={{ color: C.brand }}>{num(customers.length)} نفر</div>
          <div className="stat-sub" style={{ color: C.muted }}>با اولین خرید ثبت می‌شوند</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="card-title">مشتریان و قرض‌ها</div>
          <span className="card-note tnum">{num(rows.length)}</span>
          <div className="spacer"></div>

          <div className="segment segment-flat">
            <button onClick={() => setOnlyDebt(false)} className={!onlyDebt ? 'on' : ''}>همه</button>
            <button onClick={() => setOnlyDebt(true)} className={onlyDebt ? 'on' : ''}>
              قرضداران{debtors ? ` (${debtors})` : ''}
            </button>
          </div>

          <div className="inline-search" style={{ width: 200 }}>
            <Icon d={ICON.search} size={16} stroke={C.faint} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام یا شماره…" />
          </div>

          <button onClick={() => { setForm({ ...EMPTY }); setError(''); }} className="btn btn-primary btn-md">
            <Icon d={ICON.plus} size={16} width={2} />مشتری جدید
          </button>
        </div>

        {loaded && customers.length === 0 ? (
          <div className="empty">
            هنوز مشتری ثبت نشده. مشتریان با اولین خرید نام‌دار به‌صورت خودکار ثبت می‌شوند، یا با{' '}
            <strong>مشتری جدید</strong> دستی اضافه کنید.
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">مشتری‌ای با این مشخصات پیدا نشد.</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>مشتری</th><th>شماره تماس</th><th>آخرین خرید</th>
                  <th className="num">مبلغ قرض</th><th>وضعیت</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="row" style={{ gap: 11 }}>
                        <div className="avatar" style={{ width: 38, height: 38 }}>{abbr(c.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="semi ellipsis">{c.name}</div>
                          {c.note && <div className="ellipsis" style={{ fontSize: 11, color: C.faint }}>{c.note}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="tnum ltr" style={{ color: C.muted }}>{c.phone || '—'}</td>
                    <td className="tnum" style={{ color: C.muted }}>{c.lastBuy ? jDate(c.lastBuy) : '—'}</td>
                    <td className="num strong" style={{ color: c.credit > 0 ? C.redBright : C.faint }}>
                      {c.credit > 0 ? fmt(c.credit) : '—'}
                    </td>
                    <td>
                      <span className={`pill ${c.credit > 0 ? 'pill-red' : 'pill-green'}`}>
                        {c.credit > 0 ? 'قرضدار' : 'نقدی'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {c.credit > 0 && (
                          <button onClick={() => { setSettleFor({ ...c, amount: '' }); setError(''); }} className="btn btn-soft btn-sm">تسویه</button>
                        )}
                        <button onClick={() => openHistory(c)} className="btn btn-ghost btn-sm">خریدها</button>
                        <button onClick={() => { setForm({ ...c, credit: '' }); setError(''); }} className="btn btn-ghost btn-sm btn-icon" title="تغییر">
                          <Icon d={ICON.edit} size={15} stroke={C.muted} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>{form._id ? 'تغییر معلومات مشتری' : 'مشتری جدید'}</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div><div className="field-label">نام مشتری</div>
                <input value={form.name} onChange={set('name')} placeholder="مثلاً: حاجی رسول (دکان)" className="field" /></div>
              <div><div className="field-label">شماره تماس</div>
                <input value={form.phone || ''} onChange={set('phone')} className="field ltr" inputMode="tel" /></div>
              <div><div className="field-label">یادداشت</div>
                <input value={form.note || ''} onChange={set('note')} placeholder="مثلاً: هر هفته عمده می‌گیرد" className="field" /></div>

              {!form._id && (
                <div>
                  <div className="field-label">قرض قدیمی (اختیاری)</div>
                  <input value={form.credit} onChange={set('credit')} type="number" min="0" placeholder="0" className="field tnum" />
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>
                    اگر این مشتری از دفتر قبلی قرض دارد، مبلغ آن را اینجا وارد کنید.
                  </div>
                </div>
              )}

              {error && <div className="banner banner-error">{error}</div>}
            </div>
            <div className="modal-actions">
              {form._id && <button onClick={remove} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>}
              <button onClick={() => setForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}

      {settleFor && (
        <div className="overlay">
          <div className="modal modal-sm">
            <h2>تسویهٔ قرض {settleFor.name}</h2>
            <div className="modal-sub tnum">قرض فعلی: {fmt(settleFor.credit)}</div>

            <div className="field-label">مبلغ دریافتی</div>
            <input value={settleFor.amount} onChange={(e) => setSettleFor((s) => ({ ...s, amount: e.target.value }))}
              type="number" min="0" max={settleFor.credit} placeholder={`تمام قرض (${Math.round(settleFor.credit)})`}
              className="field tnum" style={{ height: 44 }} />
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
              خالی بگذارید تا تمام قرض تسویه شود. پرداخت جزئی هم قبول است.
            </div>

            {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="modal-actions">
              <button onClick={() => setSettleFor(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={settle} disabled={busy} className="btn btn-primary">{busy ? 'در حال ثبت…' : 'ثبت دریافت'}</button>
            </div>
          </div>
        </div>
      )}

      {history && (
        <div className="overlay">
          <div className="modal modal-lg">
            <h2>خریدهای {history.customer.name}</h2>
            <div className="modal-sub">
              {history.customer.since ? `مشتری از ${jDate(history.customer.since)}` : 'تاریخ ثبت نامعلوم'}
            </div>

            {history.sales === null ? (
              <div className="empty">در حال بارگیری…</div>
            ) : history.sales.length === 0 ? (
              <div className="empty">برای این مشتری بلی ثبت نشده.</div>
            ) : (
              <div className="table-scroll">
                <table className="data narrow" style={{ minWidth: 460 }}>
                  <thead><tr><th>بل</th><th>تاریخ</th><th>اقلام</th><th>پرداخت</th><th className="num">مبلغ</th></tr></thead>
                  <tbody>
                    {history.sales.map((s) => (
                      <tr key={s._id} onClick={() => setBill(s)} style={{ cursor: 'pointer' }}>
                        <td className="semi tnum" style={{ color: C.brand }}>#{s.no}</td>
                        <td className="tnum" style={{ color: C.muted }}>{jDate(s.date)} · {clock(s.date)}</td>
                        <td className="tnum" style={{ color: C.muted }}>{s.items.length} قلم</td>
                        <td><span className={`pill ${s.payment === 'قرض' ? 'pill-amber' : 'pill-green'}`}>{s.payment}</span></td>
                        <td className="num semi">{fmt(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10 }}>روی هر بل کلیک کنید تا باز و چاپ شود.</div>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setHistory(null)} className="btn btn-ghost">بستن</button>
            </div>
          </div>
        </div>
      )}

      {bill && <BillModal sale={bill} onClose={() => setBill(null)} />}
    </>
  );
}
