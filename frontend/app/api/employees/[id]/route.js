import { route, ok, fail, body } from '@/lib/route';
import { Employee, logAct } from '@/lib/models';
import { validateEmployee } from '@/lib/validate';
import { EMP_STATUS } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export const PUT = route(async (request, { params, user }) => {
  const e = await Employee.findById(params.id);
  if (!e) return fail('کارمند پیدا نشد', 404);

  const b = await body(request);
  const bad = validateEmployee({ name: b.name ?? e.name, role: b.role ?? e.role, salary: b.salary ?? e.salary });
  if (bad) return fail(bad);

  for (const k of ['name', 'role', 'phone']) if (b[k] !== undefined) e[k] = String(b[k]).trim();
  if (b.account !== undefined) e.account = String(b.account).trim().toLowerCase();
  if (b.salary !== undefined) e.salary = Math.max(0, +b.salary || 0);
  if (b.status !== undefined && EMP_STATUS.includes(b.status)) e.status = b.status;
  if (b.hired !== undefined) e.hired = b.hired ? new Date(b.hired) : null;

  await e.save();
  await logAct(user.name, `معلومات کارمند «${e.name}» را تغییر داد`);
  return ok(e);
});

export const DELETE = route(async (request, { params, user }) => {
  const e = await Employee.findById(params.id);
  if (!e) return fail('کارمند پیدا نشد', 404);
  await e.deleteOne();
  await logAct(user.name, `کارمند «${e.name}» را حذف کرد`);
  return ok({ ok: true });
});
