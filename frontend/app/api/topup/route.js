import { route, ok, fail, body } from '@/lib/route';
import { Topup, Customer, Transaction, getTopupAccount, nextSeq, logAct } from '@/lib/models';
import { TOPUP_PAYMENTS } from '@/lib/labels';
import { midnight, topupTotals } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const DAY = 864e5;

// The recent topups, the account behind them, and what today and the last thirty days
// have earned.
export const GET = route(async (request) => {
  const p = new URL(request.url).searchParams;
  const limit = Math.min(+p.get('limit') || 60, 300);
  const today = midnight(new Date());

  const [account, topups, todayRows, monthRows] = await Promise.all([
    getTopupAccount(),
    Topup.find().sort({ date: -1 }).limit(limit),
    Topup.find({ date: { $gte: today } }),
    Topup.find({ date: { $gte: new Date(today.getTime() - 29 * DAY) } })
  ]);

  return ok({ account, topups, today: topupTotals(todayRows), month: topupTotals(monthRows) });
});

/**
 * Send a topup to a number. Any network is fine — it all comes out of the one pool of
 * credit. The customer hands over the face value and the shop keeps the commission,
 * so the balance falls by the full amount while the earning is frozen on the record
 * at the rate in force that day.
 */
export const POST = route(async (request, { user }) => {
  const { phone, amount, customer, payment } = await body(request);
  const a = await getTopupAccount();

  const number = String(phone || '').trim();
  if (!/^[0-9+\s-]{6,20}$/.test(number)) return fail('شماره موبایل را درست وارد کنید');

  const value = Math.round(+amount);
  if (!value || value <= 0) return fail('مبلغ تاپ‌آپ را وارد کنید');
  if (value > a.balance) {
    return fail(`اعتبار کافی نیست — ${Math.round(a.balance).toLocaleString('en-US')} باقی است`);
  }

  const pay = TOPUP_PAYMENTS.includes(payment) ? payment : 'نقد';
  const name = String(customer || '').trim();
  if (pay === 'قرض' && !name) return fail('برای تاپ‌آپ قرضی نام مشتری لازم است');

  const seq = await nextSeq('topup');
  const t = await Topup.create({
    no: `TP-${seq}`, date: new Date(), phone: number,
    amount: value, rate: a.commissionPer1000,
    commission: Math.round((value / 1000) * a.commissionPer1000),
    customer: name || 'مشتری نقدی', payment: pay, servedBy: user.name
  });

  a.balance -= value;
  await a.save();

  // A named customer is remembered the same way a bill remembers one; a walk-in
  // buying credit for cash creates no record.
  if (name) {
    const existing = await Customer.findOne({ $or: [{ name }, { phone: number }] });
    if (existing) {
      existing.lastBuy = t.date;
      if (!existing.phone) existing.phone = number;
      if (pay === 'قرض') existing.credit += value;
      await existing.save();
    } else {
      await Customer.create({
        name, phone: number, since: t.date, lastBuy: t.date,
        credit: pay === 'قرض' ? value : 0
      });
    }
  }

  // Credit sales are income only once the money actually arrives, exactly as at the
  // till. Cash tagged 'topup' stays out of the profit and loss expense line.
  if (pay !== 'قرض') {
    await Transaction.create({
      type: 'درآمد', tag: 'topup', desc: `فروش تاپ‌آپ ${t.no} — ${number}`, amount: value
    });
  }

  await logAct(user.name, `تاپ‌آپ ${value.toLocaleString('en-US')} برای ${number} فرستاد (${t.no})`);
  return ok(t, 201);
});
