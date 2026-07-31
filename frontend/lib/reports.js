import { Sale, Return, Product } from './models';
import { JDAYS } from './jalali';

const DAY = 864e5;

export const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Calendar windows — never row counts, because days without sales have no rows. */
function windowFor(period) {
  const today = midnight(new Date());
  const days = { daily: 1, weekly: 7, monthly: 30 }[period] || 1;
  const curFrom = new Date(today.getTime() - (days - 1) * DAY);
  const curTo = new Date(today.getTime() + DAY);
  return {
    days, curFrom, curTo,
    prevFrom: new Date(curFrom.getTime() - days * DAY),
    prevTo: curFrom
  };
}

/**
 * Gross figures straight from the bills. `profit` is the margin on what was sold,
 * less every discount given away — the number the shop actually keeps.
 */
export function saleTotals(sales) {
  return sales.reduce((a, s) => {
    const margin = s.items.reduce((t, i) => t + (i.price - i.buy) * i.qty, 0);
    return {
      rev: a.rev + s.total,
      profit: a.profit + margin - (s.autoDisc || 0) - (s.disc || 0),
      bills: a.bills + 1,
      units: a.units + s.items.reduce((t, i) => t + i.qty, 0)
    };
  }, { rev: 0, profit: 0, bills: 0, units: 0 });
}

/**
 * What returns cost. Restocked goods only give back the margin that was booked;
 * goods too damaged to resell also lose their purchase cost.
 */
export function returnTotals(returns) {
  return returns.reduce((a, r) => {
    const impact = r.items.reduce((t, i) => t + (r.restocked ? (i.price - i.buy) : i.price) * i.qty, 0);
    return {
      refunded: a.refunded + r.total,
      profitLoss: a.profitLoss + impact,
      units: a.units + r.items.reduce((t, i) => t + i.qty, 0),
      count: a.count + 1
    };
  }, { refunded: 0, profitLoss: 0, units: 0, count: 0 });
}

/** The dashboard's seven bars: one per day of the current Dari week. */
export async function weekBars() {
  const today = midnight(new Date());
  // getDay(): 0=Sunday … 6=Saturday. The week opens on Saturday.
  const back = (today.getDay() + 1) % 7;
  const start = new Date(today.getTime() - back * DAY);

  const sales = await Sale.find({ date: { $gte: start, $lt: new Date(today.getTime() + DAY) } }).select('date total');

  return Array.from({ length: 7 }, (_, i) => {
    const from = new Date(start.getTime() + i * DAY);
    const to = new Date(from.getTime() + DAY);
    return {
      day: JDAYS[from.getDay()],
      value: sales.filter((s) => s.date >= from && s.date < to).reduce((t, s) => t + s.total, 0),
      future: from > today
    };
  });
}

/** Fixed calendar slices, so a stretch with no sales shows as a zero bar. */
export async function periodBars(period) {
  const today = midnight(new Date());
  const since = new Date(today.getTime() - 200 * DAY);
  const sales = await Sale.find({ date: { $gte: since } }).select('date total');
  const sum = (from, to) => sales.filter((s) => s.date >= from && s.date < to).reduce((t, s) => t + s.total, 0);

  if (period === 'monthly') {
    return Array.from({ length: 6 }, (_, k) => {
      const from = new Date(today.getFullYear(), today.getMonth() - (5 - k), 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      return { day: String(from.getMonth() + 1), value: sum(from, to) };
    });
  }
  if (period === 'weekly') {
    return Array.from({ length: 7 }, (_, k) => {
      const from = new Date(today.getTime() - (6 - k) * DAY);
      return { day: JDAYS[from.getDay()], value: sum(from, new Date(from.getTime() + DAY)) };
    });
  }
  return Array.from({ length: 8 }, (_, k) => {
    const from = new Date(today.getTime() + (k - 7) * DAY);
    return { day: String(from.getDate()), value: sum(from, new Date(from.getTime() + DAY)) };
  });
}

/**
 * Real movers, straight from the bill lines in the window. Slow movers include
 * products that sold nothing at all — those are the ones tying up cash.
 */
export async function movers(sales) {
  const products = await Product.find().select('name category stock buy');
  const units = {};
  const revenue = {};
  const cats = {};
  const categoryOf = Object.fromEntries(products.map((p) => [p.name, p.category]));

  for (const s of sales) {
    for (const i of s.items) {
      const sold = i.qty - (i.returned || 0);
      if (sold <= 0) continue;
      units[i.name] = (units[i.name] || 0) + sold;
      revenue[i.name] = (revenue[i.name] || 0) + i.price * sold;
      const c = categoryOf[i.name] || 'متفرقه';
      cats[c] = (cats[c] || 0) + i.price * sold;
    }
  }

  const ranked = Object.keys(units).sort((a, b) => units[b] - units[a]);
  const catTotal = Object.values(cats).reduce((t, v) => t + v, 0);

  // Stocked products with no movement first, then the weakest sellers.
  const idle = products
    .filter((p) => p.stock > 0 && !units[p.name])
    .sort((a, b) => b.buy * b.stock - a.buy * a.stock)
    .slice(0, 5)
    .map((p) => ({ name: p.name, units: 0, rev: 0, tied: p.buy * p.stock }));

  const weak = ranked.slice(-5).reverse()
    .filter((n) => !ranked.slice(0, 5).includes(n))
    .map((name) => ({ name, units: units[name], rev: revenue[name], tied: 0 }));

  return {
    top: ranked.slice(0, 5).map((name, i) => ({ rank: i + 1, name, units: units[name], rev: revenue[name] })),
    slow: [...idle, ...weak].slice(0, 5),
    cats: Object.entries(cats).sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount, pct: catTotal ? Math.round(amount / catTotal * 100) : 0 }))
  };
}

/** Everything the reports screen needs for one period. */
export async function periodData(period) {
  const w = windowFor(period);
  const [cur, prev, curReturns, prevReturns] = await Promise.all([
    Sale.find({ date: { $gte: w.curFrom, $lt: w.curTo } }),
    Sale.find({ date: { $gte: w.prevFrom, $lt: w.prevTo } }),
    Return.find({ date: { $gte: w.curFrom, $lt: w.curTo } }),
    Return.find({ date: { $gte: w.prevFrom, $lt: w.prevTo } })
  ]);

  return {
    window: w,
    cur: saleTotals(cur), prev: saleTotals(prev),
    returns: returnTotals(curReturns), prevReturns: returnTotals(prevReturns),
    sales: cur
  };
}

export const RANGE_LABEL = { daily: 'امروز', weekly: 'هفتهٔ گذشته (۷ روز)', monthly: 'ماه گذشته (۳۰ روز)' };
export const RANGE_TITLE = { daily: 'راپور روزانه', weekly: 'راپور هفته‌وار', monthly: 'راپور ماهوار' };
