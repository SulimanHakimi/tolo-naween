import { route, ok, fail, body } from '@/lib/route';
import { Product, logAct } from '@/lib/models';
import { validateProduct } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/**
 * Editing a product. The pricing screen sends only `retail` and `wholesale`, so
 * every field falls back to what is already stored before validation runs.
 */
export const PUT = route(async (request, { params, user }) => {
  const p = await Product.findById(params.id);
  if (!p) return fail('جنس پیدا نشد', 404);

  const b = await body(request);
  const bad = validateProduct({
    name: b.name ?? p.name, category: b.category ?? p.category, unit: b.unit ?? p.unit,
    buy: b.buy ?? p.buy, retail: b.retail ?? p.retail,
    wholesale: b.wholesale ?? p.wholesale, expiry: b.expiry ?? p.expiry
  });
  if (bad) return fail(bad);

  if (b.barcode !== undefined) {
    const barcode = String(b.barcode).trim();
    if (barcode) {
      const clash = await Product.findOne({ barcode, _id: { $ne: p._id } });
      if (clash) return fail(`این بارکد برای «${clash.name}» ثبت شده است`);
    }
    p.barcode = barcode;
  }

  for (const k of ['name', 'category', 'unit', 'supplier', 'expiry']) {
    if (b[k] !== undefined) p[k] = String(b[k]).trim();
  }
  for (const k of ['buy', 'retail', 'wholesale']) {
    if (b[k] !== undefined) p[k] = +b[k] || 0;
  }
  if (b.stock !== undefined) p.stock = Math.max(0, Math.floor(+b.stock) || 0);

  await p.save();
  await logAct(user.name, `جنس «${p.name}» را تغییر داد`);
  return ok(p);
}, { perms: ['inv', 'price'] });

export const DELETE = route(async (request, { params, user }) => {
  const p = await Product.findById(params.id);
  if (!p) return fail('جنس پیدا نشد', 404);
  // Deleting stock on hand would silently destroy inventory value.
  if (p.stock > 0) return fail('جنسی که موجودی دارد حذف نمی‌شود — اول موجودی را صفر کنید');

  await p.deleteOne();
  await logAct(user.name, `جنس «${p.name}» را حذف کرد`);
  return ok({ ok: true });
}, { perms: ['inv'] });
