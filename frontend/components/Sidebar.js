'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useApp, SCREEN_ORDER, SCREEN_PATH } from '@/lib/store';
import { initialsOf } from '@/lib/ui';
import { ago } from '@/lib/format';
import Icon, { ICON } from './icons';

const NAV_ICON = {
  dash: ICON.grid, pos: ICON.pos, inv: ICON.box, pur: ICON.truck, cust: ICON.users,
  rep: ICON.chart, price: ICON.tag, emp: ICON.badge, sec: ICON.shield
};

export default function Sidebar() {
  const { user, L, signOut, settings, alertCount } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  if (!user) return null;

  const backupOk = settings.lastBackup
    && Date.now() - new Date(settings.lastBackup).getTime() < 36 * 3600e3;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Icon d={ICON.home} size={24} stroke="#fff" width={1.9} />
        </div>
        <div>
          <div className="brand-name">{settings.storeName || 'طلوع ناوین'}</div>
          <div className="brand-sub">سیستم مدیریت سوپرمارکت</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {SCREEN_ORDER.filter((k) => user.perms?.[k]).map((k) => (
          <button key={k} onClick={() => router.push(SCREEN_PATH[k])}
            className={`nav-btn${pathname === SCREEN_PATH[k] ? ' active' : ''}`}>
            <Icon d={NAV_ICON[k]} size={20} width={1.7} />
            <span style={{ flex: 1 }}>{L[k]}</span>
            {k === 'inv' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <div className="avatar" style={{ width: 38, height: 38, background: 'var(--brand)', color: '#fff', fontSize: 15 }}>
            {user.initials || initialsOf(user.name)}
          </div>
          <div className="who" style={{ flex: 1, minWidth: 0 }}>
            <div className="who-name ellipsis">{user.name}</div>
            <div className="who-role">{user.role}</div>
          </div>
          <button onClick={signOut} title="خارج شدن" aria-label="خارج شدن"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7C93A3', padding: 4 }}>
            <Icon d={ICON.logout} size={17} />
          </button>
        </div>

        {/* The real last-backup time — never a claim the app cannot back up. */}
        <div className="backup-line">
          <span className={`dot ${backupOk ? 'dot-on' : 'dot-off'}`}></span>
          {settings.lastBackup ? `آخرین بک‌اپ: ${ago(settings.lastBackup)}` : 'بک‌اپ گرفته نشده'}
        </div>
      </div>
    </aside>
  );
}
