import { route, ok, fail, body } from '@/lib/route';
import { getSettings, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

// Currency, VAT, the alert thresholds and the shop details drive prices and printed
// documents everywhere, so any signed-in account may read them.
export const GET = route(async () => ok(await getSettings()));

export const PUT = route(async (request, { user }) => {
  const s = await getSettings();
  const b = await body(request);

  if (b.currency !== undefined) {
    if (!['AFN', 'USD', 'PKR'].includes(b.currency)) return fail('این واحد پول پشتیبانی نمی‌شود');
    s.currency = b.currency;
  }
  if (b.vatRate !== undefined) s.vatRate = Math.max(0, Math.min(15, +b.vatRate || 0));
  if (b.lowStockThreshold !== undefined) s.lowStockThreshold = Math.max(1, Math.min(1000, +b.lowStockThreshold || 10));
  if (b.expiryWarnDays !== undefined) s.expiryWarnDays = Math.max(1, Math.min(365, +b.expiryWarnDays || 60));
  if (b.wholesaleMinQty !== undefined) s.wholesaleMinQty = Math.max(2, Math.min(10000, +b.wholesaleMinQty || 50));
  if (b.autoBackup !== undefined) s.autoBackup = !!b.autoBackup;

  for (const k of ['storeName', 'storeAddress', 'storePhone', 'storeLicense']) {
    if (b[k] !== undefined) s[k] = String(b[k]).trim();
  }
  if (!s.storeName) return fail('نام سوپرمارکت خالی نمی‌شود');

  await s.save();
  await logAct(user.name, 'تنظیمات سیستم را تغییر داد');
  return ok(s);
});
