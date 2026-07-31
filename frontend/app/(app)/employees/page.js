'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { makeFmt, num, jDate, jLong } from '@/lib/format';
import { C, TINTS, initialsOf } from '@/lib/ui';
import { EMP_STATUS } from '@/lib/labels';
import Icon, { ICON } from '@/components/icons';
import JDateField from '@/components/JDateField';

const EMPTY = { name: '', role: '', phone: '', account: '', salary: '', status: 'فعال', hired: '' };
const STATUS_COLOR = { 'فعال': C.greenBright, 'رخصت': C.amberBright, 'خارج شده': C.faint };

export default function EmployeesPage() {
  const { settings, user } = useApp();
  const fmt = makeFmt(settings.currency);

  const [employees, setEmployees] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/employees').then(setEmployees)
    .catch((e) => setError(e.message)).finally(() => setLoaded(true));

  useEffect(() => {
    load();
    api('/users').then(setAccounts).catch(() => {});
  }, []);

  const active = employees.filter((e) => e.status === 'فعال');
  const payroll = active.reduce((t, e) => t + e.salary, 0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const path = form._id ? `/employees/${form._id}` : '/employees';
      await api(path, { method: form._id ? 'PUT' : 'POST', body: form });
      setNotice(form._id ? 'معلومات کارمند تغییر یافت.' : 'کارمند ثبت شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/employees/${form._id}`, { method: 'DELETE' });
      setNotice('کارمند حذف شد.');
      setForm(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function pay() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/employees/${payFor._id}/pay`, { method: 'POST', body: { amount: +payFor.amount || 0 } });
      setNotice('پرداخت معاش ثبت شد و در مصارف حساب گردید.');
      setPayFor(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  // A month or more since the last payment is the cue that salary is due.
  const dueDays = (e) => e.lastPaid
    ? Math.floor((Date.now() - new Date(e.lastPaid).getTime()) / 864e5)
    : null;

  return (
    <>
      {notice && <div className="banner banner-ok" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !form && !payFor && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-3 gap-b">
        <div className="card">
          <div className="stat-label">کارمندان فعال</div>
          <div className="stat-value" style={{ color: C.brand }}>{num(active.length)} نفر</div>
          <div className="stat-sub" style={{ color: C.muted }}>از {num(employees.length)} ثبت‌شده</div>
        </div>
        <div className="card">
          <div className="stat-label">مجموع معاش ماهانه</div>
          <div className="stat-value" style={{ color: C.text }}>{fmt(payroll)}</div>
          <div className="stat-sub" style={{ color: C.muted }}>کارمندان فعال</div>
        </div>
        <div className="card">
          <div className="stat-label">معاش پرداخت‌نشده</div>
          <div className="stat-value" style={{ color: active.some((e) => (dueDays(e) ?? 99) >= 30) ? C.amber : C.green }}>
            {num(active.filter((e) => (dueDays(e) ?? 99) >= 30).length)} نفر
          </div>
          <div className="stat-sub" style={{ color: C.muted }}>۳۰ روز یا بیشتر از آخرین پرداخت</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="card-head">
          <div className="card-title">کارمندان</div>
          <div className="spacer"></div>
          <button onClick={() => { setForm({ ...EMPTY }); setError(''); }} className="btn btn-primary btn-md">
            <Icon d={ICON.plus} size={16} width={2} />کارمند جدید
          </button>
        </div>

        {loaded && employees.length === 0 ? (
          <div className="empty">
            کارمندی ثبت نشده. اینجا معاش و وضعیت کار ثبت می‌شود؛ نام کاربری و رمز ورود در صفحهٔ{' '}
            <strong>امنیت و بک‌اپ</strong> ساخته می‌شود.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>کارمند</th><th>وظیفه</th><th>شماره تماس</th><th>حساب کاربری</th>
                  <th className="num">معاش ماهانه</th><th>آخرین پرداخت</th><th>وضعیت</th><th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => {
                  const [tint, colour] = TINTS[i % TINTS.length];
                  const days = dueDays(e);
                  return (
                    <tr key={e._id}>
                      <td>
                        <div className="row" style={{ gap: 11 }}>
                          <div className="avatar" style={{ width: 38, height: 38, background: tint, color: colour }}>
                            {initialsOf(e.name)}
                          </div>
                          <div className="semi">{e.name}</div>
                        </div>
                      </td>
                      <td style={{ color: C.muted }}>{e.role}</td>
                      <td className="tnum ltr" style={{ color: C.muted }}>{e.phone || '—'}</td>
                      <td className="ltr" style={{ color: e.account ? C.brand : C.faint, fontSize: 12.5 }}>
                        {e.account || 'ندارد'}
                      </td>
                      <td className="num semi">{e.salary ? fmt(e.salary) : '—'}</td>
                      <td className="tnum" style={{ color: days != null && days >= 30 ? C.amber : C.muted }}>
                        {e.lastPaid ? jDate(e.lastPaid) : 'هیچ‌وقت'}
                      </td>
                      <td>
                        <span className="row" style={{ gap: 7 }}>
                          <span className="dot" style={{ background: STATUS_COLOR[e.status] }}></span>
                          <span style={{ fontSize: 12.5 }}>{e.status}</span>
                        </span>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {e.status === 'فعال' && e.salary > 0 && (
                            <button onClick={() => { setPayFor({ ...e, amount: '' }); setError(''); }} className="btn btn-soft btn-sm">
                              پرداخت معاش
                            </button>
                          )}
                          <button onClick={() => { setForm({ ...e, salary: String(e.salary || ''), hired: e.hired ? String(e.hired).slice(0, 10) : '' }); setError(''); }}
                            className="btn btn-ghost btn-sm btn-icon" title="تغییر">
                            <Icon d={ICON.edit} size={15} stroke={C.muted} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="overlay">
          <div className="modal modal-md">
            <h2>{form._id ? 'تغییر معلومات کارمند' : 'کارمند جدید'}</h2>
            <div className="modal-sub">
              این صفحه معاش و وضعیت کار را نگه می‌دارد. سطح دسترسی به صفحات از «امنیت و بک‌اپ» تعیین می‌شود.
            </div>

            <div className="form-grid">
              <div className="form-row">
                <div><div className="field-label">نام</div>
                  <input value={form.name} onChange={set('name')} className="field" /></div>
                <div><div className="field-label">وظیفه</div>
                  <input value={form.role} onChange={set('role')} placeholder="مثلاً: صندوق‌دار" className="field" /></div>
              </div>

              <div className="form-row">
                <div><div className="field-label">شماره تماس</div>
                  <input value={form.phone || ''} onChange={set('phone')} className="field ltr" inputMode="tel" /></div>
                <div><div className="field-label">معاش ماهانه</div>
                  <input value={form.salary} onChange={set('salary')} type="number" min="0" className="field tnum" /></div>
              </div>

              <div className="form-row">
                <div>
                  <div className="field-label">وضعیت</div>
                  <select value={form.status} onChange={set('status')} className="field">
                    {EMP_STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div className="field-label">حساب کاربری (اختیاری)</div>
                  {accounts.length > 0 ? (
                    <select value={form.account || ''} onChange={set('account')} className="field ltr">
                      <option value="">— وصل نشده —</option>
                      {accounts.map((a) => <option key={a._id} value={a.username}>{a.username} — {a.name}</option>)}
                    </select>
                  ) : (
                    <input value={form.account || ''} onChange={set('account')} placeholder="نام کاربری" className="field ltr" />
                  )}
                </div>
              </div>

              <div>
                <div className="field-label">تاریخ شروع کار</div>
                <JDateField value={form.hired} onChange={(iso) => setForm((f) => ({ ...f, hired: iso }))} />
              </div>

              {error && <div className="banner banner-error">{error}</div>}
            </div>

            <div className="modal-actions">
              {form._id && <button onClick={remove} disabled={busy} className="btn btn-danger" style={{ flex: 0, padding: '0 18px' }}>حذف</button>}
              <button onClick={() => setForm(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>
        </div>
      )}

      {payFor && (
        <div className="overlay">
          <div className="modal modal-sm">
            <h2>پرداخت معاش {payFor.name}</h2>
            <div className="modal-sub tnum">
              معاش ماهانه: {fmt(payFor.salary)}
              {payFor.lastPaid ? ` · آخرین پرداخت ${jLong(payFor.lastPaid)}` : ' · تا حال پرداخت نشده'}
            </div>

            <div className="field-label">مبلغ پرداخت</div>
            <input value={payFor.amount} onChange={(e) => setPayFor((p) => ({ ...p, amount: e.target.value }))}
              type="number" min="0" placeholder={`معاش کامل (${Math.round(payFor.salary)})`}
              className="field tnum" style={{ height: 44 }} />
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
              خالی بگذارید تا معاش کامل پرداخت شود. این مبلغ در راپور مفاد و ضرر به‌عنوان مصرف حساب می‌شود.
            </div>

            {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="modal-actions">
              <button onClick={() => setPayFor(null)} className="btn btn-ghost">انصراف</button>
              <button onClick={pay} disabled={busy} className="btn btn-primary">{busy ? 'در حال ثبت…' : 'ثبت پرداخت'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
