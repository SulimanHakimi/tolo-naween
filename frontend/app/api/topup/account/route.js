import { route, ok, fail, body } from '@/lib/route';
import { getTopupAccount, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// The single airtime account: who the credit comes from, what it earns, how much is
// left and what is still owed for it.
export const GET = route(async () => ok(await getTopupAccount()));

export const PUT = route(async (request, { user }) => {
  const a = await getTopupAccount();
  const b = await body(request);

  if (b.provider !== undefined) {
    if (!b.provider?.trim()) return fail('نام شرکت تهیه‌کنندهٔ اعتبار لازم است');
    a.provider = b.provider.trim();
  }
  if (b.phone !== undefined) a.phone = String(b.phone).trim();
  if (b.commissionPer1000 !== undefined && b.commissionPer1000 !== '') {
    const rate = +b.commissionPer1000;
    if (!(rate >= 0) || rate > 1000) return fail('کمیشن فی ۱۰۰۰ درست نیست');
    // Topups already sold keep the rate they were sold at, so past commission never
    // moves when the company changes its terms.
    a.commissionPer1000 = rate;
  }

  await a.save();
  await logAct(user.name, 'تنظیمات اعتبار تاپ‌آپ را تغییر داد');
  return ok(a);
});
