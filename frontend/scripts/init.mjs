// One-time setup: creates the manager account and the settings row.
// Creates no products, suppliers, customers or sales — the shop enters its own data.
// Safe to re-run: an existing account is left untouched.
//
//   npm run init
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Next.js loads .env.local for the app itself, but a standalone script must do it.
dotenv.config({ path: '.env.local' });

const { default: connectDB } = await import('../lib/db.js');
const { User, Counter, getSettings } = await import('../lib/models/index.js');

const initials = (name) => String(name || '').trim().slice(0, 1) || '؟';

async function main() {
  const name = process.env.ADMIN_NAME || 'مدیر عمومی';
  const role = process.env.ADMIN_ROLE || 'مدیر عمومی';
  const username = (process.env.ADMIN_USERNAME || 'manager').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!password) {
    console.error('ADMIN_PASSWORD را در .env.local تعیین کنید و بعد init را اجرا کنید.');
    console.error('Set ADMIN_PASSWORD in .env.local before running init.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('رمز باید حداقل ۸ حرف باشد.');
    process.exit(1);
  }
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    console.error('ADMIN_USERNAME باید ۳ تا ۲۰ حرف انگلیسی، رقم، نقطه یا خط تیره باشد.');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ username });
  if (existing) {
    console.log(`حساب «${existing.username}» موجود است — تغییر نیافت.`);
    console.log('برای تغییر رمز: npm run set-password -- ' + existing.username + ' <new password>');
  } else {
    await User.create({
      name, role, initials: initials(name), username,
      passwordHash: await bcrypt.hash(password, 10), active: true
    });
    console.log(`+ حساب ساخته شد: ${username} (${name})`);
    console.log('  این حساب به تمام صفحات دسترسی دارد.');
  }

  // Numbering starts at 1000 so the first bill reads #1001.
  for (const key of ['sale', 'po', 'return']) {
    if (!(await Counter.findOne({ key }))) await Counter.create({ key, seq: 1000 });
  }

  await getSettings();
  console.log('\nتنظیمات آماده است. وارد شوید، بعد تهیه‌کنندگان و اجناس خود را ثبت کنید.');
  console.log('حساب‌های بیشتر را از صفحهٔ «امنیت و بک‌اپ» بسازید — همه دسترسی کامل دارند.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
