import { route, ok } from '@/lib/route';
import { Return } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const limit = Math.min(+new URL(request.url).searchParams.get('limit') || 100, 300);
  return ok(await Return.find().sort({ date: -1 }).limit(limit));
}, { perms: ['rep', 'pos'] });
