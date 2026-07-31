import { route, ok, fail, body } from '@/lib/route';
import { Supplier, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Names feed the product form and the purchase-order picker, so any signed-in
// account may read them.
export const GET = route(async () => ok(await Supplier.find().sort({ name: 1 })));

export const POST = route(async (request, { user }) => {
  const { name, person, phone, address, supplies } = await body(request);
  if (!name?.trim()) return fail('نام تهیه‌کننده لازم است');
  if (await Supplier.findOne({ name: name.trim() })) return fail('تهیه‌کننده‌ای با این نام موجود است');

  const s = await Supplier.create({
    name: name.trim(), person: person?.trim() || '', phone: phone?.trim() || '',
    address: address?.trim() || '', supplies: supplies?.trim() || '', balance: 0, lastOrder: ''
  });
  await logAct(user.name, `تهیه‌کننده «${s.name}» را ثبت کرد`);
  return ok(s, 201);
});
