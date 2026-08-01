import { route, ok } from '@/lib/route';
import { Transaction, Customer, Supplier, Expense, getTopupAccount } from '@/lib/models';
import { periodData, periodBars, movers, byCategory, RANGE_LABEL, EXCLUDED_TAGS } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const PERIODS = ['daily', 'weekly', 'monthly'];

/** Everything the راپورها screen shows for one period. */
export const GET = route(async (request) => {
  const asked = new URL(request.url).searchParams.get('period');
  const period = PERIODS.includes(asked) ? asked : 'daily';

  const pd = await periodData(period);
  const window = { $gte: pd.window.curFrom, $lt: pd.window.curTo };
  const [bars, mv, expenses, shopExpenses, account, receivable, payable] = await Promise.all([
    periodBars(period),
    movers(pd.sales),
    Transaction.find({ type: 'مصرف', t: window }),
    Expense.find({ date: window }),
    getTopupAccount(),
    Customer.aggregate([{ $group: { _id: null, sum: { $sum: '$credit' } } }]),
    Supplier.aggregate([{ $group: { _id: null, sum: { $sum: '$balance' } } }])
  ]);

  // Stock purchases already sit inside cost of goods sold, returns are handled through
  // returnTotals, and airtime is carried by its commission — counting any of them here
  // would double them.
  const other = expenses.filter((e) => !EXCLUDED_TAGS.includes(e.tag)).reduce((t, e) => t + e.amount, 0);

  const discounts = pd.sales.reduce((t, s) => t + (s.autoDisc || 0) + (s.disc || 0), 0);
  const netProfit = pd.cur.profit - pd.returns.profitLoss - other + pd.topup.commission;

  const pct = (now, before) => (before ? Math.round((now - before) / before * 100) : null);
  const prevNet = pd.prev.profit - pd.prevReturns.profitLoss + pd.prevTopup.commission;

  return ok({
    period, range: RANGE_LABEL[period],
    rev: pd.cur.rev, revDelta: pct(pd.cur.rev, pd.prev.rev),
    bills: pd.cur.bills, billsDelta: pd.cur.bills - pd.prev.bills,
    units: pd.cur.units,
    grossProfit: pd.cur.profit,
    netProfit, netProfitDelta: pct(netProfit, prevNet),
    margin: pd.cur.rev ? Math.round(netProfit / pd.cur.rev * 100) : 0,
    cogs: pd.cur.rev - pd.cur.profit,
    discounts, otherExpenses: other,
    returns: pd.returns.refunded, returnUnits: pd.returns.units,
    returnCount: pd.returns.count, returnLoss: pd.returns.profitLoss,
    topupAmount: pd.topup.amount, topupCount: pd.topup.count,
    topupProfit: pd.topup.commission,
    topupProfitDelta: pct(pd.topup.commission, pd.prevTopup.commission),
    creditLeft: account.balance, creditOwed: account.owed,
    expenseCats: byCategory(shopExpenses),
    avg: pd.cur.bills ? pd.cur.rev / pd.cur.bills : 0,
    bars,
    top: mv.top, slow: mv.slow, cats: mv.cats,
    receivable: receivable[0]?.sum || 0,
    payable: payable[0]?.sum || 0
  });
});
