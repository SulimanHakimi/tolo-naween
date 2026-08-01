import { route, ok, fail, body } from '@/lib/route';
import { Expense, Transaction, logAct } from '@/lib/models';
import { SHOP_PURSE, expenseTag } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * Edit an expense, or mark that whoever fronted the money has been paid back.
 * Paying somebody back is a movement between the till and that person, not a second
 * expense, so it writes no new cash-book entry.
 */
export const PUT = route(async (request, { params, user }) => {
  const e = await Expense.findById(params.id);
  if (!e) return fail('مصرف پیدا نشد', 404);

  const b = await body(request);

  // `{ reimbursed: true }` on its own is the pay-back action.
  if (Object.keys(b).length === 1 && b.reimbursed !== undefined) {
    if (e.paidBy === SHOP_PURSE) return fail('این مصرف از صندوق دکان پرداخت شده است');
    e.reimbursed = !!b.reimbursed;
    await e.save();
    await logAct(user.name, `پول «${e.paidBy}» را برای ${e.no} بازپرداخت کرد`);
    return ok(e);
  }

  if (b.category !== undefined) {
    if (!b.category?.trim()) return fail('دستهٔ مصرف لازم است');
    e.category = b.category.trim();
  }
  if (b.desc !== undefined) {
    if (!b.desc?.trim()) return fail('شرح مصرف لازم است');
    e.desc = b.desc.trim();
  }
  if (b.amount !== undefined) {
    const value = +b.amount;
    if (!value || value <= 0) return fail('مبلغ مصرف لازم است');
    e.amount = value;
  }
  if (b.date !== undefined && b.date) {
    const when = new Date(b.date);
    if (Number.isNaN(when.getTime())) return fail('تاریخ درست نیست');
    e.date = when;
  }
  if (b.note !== undefined) e.note = String(b.note).trim();
  if (b.paidBy !== undefined) {
    e.paidBy = b.paidBy?.trim() || SHOP_PURSE;
    if (e.paidBy === SHOP_PURSE) e.reimbursed = true;
  }
  if (b.reimbursed !== undefined) e.reimbursed = !!b.reimbursed;

  await e.save();

  // The cash book has to follow, or the till and the expense list drift apart.
  if (e.tx) {
    await Transaction.updateOne({ _id: e.tx }, {
      t: e.date, tag: expenseTag(e.category),
      desc: `${e.category} — ${e.desc}`, amount: e.amount
    });
  }

  await logAct(user.name, `مصرف ${e.no} را تغییر داد`);
  return ok(e);
});

export const DELETE = route(async (request, { params, user }) => {
  const e = await Expense.findById(params.id);
  if (!e) return fail('مصرف پیدا نشد', 404);

  if (e.tx) await Transaction.deleteOne({ _id: e.tx });
  await e.deleteOne();
  await logAct(user.name, `مصرف ${e.no} را حذف کرد: ${e.desc}`);
  return ok({ ok: true });
});
