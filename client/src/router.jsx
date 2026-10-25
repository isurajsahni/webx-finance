import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouteError } from '@/features/common/RouteError';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth, RequireOwner } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { NotFound } from '@/features/common/ComingSoon';

// Pages load on demand, so the first visit only downloads what it needs.
const page = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const AccountPage = page(() => import('@/features/auth/AccountPage'), 'AccountPage');
const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage');
const SettingsLayout = page(() => import('@/features/settings/SettingsLayout'), 'SettingsLayout');
const CompanyTab = page(() => import('@/features/settings/CompanyTab'), 'CompanyTab');
const BankAccountsTab = page(() => import('@/features/settings/BankAccountsTab'), 'BankAccountsTab');
const NumberingTab = page(() => import('@/features/settings/NumberingTab'), 'NumberingTab');
const PreferencesTab = page(() => import('@/features/settings/PreferencesTab'), 'PreferencesTab');
const CategoriesTab = page(() => import('@/features/settings/CategoriesTab'), 'CategoriesTab');
const UsersTab = page(() => import('@/features/settings/UsersTab'), 'UsersTab');
const AuditTab = page(() => import('@/features/settings/AuditTab'), 'AuditTab');
const ClientsPage = page(() => import('@/features/clients/ClientsPage'), 'ClientsPage');
const ClientDetailPage = page(() => import('@/features/clients/ClientDetailPage'), 'ClientDetailPage');
const InvoicesPage = page(() => import('@/features/invoices/InvoicesPage'), 'InvoicesPage');
const InvoiceEditorPage = page(() => import('@/features/invoices/InvoiceEditorPage'), 'InvoiceEditorPage');
const InvoiceViewPage = page(() => import('@/features/invoices/InvoiceViewPage'), 'InvoiceViewPage');
const PaymentsPage = page(() => import('@/features/payments/PaymentsPage'), 'PaymentsPage');
const PaymentViewPage = page(() => import('@/features/payments/PaymentViewPage'), 'PaymentViewPage');
const ExpensesPage = page(() => import('@/features/expenses/ExpensesPage'), 'ExpensesPage');
const ExpenseViewPage = page(() => import('@/features/expenses/ExpenseViewPage'), 'ExpenseViewPage');
const ReimbursementsPage = page(() => import('@/features/expenses/ReimbursementsPage'), 'ReimbursementsPage');
const ReimbursementViewPage = page(() => import('@/features/expenses/ReimbursementViewPage'), 'ReimbursementViewPage');
const TeamPage = page(() => import('@/features/team/TeamPage'), 'TeamPage');
const MemberDetailPage = page(() => import('@/features/team/MemberDetailPage'), 'MemberDetailPage');
const PayoutEditorPage = page(() => import('@/features/team/PayoutEditorPage'), 'PayoutEditorPage');
const PayoutViewPage = page(() => import('@/features/team/PayoutViewPage'), 'PayoutViewPage');
const LedgerPage = page(() => import('@/features/ledger/LedgerPage'), 'LedgerPage');
const ReportsPage = page(() => import('@/features/reports/ReportsPage'), 'ReportsPage');
const QuotesPage = page(() => import('@/features/quotes/QuotesPage'), 'QuotesPage');
const QuoteViewPage = page(() => import('@/features/quotes/QuoteViewPage'), 'QuoteViewPage');
const ServicesPage = page(() => import('@/features/services/ServicesPage'), 'ServicesPage');

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'clients', element: <ClientsPage /> },
          { path: 'clients/:id', element: <ClientDetailPage /> },
          { path: 'invoices', element: <InvoicesPage /> },
          { path: 'invoices/new', element: <InvoiceEditorPage /> },
          { path: 'invoices/:id', element: <InvoiceViewPage /> },
          { path: 'invoices/:id/edit', element: <InvoiceEditorPage /> },
          { path: 'quotes', element: <QuotesPage /> },
          { path: 'quotes/new', element: <InvoiceEditorPage key="new-quote" docType="quote" /> },
          { path: 'quotes/:id', element: <QuoteViewPage /> },
          { path: 'quotes/:id/edit', element: <InvoiceEditorPage key="edit-quote" docType="quote" /> },
          { path: 'services', element: <ServicesPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'payments/:id', element: <PaymentViewPage /> },
          { path: 'expenses', element: <ExpensesPage /> },
          { path: 'expenses/:id', element: <ExpenseViewPage /> },
          { path: 'reimbursements', element: <ReimbursementsPage /> },
          { path: 'reimbursements/:id', element: <ReimbursementViewPage /> },
          { path: 'team', element: <TeamPage /> },
          { path: 'team/:id', element: <MemberDetailPage /> },
          { path: 'payouts/new', element: <PayoutEditorPage /> },
          { path: 'payouts/:id', element: <PayoutViewPage /> },
          { path: 'ledger', element: <LedgerPage /> },
          { path: 'reports', element: <ReportsPage /> },
          {
            path: 'settings',
            element: <RequireOwner />,
            children: [
              {
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <Navigate to="company" replace /> },
                  { path: 'company', element: <CompanyTab /> },
                  { path: 'bank-accounts', element: <BankAccountsTab /> },
                  { path: 'numbering', element: <NumberingTab /> },
                  { path: 'preferences', element: <PreferencesTab /> },
                  { path: 'categories', element: <CategoriesTab /> },
                  { path: 'users', element: <UsersTab /> },
                  { path: 'audit', element: <AuditTab /> },
                ],
              },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
