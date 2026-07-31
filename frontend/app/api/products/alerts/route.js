import { route, ok } from '@/lib/route';
import { Product, getSettings } from '@/lib/models';
import { stockStatus, needsAttention } from '@/lib/ui';
import { daysTo } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Counts only — small enough for the app shell to fetch on every page so the
// sidebar badge is right wherever the user happens to be.
export const GET = route(async () => {
  const settings = await getSettings();
  const products = await Product.find().select('stock expiry');
  const flagged = products.map((p) => stockStatus(p, settings, daysTo(p.expiry))).filter(needsAttention);

  return ok({
    count: flagged.length,
    out: flagged.filter((s) => s.key === 'out').length,
    low: flagged.filter((s) => s.key === 'low').length,
    exp: flagged.filter((s) => s.key === 'exp' || s.key === 'expired').length
  });
});
