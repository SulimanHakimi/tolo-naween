import { route, ok, fail, body } from '@/lib/route';
import { Customer, Sale, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const PUT = route(async (request, { params, user }) => {
  const c = await Customer.findById(params.id);
  if (!c) return fail('مشتری پیدا نشد', 404);

  const b = await body(request);
  if (b.phone !== undefined) {
    const phone = String(b.phone).trim();
    if (phone) {
      const clash = await Customer.findOne({ phone, _id: { $ne: c._id } });
      if (clash) return fail(`این شماره برای «${clash.name}» ثبت شده است`);
    }
    c.phone = phone;
  }
  if (b.name?.trim() && b.name.trim() !== c.name) {
    // Bills reference the customer by name, so keep the history pointing at them.
    await Sale.updateMany({ customer: c.name }, { customer: b.name.trim() });
    c.name = b.name.trim();
  }
  if (b.note !== undefined) c.note = String(b.note).trim();

  await c.save();
  await logAct(user.name, `معلومات مشتری «${c.name}» را تغییر داد`);
  return ok(c);
}, { perms: ['cust'] });

export const DELETE = route(async (request, { params, user }) => {
  const c = await Customer.findById(params.id);
  if (!c) return fail('مشتری پیدا نشد', 404);
  if (c.credit > 0) return fail('این مشتری قرض دارد — اول تسویه کنید');

  await c.deleteOne();
  await logAct(user.name, `مشتری «${c.name}» را حذف کرد`);
  return ok({ ok: true });
}, { perms: ['cust'] });
