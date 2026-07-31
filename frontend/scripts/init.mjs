// One-time setup: creates the staff accounts and the settings row.
// Creates no products, suppliers, customers or sales — the shop enters its own data.
// Safe to re-run: existing accounts are left untouched.
//
//   npm run init
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Next.js loads .env.local for the app itself, but a standalone script must do it.
dotenv.config({ path: '.env.local' });

const { default: connectDB } = await import('../lib/db.js');
const { User, Counter, PERM_KEYS, getSettings } = await import('../lib/models/index.js');
const { ROLE_PRESETS } = await import('../lib/labels.js');

const initials = (name) => String(name || '').trim().slice(0, 1) || '؟';
const permsFor = (role) => Object.fromEntries(PERM_KEYS.map((k) => [k, (ROLE_PRESETS[role] || []).includes(k)]));

// Only accounts whose password is set in .env.local get created. The manager is
// required; the other three are optional and can be added later from the app.
const ACCOUNTS = [
  { role: 'مدیر', envPrefix: 'MANAGER', fallbackName: 'مدیر عمومی', fallbackUser: 'manager', required: true },
  { role: 'فروشنده', envPrefix: 'SELLER', fallbackName: 'فروشنده', fallbackUser: 'seller' },
  { role: 'صندوق‌دار', envPrefix: 'CASHIER', fallbackName: 'صندوق‌دار', fallbackUser: 'cashier' },
  { role: 'گدام‌دار', envPrefix: 'STOREKEEPER', fallbackName: 'مسئول گدام', fallbackUser: 'store' }
];

async function main() {
  const planned = ACCOUNTS.map((a) => ({
    ...a,
    name: process.env[`${a.envPrefix}_NAME`] || a.fallbackName,
    username: (process.env[`${a.envPrefix}_USERNAME`] || a.fallbackUser).toLowerCase().trim(),
    password: process.env[`${a.envPrefix}_PASSWORD`] || ''
  }));

  const manager = planned.find((a) => a.required);
  if (!manager.password) {
    console.error('MANAGER_PASSWORD را در .env.local تعیین کنید و بعد init را اجرا کنید.');
    console.error('Set MANAGER_PASSWORD in .env.local before running init.');
    process.exit(1);
  }
  const tooShort = planned.filter((a) => a.password && a.password.length < 8);
  if (tooShort.length) {
    console.error('هر رمز باید حداقل ۸ حرف باشد: ' + tooShort.map((a) => a.envPrefix).join(', '));
    process.exit(1);
  }

  await connectDB();

  for (const a of planned) {
    if (!a.password) {
      console.log(`- ${a.role}: رمز تعیین نشده، رد شد (${a.envPrefix}_PASSWORD)`);
      continue;
    }
    const existing = await User.findOne({ username: a.username });
    if (existing) {
      console.log(`- ${a.role}: حساب «${existing.username}» موجود است — تغییر نیافت.`);
      continue;
    }
    await User.create({
      name: a.name, role: a.role, initials: initials(a.name),
      username: a.username, passwordHash: await bcrypt.hash(a.password, 10),
      active: true, perms: permsFor(a.role)
    });
    console.log(`+ ${a.role} ساخته شد: ${a.username}`);
  }

  // Numbering starts at 1000 so the first bill reads #1001.
  for (const key of ['sale', 'po', 'return']) {
    if (!(await Counter.findOne({ key }))) await Counter.create({ key, seq: 1000 });
  }

  await getSettings();
  console.log('\nتنظیمات آماده است. وارد شوید، بعد تهیه‌کنندگان و اجناس خود را ثبت کنید.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
