// Validation shared between the create and update routes, so a rule can never be
// enforced on one and forgotten on the other.

export function validateProduct({ name, category, unit, buy, retail, wholesale, expiry }) {
  if (!name?.trim()) return 'نام جنس لازم است';
  if (!category?.trim()) return 'دستهٔ جنس لازم است';
  if (!unit?.trim()) return 'واحد جنس لازم است';
  if (!(+buy) || +buy <= 0) return 'قیمت خرید لازم است';
  if (!(+retail) || +retail <= 0) return 'قیمت پرچون لازم است';
  if (+retail < +buy) return 'قیمت پرچون کمتر از قیمت خرید است';
  if (+wholesale && +wholesale < +buy) return 'قیمت عمده کمتر از قیمت خرید است';
  if (+wholesale && +wholesale > +retail) return 'قیمت عمده باید از قیمت پرچون کمتر باشد';
  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return 'تاریخ انقضا درست نیست';
  return null;
}

export function validateDiscount({ name, kind, value, scope, target, from, to }) {
  if (!name?.trim()) return 'نام تخفیف لازم است';
  if (!['percent', 'amount'].includes(kind)) return 'نوع تخفیف درست نیست';
  const v = +value;
  if (!v || v <= 0) return 'مقدار تخفیف لازم است';
  if (kind === 'percent' && v > 100) return 'فیصدی تخفیف بیشتر از ۱۰۰ نمی‌شود';
  if (!['all', 'category', 'product'].includes(scope)) return 'دامنهٔ تخفیف درست نیست';
  if (scope !== 'all' && !target?.trim()) return 'برای این دامنه، جنس یا دسته را انتخاب کنید';
  if (from && to && new Date(from) > new Date(to)) return 'تاریخ شروع بعد از تاریخ پایان است';
  return null;
}

export function validateEmployee({ name, role, salary }) {
  if (!name?.trim()) return 'نام کارمند لازم است';
  if (!role?.trim()) return 'وظیفهٔ کارمند لازم است';
  if (+salary < 0) return 'معاش منفی نمی‌شود';
  return null;
}
