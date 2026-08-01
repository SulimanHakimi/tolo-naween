'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, num, jDate, clock, jRelative } from '@/lib/format';
import { C } from '@/lib/ui';
import { TOPUP_AMOUNTS, TOPUP_PAYMENTS } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';

const EMPTY_SALE = { phone: '', amount: '', customer: '', payment: 'نقد' };

export default function TopupPage() {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);

  const [d, setD] = useState(null);                  // { account, topups, today, month }
  const [loads, setLoads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [sale, setSale] = useState({ ...EMPTY_SALE });
  const [account, setAccount] = useState(null);      // the settings modal
  const [loadForm, setLoadForm] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [error, setError] = useState('');
  const [saleError, setSaleError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([api('/topup'), api('/topup/loads?limit=12')])
    .then(([data, l]) => { setD(data); setLoads(l); })
    .catch((e) => setError(e.message))
    .finally(() => setLoaded(true));

  useFocusTerm(setSearch);
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!d) return [];
    if (!q) return d.topups;
    return d.topups.filter((t) => [t.no, t.phone, t.customer]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [d, search]);

  const acc = d?.account;
  const rate = acc?.commissionPer1000 ?? 20;
  const preview = Math.round(((+sale.amount || 0) / 1000) * rate);
  const shortOfCredit = acc && +sale.amount > acc.balance;

  const setSaleField = (k) => (e) => setSale((s) => ({ ...s, [k]: e.target.value }));

  async function send() {
    if (busy) return;
    setBusy(true); setSaleError('');
    try {
      const t = await api('/topup', { method: 'POST', body: sale });
      setNotice(t.payment === 'قرض'
        ? `تاپ‌آپ ${t.no} فرستاده شد — ${fmt(t.amount)} به قرض «${t.customer}» اضافه شد. کمیشن: ${fmt(t.commission)}`
        : `تاپ‌آپ ${t.no} فرستاده شد — کمیشن شما: ${fmt(t.commission)}`);
      setSale({ ...EMPTY_SALE });
      load();
    } catch (e) { setSaleError(e.message); }
    setBusy(false);
  }

  async function saveAccount() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api('/topup/account', { method: 'PUT', body: account });
      setNotice('تنظیمات اعتبار ذخیره شد.');
      setAccount(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function takeCredit(paid) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await api('/topup/loads', {
        method: 'POST', body: { credit: loadForm.credit, cost: loadForm.cost, paid }
      });
      setNotice(paid
        ? `${fmt(r.credit)} اعتبار گرفته شد و ${fmt(r.cost)} پرداخت گردید.`
        : `${fmt(r.credit)} اعتبار گرفته شد — ${fmt(r.cost)} به قرضداری شما اضافه شد.`);
      setLoadForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function payProvider() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api('/topup/account/pay', { method: 'POST', body: { amount: +payFor.amount || 0 } });
      setNotice('پرداخت به شرکت ثبت شد.');
      setPayFor(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  // The credit form pre-fills the usual terms: face value less the commission.
  const suggestedCost = loadForm && +loadForm.credit
    ? Math.round(+loadForm.credit - (+loadForm.credit / 1000) * rate)
    : 0;

  if (!loaded) return <div className="empty">در حال بارگیری…</div>;
  if (!d) return <div className="banner banner-error">{error}</div>;

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !account && !loadForm && !payFor && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      {acc.balance <= 0 && (
        <div className="banner banner-error" style={{ marginBottom: 16 }}>
          اعتبار تمام شده — تا وقتی از «{acc.provider}» اعتبار نگیرید، تاپ‌آپ فرستاده نمی‌شود.
        </div>
      )}

      <div className="grid-4 gap-b">
        <div className="card">
          <div className="stat-label">اعتبار موجود</div>
          <div className="stat-value" style={{ color: acc.balance > 0 ? C.brand : C.redBright }}>{fmt(acc.balance)}</div>
          <div className="stat-sub ellipsis" style={{ color: C.muted }}>از {acc.provider}</div>
        </div>
        <div className="card">
          <div className="stat-label">تاپ‌آپ امروز</div>
          <div className="stat-value" style={{ color: C.text }}>{fmt(d.today.amount)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>{num(d.today.count)} تاپ‌آپ</div>
        </div>
        <div className="card">
          <div className="stat-label">کمیشن امروز</div>
          <div className="stat-value" style={{ color: C.green }}>{fmt(d.today.commission)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>۳۰ روز: {fmt(d.month.commission)}</div>
        </div>
        <div className="card">
          <div className="stat-label">قرضداری بابت اعتبار</div>
          <div className="stat-value" style={{ color: acc.owed ? C.redBright : C.green }}>{fmt(acc.owed)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>
            {acc.owed ? 'اعتباری که پولش را نداده‌اید' : 'همه تسویه است'}
          </div>
        </div>
      </div>

      <div className="grid-side-wide gap-b">
        <div className="card">
          <div className="row" style={{ gap: 9, marginBottom: 4 }}>
            <Icon d={ICON.mobile} size={19} stroke={C.brand} width={1.9} />
            <div className="card-title">فرستادن تاپ‌آپ</div>
          </div>
          <div className="card-note" style={{ marginBottom: 16 }}>
            به هر نمبر و هر شبکه — کمیشن {num(rate)} فی ۱۰۰۰
          </div>

          <div className="form-grid">
            <div>
              <div className="field-label">شماره موبایل</div>
              <input value={sale.phone} onChange={setSaleField('phone')} placeholder="07xx xxx xxx"
                className="field ltr tnum" inputMode="tel" style={{ height: 44 }} />
            </div>

            <div>
              <div className="field-label">مبلغ تاپ‌آپ</div>
              <input value={sale.amount} onChange={setSaleField('amount')} type="number" min="1"
                placeholder="0" className="field tnum" style={{ height: 44 }} />
              <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {TOPUP_AMOUNTS.map((a) => (
                  <button key={a} onClick={() => setSale((s) => ({ ...s, amount: String(a) }))}
                    className={`chip${+sale.amount === a ? ' on' : ''}`}>{a}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="field-label">طرز پرداخت</div>
              <div className="row" style={{ gap: 8 }}>
                {TOPUP_PAYMENTS.map((p) => (
                  <button key={p} onClick={() => setSale((s) => ({ ...s, payment: p }))}
                    className={`btn btn-md ${sale.payment === p ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="field-label">نام مشتری {sale.payment === 'قرض' ? '' : '(اختیاری)'}</div>
              <input value={sale.customer} onChange={setSaleField('customer')}
                placeholder={sale.payment === 'قرض' ? 'برای قرض لازم است' : 'مشتری نقدی'} className="field" />
            </div>

            <div className="row-between" style={{ marginTop: 4, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <span style={{ fontWeight: 700 }}>کمیشن این تاپ‌آپ</span>
              <span className="tnum" style={{ fontSize: 19, fontWeight: 800, color: C.green }}>{fmt(preview)}</span>
            </div>
            <div className="row-between" style={{ fontSize: 12, color: C.muted }}>
              <span>اعتبار بعد از این تاپ‌آپ</span>
              <span className="tnum">{fmt(Math.max(0, acc.balance - (+sale.amount || 0)))}</span>
            </div>

            {shortOfCredit && (
              <div className="banner banner-error">اعتبار کافی نیست — {fmt(acc.balance)} باقی است.</div>
            )}
            {saleError && <div className="banner banner-error">{saleError}</div>}

            <button onClick={send} disabled={busy || !+sale.amount || !sale.phone.trim() || shortOfCredit}
              className="btn btn-primary btn-block" style={{ height: 46 }}>
              {busy ? 'در حال ثبت…' : 'ثبت و فرستادن تاپ‌آپ'}
            </button>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head" style={{ padding: 0, border: 'none', marginBottom: 14 }}>
              <div className="card-title">حساب اعتبار</div>
              <div className="spacer"></div>
              <button onClick={() => { setAccount({ ...acc }); setError(''); }} className="btn btn-ghost btn-sm btn-icon" title="تنظیمات">
                <Icon d={ICON.edit} size={15} stroke={C.muted} />
              </button>
            </div>

            <div className="row-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: C.muted }}>تهیه‌کنندهٔ اعتبار</span>
              <span className="ellipsis semi" style={{ fontSize: 13.5 }}>{acc.provider}</span>
            </div>
            <div className="row-between" style={{ padding: '9px 0', fontSize: 13 }}>
              <span style={{ color: C.muted }}>کمیشن فی ۱۰۰۰</span>
              <span className="tnum semi" style={{ color: C.green }}>{num(rate)}</span>
            </div>
            <div className="row-between" style={{ fontSize: 13 }}>
              <span style={{ color: C.muted }}>شماره تماس</span>
              <span className="tnum ltr" style={{ color: C.muted }}>{acc.phone || '—'}</span>
            </div>

            <div className="stack-sm" style={{ marginTop: 16 }}>
              <button onClick={() => { setLoadForm({ credit: '', cost: '' }); setError(''); }}
                className="btn btn-primary btn-block btn-md">
                <Icon d={ICON.plus} size={16} width={2} />گرفتن اعتبار
              </button>
              {acc.owed > 0 && (
                <button onClick={() => { setPayFor({ amount: '' }); setError(''); }} className="btn btn-soft btn-block btn-md">
                  پرداخت قرضداری ({fmt(acc.owed)})
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <div className="card-head">
              <div className="card-title">اعتبارهای گرفته‌شده</div>
              <span className="card-note">آخرین خریدها</span>
            </div>
            {loads.length === 0 ? (
              <div className="empty" style={{ padding: '28px 16px' }}>هنوز اعتباری گرفته نشده.</div>
            ) : (
              <div style={{ padding: '4px 20px 14px' }}>
                {loads.map((l) => (
                  <div key={l._id} className="list-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>{l.no}</div>
                      <div style={{ fontSize: 10.5, color: l.paid ? C.muted : C.red }}>
                        {jRelative(l.date)} · {l.paid ? 'پرداخت شده' : 'قرض'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div className="tnum" style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>{fmt(l.credit)}</div>
                      <div className="tnum" style={{ fontSize: 10.5, color: C.green }}>به قیمت {fmt(l.cost)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="card-title">تاپ‌آپ‌های اخیر</div>
          <span className="card-note tnum">{num(rows.length)}</span>
          <div className="spacer"></div>
          <div className="inline-search" style={{ width: 210 }}>
            <Icon d={ICON.search} size={16} stroke={C.faint} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نمبر، شماره یا مشتری…" />
          </div>
        </div>

        {d.topups.length === 0 ? (
          <div className="empty">هنوز تاپ‌آپی فرستاده نشده.</div>
        ) : rows.length === 0 ? (
          <div className="empty">تاپ‌آپی با این مشخصات پیدا نشد.</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>شماره</th><th>نمبر موبایل</th><th>مشتری</th><th>تاریخ</th>
                  <th>پرداخت</th><th className="num">مبلغ</th><th className="num">کمیشن</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t._id}>
                    <td className="semi tnum" style={{ color: C.brand }}>{t.no}</td>
                    <td className="tnum ltr" style={{ color: C.muted }}>{t.phone}</td>
                    <td className="ellipsis" style={{ maxWidth: 170, color: C.muted }}>{t.customer}</td>
                    <td className="tnum" style={{ color: C.muted, whiteSpace: 'nowrap' }}>
                      {jDate(t.date)} · {clock(t.date)}
                    </td>
                    <td><span className={`pill ${t.payment === 'قرض' ? 'pill-amber' : 'pill-green'}`}>{t.payment}</span></td>
                    <td className="num semi">{fmt(t.amount)}</td>
                    <td className="num strong" style={{ color: C.green }}>{fmt(t.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {account && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>تنظیمات اعتبار</h2>
            <div className="modal-sub">
              اعتبار از یک شرکت گرفته می‌شود و از همان به هر نمبر و هر شبکه تاپ‌آپ می‌رود.
            </div>

            <div className="form-grid">
              <div>
                <div className="field-label">شرکت تهیه‌کنندهٔ اعتبار</div>
                <input value={account.provider} onChange={(e) => setAccount((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="نام شرکت یا نمایندگی" className="field" />
              </div>
              <div className="form-row">
                <div>
                  <div className="field-label">کمیشن فی ۱۰۰۰</div>
                  <input value={account.commissionPer1000} type="number" min="0"
                    onChange={(e) => setAccount((f) => ({ ...f, commissionPer1000: e.target.value }))}
                    className="field tnum" />
                </div>
                <div>
                  <div className="field-label">شماره تماس</div>
                  <input value={account.phone || ''} onChange={(e) => setAccount((f) => ({ ...f, phone: e.target.value }))}
                    className="field ltr" inputMode="tel" />
                </div>
              </div>

              <div style={{ fontSize: 11.5, color: C.faint }}>
                کمیشن تنها روی تاپ‌آپ‌های بعدی تطبیق می‌شود — فروش‌های گذشته با همان نرخ روز خود باقی می‌مانند.
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              <button onClick={() => setAccount(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={saveAccount} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}

      {loadForm && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>گرفتن اعتبار از {acc.provider}</h2>
            <div className="modal-sub tnum">
              اعتبار فعلی: {fmt(acc.balance)} · کمیشن {num(rate)} فی ۱۰۰۰
            </div>

            <div className="form-grid">
              <div>
                <div className="field-label">مقدار اعتباری که می‌گیرید</div>
                <input value={loadForm.credit} type="number" min="1" placeholder="مثلاً: 10000"
                  onChange={(e) => setLoadForm((f) => ({ ...f, credit: e.target.value }))}
                  className="field tnum" style={{ height: 44 }} />
              </div>
              <div>
                <div className="field-label">پولی که پرداخت می‌کنید</div>
                <input value={loadForm.cost} type="number" min="0"
                  placeholder={suggestedCost ? String(suggestedCost) : 'به‌صورت خودکار'}
                  onChange={(e) => setLoadForm((f) => ({ ...f, cost: e.target.value }))}
                  className="field tnum" />
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
                  خالی بگذارید تا به نرخ معمول شرکت حساب شود
                  {suggestedCost ? ` — ${fmt(suggestedCost)}` : ''}.
                </div>
              </div>
            </div>

            {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="stack-sm" style={{ marginTop: 18 }}>
              <button onClick={() => takeCredit(true)} disabled={busy || !+loadForm.credit}
                className="btn btn-primary btn-block" style={{ height: 46 }}>
                گرفتن اعتبار و پرداخت نقد
              </button>
              <button onClick={() => takeCredit(false)} disabled={busy || !+loadForm.credit}
                className="btn btn-ghost btn-block" style={{ height: 46 }}>
                گرفتن اعتبار، پرداخت بعداً (قرض)
              </button>
              <button onClick={() => setLoadForm(null)} className="btn btn-ghost btn-block" style={{ border: 'none', color: C.muted }}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {payFor && (
        <div className="overlay">
          <div className="modal modal-sm">
            <h2>پرداخت به {acc.provider}</h2>
            <div className="modal-sub tnum">قرضداری فعلی: {fmt(acc.owed)}</div>

            <div className="field-label">مبلغ پرداخت</div>
            <input value={payFor.amount} onChange={(e) => setPayFor((p) => ({ ...p, amount: e.target.value }))}
              type="number" min="0" max={acc.owed} placeholder={`تمام قرض (${Math.round(acc.owed)})`}
              className="field tnum" style={{ height: 44 }} />
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
              خالی بگذارید تا تمام قرضداری تسویه شود.
            </div>

            {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="modal-actions">
              <button onClick={() => setPayFor(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={payProvider} disabled={busy} className="btn btn-primary">{busy ? 'در حال ثبت…' : 'ثبت پرداخت'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
