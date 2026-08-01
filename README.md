# طلوع نوین — سیستم مدیریت سوپرمارکت

Supermarket management system: point of sale with printed bills and barcode scanning,
stock with buy / retail / wholesale prices, suppliers and purchase orders, customer
credit (قرض), returns, seasonal discounts, mobile topup with its commission, shop
expenses, reports, and backups.

The whole interface is Dari, right-to-left, on the Hijri Shamsi calendar.

- **Frontend** — Next.js (App Router) + React, plain JavaScript
- **Backend** — Next.js route handlers under `app/api` (no separate server)
- **Database** — MongoDB (Mongoose)

Same stack as Hakimi Pharmacy, built as its own project — nothing in that folder was touched.

## Screens

| Screen | What it does |
|---|---|
| داشبورد | Today's sales, bills, profit, topup, expenses, stock alerts, week chart |
| صندوق فروش | Barcode scan, product grid, cart, four payment types, printed bill |
| بل‌ها و فروشات | Every bill ever written — search, filter by date and payment, reprint, return |
| تاپ‌آپ و کریدت | Airtime credit taken from the company, topups sent to any number, commission |
| موجودی و گدام | Products with unit, barcode, prices, stock, expiry; add / edit / delete |
| خرید و تهیه‌کنندگان | Suppliers, payables, multi-line purchase orders, receiving |
| مشتریان و قرض‌ها | Customers, credit balances, settlements, purchase history |
| مصارف دکان | Rent, power, wages, transport, anything bought for the shop; who fronted it |
| راپورها | Daily / weekly / monthly figures, P&L, movers, cash book, returns, printing |
| قیمت‌ها و تخفیفات | Retail/wholesale pricing, margins, discount rules |
| امنیت و بک‌اپ | Backups, login accounts, settings, activity log |

## Accounts

There is **one kind of account and it reaches every screen**. There are no permission
tiers to configure and nothing to lock: being signed in is the whole check, on the
sidebar and in every API route alike.

An account carries a job title (`مدیر`, `صندوق‌دار`, `فروشنده`, …) which prints under the
name in the sidebar. It is a label only — renaming somebody does not take anything away
from them.

Two things are still tracked per person, because they are useful rather than restrictive:

- **Deactivating** an account blocks sign-in immediately, even on a token issued earlier.
  The last active account cannot be deactivated or deleted — there would be nobody left
  who could undo it.
- **The activity log** records who did what, so a shared system still shows which person
  changed a price, took a return, or received an order.

Add further staff from **امنیت و بک‌اپ → حساب جدید**. A manager can reset anyone's
password there without knowing the old one; each person can change their own from the
same screen.

## First run

**1. `frontend/.env.local` is already pointed at your Atlas cluster.** Choose a password
for the first account:

```
ADMIN_PASSWORD=<choose one, min 8 characters>
```

`ADMIN_NAME`, `ADMIN_ROLE` and `ADMIN_USERNAME` sit beside it and are pre-filled.

**2. Create the account** (safe to re-run; an existing account is left alone):

```bash
cd frontend && npm install && npm run init
```

**3. Start the app**, then open http://localhost:3000:

```bash
cd frontend && npm run dev
```

Blank `ADMIN_PASSWORD` once the account exists — it is only read by `npm run init`.

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

If the shop also does mobile topup, set the credit provider and the commission rate
under **تاپ‌آپ و کریدت → تنظیمات اعتبار** and take your first credit in; until then the
screen simply says the balance is empty.

Numbering starts at 1001 throughout: bills `1001`, purchase orders `PO-1001`, topups
`TP-1001`, credit taken in `CR-1001`, expenses `EX-1001`.

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

**Topup** runs on one pool of credit. The shop takes credit from a single company and
sends it to any number on any network out of that pool — there is nothing to pick at
the till but the number and the amount.

Taking 10,000 of credit for 9,800 raises the balance by 10,000 and books 9,800 going
out (or adds it to what the company is owed, if it is paid for later). Selling 1,000 of
that takes 1,000 in and drops the balance by 1,000, so the till ends up 20 ahead per
1,000 — the commission rate, editable under **تاپ‌آپ و کریدت → تنظیمات اعتبار**.

The rate is frozen onto each topup as it is sold, so changing it never moves what past
sales earned. **Only the commission is profit.** The face value belongs to the telecom
company and passes straight through, which is why the P&L counts the commission and
shows the money moved separately — and why cash entries tagged `topup` stay out of the
expense line. A topup sold on قرض adds to that customer's balance exactly as a bill
does, and becomes income when they pay.

**Shop expenses** are everything that is not stock: rent, power, wages, transport, and
whatever somebody buys for the shop. Each one books a cash-book entry the day it
happens and comes off net profit; deleting the expense removes that entry too.

When a staff member pays out of their own pocket, put their name in *پرداخت‌کننده* and
the expense stays flagged **بازپرداخت نشده** until they are paid back. Paying them back
is a movement between the till and that person, not a second expense, so it writes no
new entry. Goods bought from suppliers do not belong here — they are already inside cost
of goods sold.

**Reports** are computed from the bills themselves. Stock purchases sit inside cost of
goods sold, so the P&L excludes any cash entry tagged `stock` rather than counting it
twice; `topup` is excluded for the same reason. Slow movers include products that sold
nothing at all — those are the ones tying up cash.

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
  sign-in. Since every account has full access, a shared password is a real risk — give
  each person their own.
- Serve over HTTPS. Tokens are held in `localStorage` and last 12 hours.
- Deleting `SETUP_TOKEN` from the environment disables `POST /api/setup` entirely.

## API

All routes are under `/api` and need `Authorization: Bearer <token>`, except
`POST /api/auth/login` and `/api/setup` which are public. Being signed in is the only
check — there are no per-route permissions.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | public; returns a 12-hour token |
| POST | `/auth/logout`, `/auth/change-password` | own account |
| GET | `/search?q=` | products, customers, bills and suppliers in one call |
| GET, POST | `/products` | POST validates prices against the buy price |
| PUT, DELETE | `/products/:id` | DELETE refuses while stock remains |
| GET | `/products/alerts` | counts behind the sidebar badge |
| GET, POST | `/suppliers` | |
| PUT, DELETE | `/suppliers/:id` | rename cascades to products and orders |
| POST | `/suppliers/:id/pay` | books a `stock`-tagged expense |
| GET, POST | `/purchases` | POST only raises an order; stock is untouched |
| POST | `/purchases/:id/receive` | adds stock, updates buy price, books or owes |
| DELETE | `/purchases/:id` | only while still `در انتظار` |
| GET, POST | `/customers` | POST accepts an opening قرض balance |
| PUT, DELETE | `/customers/:id` | rename cascades to bills |
| POST | `/customers/:id/settle` | full or partial repayment |
| GET, POST | `/sales` | GET takes `q`, `payment`, `from`, `to`, `customer`, `page`; POST re-prices every line server-side |
| POST | `/sales/:id/return` | checked against what is left on each line |
| GET | `/returns` | |
| GET, PUT | `/topup/account` | the one credit account: provider, rate, balance, owed |
| POST | `/topup/account/pay` | pays down what is owed for credit taken on account |
| GET, POST | `/topup/loads` | credit coming in; empty cost falls back to the usual terms |
| GET, POST | `/topup` | POST sends a topup and freezes the commission onto it |
| GET, POST | `/expenses` | POST writes the cash-book entry alongside |
| PUT, DELETE | `/expenses/:id` | PUT with only `reimbursed` marks a pay-back |
| GET, POST | `/discounts` | |
| PUT, DELETE | `/discounts/:id` | PUT with only `active` toggles it |
| GET, POST | `/transactions` | cash book, receivables and payables |
| GET | `/dashboard` | today's figures, alerts, week chart |
| GET | `/reports`, `/reports/print` | `?period=daily\|weekly\|monthly` |
| GET, POST | `/users` | |
| PUT, DELETE | `/users/:id` | cannot strand the last active account |
| GET | `/logs` | activity log |
| GET, PUT | `/settings` | |
| POST | `/settings/backup` | returns the JSON dump to download |
| GET, POST | `/setup` | public, gated on `SETUP_TOKEN` |
