import { route, ok, fail, body } from '@/lib/route';
import { Employee, logAct } from '@/lib/models';
import { validateEmployee } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await Employee.find().sort({ status: 1, name: 1 })));

export const POST = route(async (request, { user }) => {
  const b = await body(request);
  const bad = validateEmployee(b);
  if (bad) return fail(bad);

  const e = await Employee.create({
    name: b.name.trim(), role: b.role.trim(), phone: String(b.phone || '').trim(),
    account: String(b.account || '').trim().toLowerCase(),
    salary: Math.max(0, +b.salary || 0),
    status: b.status || 'فعال',
    hired: b.hired ? new Date(b.hired) : new Date()
  });
  await logAct(user.name, `کارمند «${e.name}» را ثبت کرد`);
  return ok(e, 201);
});
