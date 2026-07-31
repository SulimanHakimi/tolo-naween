import { route, ok } from '@/lib/route';
import { ActivityLog } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const limit = Math.min(+new URL(request.url).searchParams.get('limit') || 80, 300);
  return ok(await ActivityLog.find().sort({ t: -1 }).limit(limit));
}, { perms: ['sec'] });
