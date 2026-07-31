import bcrypt from 'bcryptjs';
import { route, ok, fail, body } from '@/lib/route';
import { User, logAct } from '@/lib/models';
import { initialsOf } from '@/lib/ui';

export const dynamic = 'force-dynamic';

/** How many accounts besides this one could still sign in. */
const otherActive = (id) => User.countDocuments({ _id: { $ne: id }, active: true });

export const PUT = route(async (request, { params, user }) => {
  const target = await User.findById(params.id);
  if (!target) return fail('حساب پیدا نشد', 404);

  const b = await body(request);

  // Deactivating the last account that can sign in would lock everyone out, and
  // nobody would be left who could undo it.
  if (b.active === false && target.active && !(await otherActive(target._id))) {
    return fail('این تنها حساب فعال است — اول یک حساب دیگر بسازید');
  }

  if (b.name?.trim()) { target.name = b.name.trim(); target.initials = initialsOf(b.name); }
  if (b.role?.trim()) target.role = b.role.trim();
  if (b.active !== undefined) target.active = !!b.active;

  // A manager resetting a forgotten password does not need the old one.
  if (b.password) {
    if (String(b.password).length < 8) return fail('رمز عبور باید حداقل ۸ حرف باشد');
    target.passwordHash = await bcrypt.hash(b.password, 10);
  }

  await target.save();
  await logAct(user.name, b.password
    ? `رمز حساب «${target.name}» را تغییر داد`
    : `معلومات حساب «${target.name}» را تغییر داد`);

  const { passwordHash, ...safe } = target.toObject();
  return ok(safe);
});

export const DELETE = route(async (request, { params, user }) => {
  const target = await User.findById(params.id);
  if (!target) return fail('حساب پیدا نشد', 404);
  if (String(target._id) === String(user._id)) return fail('حساب خود را حذف نمی‌توانید');
  if (!(await otherActive(target._id))) return fail('این تنها حساب فعال است');

  await target.deleteOne();
  await logAct(user.name, `حساب کاربری «${target.name}» را حذف کرد`);
  return ok({ ok: true });
});
