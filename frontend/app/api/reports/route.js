import { route, ok } from '@/lib/route';
import { Transaction, Customer, Supplier } from '@/lib/models';
import { periodData, periodBars, movers, RANGE_LABEL } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const PERIODS = ['daily', 'weekly', 'monthly'];

/** Everything the راپورها screen shows for one period. */
export const GET = route(async (request) => {
  const asked = new URL(request.url).searchParams.get('period');
  const period = PERIODS.includes(asked) ? asked : 'daily';

  const pd = await periodData(period);
  const [bars, mv, expenses, receivable, payable] = await Promise.all([
    periodBars(period),
    movers(pd.sales),
    Transaction.find({ type: 'مصرف', t: { $gte: pd.window.curFrom, $lt: pd.window.curTo } }),
    Customer.aggregate([{ $group: { _id: null, sum: { $sum: '$credit' } } }]),
    Supplier.aggregate([{ $group: { _id: null, sum: { $sum: '$balance' } } }])
  ]);

  // Stock purchases already sit inside cost of goods sold, and returns are handled
  // through returnTotals — counting either here would double them.
  const salaries = expenses.filter((e) => e.tag === 'salary').reduce((t, e) => t + e.amount, 0);
  const other = expenses.filter((e) => !['stock', 'salary', 'return'].includes(e.tag)).reduce((t, e) => t + e.amount, 0);

  const discounts = pd.sales.reduce((t, s) => t + (s.autoDisc || 0) + (s.disc || 0), 0);
  const netProfit = pd.cur.profit - pd.returns.profitLoss - salaries - other;

  const pct = (now, before) => (before ? Math.round((now - before) / before * 100) : null);

  return ok({
    period, range: RANGE_LABEL[period],
    rev: pd.cur.rev, revDelta: pct(pd.cur.rev, pd.prev.rev),
    bills: pd.cur.bills, billsDelta: pd.cur.bills - pd.prev.bills,
    units: pd.cur.units,
    grossProfit: pd.cur.profit,
    netProfit, netProfitDelta: pct(netProfit, pd.prev.profit - pd.prevReturns.profitLoss),
    margin: pd.cur.rev ? Math.round(netProfit / pd.cur.rev * 100) : 0,
    cogs: pd.cur.rev - pd.cur.profit,
    discounts, salaries, otherExpenses: other,
    returns: pd.returns.refunded, returnUnits: pd.returns.units,
    returnCount: pd.returns.count, returnLoss: pd.returns.profitLoss,
    avg: pd.cur.bills ? pd.cur.rev / pd.cur.bills : 0,
    bars,
    top: mv.top, slow: mv.slow, cats: mv.cats,
    receivable: receivable[0]?.sum || 0,
    payable: payable[0]?.sum || 0
  });
}, { perms: ['rep'] });
