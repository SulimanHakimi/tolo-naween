'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, num, jDate, daysTo } from '@/lib/format';
import { C, stockStatus, needsAttention } from '@/lib/ui';
import { CATEGORIES, UNITS } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';
import JDateField from '@/components/JDateField';

const EMPTY = {
  name: '', category: CATEGORIES[0], unit: UNITS[0], supplier: '',
  barcode: '', buy: '', retail: '', wholesale: '', stock: '', expiry: ''
};

const FILTERS = [
  { key: 'all', label: 'همه' },
  { key: 'attention', label: 'نیازمند توجه' },
  { key: 'out', label: 'تمام شده' },
  { key: 'low', label: 'کم شده' },
  { key: 'exp', label: 'نزدیک انقضا' }
];

export default function InventoryPage() {
  const { settings, user, setAlertCount } = useApp();
  const fmt = makeFmt(settings.currency);
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null);            // null = closed; has _id = editing
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => api('/products')
    .then((rows) => {
      setProducts(rows);
      const flagged = rows.filter((p) => needsAttention(stockStatus(p, settings, daysTo(p.expiry))));
      setAlertCount(flagged.length);
    })
    .catch((e) => setError(e.message))
    .finally(() => setLoaded(true));

  useFocusTerm(setSearch);
  useEffect(() => {
    load();
    api('/suppliers').then(setSuppliers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .map((p) => ({ p, s: stockStatus(p, settings, daysTo(p.expiry)) }))
      .filter(({ p, s }) => {
        if (filter === 'attention' && !needsAttention(s)) return false;
        if (filter === 'out' && s.key !== 'out') return false;
        if (filter === 'low' && s.key !== 'low') return false;
        if (filter === 'exp' && s.key !== 'exp' && s.key !== 'expired') return false;
        if (!q) return true;
        return [p.name, p.category, p.supplier, p.barcode].some((v) => String(v || '').toLowerCase().includes(q));
      });
  }, [products, search, filter, settings]);

  const counts = useMemo(() => {
    const all = products.map((p) => stockStatus(p, settings, daysTo(p.expiry)));
    return {
      attention: all.filter(needsAttention).length,
      out: all.filter((s) => s.key === 'out').length,
      low: all.filter((s) => s.key === 'low').length,
      exp: all.filter((s) => s.key === 'exp' || s.key === 'expired').length
    };
  }, [products, settings]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function openNew() {
    setForm({ ...EMPTY, supplier: suppliers[0]?.name || '' });
    setError('');
  }

  function openEdit(p) {
    setForm({
      _id: p._id, name: p.name, category: p.category, unit: p.unit, supplier: p.supplier || '',
      barcode: p.barcode || '', buy: String(p.buy), retail: String(p.retail),
      wholesale: p.wholesale ? String(p.wholesale) : '', stock: String(p.stock), expiry: p.expiry || ''
    });
    setError('');
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const path = form._id ? `/products/${form._id}` : '/products';
      await api(path, { method: form._id ? 'PUT' : 'POST', body: form });
      setNotice(form._id ? 'جنس تغییر یافت.' : 'جنس جدید ثبت شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function remove() {
    if (busy || !form._id) return;
    setBusy(true);
    setError('');
    try {
      await api(`/products/${form._id}`, { method: 'DELETE' });
      setNotice('جنس حذف شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const margin = (p) => p.buy > 0 ? '+' + Math.round((p.retail - p.buy) / p.buy * 100) + '٪' : '—';

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}

      {counts.attention > 0 && (
        <div className="alert-bar" style={{ marginBottom: 18 }}>
          <Icon d={ICON.alert} size={22} stroke="#BC7716" width={1.9} />
          <div className="msg">
            <b>{counts.attention} قلم جنس</b> نیاز به توجه دارند — {counts.low} قلم کم شده، {counts.out} قلم
            تمام شده، و {counts.exp} قلم نزدیک به تاریخ انقضا.
          </div>
          <button onClick={() => router.push('/purchasing')} className="btn btn-warn btn-sm">ثبت سفارش خرید</button>
        </div>
      )}

      <div className="table-wrap">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="card-title">اجناس گدام</div>
          <span className="card-note tnum">{num(rows.length)} از {num(products.length)} قلم</span>
          <div className="spacer"></div>

          <div className="segment segment-flat">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'on' : ''}>
                {f.label}{f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
              </button>
            ))}
          </div>

          <div className="inline-search" style={{ width: 220 }}>
            <Icon d={ICON.search} size={16} stroke={C.faint} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی جنس یا بارکد…" />
          </div>

          <button onClick={openNew} className="btn btn-primary btn-md">
            <Icon d={ICON.plus} size={16} width={2} />جنس جدید
          </button>
        </div>

        {loaded && products.length === 0 ? (
          <div className="empty">
            هنوز جنسی ثبت نشده. {suppliers.length === 0 && 'اول یک تهیه‌کننده ثبت کنید، بعد '}
            با <strong>جنس جدید</strong> گدام خود را بسازید.
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">جنسی با این مشخصات پیدا نشد.</div>
        ) : (
          <div className="table-scroll">
            <table className="data wide">
              <thead>
                <tr>
                  <th>جنس</th>
                  <th>بارکد</th>
                  <th>موجودی</th>
                  <th className="num">قیمت خرید</th>
                  <th className="num">پرچون</th>
                  <th className="num">عمده</th>
                  <th className="num">مفاد</th>
                  <th>تاریخ انقضا</th>
                  <th>وضعیت</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, s }) => (
                  <tr key={p._id}>
                    <td>
                      <div className="semi">{p.name}</div>
                      <div style={{ fontSize: 11, color: C.faint }}>
                        {[p.category, p.supplier].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="mono tnum ltr" style={{ color: C.muted, fontSize: 12 }}>{p.barcode || '—'}</td>
                    <td className="tnum strong" style={{ color: s.key === 'out' ? C.redBright : s.key === 'low' ? C.amber : C.text }}>
                      {num(p.stock)} {p.unit}
                    </td>
                    <td className="num" style={{ color: C.muted }}>{fmt(p.buy)}</td>
                    <td className="num semi">{fmt(p.retail)}</td>
                    <td className="num" style={{ color: p.wholesale ? C.brand : C.faint, fontWeight: p.wholesale ? 600 : 400 }}>
                      {p.wholesale ? fmt(p.wholesale) : '—'}
                    </td>
                    <td className="num semi" style={{ color: C.greenBright }}>{margin(p)}</td>
                    <td className="tnum" style={{ color: s.key === 'exp' || s.key === 'expired' ? C.amber : C.muted }}>
                      {p.expiry ? jDate(p.expiry) : '—'}
                    </td>
                    <td><span className={`pill ${s.cls}`}>{s.label}</span></td>
                    <td>
                      <button onClick={() => openEdit(p)} className="btn btn-ghost btn-sm btn-icon" title="تغییر">
                        <Icon d={ICON.edit} size={15} stroke={C.muted} />
                      </button>
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
          <div className="modal modal-lg">
            <h2>{form._id ? 'تغییر جنس' : 'ثبت جنس جدید'}</h2>
            <div className="modal-sub">
              قیمت عمده اختیاری است — وقتی تعداد یک قلم به {settings.wholesaleMinQty} یا بیشتر برسد، صندوق
              به‌صورت خودکار همان قیمت را حساب می‌کند.
            </div>

            <div className="form-grid">
              <div>
                <div className="field-label">نام جنس</div>
                <input value={form.name} onChange={set('name')} placeholder="مثلاً: برنج باسمتی سیله" className="field" />
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">دسته</div>
                  <input value={form.category} onChange={set('category')} list="tn-cats" className="field" />
                  <datalist id="tn-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <div className="field-label">واحد</div>
                  <input value={form.unit} onChange={set('unit')} list="tn-units" className="field" />
                  <datalist id="tn-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">تهیه‌کننده</div>
                  <select value={form.supplier} onChange={set('supplier')} className="field">
                    <option value="">— انتخاب نشده —</option>
                    {suppliers.map((s) => <option key={s._id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="field-label">بارکد (اختیاری)</div>
                  <input value={form.barcode} onChange={set('barcode')} className="field ltr" inputMode="numeric" />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">قیمت خرید</div>
                  <input value={form.buy} onChange={set('buy')} type="number" min="0" className="field tnum" />
                </div>
                <div>
                  <div className="field-label">قیمت پرچون</div>
                  <input value={form.retail} onChange={set('retail')} type="number" min="0" className="field tnum" />
                </div>
                <div>
                  <div className="field-label">قیمت عمده</div>
                  <input value={form.wholesale} onChange={set('wholesale')} type="number" min="0" placeholder="اختیاری" className="field tnum" />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">{form._id ? 'موجودی فعلی' : 'موجودی اولیه'}</div>
                  <input value={form.stock} onChange={set('stock')} type="number" min="0" className="field tnum" />
                  {form._id && (
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                      برای افزودن موجودی، سفارش خرید ثبت و تحویل بگیرید.
                    </div>
                  )}
                </div>
                <div>
                  <div className="field-label">تاریخ انقضا (اختیاری)</div>
                  <JDateField value={form.expiry} onChange={(iso) => setForm((f) => ({ ...f, expiry: iso }))} />
                </div>
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              {form._id && (
                <button onClick={remove} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>
              )}
              <button onClick={() => setForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={submit} disabled={busy} className="btn btn-primary">
                {busy ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
