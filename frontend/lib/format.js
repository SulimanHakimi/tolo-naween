import { toJalali, fromJalali, isValidJalali, JMONTHS, JDAYS } from './jalali';

const SYMBOL = { AFN: '؋', USD: '$', PKR: '₨' };

// Digits stay Latin — that is what the design shows and what a barcode scanner and
// a calculator both produce. Only the labels around them are Dari.
export function makeFmt(currency) {
  const sym = SYMBOL[currency] || currency || '؋';
  return (n) => Math.round(n || 0).toLocaleString('en-US') + ' ' + sym;
}

export function fmtK(n) {
  const v = Math.round(n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e4) return Math.round(v / 1000) + 'k';
  return v.toLocaleString('en-US');
}

export const num = (n) => Math.round(n || 0).toLocaleString('en-US');

const pad = (n) => String(n).padStart(2, '0');

// ---------- Jalali display ----------

// '1404/06/28'
export function jDate(value) {
  const j = toJalali(value);
  return j ? `${j.jy}/${pad(j.jm)}/${pad(j.jd)}` : '—';
}

// '28 سنبله 1404'
export function jLong(value) {
  const j = toJalali(value);
  return j ? `${j.jd} ${JMONTHS[j.jm - 1]} ${j.jy}` : '—';
}

// 'شنبه، 28 سنبله 1404'
export function jToday() {
  const now = new Date();
  return `${JDAYS[now.getDay()]}، ${jLong(now)}`;
}

export const clock = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// '28/06 · 10:42' — compact stamp for list rows.
export function jStamp(value) {
  const j = toJalali(value);
  return j ? `${pad(j.jd)}/${pad(j.jm)} · ${clock(value)}` : '—';
}

// 'امروز 10:42' / 'دیروز 23:00' / '26 سنبله 14:10'
export function jRelative(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 864e5);
  if (diff === 0) return `امروز ${clock(d)}`;
  if (diff === 1) return `دیروز ${clock(d)}`;
  const j = toJalali(d);
  return `${j.jd} ${JMONTHS[j.jm - 1]} ${clock(d)}`;
}

export function ago(value) {
  if (!value) return 'هیچ‌وقت';
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 6e4);
  if (mins < 1) return 'همین حالا';
  if (mins < 60) return `${mins} دقیقه پیش`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ساعت پیش`;
  return `${Math.round(hours / 24)} روز پیش`;
}

// ---------- Jalali input ----------

// Accepts '1404/6/28', '1404-06-28' or '۱۴۰۴/۰۶/۲۸'. Returns an ISO 'YYYY-MM-DD'
// Gregorian string, or null when the text is not a real date.
export function parseJDate(text) {
  if (!text) return null;
  const latin = String(text).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const parts = latin.split(/[/\-.\s]+/).filter(Boolean).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

  const [jy, jm, jd] = parts;
  if (!isValidJalali(jy, jm, jd)) return null;
  const g = fromJalali(jy, jm, jd);
  return `${g.getFullYear()}-${pad(g.getMonth() + 1)}-${pad(g.getDate())}`;
}

// ISO 'YYYY-MM-DD' -> '1404/06/28' for editing.
export function isoToJText(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  const j = toJalali(new Date(y, m - 1, d));
  return j ? `${j.jy}/${pad(j.jm)}/${pad(j.jd)}` : '';
}

// Whole days until an expiry date; negative once it has passed.
export function daysTo(iso) {
  if (!iso) return Infinity;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return Infinity;
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((midnight(new Date(y, m - 1, d)) - midnight(new Date())) / 864e5);
}
