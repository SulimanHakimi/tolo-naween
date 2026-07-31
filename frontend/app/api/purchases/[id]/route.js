import { route, ok, fail } from '@/lib/route';
import { Purchase, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Only an order still waiting for delivery may be cancelled — a received one has
// already changed stock and the books.
export const DELETE = route(async (request, { params, user }) => {
  const po = await Purchase.findById(params.id);
  if (!po) return fail('سفارش خرید پیدا نشد', 404);
  if (po.status === 'تحویل شده') return fail('سفارش تحویل‌شده لغو نمی‌شود');

  await po.deleteOne();
  await logAct(user.name, `سفارش خرید ${po.po} را لغو کرد`);
  return ok({ ok: true });
}, { perms: ['pur'] });
