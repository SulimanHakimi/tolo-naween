import bcrypt from 'bcryptjs';
import { route, ok, fail, body, signToken, publicUser } from '@/lib/route';
import { User, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
  const { username, password } = await body(request);
  if (!username || !password) return fail('نام کاربری و رمز عبور لازم است');

  const user = await User.findOne({ username: String(username).toLowerCase().trim() });
  // Identical message either way, so the form cannot be used to discover usernames.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail('نام کاربری یا رمز عبور نادرست است', 401);
  }
  if (!user.active) return fail('این حساب غیرفعال شده است — به مدیر مراجعه کنید', 403);

  await logAct(user.name, 'وارد سیستم شد');
  return ok({ token: signToken(user), user: publicUser(user) });
}, { public: true });
