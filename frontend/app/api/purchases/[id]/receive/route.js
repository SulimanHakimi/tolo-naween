import { route, ok, fail, body } from '@/lib/route';
import { Purchase, Product, Supplier, Transaction, logAct } from '@/lib/models';
import { jDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Receive a purchase order. Stock goes up and each product's buy price is updated to
 * what this delivery actually cost, so margins always reflect the latest cost.
 *
 * Paying on the spot books the expense; otherwise the amount joins what the shop
 * owes that supplier and shows up under قرضداری. Either way the entry is tagged
 * 'stock' so the profit and loss report does not count it twice.
 */
export const POST = route(async (request, { params, user }) => {
  const po = await Purchase.findById(params.id);
  if (!po) return fail('سفارش خرید پیدا نشد', 404);
  if (po.status === 'تحویل شده') return fail('این سفارش قبلاً تحویل شده است');

  const { paid } = await body(request);
  const sup = await Supplier.findOne({ name: po.supplier });
  if (!sup) return fail('تهیه‌کننده پیدا نشد', 404);

  for (const l of po.lines) {
    const product = await Product.findById(l.product);
    if (!product) continue;                          // product deleted after ordering
    product.stock += l.qty;
    product.buy = l.cost;
    // A price rise on cost must never leave the shop selling below cost.
    if (product.retail < l.cost) product.retail = l.cost;
    if (product.wholesale && product.wholesale < l.cost) product.wholesale = l.cost;
    await product.save();
  }

  po.status = 'تحویل شده';
  po.paid = !!paid;
  po.receivedAt = new Date();
  await po.save();

  sup.lastOrder = jDate(po.receivedAt);
  if (paid) {
    await Transaction.create({ type: 'مصرف', tag: 'stock', desc: `پرداخت ${po.po} — ${sup.name}`, amount: po.total });
  } else {
    sup.balance += po.total;
  }
  await sup.save();

  await logAct(user.name, `سفارش خرید ${po.po} را تحویل گرفت`);
  return ok(po);
});
