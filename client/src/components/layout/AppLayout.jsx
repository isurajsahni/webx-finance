import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router';
import { LogOut, Menu, X, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/AuthContext';
import { BrandMark, BrandName } from './Brand';
import { NAV } from './nav';
import { LoadingState } from '@/components/ui';

function Sidebar({ onNavigate }) {
  const { user, isOwner, logout } = useAuth();
  const items = NAV.filter((n) => !n.ownerOnly || isOwner);

  return (
    <div className="flex h-full flex-col bg-ink text-white">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-3 px-5 py-5">
        <BrandMark />
        <BrandName dark />
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {items.map(({ to, label, icon: Icon, end, phase }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                isActive ? 'bg-brand-500 text-white shadow-[0_6px_20px_-6px] shadow-brand-500/60' : 'text-white/65 hover:bg-white/8 hover:text-white',
              )
            }
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {phase && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-white/40">P{phase}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Link to="/account" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-md hover:opacity-90" title="Your account">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80">
              <UserRound className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="text-[11px] text-white/50 capitalize">{user?.role}</p>
            </div>
          </Link>
          <button type="button" onClick={logout} className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  // Browser tab title follows the section: "Invoices · Web{X} Finance".
  useEffect(() => {
    const item = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
    const extra = { '/account': 'Your account', '/payouts': 'Payouts' };
    const name = item?.label || Object.entries(extra).find(([k]) => location.pathname.startsWith(k))?.[1];
    document.title = name ? `${name} · Web{X} Finance` : 'Web{X} Finance';
  }, [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-panel" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <BrandMark className="size-7" />
        <BrandName />
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-5 right-3 z-10 rounded-md p-1 text-white/60 hover:text-white" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
