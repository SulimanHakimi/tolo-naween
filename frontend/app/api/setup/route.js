import bcrypt from 'bcryptjs';
import { route, ok, fail, body } from '@/lib/route';
import * as models from '@/lib/models';
import { User, Counter, COLLECTIONS, PERM_KEYS, getSettings, logAct } from '@/lib/models';
import { ROLE_PRESETS } from '@/lib/labels';
import { initialsOf } from '@/lib/ui';

export const dynamic = 'force-dynamic';

/**
 * First-run bootstrap for hosts where the database is not reachable from a laptop
 * (serverless deploys behind an IP allowlist). Creates the same four accounts as
 * `npm run init`.
 *
 * Every call requires SETUP_TOKEN to be set in the environment and to match the
 * x-setup-token header. Delete SETUP_TOKEN once the accounts exist — without it
 * this route answers 403 to everything.
 */
function guard(request) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return fail('راه‌اندازی غیرفعال است', 403);
  if (request.headers.get('x-setup-token') !== expected) return fail('توکن راه‌اندازی نادرست است', 403);
  return null;
}

const permsFor = (role) => Object.fromEntries(PERM_KEYS.map((k) => [k, (ROLE_PRESETS[role] || []).includes(k)]));

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
  const wanted = [
    { role: 'مدیر', name: b.managerName || 'مدیر عمومی', username: b.managerUsername || 'manager', password: b.managerPassword },
    { role: 'فروشنده', name: b.sellerName || 'فروشنده', username: b.sellerUsername || 'seller', password: b.sellerPassword },
    { role: 'صندوق‌دار', name: b.cashierName || 'صندوق‌دار', username: b.cashierUsername || 'cashier', password: b.cashierPassword },
    { role: 'گدام‌دار', name: b.keeperName || 'مسئول گدام', username: b.keeperUsername || 'store', password: b.keeperPassword }
  ].filter((a) => a.password);

  if (!wanted.some((a) => a.role === 'مدیر')) {
    return fail('رمز حساب مدیر لازم است — بدون آن هیچ‌کس به سیستم دسترسی کامل ندارد');
  }
  if (wanted.some((a) => String(a.password).length < 8)) {
    return fail('هر رمز باید حداقل ۸ حرف باشد');
  }

  const existing = await User.countDocuments();
  // Without an explicit reset this route refuses to touch a database that is in use.
  if (existing > 0 && b.reset !== true) {
    return fail('حساب‌ها قبلاً ساخته شده‌اند. برای پاک کردن همه‌چیز و شروع از نو "reset": true بفرستید.', 409);
  }

  const erased = {};
  if (b.reset === true) {
    for (const name of COLLECTIONS) {
      erased[name] = await models[name].countDocuments();
      await models[name].deleteMany({});
    }
  }

  const created = [];
  for (const a of wanted) {
    await User.create({
      name: a.name, role: a.role, initials: initialsOf(a.name),
      username: String(a.username).toLowerCase().trim(),
      passwordHash: await bcrypt.hash(a.password, 10),
      active: true, perms: permsFor(a.role)
    });
    created.push({ name: a.name, role: a.role, username: a.username });
  }

  // Numbering starts at 1000 so the first bill reads #1001.
  for (const key of ['sale', 'po', 'return']) {
    if (!(await Counter.findOne({ key }))) await Counter.create({ key, seq: 1000 });
  }

  await getSettings();
  await logAct('سیستم', 'راه‌اندازی اولیه انجام شد — حساب‌های کارمندان ساخته شد');
  return ok({ created, erased }, 201);
}, { public: true });
