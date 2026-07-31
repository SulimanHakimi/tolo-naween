'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useFocusTerm } from '@/lib/focus';
import { makeFmt, daysTo } from '@/lib/format';
import { activeDiscounts, priceLine, cartTotals } from '@/lib/pricing';
import { C, stockStatus } from '@/lib/ui';
import { PAYMENTS } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';
import BillModal from '@/components/BillModal';

const PAY_ICON = { 'نقد': ICON.money, 'کارت': ICON.card, 'موبایل': ICON.mobile, 'قرض': ICON.users };

export default function PosPage() {
  const { settings, setAlertCount } = useApp();
  const fmt = makeFmt(settings.currency);

  const [products, setProducts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [cat, setCat] = useState('همه');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);            // [{ id, qty }]
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [manual, setManual] = useState('');
  const [discMode, setDiscMode] = useState('amt');
  const [payment, setPayment] = useState('نقد');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [sale, setSale] = useState(null);
  const scanBox = useRef(null);

  const load = () => Promise.all([api('/products'), api('/discounts')])
    .then(([p, d]) => { setProducts(p); setDiscounts(d); })
    .catch((e) => setError(e.message))
    .finally(() => setLoaded(true));

  useEffect(() => { load(); }, []);

  // The topbar's «اسکن بارکد» button parks the cursor in the scan field for us.
  useFocusTerm(setSearch);
  useEffect(() => {
    if (sessionStorage.getItem('tn_scan')) {
      sessionStorage.removeItem('tn_scan');
      scanBox.current?.focus();
    }
  }, []);

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p._id, p])), [products]);
  const rules = useMemo(() => activeDiscounts(discounts), [discounts]);
  const categories = useMemo(
    () => ['همه', ...[...new Set(products.map((p) => p.category))].sort()],
    [products]
  );

  const q = search.trim().toLowerCase();
  const visible = products.filter((p) => {
    if (cat !== 'همه' && p.category !== cat) return false;
    if (!q) return true;
    return [p.name, p.category, p.barcode].some((v) => String(v || '').toLowerCase().includes(q));
  });

  function note(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2200);
  }

  function add(id) {
    const p = byId[id];
    if (!p || p.stock <= 0) return;
    setError('');
    setCart((c) => {
      const line = c.find((x) => x.id === id);
      if (!line) return [...c, { id, qty: 1 }];
      if (line.qty >= p.stock) { note(`تمام موجودی «${p.name}» در سبد است`); return c; }
      return c.map((x) => x.id === id ? { ...x, qty: x.qty + 1 } : x);
    });
  }

  function setQty(id, next) {
    const p = byId[id];
    const qty = Math.max(1, Math.min(p?.stock ?? 1, next));
    setCart((c) => c.map((x) => x.id === id ? { ...x, qty } : x));
  }

  // A USB scanner types the digits then presses Enter. Matching only on Enter keeps
  // a partially-typed code from grabbing the wrong product.
  function onScan(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = e.currentTarget.value.trim();
    if (!code) return;

    const hit = products.find((p) => p.barcode && p.barcode === code);
    if (hit) {
      add(hit._id);
      note(`«${hit.name}» اضافه شد`);
    } else {
      // Not a barcode — treat it as a name search so typing still works.
      setSearch(code);
      note('بارکدی با این شماره پیدا نشد — به نام جستجو شد');
    }
    e.currentTarget.value = '';
  }

  const lines = cart.map((c) => {
    const p = byId[c.id];
    return p ? { id: c.id, product: p, ...priceLine(p, c.qty, settings, rules) } : null;
  }).filter(Boolean);

  const t = cartTotals(lines, settings, manual, discMode);
  const needsName = payment === 'قرض' && !customer.trim();

  async function checkout() {
    if (!lines.length || busy) return;
    if (needsName) { setError('برای فروش قرضی نام مشتری لازم است.'); return; }

    setBusy(true);
    setError('');
    try {
      const created = await api('/sales', {
        method: 'POST',
        body: {
          items: cart.map((c) => ({ product: c.id, qty: c.qty })),
          customer, phone, discount: +manual || 0, discMode, payment
        }
      });
      setSale(created);
      setCart([]); setCustomer(''); setPhone(''); setManual(''); setPayment('نقد');
      load();
      api('/products/alerts').then((r) => setAlertCount(r.count)).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="pos">
        <div className="pos-left">
          <div className="scan-bar">
            <Icon d={ICON.barcode} size={22} stroke={C.brand} />
            <input ref={scanBox} onKeyDown={onScan} defaultValue=""
              placeholder="بارکد را اسکن کنید و Enter بزنید…" className="ltr" inputMode="numeric" />
          </div>

          <div className="scan-bar" style={{ height: 44, marginBottom: 14 }}>
            <Icon d={ICON.search} size={19} stroke={C.faint} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام جنس را تایپ کنید…" />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.faint, fontSize: 18, padding: 0 }}>×</button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="pos-cats">
              {categories.map((c) => (
                <span key={c} onClick={() => setCat(c)} className={`chip${cat === c ? ' on' : ''}`}>{c}</span>
              ))}
            </div>
          )}

          {flash && <div className="banner banner-ok" style={{ marginBottom: 12 }}>{flash}</div>}

          <div className="pos-scroll">
            {loaded && products.length === 0 && (
              <div className="card empty">
                هنوز جنسی ثبت نشده. اول از صفحهٔ <strong>موجودی و گدام</strong> اجناس را ثبت کنید.
              </div>
            )}
            {loaded && products.length > 0 && visible.length === 0 && (
              <div className="card empty">جنسی با این مشخصات پیدا نشد.</div>
            )}

            <div className="pos-grid">
              {visible.map((p) => {
                const s = stockStatus(p, settings, daysTo(p.expiry));
                const out = p.stock <= 0;
                return (
                  <button key={p._id} onClick={() => add(p._id)} disabled={out} className="prod-card">
                    <div className="prod-name">{p.name}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{p.category}</div>
                    <div className="row-between" style={{ marginTop: 10 }}>
                      <span className="prod-price">{fmt(p.retail)}</span>
                      <span style={{ fontSize: 11, color: s.key === 'ok' ? C.faint : s.color, fontWeight: s.key === 'ok' ? 400 : 600 }}>
                        {out ? 'تمام شده' : `${p.stock} ${p.unit}`}
                      </span>
                    </div>
                    {p.wholesale > 0 && (
                      <div style={{ fontSize: 10.5, color: C.brand, marginTop: 5 }}>
                        عمده از {settings.wholesaleMinQty} {p.unit}: {fmt(p.wholesale)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="cart">
          <div className="cart-head">
            <div style={{ fontSize: 16, fontWeight: 700 }}>بل جاری</div>
            <span className="pill pill-blue">{customer.trim() || 'مشتری نقدی'}</span>
          </div>

          <div style={{ padding: '12px 18px 4px' }} className="form-grid">
            <div className="form-row">
              <input value={customer} onChange={(e) => setCustomer(e.target.value)}
                placeholder={payment === 'قرض' ? 'نام مشتری (لازم)' : 'نام مشتری (اختیاری)'}
                className={`field${needsName ? ' invalid' : ''}`} style={{ padding: '8px 12px' }} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="شماره تماس"
                className="field ltr" style={{ padding: '8px 12px' }} inputMode="tel" />
            </div>
          </div>

          <div className="cart-body">
            {!lines.length && (
              <div className="empty" style={{ padding: '34px 0' }}>روی جنس کلیک کنید تا به بل اضافه شود</div>
            )}

            {lines.map((l) => (
              <div key={l.id} className="cart-line">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{l.product.name}</div>
                  <div className="tnum" style={{ fontSize: 11.5, color: C.faint }}>
                    {fmt(l.price)} × {l.qty} {l.product.unit}
                  </div>
                  {(l.wholesaleApplied || l.discountName) && (
                    <div style={{ fontSize: 10.5, color: C.green, fontWeight: 600, marginTop: 2 }}>
                      {[l.wholesaleApplied && 'قیمت عمده', l.discountName].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 7 }}>
                  <button onClick={() => setQty(l.id, l.qty - 1)} className="qty-btn" disabled={l.qty <= 1} aria-label="کم کردن">−</button>
                  <span className="tnum" style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{l.qty}</span>
                  <button onClick={() => setQty(l.id, l.qty + 1)} className="qty-btn plus"
                    disabled={l.qty >= l.product.stock} aria-label="زیاد کردن">+</button>
                </div>
                <div className="tnum" style={{ fontSize: 13.5, fontWeight: 700, minWidth: 72, textAlign: 'left' }}>{fmt(l.lineTotal)}</div>
                <button onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))} aria-label="حذف"
                  style={{ border: 'none', background: 'none', color: C.redBright, cursor: 'pointer', fontSize: 17, padding: 2 }}>×</button>
              </div>
            ))}
          </div>

          <div className="cart-foot">
            <div className="cart-row" style={{ color: C.muted }}>
              <span>مجموع فرعی</span><span className="tnum">{fmt(t.sub)}</span>
            </div>

            {t.autoDisc > 0 && (
              <div className="cart-row" style={{ color: C.greenBright, fontWeight: 600 }}>
                <span>{t.autoDiscNote}</span><span className="tnum">− {fmt(t.autoDisc)}</span>
              </div>
            )}

            <div className="cart-row" style={{ alignItems: 'center', color: C.muted }}>
              <span>تخفیف دستی</span>
              <span className="row" style={{ gap: 6 }}>
                <input value={manual} onChange={(e) => setManual(e.target.value)} type="number" min="0" placeholder="0"
                  className="field tnum" style={{ width: 74, padding: '5px 9px', borderRadius: 9, textAlign: 'left' }} />
                <span className="segment segment-flat" style={{ padding: 2 }}>
                  {[['amt', settings.currency], ['pct', '٪']].map(([m, label]) => (
                    <button key={m} onClick={() => setDiscMode(m)} className={discMode === m ? 'on' : ''}
                      style={{ height: 24, padding: '0 9px', fontSize: 11 }}>{label}</button>
                  ))}
                </span>
              </span>
            </div>

            {t.disc > 0 && (
              <div className="cart-row" style={{ color: C.greenBright, fontWeight: 600 }}>
                <span>تخفیف اعمال‌شده</span><span className="tnum">− {fmt(t.disc)}</span>
              </div>
            )}
            {settings.vatRate > 0 && (
              <div className="cart-row" style={{ color: C.muted }}>
                <span>مالیه ({settings.vatRate}٪)</span><span className="tnum">{fmt(t.vat)}</span>
              </div>
            )}

            <div className="cart-total">
              <span style={{ fontSize: 15, fontWeight: 700 }}>قابل پرداخت</span>
              <span className="tnum" style={{ fontSize: 22, fontWeight: 800, color: C.brand }}>{fmt(t.total)}</span>
            </div>

            <div className="pay-grid">
              {PAYMENTS.map((p) => (
                <button key={p} onClick={() => setPayment(p)} className={`pay-btn${payment === p ? ' on' : ''}`}>
                  <Icon d={PAY_ICON[p]} size={19} />
                  {p}
                </button>
              ))}
            </div>

            {payment === 'قرض' && (
              <div style={{ fontSize: 11.5, color: C.amber, marginTop: 9, lineHeight: 1.7 }}>
                این مبلغ به حساب قرض مشتری اضافه می‌شود — بعداً از صفحهٔ «مشتریان و قرض‌ها» تسویه کنید.
              </div>
            )}

            {error && <div className="banner banner-error" style={{ marginTop: 10 }}>{error}</div>}

            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button onClick={checkout} disabled={busy || !lines.length}
                className="btn btn-primary" style={{ flex: 1, height: 50, fontSize: 15 }}>
                {busy ? 'در حال ثبت…' : 'تکمیل فروش'}
              </button>
              <button onClick={() => { setCart([]); setManual(''); setError(''); }} disabled={!lines.length}
                className="btn btn-ghost" style={{ width: 52, height: 50, padding: 0 }} title="خالی کردن سبد">
                <Icon d={ICON.trash} size={19} stroke={C.muted} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {sale && <BillModal sale={sale} onClose={() => setSale(null)} />}
    </>
  );
}
