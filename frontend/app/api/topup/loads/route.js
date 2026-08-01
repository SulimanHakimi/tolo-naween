import { route, ok, fail, body } from '@/lib/route';
import { TopupLoad, Transaction, getTopupAccount, nextSeq, logAct } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const limit = Math.min(+new URL(request.url).searchParams.get('limit') || 50, 300);
  return ok(await TopupLoad.find().sort({ date: -1 }).limit(limit));
});

/**
 * Credit arriving from the company. `credit` is the face value the shop can now send
 * to any number; `cost` is what it pays for that — normally less, and the gap is where
 * the commission comes from. Paying later adds the cost to what the shop owes instead.
 */
export const POST = route(async (request, { user }) => {
  const { credit, cost, paid } = await body(request);
  const a = await getTopupAccount();

  const face = Math.round(+credit);
  if (!face || face <= 0) return fail('مقدار اعتبار را وارد کنید');

  // An empty cost means the company's usual terms: face value less the commission.
  const price = cost === undefined || cost === '' || cost === null
    ? Math.round(face - (face / 1000) * a.commissionPer1000)
    : Math.round(+cost);
  if (!(price >= 0)) return fail('قیمت خرید اعتبار درست نیست');
  if (price > face) return fail('قیمت خرید از مقدار اعتبار بیشتر است');

  const seq = await nextSeq('load');
  const load = await TopupLoad.create({
    no: `CR-${seq}`, date: new Date(), provider: a.provider,
    credit: face, cost: price, paid: paid !== false, createdBy: user.name
  });

  a.balance += face;
  if (load.paid) {
    await Transaction.create({
      type: 'مصرف', tag: 'topup', desc: `خرید اعتبار ${load.no} — ${a.provider}`, amount: price
    });
  } else {
    a.owed += price;
  }
  await a.save();

  await logAct(user.name, `${face.toLocaleString('en-US')} اعتبار گرفت (${load.no})`);
  return ok(load, 201);
});
