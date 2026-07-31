import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from './db';
import { User } from './models';

export const ok = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (error, status = 400) => NextResponse.json({ error }, { status });

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, secret(), { expiresIn: '12h' });
}

export function publicUser(u) {
  return { id: u._id, name: u.name, role: u.role, initials: u.initials, username: u.username };
}

async function authenticate(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), secret());
    const user = await User.findById(payload.sub).select('-passwordHash');
    // A disabled account keeps its token until expiry, so the check belongs here too.
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

/**
 * Wraps a route handler with the database connection and authentication. Every
 * signed-in account reaches everything, so being signed in is the whole check.
 * Pass `public: true` for the sign-in and setup routes.
 */
export function route(handler, { public: isPublic } = {}) {
  return async (request, ctx = {}) => {
    try {
      await connectDB();

      if (isPublic) return await handler(request, ctx);

      const user = await authenticate(request);
      if (!user) return fail('ورود به سیستم لازم است', 401);

      const params = ctx.params ? await ctx.params : {};
      return await handler(request, { ...ctx, params, user });
    } catch (e) {
      console.error(e);
      if (e?.name === 'MongooseServerSelectionError') {
        return fail('اتصال به دیتابیس ممکن نیست. MONGODB_URI و لیست IP های مجاز را بررسی کنید.', 503);
      }
      return fail(e?.message || 'خطای سرور', e?.status || 500);
    }
  };
}

export async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
