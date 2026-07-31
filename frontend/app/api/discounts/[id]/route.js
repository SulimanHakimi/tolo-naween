import { route, ok, fail, body } from '@/lib/route';
import { Discount, logAct } from '@/lib/models';
import { validateDiscount } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export const PUT = route(async (request, { params, user }) => {
  const d = await Discount.findById(params.id);
  if (!d) return fail('تخفیف پیدا نشد', 404);

  const b = await body(request);
  // Toggling active on its own must not have to resend the whole rule.
  if (Object.keys(b).length === 1 && b.active !== undefined) {
    d.active = !!b.active;
    await d.save();
    await logAct(user.name, `تخفیف «${d.name}» را ${d.active ? 'فعال' : 'غیرفعال'} کرد`);
    return ok(d);
  }

  const merged = {
    name: b.name ?? d.name, kind: b.kind ?? d.kind, value: b.value ?? d.value,
    scope: b.scope ?? d.scope, target: b.target ?? d.target,
    from: b.from ?? d.from, to: b.to ?? d.to
  };
  const bad = validateDiscount(merged);
  if (bad) return fail(bad);

  d.name = merged.name.trim();
  d.kind = merged.kind;
  d.value = +merged.value;
  d.scope = merged.scope;
  d.target = merged.scope === 'all' ? '' : String(merged.target).trim();
  d.from = merged.from ? new Date(merged.from) : null;
  d.to = merged.to ? new Date(merged.to) : null;
  if (b.active !== undefined) d.active = !!b.active;

  await d.save();
  await logAct(user.name, `تخفیف «${d.name}» را تغییر داد`);
  return ok(d);
});

export const DELETE = route(async (request, { params, user }) => {
  const d = await Discount.findById(params.id);
  if (!d) return fail('تخفیف پیدا نشد', 404);
  await d.deleteOne();
  await logAct(user.name, `تخفیف «${d.name}» را حذف کرد`);
  return ok({ ok: true });
});
