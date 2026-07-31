import { route, ok, fail, body } from '@/lib/route';
import { Supplier, Product, Purchase, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const PUT = route(async (request, { params, user }) => {
  const s = await Supplier.findById(params.id);
  if (!s) return fail('تهیه‌کننده پیدا نشد', 404);

  const b = await body(request);
  if (b.name?.trim() && b.name.trim() !== s.name) {
    const clash = await Supplier.findOne({ name: b.name.trim(), _id: { $ne: s._id } });
    if (clash) return fail('تهیه‌کننده‌ای با این نام موجود است');
    // Products carry the supplier by name, so a rename has to follow through.
    await Product.updateMany({ supplier: s.name }, { supplier: b.name.trim() });
    await Purchase.updateMany({ supplier: s.name }, { supplier: b.name.trim() });
    s.name = b.name.trim();
  }
  for (const k of ['person', 'phone', 'address', 'supplies']) {
    if (b[k] !== undefined) s[k] = String(b[k]).trim();
  }

  await s.save();
  await logAct(user.name, `معلومات تهیه‌کننده «${s.name}» را تغییر داد`);
  return ok(s);
});

export const DELETE = route(async (request, { params, user }) => {
  const s = await Supplier.findById(params.id);
  if (!s) return fail('تهیه‌کننده پیدا نشد', 404);
  if (s.balance > 0) return fail('این تهیه‌کننده قرضداری دارد — اول تسویه کنید');

  const used = await Product.countDocuments({ supplier: s.name });
  if (used) return fail(`${used} قلم جنس به این تهیه‌کننده وصل است`);

  await s.deleteOne();
  await logAct(user.name, `تهیه‌کننده «${s.name}» را حذف کرد`);
  return ok({ ok: true });
});
