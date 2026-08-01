import { route, ok, fail, body } from '@/lib/route';
import { getTopupAccount, Transaction, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Pay the company for credit that was taken on account. Tagged 'topup' so the profit
// and loss report does not count it twice — airtime profit is reported from the
// commission on each topup, not from the cash moving in and out.
export const POST = route(async (request, { user }) => {
  const a = await getTopupAccount();
  if (a.owed <= 0) return fail('به شرکت قرضداری ندارید');

  const { amount } = await body(request);
  const value = +amount || a.owed;
  if (value <= 0) return fail('مبلغ پرداخت را وارد کنید');
  if (value > a.owed) return fail(`قرضداری شما ${Math.round(a.owed).toLocaleString('en-US')} است`);

  a.owed -= value;
  await a.save();
  await Transaction.create({
    type: 'مصرف', tag: 'topup', desc: `پرداخت بابت اعتبار — ${a.provider}`, amount: value
  });
  await logAct(user.name, `${Math.round(value).toLocaleString('en-US')} بابت اعتبار پرداخت کرد`);
  return ok(a);
});
