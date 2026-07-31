import { route, ok, fail, body } from '@/lib/route';
import { Discount, logAct } from '@/lib/models';
import { validateDiscount } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// The till applies these on every line, so any account that can sell may read them.
export const GET = route(async () => ok(await Discount.find().sort({ active: -1, createdAt: -1 })));

export const POST = route(async (request, { user }) => {
  const b = await body(request);
  const bad = validateDiscount(b);
  if (bad) return fail(bad);

  const d = await Discount.create({
    name: b.name.trim(), kind: b.kind, value: +b.value,
    scope: b.scope, target: b.scope === 'all' ? '' : b.target.trim(),
    from: b.from ? new Date(b.from) : null,
    to: b.to ? new Date(b.to) : null,
    active: b.active !== false
  });
  await logAct(user.name, `تخفیف «${d.name}» را ایجاد کرد`);
  return ok(d, 201);
});
