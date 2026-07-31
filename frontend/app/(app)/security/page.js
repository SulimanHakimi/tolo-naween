'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { ago, jRelative, num } from '@/lib/format';
import { C, initialsOf } from '@/lib/ui';
import { JOB_TITLES } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';

const CURRENCIES = ['AFN', 'USD', 'PKR'];
const EMPTY_USER = { name: '', role: JOB_TITLES[0], username: '', password: '', active: true };

// Which icon and tint an activity row gets, from words that appear in the action.
const LOG_STYLE = [
  [/فروش|بل/, ICON.cart, C.blueSoft, C.brand],
  [/برگشتی/, ICON.undo, C.redSoft, C.red],
  [/سفارش خرید|تحویل|تهیه‌کننده/, ICON.truck, C.greenSoft, C.green],
  [/بک‌اپ/, ICON.db, C.blueSoft, C.brand],
  [/رمز|حساب|دسترسی/, ICON.key, C.amberSoft, C.amber],
  [/قیمت|تخفیف|جنس/, ICON.edit, C.amberSoft, C.amber],
  [/قرض/, ICON.wallet, C.amberSoft, C.amber]
];
const styleFor = (action) => {
  const hit = LOG_STYLE.find(([re]) => re.test(action));
  return hit ? { icon: hit[1], tint: hit[2], color: hit[3] } : { icon: ICON.check, tint: C.bg, color: C.muted };
};

export default function SecurityPage() {
  const { settings, setSettings, user } = useApp();

  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);            // account form
  const [pwFor, setPwFor] = useState(null);          // reset another account's password
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadUsers = () => api('/users').then(setUsers).catch((e) => setError(e.message));
  const loadLogs = () => api('/logs').then(setLogs).catch(() => {});

  useEffect(() => { loadUsers(); loadLogs(); }, []);
  useEffect(() => {
    setProfile({
      storeName: settings.storeName || '',
      storeAddress: settings.storeAddress || '',
      storePhone: settings.storePhone || '',
      storeLicense: settings.storeLicense || ''
    });
  }, [settings]);

  async function saveSettings(patch) {
    setError(''); setNotice('');
    try {
      setSettings(await api('/settings', { method: 'PUT', body: patch }));
      setNotice('تنظیمات ذخیره شد.');
      loadLogs();
    } catch (e) { setError(e.message); }
  }

  async function backupNow() {
    setError(''); setNotice('');
    setBusy(true);
    try {
      const { settings: s, dump } = await api('/settings/backup', { method: 'POST' });
      setSettings(s);
      const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tolo-naween-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice('فایل بک‌اپ دانلود شد — آن را در جای مصون نگه کنید.');
      loadLogs();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function changeOwnPassword() {
    setPwErr(''); setPwMsg('');
    if (pw.newPassword !== pw.confirm) { setPwErr('دو رمز جدید یکسان نیستند.'); return; }
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwMsg('رمز شما تغییر یافت.');
      loadLogs();
    } catch (e) { setPwErr(e.message); }
  }

  function openNewUser() {
    setForm({ ...EMPTY_USER });
    setError('');
  }

  function openEditUser(u) {
    setForm({ _id: u._id, name: u.name, role: u.role, username: u.username, password: '', active: u.active });
    setError('');
  }

  async function saveUser() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const path = form._id ? `/users/${form._id}` : '/users';
      const body = { name: form.name, role: form.role, active: form.active };
      if (!form._id) { body.username = form.username; body.password = form.password; }
      await api(path, { method: form._id ? 'PUT' : 'POST', body });
      setNotice(form._id ? 'حساب تغییر یافت.' : 'حساب کاربری ساخته شد.');
      setForm(null);
      loadUsers(); loadLogs();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function removeUser() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/users/${form._id}`, { method: 'DELETE' });
      setNotice('حساب حذف شد.');
      setForm(null);
      loadUsers(); loadLogs();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function resetPassword() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/users/${pwFor._id}`, { method: 'PUT', body: { password: pwFor.password } });
      setNotice(`رمز حساب ${pwFor.username} تغییر یافت — آن را به خودش بدهید.`);
      setPwFor(null);
      loadLogs();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const backupAge = settings.lastBackup ? (Date.now() - new Date(settings.lastBackup).getTime()) / 864e5 : null;
  const backupStale = backupAge === null || backupAge > 1.5;

  const setP = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  if (!profile) return null;

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !form && !pwFor && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-side-wide gap-b">
        <div className="stack">
          <div style={{ background: 'linear-gradient(135deg,#106090,#0E1B24)', borderRadius: 16, padding: 22, color: '#fff', boxShadow: '0 8px 24px rgba(16,96,144,0.25)' }}>
            <div className="row" style={{ gap: 11, marginBottom: 16 }}>
              <Icon d={ICON.shield} size={24} stroke="#fff" />
              <div style={{ fontSize: 16, fontWeight: 700 }}>بک‌اپ معلومات</div>
            </div>

            <div className="row" style={{ gap: 8, fontSize: 13, color: '#CFE0EA', marginBottom: 6 }}>
              <span className="dot" style={{ background: backupStale ? C.amberBright : C.greenBright }}></span>
              {settings.lastBackup
                ? `آخرین بک‌اپ: ${ago(settings.lastBackup)}`
                : 'تا حال بک‌اپ گرفته نشده'}
            </div>
            <div style={{ fontSize: 12, color: '#7C93A3', lineHeight: 1.9 }}>
              {backupStale
                ? 'یک فایل بک‌اپ بگیرید و آن را بیرون از این کمپیوتر نگه کنید — بک‌اپ روی همان دیسک، دیسک خراب‌شده را نجات نمی‌دهد.'
                : 'بک‌اپ به‌روز است. آن را در فلش یا ایمیل هم نگه کنید.'}
            </div>

            <button onClick={backupNow} disabled={busy} className="btn btn-block"
              style={{ marginTop: 16, height: 46, background: '#fff', color: C.brand, fontWeight: 700 }}>
              <Icon d={ICON.download} size={18} stroke={C.brand} />
              {busy ? 'در حال آماده‌سازی…' : 'اکنون بک‌اپ بگیر'}
            </button>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>رمز خودم</div>
            <div className="card-note" style={{ marginBottom: 14 }}>
              وارد شده به‌نام {user?.name} ({user?.username}).
            </div>
            <div className="form-grid">
              <input type="password" autoComplete="current-password" placeholder="رمز فعلی" className="field ltr" dir="ltr"
                value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
              <input type="password" autoComplete="new-password" placeholder="رمز جدید (حداقل ۸ حرف)" className="field ltr" dir="ltr"
                value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
              <input type="password" autoComplete="new-password" placeholder="تکرار رمز جدید" className="field ltr" dir="ltr"
                value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
              {pwErr && <div className="banner banner-error">{pwErr}</div>}
              {pwMsg && <div className="banner banner-ok">{pwMsg}</div>}
              <button onClick={changeOwnPassword} className="btn btn-soft btn-block">تغییر رمز</button>
            </div>
          </div>

          <div className="table-wrap">
            <div className="card-head">
              <div className="card-title">حساب‌های کاربری</div>
              <span className="card-note tnum">{num(users.length)}</span>
              <div className="spacer"></div>
              <button onClick={openNewUser} className="btn btn-primary btn-sm">
                <Icon d={ICON.plus} size={15} width={2} />حساب جدید
              </button>
            </div>

            <div style={{ padding: '6px 12px 12px' }}>
              {users.map((u) => (
                <div key={u._id} className="list-row" style={{ opacity: u.active ? 1 : 0.6 }}>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{u.initials || initialsOf(u.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ellipsis semi" style={{ fontSize: 13 }}>
                      {u.name}
                      {String(u._id) === String(user?.id) && <span style={{ color: C.faint, fontWeight: 400 }}> (خودم)</span>}
                    </div>
                    <div className="ellipsis" style={{ fontSize: 11, color: C.faint }}>
                      <span className="ltr">{u.username}</span> · {u.role}
                    </div>
                  </div>
                  {!u.active && <span className="pill pill-grey">غیرفعال</span>}
                  <button onClick={() => { setPwFor({ ...u, password: '' }); setError(''); }} className="btn btn-ghost btn-sm btn-icon" title="تغییر رمز">
                    <Icon d={ICON.key} size={15} stroke={C.muted} />
                  </button>
                  <button onClick={() => openEditUser(u)} className="btn btn-ghost btn-sm btn-icon" title="دسترسی‌ها">
                    <Icon d={ICON.edit} size={15} stroke={C.muted} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <div className="card-head">
            <div className="card-title">راپور فعالیت‌ها (چه کسی چه کاری کرد)</div>
          </div>
          {logs.length === 0 ? (
            <div className="empty">هنوز فعالیتی ثبت نشده.</div>
          ) : (
            <div style={{ padding: '8px 20px 16px', maxHeight: 620, overflowY: 'auto' }}>
              {logs.map((l) => {
                const s = styleFor(l.action);
                return (
                  <div key={l._id} className="row" style={{ gap: 13, padding: '13px 0', borderBottom: '1px solid #F7F8FA', alignItems: 'flex-start' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: s.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon d={s.icon} size={16} stroke={s.color} width={1.9} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        <b style={{ fontWeight: 700 }}>{l.user}</b> — {l.action}
                      </div>
                      <div className="tnum" style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{jRelative(l.t)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2 gap-b">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>معلومات سوپرمارکت</div>
          <div className="card-note" style={{ marginBottom: 14 }}>
            بالای هر بل و راپور چاپ می‌شود. خانه‌های خالی چاپ نمی‌شوند.
          </div>
          <div className="form-grid">
            <div className="form-row">
              <div><div className="field-label">نام سوپرمارکت</div>
                <input value={profile.storeName} onChange={setP('storeName')} className="field" /></div>
              <div><div className="field-label">آدرس</div>
                <input value={profile.storeAddress} onChange={setP('storeAddress')} className="field" /></div>
            </div>
            <div className="form-row">
              <div><div className="field-label">شماره تماس</div>
                <input value={profile.storePhone} onChange={setP('storePhone')} className="field ltr" inputMode="tel" /></div>
              <div><div className="field-label">شماره جواز</div>
                <input value={profile.storeLicense} onChange={setP('storeLicense')} className="field ltr" /></div>
            </div>
            <button onClick={() => saveSettings(profile)} className="btn btn-soft" style={{ alignSelf: 'flex-start' }}>
              ذخیرهٔ معلومات
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>تنظیمات فروش و هشدارها</div>
          <div className="card-note" style={{ marginBottom: 14 }}>
            روی تمام قیمت‌ها، بل‌های جدید و هشدارهای گدام تأثیر دارد.
          </div>

          <div className="form-grid">
            <div className="form-row">
              <div>
                <div className="field-label">واحد پول</div>
                <select value={settings.currency} onChange={(e) => saveSettings({ currency: e.target.value })} className="field">
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="field-label">مالیه (٪)</div>
                <input type="number" min="0" max="15" step="0.5" defaultValue={settings.vatRate} className="field tnum"
                  onBlur={(e) => Number(e.target.value) !== settings.vatRate && saveSettings({ vatRate: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div>
                <div className="field-label">هشدار کمبود موجودی زیر</div>
                <input type="number" min="1" max="1000" defaultValue={settings.lowStockThreshold} className="field tnum"
                  onBlur={(e) => Number(e.target.value) !== settings.lowStockThreshold && saveSettings({ lowStockThreshold: e.target.value })} />
              </div>
              <div>
                <div className="field-label">هشدار انقضا (روز پیش از تاریخ)</div>
                <input type="number" min="1" max="365" defaultValue={settings.expiryWarnDays} className="field tnum"
                  onBlur={(e) => Number(e.target.value) !== settings.expiryWarnDays && saveSettings({ expiryWarnDays: e.target.value })} />
              </div>
            </div>

            <div>
              <div className="field-label">حد اقل تعداد برای قیمت عمده</div>
              <input type="number" min="2" max="10000" defaultValue={settings.wholesaleMinQty} className="field tnum"
                onBlur={(e) => Number(e.target.value) !== settings.wholesaleMinQty && saveSettings({ wholesaleMinQty: e.target.value })} />
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 5 }}>
                وقتی تعداد یک قلم در بل به این عدد برسد، صندوق قیمت عمدهٔ همان جنس را حساب می‌کند.
              </div>
            </div>
          </div>
        </div>
      </div>

      {form && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>{form._id ? `حساب ${form.name}` : 'حساب کاربری جدید'}</h2>
            <div className="modal-sub">
              هر حساب به تمام صفحات دسترسی کامل دارد. «وظیفه» تنها یک عنوان است که زیر نام
              در منو نشان داده می‌شود و چیزی را محدود نمی‌کند.
            </div>

            <div className="form-grid">
              <div className="form-row">
                <div><div className="field-label">نام</div>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="field" /></div>
                <div>
                  <div className="field-label">وظیفه (عنوان)</div>
                  <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    list="tn-titles" className="field" />
                  <datalist id="tn-titles">{JOB_TITLES.map((r) => <option key={r} value={r} />)}</datalist>
                </div>
              </div>

              {!form._id && (
                <div className="form-row">
                  <div>
                    <div className="field-label">نام کاربری (انگلیسی)</div>
                    <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      className="field ltr" dir="ltr" placeholder="ahmad" />
                  </div>
                  <div>
                    <div className="field-label">رمز عبور (حداقل ۸ حرف)</div>
                    <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      type="password" className="field ltr" dir="ltr" autoComplete="new-password" />
                  </div>
                </div>
              )}

              {form._id && (
                <label className="row" style={{ gap: 9, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                  <input type="checkbox" checked={form.active} style={{ width: 16, height: 16, accentColor: C.brand, cursor: 'pointer' }}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                  حساب فعال است (غیرفعال کردن، ورود را فوراً می‌بندد)
                </label>
              )}

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              {form._id && String(form._id) !== String(user?.id) && (
                <button onClick={removeUser} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>
              )}
              <button onClick={() => setForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={saveUser} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}

      {pwFor && (
        <div className="overlay">
          <div className="modal modal-sm">
            <h2>تغییر رمز {pwFor.name}</h2>
            <div className="modal-sub">
              نام کاربری: <span className="ltr">{pwFor.username}</span> — رمز جدید را به خودش بدهید تا بعداً خودش تغییرش دهد.
            </div>

            <div className="field-label">رمز جدید (حداقل ۸ حرف)</div>
            <input value={pwFor.password} onChange={(e) => setPwFor((p) => ({ ...p, password: e.target.value }))}
              type="text" className="field ltr" dir="ltr" style={{ height: 44 }} autoComplete="off" />

            {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="modal-actions">
              <button onClick={() => setPwFor(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={resetPassword} disabled={busy || pwFor.password.length < 8} className="btn btn-primary">
                {busy ? 'در حال ذخیره…' : 'تغییر رمز'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
