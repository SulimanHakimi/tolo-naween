'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, num, jDate } from '@/lib/format';
import { C, abbr } from '@/lib/ui';
import Icon, { ICON } from '@/components/icons';

const EMPTY_SUPPLIER = { name: '', person: '', phone: '', address: '', supplies: '' };
const EMPTY_LINE = { product: '', qty: '', cost: '' };

export default function PurchasingPage() {
  const { settings, setAlertCount } = useApp();
  const fmt = makeFmt(settings.currency);

  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [supForm, setSupForm] = useState(null);
  const [poForm, setPoForm] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [receiveFor, setReceiveFor] = useState(null);

  const load = () => Promise.all([api('/suppliers'), api('/purchases'), api('/products')])
    .then(([s, o, p]) => { setSuppliers(s); setOrders(o); setProducts(p); })
    .catch((e) => setError(e.message))
    .finally(() => setLoaded(true));

  useFocusTerm(setSearch);
  useEffect(() => { load(); }, []);

  const visibleSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => [s.name, s.phone, s.supplies, s.person]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [suppliers, search]);

  const payable = suppliers.reduce((t, s) => t + s.balance, 0);
  const pending = orders.filter((o) => o.status === 'در انتظار');
  const monthAgo = Date.now() - 30 * 864e5;
  const monthBuys = orders
    .filter((o) => o.status === 'تحویل شده' && new Date(o.receivedAt || o.date).getTime() > monthAgo)
    .reduce((t, o) => t + o.total, 0);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p._id, p])), [products]);

  async function saveSupplier() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const path = supForm._id ? `/suppliers/${supForm._id}` : '/suppliers';
      await api(path, { method: supForm._id ? 'PUT' : 'POST', body: supForm });
      setNotice(supForm._id ? 'معلومات تهیه‌کننده تغییر یافت.' : 'تهیه‌کننده ثبت شد.');
      setSupForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function removeSupplier() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/suppliers/${supForm._id}`, { method: 'DELETE' });
      setNotice('تهیه‌کننده حذف شد.');
      setSupForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function saveOrder() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const lines = poForm.lines.filter((l) => l.product && +l.qty > 0 && +l.cost > 0);
      if (!lines.length) throw new Error('حداقل یک قلم جنس با تعداد و قیمت وارد کنید');
      await api('/purchases', { method: 'POST', body: { supplier: poForm.supplier, lines } });
      setNotice('سفارش خرید ثبت شد — بعد از رسیدن جنس، «تحویل گرفتن» را بزنید.');
      setPoForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function receive(paid) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/purchases/${receiveFor._id}/receive`, { method: 'POST', body: { paid } });
      setNotice(paid
        ? 'سفارش تحویل شد و پرداخت ثبت گردید — موجودی گدام به‌روز شد.'
        : 'سفارش تحویل شد — مبلغ به قرضداری تهیه‌کننده اضافه شد.');
      setReceiveFor(null);
      load();
      api('/products/alerts').then((r) => setAlertCount(r.count)).catch(() => {});
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function cancelOrder(po) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/purchases/${po._id}`, { method: 'DELETE' });
      setNotice(`سفارش ${po.po} لغو شد.`);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function paySupplier() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/suppliers/${payFor._id}/pay`, { method: 'POST', body: { amount: +payFor.amount || 0 } });
      setNotice('پرداخت ثبت شد.');
      setPayFor(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const setSup = (k) => (e) => setSupForm((f) => ({ ...f, [k]: e.target.value }));

  const setLine = (i, k) => (e) => setPoForm((f) => ({
    ...f,
    lines: f.lines.map((l, idx) => idx === i ? { ...l, [k]: e.target.value } : l)
  }));

  // Picking a product pre-fills its last known buy price — usually the right number.
  const pickProduct = (i) => (e) => {
    const p = productById[e.target.value];
    setPoForm((f) => ({
      ...f,
      lines: f.lines.map((l, idx) => idx === i ? { ...l, product: e.target.value, cost: p ? String(p.buy) : l.cost } : l)
    }));
  };

  const poTotal = poForm
    ? poForm.lines.reduce((t, l) => t + (Math.floor(+l.qty) || 0) * (+l.cost || 0), 0)
    : 0;

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !supForm && !poForm && !payFor && !receiveFor && (
        <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      <div className="grid-3 gap-b">
        <div className="card">
          <div className="stat-label">مجموع قرضداری به تهیه‌کنندگان</div>
          <div className="stat-value" style={{ color: payable ? C.redBright : C.green }}>{fmt(payable)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>
            {suppliers.filter((s) => s.balance > 0).length} تهیه‌کننده قرضدار
          </div>
        </div>
        <div className="card">
          <div className="stat-label">سفارشات در انتظار تحویل</div>
          <div className="stat-value" style={{ color: pending.length ? C.amber : C.green }}>{num(pending.length)}</div>
          <div className="stat-sub tnum" style={{ color: C.muted }}>
            به ارزش {fmt(pending.reduce((t, o) => t + o.total, 0))}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">خرید ۳۰ روز گذشته</div>
          <div className="stat-value" style={{ color: C.brand }}>{fmt(monthBuys)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>سفارشات تحویل‌شده</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="table-wrap">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="card-title">تهیه‌کنندگان</div>
            <span className="card-note tnum">{num(visibleSuppliers.length)}</span>
            <div className="spacer"></div>
            <div className="inline-search" style={{ width: 170 }}>
              <Icon d={ICON.search} size={16} stroke={C.faint} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام یا شماره…" />
            </div>
            <button onClick={() => { setSupForm({ ...EMPTY_SUPPLIER }); setError(''); }} className="btn btn-primary btn-md">
              <Icon d={ICON.plus} size={16} width={2} />تهیه‌کننده جدید
            </button>
          </div>

          {loaded && suppliers.length === 0 ? (
            <div className="empty">هنوز تهیه‌کننده‌ای ثبت نشده. با <strong>تهیه‌کننده جدید</strong> شروع کنید.</div>
          ) : visibleSuppliers.length === 0 ? (
            <div className="empty">تهیه‌کننده‌ای با این مشخصات پیدا نشد.</div>
          ) : (
            <div style={{ padding: '6px 8px' }}>
              {visibleSuppliers.map((s) => (
                <div key={s._id} className="row" style={{ gap: 13, padding: '13px 12px', borderRadius: 12 }}>
                  <div className="avatar avatar-sq" style={{ width: 42, height: 42, fontSize: 15 }}>{abbr(s.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
                    <div className="ellipsis" style={{ fontSize: 11.5, color: C.faint }}>
                      {[s.supplies, s.phone].filter(Boolean).join(' · ') || 'معلومات تکمیل نشده'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 700, color: s.balance > 0 ? C.redBright : C.green }}>
                      {s.balance > 0 ? fmt(s.balance) : 'تسویه'}
                    </div>
                    <div style={{ fontSize: 11, color: s.balance > 0 ? C.red : C.green }}>
                      {s.balance > 0 ? 'قرضدار' : 'بدون قرض'}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {s.balance > 0 && (
                      <button onClick={() => { setPayFor({ ...s, amount: '' }); setError(''); }} className="btn btn-soft btn-sm">پرداخت</button>
                    )}
                    <button onClick={() => { setSupForm({ ...s }); setError(''); }} className="btn btn-ghost btn-sm btn-icon" title="تغییر">
                      <Icon d={ICON.edit} size={15} stroke={C.muted} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="table-wrap">
          <div className="card-head">
            <div className="card-title">سفارشات خرید</div>
            <div className="spacer"></div>
            <button onClick={() => { setPoForm({ supplier: suppliers[0]?.name || '', lines: [{ ...EMPTY_LINE }] }); setError(''); }}
              disabled={!suppliers.length || !products.length} className="btn btn-primary btn-md"
              title={!suppliers.length ? 'اول تهیه‌کننده ثبت کنید' : !products.length ? 'اول اجناس را ثبت کنید' : ''}>
              <Icon d={ICON.plus} size={16} width={2} />سفارش جدید
            </button>
          </div>

          {loaded && orders.length === 0 ? (
            <div className="empty">
              سفارشی ثبت نشده. سفارش خرید موجودی را تغییر نمی‌دهد تا وقتی که{' '}
              <strong>تحویل</strong> بگیرید.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data narrow">
                <thead>
                  <tr><th>شماره</th><th>تهیه‌کننده</th><th className="num">مجموع</th><th>وضعیت</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td className="semi tnum" style={{ color: C.brand }}>{o.po}</td>
                      <td>
                        <div className="ellipsis">{o.supplier}</div>
                        <div className="tnum" style={{ fontSize: 11, color: C.faint }}>
                          {jDate(o.date)} · {o.lines.length} قلم
                        </div>
                      </td>
                      <td className="num semi">{fmt(o.total)}</td>
                      <td>
                        <span className={`pill ${o.status === 'تحویل شده' ? 'pill-green' : 'pill-amber'}`}>{o.status}</span>
                        {o.status === 'تحویل شده' && (
                          <div style={{ fontSize: 10.5, color: o.paid ? C.green : C.red, marginTop: 3 }}>
                            {o.paid ? 'پرداخت شده' : 'قرض'}
                          </div>
                        )}
                      </td>
                      <td>
                        {o.status === 'در انتظار' && (
                          <div className="row" style={{ gap: 6 }}>
                            <button onClick={() => { setReceiveFor(o); setError(''); }} className="btn btn-soft btn-sm">تحویل</button>
                            <button onClick={() => cancelOrder(o)} className="btn btn-ghost btn-sm btn-icon" title="لغو سفارش">
                              <Icon d={ICON.trash} size={14} stroke={C.red} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {supForm && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>{supForm._id ? 'تغییر تهیه‌کننده' : 'تهیه‌کنندهٔ جدید'}</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div><div className="field-label">نام شرکت یا نمایندگی</div>
                <input value={supForm.name} onChange={setSup('name')} className="field" /></div>
              <div className="form-row">
                <div><div className="field-label">شخص مسئول</div>
                  <input value={supForm.person || ''} onChange={setSup('person')} className="field" /></div>
                <div><div className="field-label">شماره تماس</div>
                  <input value={supForm.phone || ''} onChange={setSup('phone')} className="field ltr" inputMode="tel" /></div>
              </div>
              <div><div className="field-label">چه اجناسی تهیه می‌کند</div>
                <input value={supForm.supplies || ''} onChange={setSup('supplies')} placeholder="مثلاً: روغن، بوره، آرد" className="field" /></div>
              <div><div className="field-label">آدرس</div>
                <input value={supForm.address || ''} onChange={setSup('address')} className="field" /></div>
              {error && <div className="banner banner-error">{error}</div>}
            </div>
            <div className="modal-actions">
              {supForm._id && <button onClick={removeSupplier} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>}
              <button onClick={() => setSupForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={saveSupplier} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}

      {poForm && (
        <div className="overlay">
          <div className="modal modal-lg">
            <h2>سفارش خرید جدید</h2>
            <div className="modal-sub">
              قیمت خرید هر قلم بعد از تحویل روی جنس ثبت می‌شود، پس مفاد همیشه با آخرین قیمت حساب می‌گردد.
            </div>

            <div className="form-grid">
              <div>
                <div className="field-label">تهیه‌کننده</div>
                <select value={poForm.supplier} onChange={(e) => setPoForm((f) => ({ ...f, supplier: e.target.value }))} className="field">
                  {suppliers.map((s) => <option key={s._id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="field-label" style={{ marginTop: 6 }}>اقلام سفارش</div>
              {poForm.lines.map((l, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <select value={l.product} onChange={pickProduct(i)} className="field" style={{ flex: 2 }}>
                    <option value="">— جنس را انتخاب کنید —</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.unit})</option>)}
                  </select>
                  <input value={l.qty} onChange={setLine(i, 'qty')} type="number" min="1" placeholder="تعداد"
                    className="field tnum" style={{ flex: 1 }} />
                  <input value={l.cost} onChange={setLine(i, 'cost')} type="number" min="0" placeholder="قیمت خرید"
                    className="field tnum" style={{ flex: 1 }} />
                  <button onClick={() => setPoForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))}
                    disabled={poForm.lines.length === 1} className="btn btn-ghost btn-icon" style={{ height: 40 }} title="حذف قلم">
                    <Icon d={ICON.trash} size={15} stroke={C.red} />
                  </button>
                </div>
              ))}

              <button onClick={() => setPoForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}
                className="btn btn-soft btn-md" style={{ alignSelf: 'flex-start' }}>
                <Icon d={ICON.plus} size={15} width={2} />قلم دیگر
              </button>

              <div className="row-between" style={{ marginTop: 6, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                <span style={{ fontWeight: 700 }}>مجموع سفارش</span>
                <span className="tnum" style={{ fontSize: 19, fontWeight: 800, color: C.brand }}>{fmt(poTotal)}</span>
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              <button onClick={() => setPoForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={saveOrder} disabled={busy} className="btn btn-primary">{busy ? 'در حال ثبت…' : 'ثبت سفارش'}</button>
            </div>
          </div>
        </div>
      )}

      {receiveFor && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>تحویل گرفتن {receiveFor.po}</h2>
            <div className="modal-sub">
              موجودی این اقلام به گدام اضافه می‌شود و قیمت خرید آن‌ها به‌روز می‌گردد.
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              {receiveFor.lines.map((l, i) => (
                <div key={i} className="row-between" style={{ fontSize: 13, padding: '4px 0' }}>
                  <span className="ellipsis">{l.name}</span>
                  <span className="tnum" style={{ color: C.muted }}>{num(l.qty)} × {fmt(l.cost)}</span>
                </div>
              ))}
              <div className="row-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #D1D5DB', fontWeight: 700 }}>
                <span>مجموع</span><span className="tnum">{fmt(receiveFor.total)}</span>
              </div>
            </div>

            {error && <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div className="stack-sm">
              <button onClick={() => receive(true)} disabled={busy} className="btn btn-primary btn-block" style={{ height: 46 }}>
                تحویل و پرداخت نقد
              </button>
              <button onClick={() => receive(false)} disabled={busy} className="btn btn-ghost btn-block" style={{ height: 46 }}>
                تحویل، پرداخت بعداً (قرض)
              </button>
              <button onClick={() => setReceiveFor(null)} className="btn btn-ghost btn-block" style={{ border: 'none', color: C.muted }}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {payFor && (
        <div className="overlay">
          <div className="modal modal-sm">
            <h2>پرداخت به {payFor.name}</h2>
            <div className="modal-sub tnum">قرضداری فعلی: {fmt(payFor.balance)}</div>

            <div className="field-label">مبلغ پرداخت</div>
            <input value={payFor.amount} onChange={(e) => setPayFor((p) => ({ ...p, amount: e.target.value }))}
              type="number" min="0" max={payFor.balance} placeholder={`تمام قرض (${Math.round(payFor.balance)})`}
              className="field tnum" style={{ height: 44 }} />
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
              خالی بگذارید تا تمام قرضداری تسویه شود.
            </div>

            {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="modal-actions">
              <button onClick={() => setPayFor(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={paySupplier} disabled={busy} className="btn btn-primary">{busy ? 'در حال ثبت…' : 'ثبت پرداخت'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
