'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, storeSession, getToken, getStoredUser } from '@/lib/api';
import { firstScreen, useApp } from '@/lib/store';
import { DEFAULT_STORE } from '@/lib/labels';

const POINTS = [
  'صندوق فروش با اسکن بارکد و چاپ بل',
  'گدام با قیمت خرید، پرچون و عمده',
  'قرض مشتریان و قرضداری تهیه‌کنندگان',
  'راپور مفاد و ضرر و اجناس پرفروش'
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getToken() ? getStoredUser() : null;
    if (u) router.replace(firstScreen(u));
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { username, password } });
      storeSession(token, user);
      setUser(user);
      router.replace(firstScreen(user));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <div className="row" style={{ gap: 13 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-6 9 6v10a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1z"></path>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>{DEFAULT_STORE.storeName}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>سیستم مدیریت سوپرمارکت</div>
          </div>
        </div>

        <div>
          <div className="login-pitch">تمام سوپرمارکت را از یک جا اداره کنید.</div>
          <div className="login-points">
            {POINTS.map((p) => (
              <div key={p} className="login-point">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#15BE53" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
                {p}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, opacity: 0.6 }}>
          هر کارمند با نام کاربری خود وارد می‌شود و تنها صفحاتی را می‌بیند که مدیر اجازه داده است.
        </div>
      </div>

      <div className="login-side">
        <form className="login-form" onSubmit={submit}>
          <div style={{ fontSize: 25, fontWeight: 800 }}>ورود به سیستم</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5, marginBottom: 22 }}>
            نام کاربری و رمز خود را وارد کنید.
          </div>

          <div className="field-label">نام کاربری</div>
          <input className="field ltr" autoComplete="username" value={username} dir="ltr"
            onChange={(e) => setUsername(e.target.value)} style={{ height: 46, marginBottom: 13 }} required />

          <div className="field-label">رمز عبور</div>
          <input className="field ltr" type="password" autoComplete="current-password" value={password} dir="ltr"
            onChange={(e) => setPassword(e.target.value)} style={{ height: 46 }} required />

          {error && <div className="banner banner-error" style={{ marginTop: 13 }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}
            style={{ height: 50, marginTop: 22, fontSize: 15 }}>
            {busy ? 'در حال ورود…' : 'ورود'}
          </button>

          <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', marginTop: 16, lineHeight: 1.7 }}>
            رمز خود را فراموش کرده‌اید؟ از مدیر بخواهید آن را از صفحهٔ «امنیت و بک‌اپ» تغییر دهد.
          </div>
        </form>
      </div>
    </div>
  );
}
