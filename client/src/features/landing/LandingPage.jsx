import { Link } from 'react-router';
import { ArrowRight, BarChart3, BookOpenText, CheckCircle2, FileText, LockKeyhole, Receipt, ServerCog, UsersRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui';

const FEATURES = [
  { icon: FileText, title: 'Quotes & invoices', text: 'Branded PDFs with GST, advance + balance splits, UPI QR and a live preview.' },
  { icon: Wallet, title: 'Payments & receipts', text: 'Part payments, TDS and proof of payment, each with its own numbered receipt.' },
  { icon: Receipt, title: 'Expenses', text: 'Bills, categories, recurring subscriptions and reimbursements with vouchers.' },
  { icon: UsersRound, title: 'Team & payouts', text: 'Employee profiles, payslips and payment vouchers for freelancers.' },
  { icon: BookOpenText, title: 'Ledger', text: 'Every transaction with a running balance per account, exportable anytime.' },
  { icon: BarChart3, title: 'Reports', text: 'Profit & loss, receivables ageing, GST summary, as PDF, CSV or Excel.' },
];

const Brand = ({ dark }) => (
  <div className="flex items-center gap-3">
    <img src="/favicon.svg" alt="" className="size-9" />
    <div className="leading-tight">
      <p className={`text-[13px] font-black tracking-wide uppercase ${dark ? 'text-white' : 'text-ink'}`}>
        The Web<span className="text-brand-500">{'{X}'}</span> Studio
      </p>
      <p className={`text-[11px] font-semibold ${dark ? 'text-white/50' : 'text-muted'}`}>Finance</p>
    </div>
  </div>
);

/** A small "paid invoice" card, drawn in HTML, to show what the app produces. */
function InvoicePreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand-500/25 blur-2xl" aria-hidden />
      <div className="relative rounded-2xl bg-white p-6 text-body shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-caps">Invoice</p>
            <p className="mt-1 font-mono text-sm font-bold text-ink">2026-27/0012</p>
          </div>
          <span className="rotate-[-8deg] rounded-md border-2 border-emerald-500 px-2 py-0.5 text-xs font-black tracking-widest text-emerald-600 uppercase">Paid</span>
        </div>
        <div className="mt-5 space-y-2 border-y border-line/70 py-4 text-sm">
          <div className="flex justify-between"><span>Website design & development</span><span className="font-semibold tabular-nums">₹45,000</span></div>
          <div className="flex justify-between text-muted"><span>Advance received · 1 Sep</span><span className="tabular-nums">− ₹15,000</span></div>
          <div className="flex justify-between text-muted"><span>Final payment received · 15 Oct</span><span className="tabular-nums">− ₹30,000</span></div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-lavender px-3 py-2 text-sm font-bold text-ink">
          <span>Balance due</span>
          <span className="flex items-center gap-1.5 tabular-nums"><CheckCircle2 className="size-4 text-emerald-600" /> ₹0</span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <ServerCog className="size-3.5" /> Free hosting until 30 Nov 2027
        </div>
      </div>
    </div>
  );
}

/** Public front page for signed-out visitors. The workspace is private: there is no sign-up. */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f6fb]">
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute -top-48 -right-40 size-[560px] rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Brand dark />
          <Button as={Link} to="/login" size="sm">Sign in</Button>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16 lg:pb-28">
          <div>
            <p className="label-caps">Studio finance, in one place</p>
            <h1 className="mt-4 text-4xl leading-[1.1] font-black tracking-tight sm:text-5xl">
              Every rupee in and out, <span className="text-brand-400">accounted for.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/70">
              Quotes, invoices, receipts, expenses and payouts for The Web{'{X}'} Studio, with branded PDFs and reports ready when you need them.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button as={Link} to="/login" className="h-11 px-5">
                Sign in to your workspace <ArrowRight className="size-4" />
              </Button>
              <span className="flex items-center gap-1.5 text-sm text-white/50"><LockKeyhole className="size-4" /> Authorised users only</span>
            </div>
          </div>
          <InvoicePreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <p className="label-caps">What's inside</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Built for how the studio works</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5">
              <span className="grid size-10 place-items-center rounded-lg bg-lavender text-brand-600"><Icon className="size-5" /></span>
              <h3 className="mt-4 font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-5 rounded-2xl bg-ink px-6 py-8 text-white sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="text-xl font-black">Have an account?</h2>
            <p className="mt-1 text-sm text-white/60">Accounts are created by the studio owner under Settings → Users.</p>
          </div>
          <Button as={Link} to="/login">Sign in <ArrowRight className="size-4" /></Button>
        </div>
      </section>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:px-6">
          <span>© {new Date().getFullYear()} The Web{'{X}'} Studio</span>
          <span>Private workspace · Authorised users only</span>
        </div>
      </footer>
    </div>
  );
}
