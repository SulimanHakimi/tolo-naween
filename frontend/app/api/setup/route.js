import bcrypt from 'bcryptjs';
import { route, ok, fail, body } from '@/lib/route';
import * as models from '@/lib/models';
import { User, Counter, COLLECTIONS, getSettings, logAct } from '@/lib/models';
import { initialsOf } from '@/lib/ui';

export const dynamic = 'force-dynamic';

/**
 * First-run bootstrap for hosts where the database is not reachable from a laptop
 * (serverless deploys behind an IP allowlist). Creates the same single account as
 * `npm run init`.
 *
 * Every call requires SETUP_TOKEN to be set in the environment and to match the
 * x-setup-token header. Delete SETUP_TOKEN once the account exists — without it
 * this route answers 403 to everything.
 */
function guard(request) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return fail('راه‌اندازی غیرفعال است', 403);
  if (request.headers.get('x-setup-token') !== expected) return fail('توکن راه‌اندازی نادرست است', 403);
  return null;
}

// Non-destructive: report what is currently stored, so a reset is never blind.
export const GET = route(async (request) => {
  const blocked = guard(request);
  if (blocked) return blocked;

  const counts = {};
  for (const name of COLLECTIONS) counts[name] = await models[name].countDocuments();
  return ok({ counts, users: await User.find().select('name role username active') });
}, { public: true });

export const POST = route(async (request) => {
  const blocked = guard(request);
  if (blocked) return blocked;

  const b = await body(request);
  const password = b.password || '';
  const username = String(b.username || 'manager').toLowerCase().trim();

  if (password.length < 8) return fail('رمز باید حداقل ۸ حرف باشد');
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    return fail('نام کاربری باید ۳ تا ۲۰ حرف انگلیسی، رقم، نقطه یا خط تیره باشد');
  }

  const existing = await User.countDocuments();
  // Without an explicit reset this route refuses to touch a database that is in use.
  if (existing > 0 && b.reset !== true) {
    return fail('حساب قبلاً ساخته شده است. برای پاک کردن همه‌چیز و شروع از نو "reset": true بفرستید.', 409);
  }

  const erased = {};
  if (b.reset === true) {
    for (const name of COLLECTIONS) {
      erased[name] = await models[name].countDocuments();
      await models[name].deleteMany({});
    }
  }

  const name = b.name || 'مدیر عمومی';
  await User.create({
    name, role: b.role || 'مدیر عمومی', initials: initialsOf(name),
    username, passwordHash: await bcrypt.hash(password, 10), active: true
  });

  // Numbering starts at 1000 so the first bill reads #1001.
  for (const key of ['sale', 'po', 'return']) {
    if (!(await Counter.findOne({ key }))) await Counter.create({ key, seq: 1000 });
  }

  await getSettings();
  await logAct('سیستم', 'راه‌اندازی اولیه انجام شد — حساب مدیر ساخته شد');
  return ok({ created: { name, username }, erased }, 201);
}, { public: true });
