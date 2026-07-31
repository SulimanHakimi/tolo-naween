import { route, ok, fail, body } from '@/lib/route';
import { Employee, Transaction, logAct } from '@/lib/models';
import { jLong } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Pay a month's salary. Booked as a real operating expense, so it lands in the
// profit and loss report rather than disappearing into cost of goods.
export const POST = route(async (request, { params, user }) => {
  const e = await Employee.findById(params.id);
  if (!e) return fail('کارمند پیدا نشد', 404);

  const { amount } = await body(request);
  const value = +amount || e.salary;
  if (value <= 0) return fail('مبلغ معاش را وارد کنید');

  e.lastPaid = new Date();
  await e.save();

  await Transaction.create({
    type: 'مصرف', tag: 'salary',
    desc: `معاش ${e.name} — ${jLong(e.lastPaid)}`,
    amount: value
  });
  await logAct(user.name, `معاش «${e.name}» را پرداخت کرد`);
  return ok(e);
});
