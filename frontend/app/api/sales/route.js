import { route, ok, fail, body } from '@/lib/route';
import { Product, Sale, Customer, Discount, Transaction, nextSeq, getSettings, logAct } from '@/lib/models';
import { activeDiscounts, priceLine, cartTotals } from '@/lib/pricing';
import { PAYMENTS } from '@/lib/labels';

export const dynamic = 'force-dynamic';

// Escaped so a bill number containing '.' or '*' cannot turn into a wildcard scan.
const rx = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/**
 * The bill list, filtered and paged. `sum` and `profit` cover the whole filtered set
 * rather than the page on screen, so narrowing the filter answers "what did this
 * customer / this week / credit sales actually bring in" — the page number never
 * changes those figures.
 */
export const GET = route(async (request) => {
  const p = new URL(request.url).searchParams;
  const limit = Math.min(+p.get('limit') || 200, 500);
  const page = Math.max(+p.get('page') || 1, 1);

  const filter = {};
  if (p.get('customer')) filter.customer = p.get('customer');
  if (PAYMENTS.includes(p.get('payment'))) filter.payment = p.get('payment');

  // `from` and `to` are ISO 'YYYY-MM-DD'; `to` covers the whole of that day.
  const since = p.get('since') || p.get('from');
  const until = p.get('to');
  if (since || until) {
    filter.date = {};
    if (since) filter.date.$gte = new Date(since);
    if (until) filter.date.$lt = new Date(new Date(until).getTime() + 864e5);
  }

  const q = (p.get('q') || '').trim();
  if (q.length) {
    const re = rx(q);
    filter.$or = [{ no: re }, { customer: re }, { phone: re }, { servedBy: re }];
  }

  // The same maths as saleTotals, run in the database so the totals can cover every
  // matching bill without loading them all.
  const reduceItems = (expr) => ({
    $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', expr] } }
  });

  const [sales, total, agg] = await Promise.all([
    Sale.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: filter },
      {
        $project: {
          total: 1,
          margin: reduceItems({ $multiply: [{ $subtract: ['$$this.price', '$$this.buy'] }, '$$this.qty'] }),
          given: { $add: [{ $ifNull: ['$autoDisc', 0] }, { $ifNull: ['$disc', 0] }] },
          units: reduceItems('$$this.qty')
        }
      },
      {
        $group: {
          _id: null,
          sum: { $sum: '$total' },
          profit: { $sum: { $subtract: ['$margin', '$given'] } },
          units: { $sum: '$units' }
        }
      }
    ])
  ]);

  const t = agg[0] || { sum: 0, profit: 0, units: 0 };
  return ok({
    sales, total, page, pages: Math.max(1, Math.ceil(total / limit)),
    sum: t.sum, profit: t.profit, units: t.units
  });
});

/**
 * Complete a sale from the till. Prices are recomputed here from the stored product
 * and the live discount rules — the browser only sends product ids and quantities,
 * so a tampered cart cannot invent its own prices.
 */
export const POST = route(async (request, { user }) => {
  const { items, customer, phone, discount, discMode, payment } = await body(request);
  if (!Array.isArray(items) || !items.length) return fail('سبد خرید خالی است');

  const pay = PAYMENTS.includes(payment) ? payment : 'نقد';
  if (pay === 'قرض' && !String(customer || '').trim()) {
    return fail('برای فروش قرضی نام مشتری لازم است');
  }

  const settings = await getSettings();
  const rules = activeDiscounts(await Discount.find({ active: true }));

  // Resolve every line first: nothing is written until the whole cart is valid.
  const priced = [];
  for (const it of items) {
    const product = await Product.findById(it.product);
    const qty = Math.floor(+it.qty);
    if (!product || !qty || qty < 1) return fail('یکی از اقلام سبد درست نیست');
    if (product.stock < qty) {
      return fail(`موجودی «${product.name}» کافی نیست (${product.stock} ${product.unit} باقی است)`);
    }
    priced.push({ product, line: priceLine(product, qty, settings, rules) });
  }

  const lines = priced.map((p) => p.line);
  const t = cartTotals(lines, settings, discount, discMode);

  const seq = await nextSeq('sale');
  const sale = await Sale.create({
    no: `${seq}`,
    date: new Date(),
    customer: String(customer || '').trim() || 'مشتری نقدی',
    phone: String(phone || '').trim(),
    items: priced.map(({ product, line }) => ({
      product: product._id, name: product.name, unit: product.unit,
      qty: line.qty, price: line.price, listPrice: line.listPrice, buy: line.buy, returned: 0
    })),
    sub: t.sub, autoDisc: t.autoDisc, autoDiscNote: t.autoDiscNote,
    disc: t.disc, vat: t.vat, total: t.total,
    payment: pay, servedBy: user.name
  });

  for (const { product, line } of priced) {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: -line.qty } });
  }

  // A named customer is remembered from their first purchase onward; a walk-in with
  // no name stays anonymous and creates no record.
  const named = sale.customer !== 'مشتری نقدی';
  if (named) {
    const query = sale.phone ? { $or: [{ phone: sale.phone }, { name: sale.customer }] } : { name: sale.customer };
    const existing = await Customer.findOne(query);
    if (existing) {
      existing.lastBuy = sale.date;
      if (!existing.phone && sale.phone) existing.phone = sale.phone;
      if (pay === 'قرض') existing.credit += sale.total;
      await existing.save();
    } else {
      await Customer.create({
        name: sale.customer, phone: sale.phone,
        since: sale.date, lastBuy: sale.date,
        credit: pay === 'قرض' ? sale.total : 0
      });
    }
  }

  // Credit sales are income only once the money actually arrives.
  if (pay !== 'قرض') {
    await Transaction.create({ type: 'درآمد', tag: 'sale', desc: `فروش بل ${sale.no}`, amount: sale.total });
  }

  await logAct(user.name, `فروش ${pay} بل #${sale.no} را ثبت کرد`);
  return ok(sale, 201);
});
