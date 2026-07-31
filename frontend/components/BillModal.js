'use client';

import { useApp } from '@/lib/store';
import { makeFmt, jDate, clock } from '@/lib/format';
import Portal from './Portal';

const META = { color: 'var(--muted)' };
const LEFT = { textAlign: 'left' };

/** The printed bill (بل). Opens after a sale and from the bill history. */
export default function BillModal({ sale, onClose }) {
  const { settings, user } = useApp();
  const fmt = makeFmt(settings.currency);
  if (!sale) return null;

  const line = (label, value, bold) => (
    <>
      <div style={META}>{label}</div>
      <div style={{ ...LEFT, fontWeight: bold ? 700 : 400 }} className="tnum">{value}</div>
    </>
  );

  return (
    <Portal>
    <div className="overlay">
      <div className="doc-shell">
        <div className="doc">
          <div className="doc-head">
            <div className="doc-name">{settings.storeName}</div>
            {/* Only print the details that have actually been filled in. */}
            <div className="doc-meta" style={{ marginTop: 3 }}>
              {[settings.storeAddress, settings.storePhone].filter(Boolean).join(' · ')}
            </div>
            {settings.storeLicense && <div className="doc-meta">جواز نمبر {settings.storeLicense}</div>}
          </div>

          <div className="doc-grid">
            {line('شماره بل', sale.no, true)}
            {line('تاریخ', `${jDate(sale.date)} · ${clock(sale.date)}`)}
            {line('مشتری', sale.customer || 'مشتری نقدی')}
            {sale.phone ? line('شماره تماس', sale.phone) : null}
            {line('فروشنده', sale.servedBy || user?.name)}
            {line('نوع پرداخت', sale.payment || 'نقد', true)}
          </div>

          <div className="doc-items" style={{ padding: '10px 0 6px', fontSize: 10.5, fontWeight: 600, color: 'var(--muted)' }}>
            <div>جنس</div>
            <div style={{ textAlign: 'center' }}>تعداد</div>
            <div style={LEFT}>قیمت</div>
            <div style={LEFT}>مبلغ</div>
          </div>

          {sale.items.map((r, i) => (
            <div key={i} className="doc-items" style={{ padding: '5px 0', fontSize: 12 }}>
              <div>
                {r.name}
                {r.unit ? <span style={{ color: 'var(--faint)', fontSize: 10.5 }}> / {r.unit}</span> : null}
              </div>
              <div style={{ textAlign: 'center' }} className="tnum">{r.qty}</div>
              <div style={LEFT} className="tnum">{fmt(r.price)}</div>
              <div style={{ ...LEFT, fontWeight: 600 }} className="tnum">{fmt(r.price * r.qty)}</div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #C6D0D8', marginTop: 10, paddingTop: 10 }}>
            <div className="doc-line" style={META}>
              <div>مجموع فرعی</div><div className="tnum">{fmt(sale.sub)}</div>
            </div>
            {sale.autoDisc > 0 && (
              <div className="doc-line" style={{ color: 'var(--green)' }}>
                <div>{sale.autoDiscNote || 'تخفیف'}</div><div className="tnum">− {fmt(sale.autoDisc)}</div>
              </div>
            )}
            {sale.disc > 0 && (
              <div className="doc-line" style={{ color: 'var(--green)' }}>
                <div>تخفیف دستی</div><div className="tnum">− {fmt(sale.disc)}</div>
              </div>
            )}
            {sale.vat > 0 && (
              <div className="doc-line" style={META}>
                <div>مالیه ({settings.vatRate}٪)</div><div className="tnum">{fmt(sale.vat)}</div>
              </div>
            )}
            <div className="doc-total">
              <div>قابل پرداخت</div><div className="tnum">{fmt(sale.total)}</div>
            </div>
          </div>

          <div className="doc-foot">
            {sale.payment === 'قرض'
              ? 'این مبلغ در حساب قرض مشتری ثبت شد.'
              : 'از خرید شما تشکر — دوباره تشریف بیاورید.'}
          </div>
        </div>

        <div className="doc-actions">
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>بستن</button>
          <button onClick={() => window.print()} className="btn btn-primary" style={{ flex: 2 }}>چاپ بل</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
