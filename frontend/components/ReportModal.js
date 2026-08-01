'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt, jLong, num } from '@/lib/format';
import Portal from './Portal';

const META = { color: 'var(--muted)' };
const LEFT = { textAlign: 'left' };

/**
 * Printable report. `type` is 'sales' | 'pl' | 'stock'; the figures come from
 * GET /api/reports/print so the paper copy and the screen cannot drift apart.
 */
export default function ReportModal({ type, period, onClose }) {
  const { settings } = useApp();
  const fmt = makeFmt(settings.currency);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/reports/print?type=${type}&period=${period}`).then(setData).catch((e) => setError(e.message));
  }, [type, period]);

  const row = (label, value, opts = {}) => (
    <div className="doc-line" style={opts.strong ? { fontWeight: 700, fontSize: 13 } : META}>
      <div>{label}</div><div className="tnum" style={opts.color ? { color: opts.color } : null}>{value}</div>
    </div>
  );

  return (
    <Portal>
    <div className="overlay">
      <div className="doc-shell report">
        <div className="doc">
          <div className="doc-head">
            <div className="doc-name">{settings.storeName}</div>
            <div className="doc-meta" style={{ marginTop: 3 }}>
              {[settings.storeAddress, settings.storePhone].filter(Boolean).join(' · ')}
            </div>
          </div>

          {error && <div className="banner banner-error" style={{ marginTop: 14 }}>{error}</div>}
          {!data && !error && <div className="empty">در حال آماده‌سازی راپور…</div>}

          {data && (
            <>
              <div style={{ textAlign: 'center', padding: '14px 0 12px', borderBottom: '1px dashed #C6D0D8' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{data.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{data.range}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                  چاپ شده: {jLong(new Date())}
                </div>
              </div>

              {data.type === 'sales' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 0' }}>
                    <div className="doc-tile"><div className="k">فروش کل</div><div className="v">{fmt(data.rev)}</div></div>
                    <div className="doc-tile"><div className="k">مفاد خالص</div><div className="v">{fmt(data.netProfit)}</div></div>
                    <div className="doc-tile"><div className="k">تعداد بل‌ها</div><div className="v">{num(data.bills)}</div></div>
                    <div className="doc-tile"><div className="k">اوسط هر بل</div><div className="v">{fmt(data.avg)}</div></div>
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, marginBottom: 4 }}>پرفروش‌ترین اجناس</div>
                  {data.top.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>در این دوره فروشی ثبت نشده.</div>}
                  {data.top.map((t) => (
                    <div key={t.name} className="doc-line">
                      <div>{t.rank}. {t.name}</div>
                      <div className="tnum" style={LEFT}>{num(t.units)} — {fmt(t.rev)}</div>
                    </div>
                  ))}

                  {data.cats.length > 0 && (
                    <>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>فروش بر اساس دسته</div>
                      {data.cats.map((c) => (
                        <div key={c.name} className="doc-line">
                          <div>{c.name}</div>
                          <div className="tnum" style={LEFT}>{fmt(c.amount)} ({c.pct}٪)</div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {data.type === 'pl' && (
                <div style={{ padding: '14px 0' }}>
                  {row('فروش کل', fmt(data.revenue))}
                  {row('قیمت تمام‌شد اجناس فروخته‌شده', '− ' + fmt(data.cogs))}
                  {row('مفاد خام', fmt(data.grossProfit), { strong: true })}
                  <div style={{ borderTop: '1px dashed #C6D0D8', margin: '8px 0' }}></div>
                  {row('تخفیفات داده‌شده', '− ' + fmt(data.discounts))}
                  {row('ضرر برگشتی‌ها', '− ' + fmt(data.returnLoss))}
                  {row('مصارف دکان', '− ' + fmt(data.otherExpenses))}
                  {row(`کمیشن تاپ‌آپ (${num(data.topupCount)} فروش)`, '+ ' + fmt(data.topupProfit))}
                  <div className="doc-total" style={{ color: data.netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    <div>مفاد خالص</div><div className="tnum">{fmt(data.netProfit)}</div>
                  </div>

                  {data.expenseCats.length > 0 && (
                    <>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 14, marginBottom: 4 }}>
                        مصارف بر اساس دسته
                      </div>
                      {data.expenseCats.map((c) => (
                        <div key={c.name} className="doc-line">
                          <div>{c.name}</div>
                          <div className="tnum" style={LEFT}>{fmt(c.amount)} ({c.pct}٪)</div>
                        </div>
                      ))}
                    </>
                  )}

                  <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.8 }}>
                    خریدهای گدام در «قیمت تمام‌شد» حساب شده‌اند و دوباره در مصارف شامل نیستند.
                    از تاپ‌آپ تنها کمیشن آن مفاد شمرده می‌شود — {fmt(data.topupAmount)} پول تاپ‌آپ
                    مربوط شرکت مخابراتی است.
                  </div>
                </div>
              )}

              {data.type === 'stock' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 0' }}>
                    <div className="doc-tile"><div className="k">اقلام ثبت‌شده</div><div className="v">{num(data.items)}</div></div>
                    <div className="doc-tile"><div className="k">مجموع واحدها</div><div className="v">{num(data.units)}</div></div>
                    <div className="doc-tile"><div className="k">ارزش به قیمت خرید</div><div className="v">{fmt(data.buyValue)}</div></div>
                    <div className="doc-tile"><div className="k">ارزش به قیمت فروش</div><div className="v">{fmt(data.sellValue)}</div></div>
                  </div>
                  {row('اجناس کم‌موجود', num(data.lowCount) + ' قلم', { color: 'var(--amber)' })}
                  {row('اجناس تمام‌شده', num(data.outCount) + ' قلم', { color: 'var(--red)' })}
                  {row('نزدیک تاریخ انقضا', num(data.expCount) + ' قلم', { color: 'var(--amber)' })}

                  <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 14, marginBottom: 4 }}>
                    بیشترین سرمایهٔ خوابیده
                  </div>
                  {data.rows.map((r) => (
                    <div key={r.name} className="doc-line">
                      <div>{r.name}</div>
                      <div className="tnum" style={LEFT}>{num(r.stock)} {r.unit} — {fmt(r.value)}</div>
                    </div>
                  ))}
                </>
              )}

              <div className="doc-foot">
                این راپور از روی بل‌های ثبت‌شده محاسبه شده است.
              </div>
            </>
          )}
        </div>

        <div className="doc-actions">
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>بستن</button>
          <button onClick={() => window.print()} className="btn btn-primary" style={{ flex: 2 }} disabled={!data}>چاپ راپور</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
