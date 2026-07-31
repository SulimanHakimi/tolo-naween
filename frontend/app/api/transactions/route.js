import { route, ok, fail, body } from '@/lib/route';
import { Transaction, Customer, Supplier, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Cash book plus what the shop is owed and what it owes.
export const GET = route(async () => {
  const [all, customers, suppliers] = await Promise.all([
    Transaction.find().sort({ t: -1 }).limit(300),
    Customer.find({ credit: { $gt: 0 } }).sort({ credit: -1 }),
    Supplier.find({ balance: { $gt: 0 } }).sort({ balance: -1 })
  ]);

  const cash = all.reduce((t, x) => t + (x.type === 'درآمد' ? x.amount : -x.amount), 0);
  const cut = Date.now() - 30 * 864e5;
  const income30 = all.filter((x) => x.type === 'درآمد' && x.t > cut).reduce((t, x) => t + x.amount, 0);
  const expense30 = all.filter((x) => x.type === 'مصرف' && x.t > cut).reduce((t, x) => t + x.amount, 0);

  return ok({
    transactions: all,
    cash, income30, expense30,
    receivable: customers.reduce((t, c) => t + c.credit, 0),
    payable: suppliers.reduce((t, s) => t + s.balance, 0)
  });
}, { perms: ['rep'] });

export const POST = route(async (request, { user }) => {
  const { type, desc, amount } = await body(request);
  if (!['درآمد', 'مصرف'].includes(type)) return fail('نوع ثبت درست نیست');
  if (!desc?.trim()) return fail('شرح لازم است');
  if (!(+amount) || +amount <= 0) return fail('مبلغ لازم است');

  const tx = await Transaction.create({ type, tag: 'other', desc: desc.trim(), amount: +amount });
  await logAct(user.name, `${type} ثبت کرد: ${tx.desc}`);
  return ok(tx, 201);
}, { perms: ['rep'] });
