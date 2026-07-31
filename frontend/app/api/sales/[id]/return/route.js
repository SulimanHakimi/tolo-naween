import { route, ok, fail, body } from '@/lib/route';
import { Sale, Return, Product, Customer, Transaction, nextSeq, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

/**
 * Take goods back against a bill. Quantities are checked against what is left on
 * each line, so the same item can never be refunded twice. `restock: false` is for
 * goods that come back damaged — the money is refunded but the stock is not.
 *
 * A return on a credit sale reduces the customer's debt instead of paying out cash.
 */
export const POST = route(async (request, { params, user }) => {
  const sale = await Sale.findById(params.id);
  if (!sale) return fail('بل پیدا نشد', 404);

  const { items, reason, restock } = await body(request);
  if (!Array.isArray(items) || !items.length) return fail('هیچ جنسی برای برگشت انتخاب نشده');

  const restocked = restock !== false;
  const taken = [];

  for (const req of items) {
    const line = sale.items.find((i) => i.name === req.name);
    if (!line) return fail(`«${req.name}» در این بل نیست`);

    const qty = Math.floor(+req.qty);
    const left = line.qty - (line.returned || 0);
    if (!qty || qty < 1) continue;
    if (qty > left) return fail(`از «${line.name}» فقط ${left} ${line.unit} قابل برگشت است`);

    line.returned = (line.returned || 0) + qty;
    taken.push({ line, qty });
  }
  if (!taken.length) return fail('تعداد برگشتی را وارد کنید');

  const total = taken.reduce((t, { line, qty }) => t + line.price * qty, 0);
  const seq = await nextSeq('return');

  const rec = await Return.create({
    rn: `R-${seq}`, sale: sale.no, date: new Date(),
    items: taken.map(({ line, qty }) => ({ name: line.name, qty, price: line.price, buy: line.buy })),
    total, reason: String(reason || '').trim(), restocked, handledBy: user.name
  });

  // The `returned` counters live inside a subdocument array; marking the path keeps
  // mongoose from skipping them and letting the same units be refunded twice.
  sale.markModified('items');
  await sale.save();

  if (restocked) {
    for (const { line, qty } of taken) {
      if (line.product) await Product.updateOne({ _id: line.product }, { $inc: { stock: qty } });
    }
  }

  if (sale.payment === 'قرض') {
    const c = await Customer.findOne({ name: sale.customer });
    if (c) { c.credit = Math.max(0, c.credit - total); await c.save(); }
  } else {
    await Transaction.create({ type: 'مصرف', tag: 'return', desc: `برگشتی بل ${sale.no}`, amount: total });
  }

  await logAct(user.name, `برگشتی ${rec.rn} برای بل #${sale.no} را ثبت کرد`);
  return ok({ return: rec, sale }, 201);
}, { perms: ['pos', 'rep'] });
