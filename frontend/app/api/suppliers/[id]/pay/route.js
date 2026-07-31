import { route, ok, fail, body } from '@/lib/route';
import { Supplier, Transaction, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Pay down what the shop owes a supplier; records the cash going out. Tagged
// 'stock' so the profit and loss report does not count it twice.
export const POST = route(async (request, { params, user }) => {
  const s = await Supplier.findById(params.id);
  if (!s) return fail('تهیه‌کننده پیدا نشد', 404);
  if (s.balance <= 0) return fail('این تهیه‌کننده قرضداری ندارد');

  const { amount } = await body(request);
  const value = +amount || s.balance;
  if (value <= 0) return fail('مبلغ پرداخت را وارد کنید');
  if (value > s.balance) return fail(`قرضداری این تهیه‌کننده ${Math.round(s.balance).toLocaleString('en-US')} است`);

  s.balance -= value;
  await s.save();
  await Transaction.create({ type: 'مصرف', tag: 'stock', desc: `پرداخت به تهیه‌کننده — ${s.name}`, amount: value });
  await logAct(user.name, `${Math.round(value).toLocaleString('en-US')} به «${s.name}» پرداخت کرد`);
  return ok(s);
});
