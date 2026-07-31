import { route, ok, fail, body } from '@/lib/route';
import { Customer, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await Customer.find().sort({ credit: -1, name: 1 })), { perms: ['cust', 'rep'] });

export const POST = route(async (request, { user }) => {
  const { name, phone, note, credit } = await body(request);
  if (!name?.trim()) return fail('نام مشتری لازم است');

  const phoneClean = String(phone || '').trim();
  if (phoneClean && await Customer.findOne({ phone: phoneClean })) {
    return fail('مشتری با این شماره تماس قبلاً ثبت شده است');
  }

  const c = await Customer.create({
    name: name.trim(), phone: phoneClean, note: String(note || '').trim(),
    since: new Date(),
    // An opening balance covers debt carried over from paper records.
    credit: Math.max(0, +credit || 0)
  });
  await logAct(user.name, `مشتری «${c.name}» را ثبت کرد`);
  return ok(c, 201);
}, { perms: ['cust'] });
