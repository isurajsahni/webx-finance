import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui';

const TABS = [
  { to: 'company', label: 'Company' },
  { to: 'bank-accounts', label: 'Bank accounts' },
  { to: 'numbering', label: 'Numbering' },
  { to: 'preferences', label: 'GST & defaults' },
  { to: 'categories', label: 'Expense categories' },
  { to: 'users', label: 'Users' },
  { to: 'audit', label: 'Audit log' },
];

export function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" description="Company profile, bank accounts, numbering and access." />
      <nav className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Settings sections">
        <div className="flex w-max gap-1 rounded-xl border border-line/70 bg-white p-1 shadow-xs">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn('rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors', isActive ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-body')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </>
  );
}
