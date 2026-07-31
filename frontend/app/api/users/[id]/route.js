import bcrypt from 'bcryptjs';
import { route, ok, fail, body } from '@/lib/route';
import { User, PERM_KEYS, logAct } from '@/lib/models';
import { initialsOf } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const readPerms = (input) => Object.fromEntries(PERM_KEYS.map((k) => [k, !!input?.[k]]));

/** How many accounts can still reach the امنیت screen besides this one. */
async function otherAdmins(id) {
  return User.countDocuments({ _id: { $ne: id }, active: true, 'perms.sec': true });
}

export const PUT = route(async (request, { params, user }) => {
  const target = await User.findById(params.id);
  if (!target) return fail('حساب پیدا نشد', 404);

  const b = await body(request);

  // Locking out the last administrator would leave nobody able to fix it.
  const losingAdmin = (b.perms && !b.perms.sec) || b.active === false;
  if (target.perms?.sec && losingAdmin && !(await otherAdmins(target._id))) {
    return fail('این تنها حساب با دسترسی «امنیت و بک‌اپ» است — اول یک مدیر دیگر بسازید');
  }

  if (b.name?.trim()) { target.name = b.name.trim(); target.initials = initialsOf(b.name); }
  if (b.role?.trim()) target.role = b.role.trim();
  if (b.perms !== undefined) target.perms = readPerms(b.perms);
  if (b.active !== undefined) target.active = !!b.active;

  // A manager resetting a forgotten password does not need the old one.
  if (b.password) {
    if (String(b.password).length < 8) return fail('رمز عبور باید حداقل ۸ حرف باشد');
    target.passwordHash = await bcrypt.hash(b.password, 10);
  }

  await target.save();
  await logAct(user.name, b.password
    ? `رمز حساب «${target.name}» را تغییر داد`
    : `دسترسی حساب «${target.name}» را تغییر داد`);

  const { passwordHash, ...safe } = target.toObject();
  return ok(safe);
}, { perms: ['sec'] });

export const DELETE = route(async (request, { params, user }) => {
  const target = await User.findById(params.id);
  if (!target) return fail('حساب پیدا نشد', 404);
  if (String(target._id) === String(user._id)) return fail('حساب خود را حذف نمی‌توانید');
  if (target.perms?.sec && !(await otherAdmins(target._id))) {
    return fail('این تنها حساب با دسترسی «امنیت و بک‌اپ» است');
  }

  await target.deleteOne();
  await logAct(user.name, `حساب کاربری «${target.name}» را حذف کرد`);
  return ok({ ok: true });
}, { perms: ['sec'] });
