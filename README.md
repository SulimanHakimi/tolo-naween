# طلوع ناوین — سیستم مدیریت سوپرمارکت

Supermarket management system: point of sale with printed bills and barcode scanning,
stock with buy / retail / wholesale prices, suppliers and purchase orders, customer
credit (قرض), returns, seasonal discounts, staff and salaries, reports, and backups.

The whole interface is Dari, right-to-left, on the Hijri Shamsi calendar.

- **Frontend** — Next.js (App Router) + React, plain JavaScript
- **Backend** — Next.js route handlers under `app/api` (no separate server)
- **Database** — MongoDB (Mongoose)

Same stack as Hakimi Pharmacy, built as its own project — nothing in that folder was touched.

## Screens

| Screen | Permission | What it does |
|---|---|---|
| داشبورد | `dash` | Today's sales, bills, profit, stock alerts, week chart, top sellers |
| صندوق فروش | `pos` | Barcode scan, product grid, cart, four payment types, printed bill |
| موجودی و گدام | `inv` | Products with unit, barcode, prices, stock, expiry; add / edit / delete |
| خرید و تهیه‌کنندگان | `pur` | Suppliers, payables, multi-line purchase orders, receiving |
| مشتریان و قرض‌ها | `cust` | Customers, credit balances, settlements, purchase history |
| راپورها | `rep` | Daily / weekly / monthly figures, P&L, movers, cash book, returns, printing |
| قیمت‌ها و تخفیفات | `price` | Retail/wholesale pricing, margins, discount rules |
| کارمندان | `emp` | Staff, job titles, salaries, salary payments |
| امنیت و بک‌اپ | `sec` | Backups, login accounts and permissions, settings, activity log |

Permissions are enforced in two places: the sidebar only shows pages the account may
open, and every API route checks the same permission. A salesperson who types
`/reports` into the address bar is redirected, and the underlying request returns 403.

## First run

**1. `frontend/.env.local` is already pointed at your Atlas cluster.** Set a password
for at least the manager account (the other three are optional):

```
MANAGER_PASSWORD=<choose one, min 8 characters>
```

**2. Create the accounts** (safe to re-run; existing accounts are left alone):

```bash
cd frontend && npm install && npm run init
```

**3. Start the app**, then open http://localhost:3000:

```bash
cd frontend && npm run dev
```

Blank the `*_PASSWORD` lines once the accounts exist — they are only read by `npm run init`.

Four roles ship with sensible defaults, all editable per-account from **امنیت و بک‌اپ**:

| Role | Reaches |
|---|---|
| مدیر | everything |
| صندوق‌دار | dashboard, till, customers, reports |
| فروشنده | till only |
| گدام‌دار | stock and purchasing |

If nobody can sign in:

```bash
cd frontend && npm run set-password -- zalmai <new password>
```

## Starting from empty

The database ships with **no** products, suppliers, customers or sales — everything is
real data you enter. The natural order on day one:

1. **خرید و تهیه‌کنندگان** → add the distributors you buy from.
2. **موجودی و گدام** → add each product with its category, unit, buy / retail price,
   opening stock, and optionally wholesale price, barcode and expiry date.
3. **صندوق فروش** → start selling. Named customers are created on their first purchase.

Bill and purchase-order numbers start at 1001.

## How the pieces connect

Completing a sale is the flow that touches most of the system. `POST /api/sales`
re-prices every line from the stored product and the live discount rules — the browser
sends only ids and quantities, so a tampered cart cannot invent its own prices. It then
writes the bill, decrements stock, creates or updates the customer, and either records
cash income or adds the total to that customer's قرض.

**Pricing order is fixed:** wholesale price replaces retail once a line reaches
`wholesaleMinQty` → the single best-matching discount rule comes off that price → VAT
applies to what is left, after any manual discount. Only one rule is ever applied per
line, so overlapping seasonal offers cannot stack into a negative price.

A **purchase order** is a promise, not a delivery: raising one changes nothing. Receiving
it adds stock, updates each product's buy price to what the delivery actually cost, and
either books the expense or adds to what you owe that supplier.

A **return** is checked against what is left on each bill line, so the same item can
never be refunded twice. Restocked goods give back only the margin; goods too damaged to
resell also lose their purchase cost. A return on a credit sale reduces the customer's
debt instead of paying out cash.

**Reports** are computed from the bills themselves. Stock purchases sit inside cost of
goods sold, so the P&L excludes any cash entry tagged `stock` rather than counting it
twice. Slow movers include products that sold nothing at all — those are the ones tying
up cash.

## Calendar

Dates are stored as real Gregorian dates and displayed as Hijri Shamsi
(`1404/06/28`). `lib/jalali.js` carries the conversion — the jalaali-js algorithm
transcribed in, so the project keeps its four runtime dependencies. Expiry and discount
dates are typed in Shamsi through `JDateField`, which validates before handing an ISO
date upward.

Digits stay Latin throughout: that is what a barcode scanner and a calculator both
produce, and what the imported design shows. Only the labels around them are Dari.

## Configuration

`frontend/.env.local` — `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, plus the init-only
account variables above. Gitignored; keep it that way.

Currency, VAT rate, low-stock threshold, expiry warning window, the wholesale minimum
quantity, and the shop name / address / phone / licence that print on bills and reports
are all edited in the app under **امنیت و بک‌اپ**.

### If you use MongoDB Atlas

Atlas rejects connections from IPs that are not on its Network Access allowlist. The TCP
connection is accepted but the handshake is dropped, which surfaces as
`ReplicaSetNoPrimary`. Add the machine's public IP under **Atlas → Network Access** —
and note that a VPN changes that IP, so allowlist the address you actually connect from.

If DNS SRV lookups are blocked on your network (`querySrv ETIMEOUT`), use the seedlist
form of the URI instead of `mongodb+srv://`. One is already prepared and commented out
in `.env.local`; swap it onto `MONGODB_URI` and comment the other.

## Backups

**امنیت و بک‌اپ → اکنون بک‌اپ بگیر** downloads a JSON copy of every collection through
the browser. Password hashes are excluded. Serverless filesystems are read-only and
wiped between invocations, which is why the file goes to your computer rather than to
the server — and why there is no unattended nightly backup: the app shows how old the
last one is and nags when it goes stale, but somebody has to press the button. Keep
copies off the machine; a backup on the same disk does not survive that disk failing.

## Before going live

- `JWT_SECRET` is already a 64-character random value. Keep it secret; changing it signs
  everyone out.
- **Rotate the Atlas password.** It was shared in plain text, so treat it as public:
  Atlas → Database Access → Edit → Edit Password, then update `.env.local`.
- Every staff member should change their own password from **امنیت و بک‌اپ** after first
  sign-in.
- Serve over HTTPS. Tokens are held in `localStorage` and last 12 hours.
- Deleting `SETUP_TOKEN` from the environment disables `POST /api/setup` entirely.

## API

All routes are under `/api` and need `Authorization: Bearer <token>` except
`POST /api/auth/login` and `/api/setup`.

| Method | Path | Permission |
|---|---|---|
| POST | `/auth/login` | public |
| GET | `/auth/me` | any signed-in account |
| POST | `/auth/logout`, `/auth/change-password` | any signed-in account |
| GET | `/search` | any signed-in account (results filtered by role) |
| GET | `/products`, `/suppliers`, `/discounts`, `/settings` | any signed-in account |
| POST, PUT, DELETE | `/products` | `inv` (`price` may also PUT prices) |
| GET | `/products/alerts` | `inv`, `dash`, `pur` or `price` |
| POST, PUT, DELETE | `/suppliers` | `pur` |
| POST | `/suppliers/:id/pay` | `pur` |
| GET, POST, DELETE | `/purchases` | `pur` |
| POST | `/purchases/:id/receive` | `pur` |
| GET | `/customers` | `cust` or `rep` |
| POST, PUT, DELETE | `/customers` | `cust` |
| POST | `/customers/:id/settle` | `cust` |
| GET | `/sales` | `rep`, `dash`, `pos` or `cust` |
| POST | `/sales` | `pos` |
| POST | `/sales/:id/return` | `pos` or `rep` |
| GET | `/returns` | `rep` or `pos` |
| POST, PUT, DELETE | `/discounts` | `price` |
| GET, POST, PUT, DELETE | `/employees` | `emp` |
| POST | `/employees/:id/pay` | `emp` |
| GET, POST | `/transactions` | `rep` |
| GET | `/dashboard` | `dash` |
| GET | `/reports`, `/reports/print` | `rep` |
| GET, POST, PUT, DELETE | `/users` | `sec` |
| GET | `/logs` | `sec` |
| PUT | `/settings`, POST `/settings/backup` | `sec` |
