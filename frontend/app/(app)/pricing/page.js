'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt, num, jDate } from '@/lib/format';
import { C } from '@/lib/ui';
import { CATEGORIES } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';
import JDateField from '@/components/JDateField';

const EMPTY_DISCOUNT = { name: '', kind: 'percent', value: '', scope: 'all', target: '', from: '', to: '', active: true };
const SCOPES = [['all', 'تمام اجناس'], ['category', 'یک دسته'], ['product', 'یک جنس']];

export default function PricingPage() {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);

  const [products, setProducts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);            // { _id, retail, wholesale }
  const [form, setForm] = useState(null);            // discount form
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([api('/products'), api('/discounts')])
    .then(([p, d]) => { setProducts(p); setDiscounts(d); })
    .catch((e) => setError(e.message))
    .finally(() => setLoaded(true));

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => [p.name, p.category].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [products, search]);

  const margin = (buy, sell) => buy > 0 ? Math.round((sell - buy) / buy * 100) : 0;

  async function savePrice() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/products/${edit._id}`, {
        method: 'PUT',
        body: { retail: +edit.retail, wholesale: +edit.wholesale || 0 }
      });
      setNotice('قیمت تغییر یافت.');
      setEdit(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function saveDiscount() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const path = form._id ? `/discounts/${form._id}` : '/discounts';
      await api(path, { method: form._id ? 'PUT' : 'POST', body: form });
      setNotice(form._id ? 'تخفیف تغییر یافت.' : 'تخفیف جدید ایجاد شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function removeDiscount() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/discounts/${form._id}`, { method: 'DELETE' });
      setNotice('تخفیف حذف شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function toggle(d) {
    setError('');
    try {
      await api(`/discounts/${d._id}`, { method: 'PUT', body: { active: !d.active } });
      load();
    } catch (e) { setError(e.message); }
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const liveNow = (d) => {
    const now = Date.now();
    if (!d.active) return false;
    if (d.from && new Date(d.from).getTime() > now) return false;
    if (d.to && new Date(d.to).getTime() < now) return false;
    return true;
  };

  const describe = (d) => {
    const amount = d.kind === 'percent' ? `${d.value}٪` : fmt(d.value);
    const where = d.scope === 'all' ? 'تمام اجناس' : d.scope === 'category' ? `دستهٔ ${d.target}` : d.target;
    return `${amount} روی ${where}`;
  };

  const period = (d) => {
    if (!d.from && !d.to) return 'دایمی';
    if (d.from && d.to) return `${jDate(d.from)} تا ${jDate(d.to)}`;
    return d.from ? `از ${jDate(d.from)}` : `تا ${jDate(d.to)}`;
  };

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !form && !edit && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-table-side">
        <div className="table-wrap">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="card-title">قیمت‌گذاری اجناس (پرچون / عمده)</div>
            <div className="spacer"></div>
            <div className="inline-search" style={{ width: 200 }}>
              <Icon d={ICON.search} size={16} stroke={C.faint} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی جنس…" />
            </div>
          </div>

          <div style={{ padding: '10px 20px', background: '#F9FAFB', fontSize: 12, color: C.muted, borderBottom: '1px solid var(--border)' }}>
            قیمت عمده وقتی حساب می‌شود که تعداد یک قلم در بل به{' '}
            <b className="tnum">{settings.wholesaleMinQty}</b> یا بیشتر برسد.
          </div>

          {loaded && products.length === 0 ? (
            <div className="empty">هنوز جنسی ثبت نشده — از صفحهٔ <strong>موجودی و گدام</strong> شروع کنید.</div>
          ) : rows.length === 0 ? (
            <div className="empty">جنسی با این نام پیدا نشد.</div>
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>جنس</th><th className="num">خرید</th><th className="num">پرچون</th>
                    <th className="num">عمده</th><th className="num">مفاد پرچون</th><th className="num">مفاد عمده</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="semi">{p.name}</div>
                        <div style={{ fontSize: 11, color: C.faint }}>{p.category} · {p.unit}</div>
                      </td>
                      <td className="num" style={{ color: C.muted }}>{fmt(p.buy)}</td>
                      <td className="num semi">{fmt(p.retail)}</td>
                      <td className="num semi" style={{ color: p.wholesale ? C.brand : C.faint }}>
                        {p.wholesale ? fmt(p.wholesale) : '—'}
                      </td>
                      <td className="num semi" style={{ color: C.greenBright }}>+{margin(p.buy, p.retail)}٪</td>
                      <td className="num semi" style={{ color: p.wholesale ? C.green : C.faint }}>
                        {p.wholesale ? `+${margin(p.buy, p.wholesale)}٪` : '—'}
                      </td>
                      <td>
                        <button onClick={() => { setEdit({ _id: p._id, name: p.name, buy: p.buy, retail: String(p.retail), wholesale: p.wholesale ? String(p.wholesale) : '' }); setError(''); }}
                          className="btn btn-ghost btn-sm">تغییر قیمت</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <div className="card-head">
            <div className="card-title">تخفیفات</div>
            <span className="card-note tnum">{num(discounts.filter(liveNow).length)} فعال</span>
            <div className="spacer"></div>
            <button onClick={() => { setForm({ ...EMPTY_DISCOUNT }); setError(''); }} className="btn btn-primary btn-md">
              <Icon d={ICON.plus} size={16} width={2} />تخفیف جدید
            </button>
          </div>

          {loaded && discounts.length === 0 ? (
            <div className="empty">
              تخفیفی ثبت نشده. تخفیف‌ها به‌صورت خودکار در صندوق فروش روی قیمت اعمال می‌شوند.
            </div>
          ) : (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {discounts.map((d) => {
                const live = liveNow(d);
                return (
                  <div key={d._id} style={{
                    border: `1px solid ${live ? '#E7F0F7' : 'var(--border)'}`,
                    background: live ? '#F7FBFD' : '#FAFAFB',
                    borderRadius: 13, padding: 15, opacity: live ? 1 : 0.72
                  }}>
                    <div className="row-between" style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{d.name}</div>
                      <span className={`pill ${live ? 'pill-green' : 'pill-grey'}`}>
                        {!d.active ? 'غیرفعال' : live ? 'فعال' : 'خارج از تاریخ'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>{describe(d)}</div>
                    <div className="row-between">
                      <div className="tnum" style={{ fontSize: 11.5, color: C.faint }}>مدت: {period(d)}</div>
                      <div className="row" style={{ gap: 6 }}>
                        <button onClick={() => toggle(d)} className="btn btn-ghost btn-sm">
                          {d.active ? 'غیرفعال کن' : 'فعال کن'}
                        </button>
                        <button onClick={() => { setForm({ ...d, value: String(d.value), from: d.from ? String(d.from).slice(0, 10) : '', to: d.to ? String(d.to).slice(0, 10) : '' }); setError(''); }}
                          className="btn btn-ghost btn-sm btn-icon" title="تغییر">
                          <Icon d={ICON.edit} size={15} stroke={C.muted} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {edit && (
        <div className="overlay">
          <div className="modal modal-sm">
            <h2>تغییر قیمت</h2>
            <div className="modal-sub">{edit.name} — قیمت خرید {fmt(edit.buy)}</div>

            <div className="form-grid">
              <div>
                <div className="field-label">قیمت پرچون</div>
                <input value={edit.retail} onChange={(e) => setEdit((x) => ({ ...x, retail: e.target.value }))}
                  type="number" min="0" className="field tnum" style={{ height: 44 }} />
                <div style={{ fontSize: 11.5, color: C.greenBright, marginTop: 4 }}>
                  مفاد: {margin(edit.buy, +edit.retail || 0)}٪
                </div>
              </div>
              <div>
                <div className="field-label">قیمت عمده (اختیاری)</div>
                <input value={edit.wholesale} onChange={(e) => setEdit((x) => ({ ...x, wholesale: e.target.value }))}
                  type="number" min="0" placeholder="ندارد" className="field tnum" style={{ height: 44 }} />
                {+edit.wholesale > 0 && (
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 4 }}>
                    مفاد عمده: {margin(edit.buy, +edit.wholesale)}٪
                  </div>
                )}
              </div>
              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              <button onClick={() => setEdit(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={savePrice} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>{form._id ? 'تغییر تخفیف' : 'تخفیف جدید'}</h2>
            <div className="modal-sub">
              اگر چند تخفیف روی یک جنس بیفتد، صندوق تنها آن یکی را حساب می‌کند که بیشترین نفع را به مشتری می‌دهد.
            </div>

            <div className="form-grid">
              <div>
                <div className="field-label">نام تخفیف</div>
                <input value={form.name} onChange={setF('name')} placeholder="مثلاً: تخفیف عید" className="field" />
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">نوع</div>
                  <select value={form.kind} onChange={setF('kind')} className="field">
                    <option value="percent">فیصدی (٪)</option>
                    <option value="amount">مبلغ ثابت روی هر واحد</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">{form.kind === 'percent' ? 'فیصدی' : `مبلغ (${settings.currency})`}</div>
                  <input value={form.value} onChange={setF('value')} type="number" min="0"
                    max={form.kind === 'percent' ? 100 : undefined} className="field tnum" />
                </div>
              </div>

              <div>
                <div className="field-label">روی چه اجناسی</div>
                <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value, target: '' }))} className="field">
                  {SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {form.scope === 'category' && (
                <div>
                  <div className="field-label">دسته</div>
                  <input value={form.target} onChange={setF('target')} list="tn-disc-cats" className="field" />
                  <datalist id="tn-disc-cats">
                    {[...new Set([...products.map((p) => p.category), ...CATEGORIES])].map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              )}

              {form.scope === 'product' && (
                <div>
                  <div className="field-label">جنس</div>
                  <select value={form.target} onChange={setF('target')} className="field">
                    <option value="">— انتخاب کنید —</option>
                    {products.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div>
                  <div className="field-label">از تاریخ (خالی = فوراً)</div>
                  <JDateField value={form.from} onChange={(iso) => setForm((f) => ({ ...f, from: iso }))} />
                </div>
                <div>
                  <div className="field-label">تا تاریخ (خالی = دایمی)</div>
                  <JDateField value={form.to} onChange={(iso) => setForm((f) => ({ ...f, to: iso }))} />
                </div>
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              {form._id && <button onClick={removeDiscount} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>}
              <button onClick={() => setForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={saveDiscount} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
