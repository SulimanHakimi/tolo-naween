'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt, fmtK, num, clock, jToday } from '@/lib/format';
import { C } from '@/lib/ui';
import Icon, { ICON } from '@/components/icons';

const PAY_PILL = { 'نقد': 'pill-green', 'کارت': 'pill-blue', 'موبایل': 'pill-blue', 'قرض': 'pill-amber' };

export default function DashboardPage() {
  const { settings, user } = useApp();
  const fmt = makeFmt(settings.currency);
  const router = useRouter();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner banner-error">{error}</div>;
  if (!d) return <div className="empty">در حال بارگیری…</div>;

  const delta = (v, suffix = '٪') => {
    if (v == null) return { text: 'مقایسه‌ای نیست', color: C.muted, bg: C.bg };
    const up = v >= 0;
    return {
      text: (up ? '+' : '') + v + suffix,
      color: up ? C.green : C.red,
      bg: up ? C.greenSoft : C.redSoft
    };
  };

  const kpis = [
    { label: 'فروش امروز', value: fmt(d.sales), icon: ICON.money, tint: C.blueSoft, color: C.brand, d: delta(d.salesDelta) },
    { label: 'تعداد بل‌ها', value: num(d.bills), icon: ICON.cart, tint: C.greenSoft, color: C.greenBright, d: delta(d.billsDelta, '') },
    { label: 'مفاد تخمینی امروز', value: fmt(d.profit), icon: ICON.profit, tint: C.amberSoft, color: C.amber, d: delta(d.profitDelta) },
    {
      label: 'اجناس نیازمند توجه', value: num(d.alertCount) + ' قلم', icon: ICON.alert,
      tint: C.redSoft, color: C.redBright,
      d: d.alertCount
        ? { text: 'نیاز به توجه', color: C.red, bg: C.redSoft }
        : { text: 'همه‌چیز مرتب', color: C.green, bg: C.greenSoft }
    }
  ];

  const peak = Math.max(...d.bars.map((b) => b.value), 1);
  const topMax = Math.max(...d.top.map((t) => t.units), 1);

  return (
    <>
      <div className="grid-4 gap-b">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="row-between">
              <div className="kpi-icon" style={{ background: k.tint }}>
                <Icon d={k.icon} size={21} stroke={k.color} />
              </div>
              <span className="kpi-delta" style={{ color: k.d.color, background: k.d.bg }}>{k.d.text}</span>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-wide-side gap-b">
        <div className="card">
          <div className="row-between" style={{ marginBottom: 22 }}>
            <div>
              <div className="card-title">فروش هفتهٔ جاری</div>
              <div className="card-note" style={{ marginTop: 2 }}>مجموع: {fmt(d.weekTotal)}</div>
            </div>
            <div className="card-note">{jToday()}</div>
          </div>

          {d.weekTotal === 0 ? (
            <div className="empty" style={{ padding: '56px 0' }}>در این هفته هنوز فروشی ثبت نشده.</div>
          ) : (
            <div className="bars">
              {d.bars.map((b, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-cap">{b.value ? fmtK(b.value) : '—'}</div>
                  <div className={`bar${b.value === peak && b.value > 0 ? ' peak' : ''}`}
                    style={{ height: `${Math.max(2, (b.value / peak) * 100)}%`, opacity: b.future ? 0.35 : 1 }}></div>
                  <div className="bar-lab">{b.day}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ gap: 9, marginBottom: 16 }}>
            <Icon d={ICON.alert} size={19} stroke={C.amberBright} width={1.9} />
            <div className="card-title">هشدار موجودی</div>
          </div>

          {d.alerts.length === 0 ? (
            <div className="empty" style={{ padding: '30px 0' }}>موجودی همه اجناس مناسب است.</div>
          ) : (
            <div className="stack-sm">
              {d.alerts.map((a) => (
                <div key={a.name} className="row" style={{ gap: 11 }}>
                  <div className="dot" style={{ background: a.color }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{a.note}</div>
                  </div>
                  <div className="tnum" style={{ fontSize: 12, fontWeight: 700, color: a.color }}>
                    {a.stock} {a.unit}
                  </div>
                </div>
              ))}
            </div>
          )}

          {user?.perms?.inv && (
            <button onClick={() => router.push('/inventory')} className="btn btn-ghost btn-block btn-md" style={{ marginTop: 18, color: C.brand }}>
              مشاهده گدام
            </button>
          )}
        </div>
      </div>

      <div className="grid-main-side">
        <div className="card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div className="card-title">آخرین فروشات امروز</div>
            {user?.perms?.rep && <a onClick={() => router.push('/reports')} style={{ cursor: 'pointer', fontSize: 12.5 }}>همه راپورها</a>}
          </div>

          {d.recent.length === 0 ? (
            <div className="empty" style={{ padding: '34px 0' }}>امروز هنوز فروشی ثبت نشده.</div>
          ) : d.recent.map((r) => (
            <div key={r.id} className="list-row">
              <div className="tile tile-blue"><Icon d={ICON.cart} size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tnum" style={{ fontSize: 13.5, fontWeight: 600 }}>بل #{r.no}</div>
                <div className="tnum" style={{ fontSize: 11.5, color: C.faint }}>
                  {clock(r.date)} · {r.items} قلم
                </div>
              </div>
              <span className={`pill ${PAY_PILL[r.payment] || 'pill-grey'}`}>{r.payment}</span>
              <div className="tnum" style={{ fontSize: 14, fontWeight: 700, minWidth: 88, textAlign: 'left' }}>{fmt(r.total)}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>اجناس پرفروش امروز</div>
          {d.top.length === 0 ? (
            <div className="empty" style={{ padding: '34px 0' }}>وقتی فروش شروع شود اینجا نشان داده می‌شود.</div>
          ) : (
            <div className="stack" style={{ gap: 15 }}>
              {d.top.map((t) => (
                <div key={t.name}>
                  <div className="row-between" style={{ marginBottom: 7 }}>
                    <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div className="tnum" style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{num(t.units)} فروش</div>
                  </div>
                  <div className="meter"><div style={{ width: `${(t.units / topMax) * 100}%` }}></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
