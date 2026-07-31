import { route, ok } from '@/lib/route';
import { Product, Customer, Sale, Supplier } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Escaped so a barcode containing '.' or '*' cannot turn into a wildcard scan.
const rx = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** Powers the topbar search box. Each account only sees what its role may reach. */
export const GET = route(async (request, { user }) => {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return ok({ hits: [] });

  const re = rx(q);
  const perms = user.perms || {};
  const jobs = [];

  if (perms.inv || perms.pos || perms.price || perms.pur) {
    jobs.push(Product.find({ $or: [{ name: re }, { barcode: re }, { category: re }] }).limit(6)
      .then((rows) => rows.map((p) => ({
        kind: 'product', id: p._id, label: p.name, amount: p.retail, note: `${p.stock} ${p.unit}`
      }))));
  }
  if (perms.cust || perms.rep) {
    jobs.push(Customer.find({ $or: [{ name: re }, { phone: re }] }).limit(5)
      .then((rows) => rows.map((c) => ({
        kind: 'customer', id: c._id, label: c.name, amount: c.credit || null, note: c.phone || '—'
      }))));
  }
  if (perms.rep || perms.pos || perms.dash) {
    jobs.push(Sale.find({ $or: [{ no: re }, { customer: re }, { phone: re }] }).sort({ date: -1 }).limit(5)
      .then((rows) => rows.map((s) => ({
        kind: 'sale', id: s._id, label: s.no, amount: s.total, date: s.date
      }))));
  }
  if (perms.pur) {
    jobs.push(Supplier.find({ $or: [{ name: re }, { phone: re }] }).limit(4)
      .then((rows) => rows.map((s) => ({
        kind: 'supplier', id: s._id, label: s.name, amount: s.balance || null, note: s.phone || '—'
      }))));
  }

  const groups = await Promise.all(jobs);
  return ok({ hits: groups.flat().slice(0, 14) });
});
