import bcrypt from 'bcryptjs';
import { route, ok, fail, body } from '@/lib/route';
import { User, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const POST = route(async (request, { user }) => {
  const { currentPassword, newPassword } = await body(request);
  if (!currentPassword || !newPassword) return fail('رمز فعلی و رمز جدید لازم است');
  if (String(newPassword).length < 8) return fail('رمز جدید باید حداقل ۸ حرف باشد');

  const full = await User.findById(user._id);
  if (!(await bcrypt.compare(currentPassword, full.passwordHash))) {
    return fail('رمز فعلی نادرست است', 401);
  }

  full.passwordHash = await bcrypt.hash(newPassword, 10);
  await full.save();
  await logAct(full.name, 'رمز خود را تغییر داد');
  return ok({ ok: true });
});
