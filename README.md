# Web{X} Finance

The private finance app for **The Web{X} Studio**. It records every rupee in and out, and produces branded PDFs: quotations, invoices, receipts, payslips, vouchers, statements and reports.

**Stack:** React + Vite + Tailwind (client), Node.js + Express + MongoDB/Mongoose (server), Puppeteer (PDF). Code used by both sides (money maths, numbering, the PDF templates) lives in `/shared`, so the live preview in the browser and the downloaded PDF are produced by the same code.

---

## 1. Run it on your Mac

You need Node.js 20.6 or newer.

```bash
npm install
```
```bash
cp server/.env.example server/.env
```
```bash
npm run dev
```

Open **http://localhost:5173**.

- **No database to set up.** If `MONGODB_URI` in `server/.env` is still the example value, `npm run dev` starts a MongoDB on your Mac automatically and keeps the data in `server/.data/`. The first run downloads it (about 75 MB).
- **First sign-in.** On the first start the app creates the owner account. The email comes from `SEED_OWNER_EMAIL`. If `SEED_OWNER_PASSWORD` is empty, a password is generated and saved into `server/.env`.
- **The app only runs while that terminal is open.** If you see "localhost refused to connect", run `npm run dev` again; your data is kept.

To change your login, edit `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` in `server/.env`, then run:

```bash
npm run seed -- --reset-owner-password
```

### Using MongoDB Atlas instead

1. In Atlas, create a cluster and a database user, and allow your IP under **Network Access**.
2. Put the connection string in `server/.env`, with the database name before the `?`:
   `MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/webx_finance?retryWrites=true&w=majority`
3. Run `npm run seed`, then `npm run dev`.

Data in the local database is not copied to Atlas automatically.

---

## 2. What it does

| Area | Highlights |
| --- | --- |
| **Dashboard** | Income, expenses and net profit for any period; outstanding and overdue amounts; pending reimbursements; income vs expenses by month; spending by category; unpaid invoices; recent transactions; account balances; **free hosting / maintenance ending soon** |
| **Clients** | Logo, contact person, phone, email, website, full address with state (GST code) and PIN, GSTIN, PAN. Each client page shows invoices, payments and a **statement of account** (PDF / CSV / Excel) |
| **Quotes** | QUOTATION PDF with a valid-until date. Draft → Sent → Accepted / Declined; shows Expired after the date. **Convert to invoice** in one click |
| **Invoices** | Live preview with the PDF template; advance + balance split with an automatic note; discount; optional GST (CGST+SGST or IGST from place of supply); five currencies; **UPI QR** for the amount due; terms & signature; handover section |
| **Saved services** | Your services and rates; pick them on quotes and invoices |
| **Payments** | Record part payments, TDS and proof. Each gets a numbered **receipt** (Advance / Part / Final payment against the invoice) |
| **Expenses** | Categories, bills, recurring subscriptions with one-click "record next" |
| **Reimbursements** | Submitted → Approved (owner) → Reimbursed, with a voucher |
| **Team & payouts** | Employee profiles (below) and payslips / payment vouchers |
| **Ledger** | Every transaction, running balance per account, manual entries (owner investment, withdrawal, transfers), CSV / Excel / PDF |
| **Reports** | Profit & loss (by month and by FY), income by client, expenses by category, receivables ageing, payout summary, GST summary. All export to PDF / CSV / Excel |
| **Settings** | Company and logo, signature, bank accounts, number formats, GST, invoice / quote / handover defaults, expense categories, users, audit log |

### How invoices and payments link

- **Numbers are given on finalise.** Drafts are unnumbered. The number is assigned on *Save & mark sent*, *Finalise & mark sent*, or the first payment, so discarded drafts never leave gaps. Cancelled invoices keep their number. Each series restarts every financial year (`2026-27/0001`) unless you switch *Include FY* off, in which case it runs continuously.
- **One invoice, every payment.** Record the advance and the final payment against the same invoice. The invoice PDF then lists each payment (date + receipt number) and the **Balance Due**, and its UPI QR asks for that balance. To request the balance, download the invoice again.
- **Status updates on its own:** Draft → Sent → Partly paid → Paid. *Overdue* is shown when a due date passes. Paid and cancelled invoices are locked.

### Website handover, hosting & maintenance

Switch it on for any quote or invoice and choose **free hosting** (1 / 2 / 3 years) and **free maintenance** (1 / 3 / 6 / 12 months).

- **Before handover,** the document says both periods start on the day the website is handed over.
- **After handover,** set the handover date on the invoice page (this works even after the invoice is paid). The document then prints the exact end dates, e.g. *1 Nov 2026 + 1 year → until 31 Oct 2027*.
- **Two lists are printed:** *Included in maintenance* (updates, security / phishing clean-up, fixes, backups…) and *Not included*: new pages, image generation, PDF creation, content, SEO…. Edit both in *Settings → GST & defaults*. Each document keeps its own copy, so later changes don't alter what you already sent.
- **Renewal alerts.** The dashboard lists periods ending within 45 days, or ended in the last 30, so you can offer a renewal.

### Team member profiles

- **Employment:** employee code (EMP-0001, automatic), photo, role and department, employee or freelancer, joining date, status (Active / On notice / Left, with exit date and reason).
- **Contact and personal:** mobile and alternate mobile, work and personal email, date of birth, blood group, address, emergency contact.
- **Pay:** monthly salary or project rate, UPI or bank payout details.
- **IDs:** PAN, UAN, and only the **last 4 digits of Aadhaar** (the full number is never stored).
- **Documents:** ID proofs, offer letter, agreements (PDF or image).
- **Payouts:** people marked *Left* can't be paid.

### Rules that prevent mistakes

- **Money is stored in paise** (whole numbers), so there are no rounding errors. Amounts show in Indian format (1,50,000).
- **Nothing financial is hard-deleted.** Invoices are cancelled, and payments, expenses, payouts and manual entries are voided, each with a reason. Voided records drop out of totals.
- **Audit log.** Every change records who, when, and each field's old and new value. Owner only: *Settings → Audit log*.
- **Roles.** The **owner** has full access. An **accountant** can't open Settings, void or cancel records, approve reimbursements, or add manual ledger entries.
- **Frozen details.** Issued documents keep a frozen copy of the client, company and bank details.

### Reports use a cash basis

- **Income** = payments received + TDS deducted by clients (on the payment date).
- **Expenses** = expenses + reimbursements (on the date paid back) + payouts (net).
- **Not income or expense:** owner investment / withdrawal and transfers.
- **TDS you deduct on payslips:** record the deposit to the government as an expense under *Taxes & Fees*.

---

## 3. Deploy (put it online)

The production server also serves the built app, so you deploy **one service**. You need:

1. **MongoDB Atlas.** Create a cluster and a database user. Under Network Access, allow your host's outbound IP (or `0.0.0.0/0` if your host has no fixed IP, with a strong database password).
2. **A host that runs Node 20+ and headless Chrome**, with a **persistent disk** for uploads (logos, bills, proofs, employee documents).

### Environment variables (production)

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas URI (required in production; there is no local fallback) |
| `JWT_SECRET` | 48+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | the public URL, e.g. `https://finance.thewebxstudio.com` |
| `TRUST_PROXY` | `1` behind Render / Railway / Nginx |
| `COOKIE_SECURE` | leave unset (defaults to `true`; requires HTTPS) |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` | the owner login, created automatically on the first start (when the database has no users) |
| `SEED_RESET_OWNER_PASSWORD` | `true` only to reset the owner's password from `SEED_OWNER_PASSWORD` on the next start; remove it afterwards |
| `UPLOAD_DIR` | `uploads` (mount the persistent disk at `server/uploads`) |

### Option A: Docker (Render, Railway, Fly.io, any VPS)

A `Dockerfile` is included. It builds the client, installs production dependencies and Chrome, adds Noto fonts so ₹ renders in PDFs, and runs as a non-root user. **It was written but not built here (Docker isn't installed on this Mac).** Build it once locally or on your host and check that a PDF downloads.

```bash
docker build -t webx-finance .
```
```bash
docker run -p 5050:5050 --env-file server/.env -v webx-uploads:/app/server/uploads webx-finance
```

On Render or Railway: create a **Web Service from the repo** using the Dockerfile, add the environment variables, attach a **disk at `/app/server/uploads`**, and set the health check path to `/api/health`. On the first start the app creates the owner from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` (no shell needed); the log says `Owner ready`.

### Option B: a VPS with Node + PM2 + Nginx

```bash
npm ci && npm run build
```
```bash
NODE_ENV=production pm2 start server/src/server.js --name webx-finance
```

- **Nginx and HTTPS:** put Nginx in front with HTTPS (Let's Encrypt) and `proxy_pass http://127.0.0.1:5050;`, and set `client_max_body_size 12m;` for uploads.
- **Chrome libraries:** on Ubuntu/Debian, install the libraries listed in the Dockerfile, plus `fonts-noto-core`.

### Backups

- **Database:** Atlas has scheduled backups on paid tiers. On the free tier, run `mongodump --uri "$MONGODB_URI" --out backup-$(date +%F)` weekly and keep copies off the server.
- **Uploads:** back up `server/uploads` too (logos, bills, proofs, documents). The storage code is behind an adapter (`server/src/services/storage`), so moving to S3 or Cloudinary later only needs a new adapter.

### Security checklist before going live

- [ ] Long random `JWT_SECRET`, different from development
- [ ] HTTPS only (`COOKIE_SECURE` stays on)
- [ ] Atlas user with access to this database only; IP access list set
- [ ] Owner password changed from anything shared during setup
- [ ] Accountant accounts created per person (no shared logins)
- [ ] Real bank details entered (*Settings → Bank accounts*) and the placeholder deactivated

---

## 4. Development

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app with hot reload |
| `npm run smoke` | 76 end-to-end API checks against a throwaway in-memory database (no Atlas needed) |
| `npm run build` | production build of the client into `client/dist` |
| `npm run seed` | create the owner, settings, placeholder bank, cash account, categories (safe to re-run) |
| `npm run pdf:sample -w server -- <dir>` | render sample PDFs without a database |

**Layout:** `shared/` holds the templates, money, numbering, financial-year, GST state, UPI QR and handover helpers. `server/src/` holds models, services, controllers, routes, validators and migrations. `client/src/` holds the API hooks, components and one folder per feature.

**Migrations.** Small data migrations run automatically at startup (`server/src/services/migrations.js`). They are safe to run repeatedly.

**Known advisory.** `npm audit` reports a moderate issue in `uuid@8`, pulled in by `exceljs`. It affects only `uuid`'s v3/v5/v6 functions with a caller-supplied buffer, which exceljs does not use.
# webx-finance
