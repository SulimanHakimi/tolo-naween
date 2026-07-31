import { route, ok, fail, body } from '@/lib/route';
import { Customer, Transaction, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Collect an outstanding قرض balance. Partial payments are normal, so an amount may
// be given; leaving it empty settles the whole balance.
export const POST = route(async (request, { params, user }) => {
  const c = await Customer.findById(params.id);
  if (!c) return fail('مشتری پیدا نشد', 404);
  if (c.credit <= 0) return fail('این مشتری قرض ندارد');

  const { amount } = await body(request);
  const value = +amount || c.credit;
  if (value <= 0) return fail('مبلغ را وارد کنید');
  if (value > c.credit) return fail(`قرض این مشتری ${Math.round(c.credit).toLocaleString('en-US')} است`);

  c.credit -= value;
  await c.save();
  await Transaction.create({ type: 'درآمد', tag: 'credit', desc: `پرداخت قرض — ${c.name}`, amount: value });
  await logAct(user.name, `${Math.round(value).toLocaleString('en-US')} قرض از «${c.name}» گرفت`);
  return ok(c);
}, { perms: ['cust'] });
