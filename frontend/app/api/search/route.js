import { route, ok } from '@/lib/route';
import { Product, Customer, Sale, Supplier, Topup, Expense } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Escaped so a barcode containing '.' or '*' cannot turn into a wildcard scan.
const rx = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/**
 * Powers the topbar search box: products, customers, bills, suppliers, topups and
 * shop expenses at once.
 */
export const GET = route(async (request) => {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return ok({ hits: [] });

  const re = rx(q);
  const [products, customers, sales, suppliers, topups, expenses] = await Promise.all([
    Product.find({ $or: [{ name: re }, { barcode: re }, { category: re }] }).limit(6),
    Customer.find({ $or: [{ name: re }, { phone: re }] }).limit(5),
    Sale.find({ $or: [{ no: re }, { customer: re }, { phone: re }] }).sort({ date: -1 }).limit(5),
    Supplier.find({ $or: [{ name: re }, { phone: re }] }).limit(4),
    Topup.find({ $or: [{ no: re }, { phone: re }, { customer: re }] }).sort({ date: -1 }).limit(4),
    Expense.find({ $or: [{ no: re }, { desc: re }, { category: re }, { paidBy: re }] }).sort({ date: -1 }).limit(4)
  ]);

  const hits = [
    ...products.map((p) => ({ kind: 'product', id: p._id, label: p.name, amount: p.retail, note: `${p.stock} ${p.unit}` })),
    ...customers.map((c) => ({ kind: 'customer', id: c._id, label: c.name, amount: c.credit || null, note: c.phone || '—' })),
    ...sales.map((s) => ({ kind: 'sale', id: s._id, label: s.no, amount: s.total, date: s.date })),
    ...suppliers.map((s) => ({ kind: 'supplier', id: s._id, label: s.name, amount: s.balance || null, note: s.phone || '—' })),
    ...topups.map((t) => ({ kind: 'topup', id: t._id, label: t.no, amount: t.amount, note: t.phone })),
    ...expenses.map((e) => ({ kind: 'expense', id: e._id, label: e.no, amount: e.amount, note: e.desc }))
  ];

  return ok({ hits: hits.slice(0, 18) });
});
