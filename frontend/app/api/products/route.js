import { route, ok, fail, body } from '@/lib/route';
import { Product, logAct } from '@/lib/models';
import { validateProduct } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// The POS grid, the pricing screen and every product picker need this, so any
// signed-in account may read it.
export const GET = route(async () => ok(await Product.find().sort({ name: 1 })));

export const POST = route(async (request, { user }) => {
  const b = await body(request);
  const bad = validateProduct(b);
  if (bad) return fail(bad);

  const barcode = b.barcode?.trim() || '';
  if (barcode && await Product.findOne({ barcode })) {
    return fail('این بارکد قبلاً برای جنس دیگری ثبت شده است');
  }

  const p = await Product.create({
    name: b.name.trim(), category: b.category.trim(), unit: b.unit.trim(),
    supplier: b.supplier?.trim() || '', barcode,
    buy: +b.buy, retail: +b.retail, wholesale: +b.wholesale || 0,
    stock: Math.max(0, Math.floor(+b.stock) || 0),
    expiry: b.expiry || ''
  });
  await logAct(user.name, `جنس «${p.name}» را ثبت کرد`);
  return ok(p, 201);
}, { perms: ['inv'] });
