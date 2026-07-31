// Colour tokens mirrored from globals.css, for the places that need them in JS
// (inline SVG strokes, computed bar fills). Layout lives in globals.css.
export const C = {
  brand: '#106090', brandDark: '#0B4A70', brandLight: '#2C92C9',
  ink: '#0E1B24', bg: '#F3F4F6', card: '#FFFFFF',
  border: '#EEEFF2', line: '#E4E4E7',
  text: '#1C1C1C', muted: '#747C8B', faint: '#9CA3AF',
  green: '#119842', greenBright: '#15BE53', amber: '#BC7716', amberBright: '#EB951B',
  red: '#C61A36', redBright: '#E41E3F',
  blueSoft: '#EDF4F8', greenSoft: '#E8F8EE', amberSoft: '#FBEAD3', redSoft: '#FCE8EC'
};

// Product-tile tints, cycled by index in the POS grid.
export const TINTS = [
  [C.blueSoft, C.brand], [C.greenSoft, C.green],
  [C.amberSoft, C.amber], [C.redSoft, C.red]
];

// Two Dari letters make a readable tile badge; one is used when the name is short.
export function abbr(name) {
  const clean = String(name || '').trim();
  if (!clean) return '؟';
  const words = clean.split(/\s+/);
  if (words.length > 1 && words[0].length < 3) return (words[0][0] + words[1][0]);
  return clean.slice(0, 2);
}

export const initialsOf = (name) => String(name || '').trim().slice(0, 1) || '؟';

/**
 * The single source of truth for a product's condition. Drives the inventory pill,
 * the dashboard alert list and the POS tile cue, so all three always agree.
 */
export function stockStatus(product, settings, daysToExpiry) {
  const low = settings?.lowStockThreshold ?? 10;
  const warn = settings?.expiryWarnDays ?? 60;

  if ((product.stock ?? 0) <= 0) {
    return { key: 'out', label: 'تمام شده', cls: 'pill-red', color: C.redBright, note: 'تمام شده — سفارش دهید' };
  }
  if (daysToExpiry < 0) {
    return { key: 'expired', label: 'انقضا گذشته', cls: 'pill-red', color: C.redBright, note: 'تاریخ انقضا گذشته است' };
  }
  if (daysToExpiry <= warn) {
    return { key: 'exp', label: 'نزدیک انقضا', cls: 'pill-amber', color: C.amberBright, note: `${daysToExpiry} روز تا انقضا` };
  }
  if (product.stock < low) {
    return { key: 'low', label: 'کم شده', cls: 'pill-amber', color: C.amberBright, note: 'کمتر از حد مجاز' };
  }
  return { key: 'ok', label: 'موجود', cls: 'pill-green', color: C.green, note: '' };
}

export const needsAttention = (s) => s.key !== 'ok';
