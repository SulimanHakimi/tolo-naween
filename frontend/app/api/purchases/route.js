import { route, ok, fail, body } from '@/lib/route';
import { Purchase, Product, Supplier, nextSeq, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const limit = Math.min(+new URL(request.url).searchParams.get('limit') || 100, 300);
  return ok(await Purchase.find().sort({ date: -1 }).limit(limit));
}, { perms: ['pur'] });

/**
 * Raise a purchase order. Nothing reaches stock here — an order is a promise, not a
 * delivery. POST /api/purchases/:id/receive is what moves goods and money.
 */
export const POST = route(async (request, { user }) => {
  const { supplier, lines } = await body(request);

  const sup = await Supplier.findOne({ name: supplier });
  if (!sup) return fail('تهیه‌کننده پیدا نشد', 404);
  if (!Array.isArray(lines) || !lines.length) return fail('حداقل یک قلم جنس به سفارش اضافه کنید');

  const resolved = [];
  for (const l of lines) {
    const product = await Product.findById(l.product);
    const qty = Math.floor(+l.qty);
    const cost = +l.cost;
    if (!product) return fail('یکی از اقلام سفارش پیدا نشد');
    if (!qty || qty < 1) return fail(`تعداد «${product.name}» را وارد کنید`);
    if (!cost || cost <= 0) return fail(`قیمت خرید «${product.name}» را وارد کنید`);
    resolved.push({ product: product._id, name: product.name, qty, cost });
  }

  const seq = await nextSeq('po');
  const po = await Purchase.create({
    po: `PO-${seq}`, supplier: sup.name, date: new Date(),
    lines: resolved,
    total: resolved.reduce((t, l) => t + l.qty * l.cost, 0),
    status: 'در انتظار', paid: false, createdBy: user.name
  });

  await logAct(user.name, `سفارش خرید ${po.po} را برای «${sup.name}» ثبت کرد`);
  return ok(po, 201);
}, { perms: ['pur'] });
