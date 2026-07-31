// Price resolution, shared by the POS screen and POST /api/sales so the till and the
// server always land on the same number. The order is fixed:
//
//   1. wholesale price replaces retail once the line reaches wholesaleMinQty
//   2. the single best matching discount rule comes off that price
//   3. VAT applies to what is left, after any manual discount
//
// Only one rule is ever applied to a line — the one that saves the customer most —
// so overlapping seasonal offers cannot stack into a negative price.

export function activeDiscounts(discounts, when = new Date()) {
  const t = when.getTime();
  return (discounts || []).filter((d) => d.active
    && (!d.from || new Date(d.from).getTime() <= t)
    && (!d.to || new Date(d.to).getTime() >= t));
}

function matches(rule, product) {
  if (rule.scope === 'all') return true;
  if (rule.scope === 'category') return rule.target === product.category;
  return rule.target === product.name;
}

// Wholesale-aware unit price, before any discount rule.
function basePrice(product, qty, settings) {
  const min = settings?.wholesaleMinQty ?? 50;
  const wholesale = +product.wholesale || 0;
  return wholesale > 0 && qty >= min ? wholesale : +product.retail;
}

/** The best matching rule for one line, as a per-unit reduction. */
function bestRule(product, qty, settings, rules) {
  const base = basePrice(product, qty, settings);
  let best = null;

  for (const r of rules || []) {
    if (!matches(r, product)) continue;
    const off = r.kind === 'percent'
      ? base * Math.min(Math.max(+r.value || 0, 0), 100) / 100
      : Math.min(Math.max(+r.value || 0, 0), base);
    if (off > 0 && (!best || off > best.off)) best = { rule: r, off };
  }
  return best;
}

/**
 * Prices one cart line. `price` is what the bill charges per unit before the rule
 * discount, which is listed separately so the customer can see what they saved.
 */
export function priceLine(product, qty, settings, rules) {
  const base = basePrice(product, qty, settings);
  const hit = bestRule(product, qty, settings, rules);
  const off = hit ? hit.off : 0;

  return {
    qty,
    unit: product.unit,
    price: base,
    listPrice: +product.retail,
    buy: +product.buy,
    wholesaleApplied: base !== +product.retail,
    discountName: hit ? hit.rule.name : '',
    discountOff: off,
    lineSub: base * qty,
    lineDisc: off * qty,
    lineTotal: Math.max(0, (base - off) * qty)
  };
}

/** Rolls priced lines up into the bill totals. */
export function cartTotals(lines, settings, manualDiscount = 0, discMode = 'amt') {
  const sub = lines.reduce((t, l) => t + l.lineSub, 0);
  const autoDisc = lines.reduce((t, l) => t + l.lineDisc, 0);
  const afterAuto = Math.max(0, sub - autoDisc);

  const raw = +manualDiscount || 0;
  const disc = raw <= 0 ? 0
    : Math.min(discMode === 'pct' ? afterAuto * Math.min(raw, 100) / 100 : raw, afterAuto);

  const vat = (afterAuto - disc) * (settings?.vatRate || 0) / 100;

  const notes = [...new Set(lines.filter((l) => l.discountName).map((l) => l.discountName))];
  if (lines.some((l) => l.wholesaleApplied)) notes.push('قیمت عمده');

  return { sub, autoDisc, autoDiscNote: notes.join(' · '), disc, vat, total: afterAuto - disc + vat };
}
