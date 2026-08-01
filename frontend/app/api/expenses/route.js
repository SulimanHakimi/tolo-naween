import { route, ok, fail, body } from '@/lib/route';
import { Expense, Transaction, nextSeq, logAct } from '@/lib/models';
import { SHOP_PURSE, expenseTag } from '@/lib/labels';
import { midnight, expenseTotals, byCategory } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const DAY = 864e5;

export const GET = route(async (request) => {
  const p = new URL(request.url).searchParams;
  const limit = Math.min(+p.get('limit') || 200, 500);
  const today = midnight(new Date());

  const [expenses, monthRows, owed] = await Promise.all([
    Expense.find().sort({ date: -1 }).limit(limit),
    Expense.find({ date: { $gte: new Date(today.getTime() - 29 * DAY) } }),
    // Money a staff member is still out of pocket for, however old.
    Expense.find({ reimbursed: false, paidBy: { $ne: SHOP_PURSE } })
  ]);

  return ok({
    expenses,
    today: expenseTotals(expenses.filter((e) => e.date >= today)),
    month: expenseTotals(monthRows),
    cats: byCategory(monthRows),
    owed: owed.reduce((t, e) => t + e.amount, 0),
    owedCount: owed.length
  });
});

/**
 * Anything the shop spends that is not stock. The cash-book entry is written here and
 * its id kept on the expense, so editing or deleting one moves both together.
 *
 * `paidBy` names the person who fronted the money when it did not come out of the
 * till; the expense still counts against profit from the day it happened, and the
 * reimbursement is settled separately without a second entry.
 */
export const POST = route(async (request, { user }) => {
  const { category, desc, amount, paidBy, note, date } = await body(request);

  if (!category?.trim()) return fail('دستهٔ مصرف لازم است');
  if (!desc?.trim()) return fail('شرح مصرف لازم است');
  const value = +amount;
  if (!value || value <= 0) return fail('مبلغ مصرف لازم است');
  if (date && Number.isNaN(new Date(date).getTime())) return fail('تاریخ درست نیست');

  const who = paidBy?.trim() || SHOP_PURSE;
  const when = date ? new Date(date) : new Date();
  const seq = await nextSeq('expense');

  const tx = await Transaction.create({
    t: when, type: 'مصرف', tag: expenseTag(category.trim()),
    desc: `${category.trim()} — ${desc.trim()}`, amount: value
  });

  const e = await Expense.create({
    no: `EX-${seq}`, date: when, category: category.trim(), desc: desc.trim(),
    amount: value, paidBy: who, reimbursed: who === SHOP_PURSE,
    note: note?.trim() || '', tx: tx._id, createdBy: user.name
  });

  await logAct(user.name, `مصرف ${Math.round(value).toLocaleString('en-US')} ثبت کرد: ${e.desc}`);
  return ok(e, 201);
});
