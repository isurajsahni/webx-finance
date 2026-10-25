import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from './client';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

/** Views computed from financial records; stale after any change. */
const DERIVED = [['dashboard'], ['ledger'], ['reports']];

/** Mutation that toasts on success/error and invalidates the given query keys. */
export function useApiMutation(fn, { invalidate = [], success, onSuccess, toastError = true } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await Promise.all([...invalidate, ...DERIVED].map((key) => qc.invalidateQueries({ queryKey: key })));
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => {
      if (toastError) toast.error(errorMessage(err));
    },
  });
}

// ── Auth ───────────────────────────────────────────────
export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api
        .get('/auth/me')
        .then((r) => r.data.user)
        .catch((err) => {
          if (err.response?.status === 401) return null;
          throw err;
        }),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => err?.response?.status !== 401 && count < 2,
  });

// ── Settings ───────────────────────────────────────────
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => get('/settings').then((d) => d.settings), staleTime: 60_000 });

export const useNumberingPreview = (date) =>
  useQuery({ queryKey: ['settings', 'numbering-preview', date], queryFn: () => get('/settings/numbering/preview', { date }) });

export const useBankAccounts = ({ includeInactive = false } = {}) =>
  useQuery({
    queryKey: ['bank-accounts', { includeInactive }],
    queryFn: () => get('/bank-accounts', includeInactive ? { includeInactive: 1 } : undefined).then((d) => d.items),
  });

export const useExpenseCategories = ({ includeInactive = false } = {}) =>
  useQuery({
    queryKey: ['expense-categories', { includeInactive }],
    queryFn: () => get('/expense-categories', includeInactive ? { includeInactive: 1 } : undefined).then((d) => d.items),
  });

export const useUsers = (params) => useQuery({ queryKey: ['users', params], queryFn: () => get('/users', params), placeholderData: (prev) => prev });

export const useAuditLogs = (params) =>
  useQuery({ queryKey: ['audit-logs', params], queryFn: () => get('/audit-logs', params), placeholderData: (prev) => prev });

// ── Clients ────────────────────────────────────────────
export const useClients = (params) =>
  useQuery({ queryKey: ['clients', params], queryFn: () => get('/clients', params), placeholderData: (prev) => prev });

export const useClient = (id) => useQuery({ queryKey: ['clients', 'one', id], queryFn: () => get(`/clients/${id}`).then((d) => d.client), enabled: !!id });

// ── Invoices ───────────────────────────────────────────
export const useInvoices = (params) =>
  useQuery({ queryKey: ['invoices', params], queryFn: () => get('/invoices', params), placeholderData: (prev) => prev });

export const useInvoice = (id) => useQuery({ queryKey: ['invoices', 'one', id], queryFn: () => get(`/invoices/${id}`).then((d) => d.invoice), enabled: !!id });

export const useNextInvoiceNumber = (date, enabled = true) =>
  useQuery({ queryKey: ['invoices', 'next-number', date], queryFn: () => get('/invoices/next-number', { date }), enabled: enabled && !!date });

// ── Payments ───────────────────────────────────────────
export const usePayments = (params, options = {}) =>
  useQuery({ queryKey: ['payments', params], queryFn: () => get('/payments', params), placeholderData: (prev) => prev, ...options });

export const usePayment = (id) => useQuery({ queryKey: ['payments', 'one', id], queryFn: () => get(`/payments/${id}`).then((d) => d.payment), enabled: !!id });

// ── Expenses & reimbursements ──────────────────────────
export const useExpenses = (params) => useQuery({ queryKey: ['expenses', params], queryFn: () => get('/expenses', params), placeholderData: (prev) => prev });
export const useExpense = (id) => useQuery({ queryKey: ['expenses', 'one', id], queryFn: () => get(`/expenses/${id}`).then((d) => d.expense), enabled: !!id });
export const useRecurringDue = () => useQuery({ queryKey: ['expenses', 'recurring-due'], queryFn: () => get('/expenses/recurring-due').then((d) => d.items) });
export const useReimbursements = (params) =>
  useQuery({ queryKey: ['reimbursements', params], queryFn: () => get('/reimbursements', params), placeholderData: (prev) => prev });
export const useReimbursement = (id) =>
  useQuery({ queryKey: ['reimbursements', 'one', id], queryFn: () => get(`/reimbursements/${id}`).then((d) => d.reimbursement), enabled: !!id });

// ── Team & payouts ─────────────────────────────────────
export const useTeam = (params) => useQuery({ queryKey: ['team', params], queryFn: () => get('/team', params), placeholderData: (prev) => prev });
export const useMember = (id) => useQuery({ queryKey: ['team', 'one', id], queryFn: () => get(`/team/${id}`).then((d) => d.member), enabled: !!id });
export const usePayouts = (params) => useQuery({ queryKey: ['payouts', params], queryFn: () => get('/payouts', params), placeholderData: (prev) => prev });
export const usePayout = (id) => useQuery({ queryKey: ['payouts', 'one', id], queryFn: () => get(`/payouts/${id}`).then((d) => d.payout), enabled: !!id });

// ── Ledger, reports, dashboard ─────────────────────────
export const useDashboard = (params) => useQuery({ queryKey: ['dashboard', params], queryFn: () => get('/dashboard', params), placeholderData: (prev) => prev, staleTime: 0 });
export const useLedger = (params) => useQuery({ queryKey: ['ledger', params], queryFn: () => get('/ledger', params), placeholderData: (prev) => prev, staleTime: 0 });
export const useBalances = () => useQuery({ queryKey: ['ledger', 'balances'], queryFn: () => get('/ledger/balances').then((d) => d.items), staleTime: 0 });
export const useReport = (name, params) => useQuery({ queryKey: ['reports', name, params], queryFn: () => get(`/reports/${name}`, params), placeholderData: (prev) => prev, staleTime: 0 });

export const useClientStatement = (id, params) =>
  useQuery({ queryKey: ['clients', 'statement', id, params], queryFn: () => get(`/clients/${id}/statement`, params), enabled: !!id, staleTime: 0, placeholderData: (prev) => prev });

// ── Quotes & saved services ────────────────────────────
export const useNextDocNumber = (base, date, enabled = true) =>
  useQuery({ queryKey: [base, 'next-number', date], queryFn: () => get(`/${base}/next-number`, { date }), enabled: enabled && !!date });
export const useQuotes = (params) => useQuery({ queryKey: ['quotes', params], queryFn: () => get('/quotes', params), placeholderData: (prev) => prev });
export const useQuote = (id) => useQuery({ queryKey: ['quotes', 'one', id], queryFn: () => get(`/quotes/${id}`).then((d) => d.quote), enabled: !!id });
export const useServices = (params) => useQuery({ queryKey: ['services', params], queryFn: () => get('/services', params), placeholderData: (prev) => prev });
