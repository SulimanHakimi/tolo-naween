import { route, ok } from '@/lib/route';
import { Product, Transaction, Expense, getSettings } from '@/lib/models';
import { periodData, movers, byCategory, RANGE_LABEL, RANGE_TITLE, EXCLUDED_TAGS } from '@/lib/reports';
import { stockStatus } from '@/lib/ui';
import { daysTo, jLong } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PERIODS = ['daily', 'weekly', 'monthly'];
const TYPES = ['sales', 'pl', 'stock'];

/** The figures behind a printable report. Same maths as /api/reports. */
export const GET = route(async (request) => {
  const q = new URL(request.url).searchParams;
  const type = TYPES.includes(q.get('type')) ? q.get('type') : 'sales';
  const period = PERIODS.includes(q.get('period')) ? q.get('period') : 'daily';

  if (type === 'stock') {
    const settings = await getSettings();
    const products = await Product.find();
    const flagged = products.map((p) => stockStatus(p, settings, daysTo(p.expiry)));

    return ok({
      type, title: 'راپور گدام',
      range: 'به تاریخ ' + jLong(new Date()),
      items: products.length,
      units: products.reduce((t, p) => t + p.stock, 0),
      buyValue: products.reduce((t, p) => t + p.buy * p.stock, 0),
      sellValue: products.reduce((t, p) => t + p.retail * p.stock, 0),
      lowCount: flagged.filter((s) => s.key === 'low').length,
      outCount: flagged.filter((s) => s.key === 'out').length,
      expCount: flagged.filter((s) => s.key === 'exp' || s.key === 'expired').length,
      rows: [...products].sort((a, b) => b.buy * b.stock - a.buy * a.stock).slice(0, 10)
        .map((p) => ({ name: p.name, stock: p.stock, unit: p.unit, value: p.buy * p.stock }))
    });
  }

  const pd = await periodData(period);
  const window = { $gte: pd.window.curFrom, $lt: pd.window.curTo };
  const expenses = await Transaction.find({ type: 'مصرف', t: window });
  const other = expenses.filter((e) => !EXCLUDED_TAGS.includes(e.tag)).reduce((t, e) => t + e.amount, 0);
  const discounts = pd.sales.reduce((t, s) => t + (s.autoDisc || 0) + (s.disc || 0), 0);
  const netProfit = pd.cur.profit - pd.returns.profitLoss - other + pd.topup.commission;

  if (type === 'pl') {
    return ok({
      type, title: 'راپور مفاد و ضرر', range: RANGE_LABEL[period],
      revenue: pd.cur.rev,
      cogs: pd.cur.rev - pd.cur.profit,
      grossProfit: pd.cur.profit,
      discounts, returnLoss: pd.returns.profitLoss,
      otherExpenses: other,
      topupAmount: pd.topup.amount, topupCount: pd.topup.count,
      topupProfit: pd.topup.commission,
      expenseCats: byCategory(await Expense.find({ date: window })),
      netProfit
    });
  }

  const mv = await movers(pd.sales);
  return ok({
    type, title: RANGE_TITLE[period], range: RANGE_LABEL[period],
    rev: pd.cur.rev, netProfit, bills: pd.cur.bills,
    avg: pd.cur.bills ? pd.cur.rev / pd.cur.bills : 0,
    top: mv.top, cats: mv.cats
  });
});
