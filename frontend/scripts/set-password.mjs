// Reset an account's password from the command line, for when nobody can sign in.
//
//   node scripts/set-password.mjs <username> <new password>
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

const { default: connectDB } = await import('../lib/db.js');
const { User, logAct } = await import('../lib/models/index.js');

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('استفاده: node scripts/set-password.mjs <username> <new password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('رمز باید حداقل ۸ حرف باشد.');
  process.exit(1);
}

await connectDB();

const user = await User.findOne({ username: username.toLowerCase().trim() });
if (!user) {
  const all = await User.find().select('username role');
  console.error(`حسابی با نام کاربری «${username}» پیدا نشد.`);
  console.error('حساب‌های موجود: ' + all.map((u) => `${u.username} (${u.role})`).join(', '));
  await mongoose.disconnect();
  process.exit(1);
}

user.passwordHash = await bcrypt.hash(password, 10);
// Locking oneself out then resetting is the common case, so make sure it can log in.
user.active = true;
await user.save();
await logAct('سیستم', `رمز حساب «${user.name}» از طریق اسکریپت تغییر یافت`);

console.log(`رمز حساب ${user.username} (${user.name} — ${user.role}) تغییر یافت.`);
await mongoose.disconnect();
