import {
  LayoutDashboard, Users, FileText, FileSignature, Package, Wallet, Receipt, HandCoins, UsersRound, BookOpenText, BarChart3, Settings,
} from 'lucide-react';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/quotes', label: 'Quotes', icon: FileSignature },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/services', label: 'Saved services', icon: Package },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/reimbursements', label: 'Reimbursements', icon: HandCoins },
  { to: '/team', label: 'Team & payouts', icon: UsersRound },
  { to: '/ledger', label: 'Ledger', icon: BookOpenText },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings, ownerOnly: true },
];
