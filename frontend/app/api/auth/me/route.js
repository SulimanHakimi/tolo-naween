import { route, ok, publicUser } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const GET = route(async (request, { user }) => ok(publicUser(user)));
