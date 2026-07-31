import bcrypt from 'bcryptjs';
import { route, ok, fail, body } from '@/lib/route';
import { User, PERM_KEYS, logAct } from '@/lib/models';
import { initialsOf } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await User.find().select('-passwordHash').sort({ createdAt: 1 })), { perms: ['sec'] });

// Only real screen keys survive, so a crafted body cannot invent a permission.
const readPerms = (input) => Object.fromEntries(PERM_KEYS.map((k) => [k, !!input?.[k]]));

export const POST = route(async (request, { user }) => {
  const { name, role, username, password, perms } = await body(request);
  if (!name?.trim()) return fail('نام کارمند لازم است');
  if (!role?.trim()) return fail('وظیفه لازم است');

  const uname = String(username || '').toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,20}$/.test(uname)) {
    return fail('نام کاربری باید ۳ تا ۲۰ حرف انگلیسی، رقم، نقطه یا خط تیره باشد');
  }
  if (String(password || '').length < 8) return fail('رمز عبور باید حداقل ۸ حرف باشد');
  if (await User.findOne({ username: uname })) return fail('این نام کاربری قبلاً گرفته شده است');

  const created = await User.create({
    name: name.trim(), role: role.trim(), initials: initialsOf(name),
    username: uname, passwordHash: await bcrypt.hash(password, 10),
    active: true, perms: readPerms(perms)
  });

  await logAct(user.name, `حساب کاربری «${created.name}» (${created.username}) را ایجاد کرد`);
  const { passwordHash, ...safe } = created.toObject();
  return ok(safe, 201);
}, { perms: ['sec'] });
