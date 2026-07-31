import { route, ok } from '@/lib/route';
import { Sale, Product, Return, getSettings } from '@/lib/models';
import { midnight, saleTotals, returnTotals, weekBars, movers } from '@/lib/reports';
import { stockStatus, needsAttention } from '@/lib/ui';
import { daysTo } from '@/lib/format';

export const dynamic = 'force-dynamic';

const DAY = 864e5;

export const GET = route(async () => {
  const settings = await getSettings();
  const today = midnight(new Date());
  const yesterday = new Date(today.getTime() - DAY);

  const [todaySales, yesterdaySales, products, todayReturns, bars] = await Promise.all([
    Sale.find({ date: { $gte: today } }).sort({ date: -1 }),
    Sale.find({ date: { $gte: yesterday, $lt: today } }),
    Product.find(),
    Return.find({ date: { $gte: today } }),
    weekBars()
  ]);

  const cur = saleTotals(todaySales);
  const prev = saleTotals(yesterdaySales);
  const ret = returnTotals(todayReturns);

  // One pass over the catalogue gives both the alert list and the sidebar badge.
  const flagged = products
    .map((p) => ({ p, s: stockStatus(p, settings, daysTo(p.expiry)) }))
    .filter(({ s }) => needsAttention(s));

  const rank = { out: 0, expired: 1, exp: 2, low: 3 };
  flagged.sort((a, b) => (rank[a.s.key] - rank[b.s.key]) || (a.p.stock - b.p.stock));

  const { top } = await movers(todaySales);

  return ok({
    sales: cur.rev,
    salesDelta: prev.rev ? Math.round((cur.rev - prev.rev) / prev.rev * 100) : null,
    bills: cur.bills,
    billsDelta: cur.bills - prev.bills,
    profit: cur.profit - ret.profitLoss,
    profitDelta: prev.profit ? Math.round((cur.profit - ret.profitLoss - prev.profit) / prev.profit * 100) : null,
    alertCount: flagged.length,
    outCount: flagged.filter(({ s }) => s.key === 'out').length,
    lowCount: flagged.filter(({ s }) => s.key === 'low').length,
    expCount: flagged.filter(({ s }) => s.key === 'exp' || s.key === 'expired').length,
    alerts: flagged.slice(0, 5).map(({ p, s }) => ({
      name: p.name, unit: p.unit, stock: p.stock, note: s.note, color: s.color
    })),
    bars,
    weekTotal: bars.reduce((t, b) => t + b.value, 0),
    recent: todaySales.slice(0, 5).map((s) => ({
      id: s._id, no: s.no, date: s.date, items: s.items.length,
      payment: s.payment, total: s.total
    })),
    top
  });
});
