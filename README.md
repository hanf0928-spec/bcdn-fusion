# BCDN Fusion · CDN Customer Console

A lightweight, self-hosted **CDN fusion product** management console.
Manage customers (one per upstream API key), pull daily traffic from
multiple CDN providers, track monthly bills / balance / recharges, and
get **Telegram group alerts** when balance drops below threshold.

> Single-process Node.js + SQLite. No Docker, no Redis, no external DB.

---

## ✨ Features

- **One customer = one API key** — each customer maps to a single upstream
  provider + API key. Add as many as you want.
- **Two upstream providers built-in**:
  - `source1` — built-in CDN (`/api/v1.0/domain/domain-statistics`,
    docs in [`data/md/CDN2.md`](data/md/CDN2.md))
  - `source2` — CDNetworks `/api/report/traffic`
    ([account-level traffic summary](https://docs.cdnetworks.com/));
    HMAC-SHA1 signed Basic auth (needs **username + apiKey**);
    docs in [`data/md/CDN1.pdf`](data/md/CDN1.pdf)
- **Top tab bar UI** — `Overview` (totals across all customers) plus one
  tab per customer, each with its own page (sub-tabs: Overview / Usage /
  Recharges / Alerts).
- **Auto sync** — cron pulls daily traffic from upstream into SQLite
  (`SYNC_CRON`, default every hour at :15). Manual *Sync now* in the UI.
- **Per-customer unit price** (USDT/GB) and **balance threshold**.
- **Per-customer Telegram chat_id** so different clients alert into
  different groups (falls back to global `TELEGRAM_CHAT_ID`).
- **Cron alerting** — checks balance vs. threshold, with cooldown to avoid
  spamming the group.
- **Modern UI** — Tailwind + Chart.js, no build step.

---

## 🚀 Quick start

```bash
# 1. install
npm install

# 2. configure (Telegram is optional but recommended)
cp .env.example .env
#   → fill TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
#   → set SOURCE1_BASE_URL to your real CDN open-API host

# 3. (optional) seed two demo customers (one per source) with the
#    API keys baked in
npm run seed

# 4. run
npm start
```

Open <http://localhost:3000>.

In the UI:
1. Click **+ New customer** to add a customer (choose provider + paste API key).
2. Click **🔄 Sync all** (or *Sync now* in the customer page) to pull traffic.
3. Each customer has its own tab in the top bar — open it to see the
   monthly chart, bills, recharges, and alert history.

---

## 🤖 Telegram setup

1. Talk to **@BotFather** → `/newbot` → copy the token to `TELEGRAM_BOT_TOKEN`.
2. Add the bot to your group, give it permission to send messages.
3. Send any message in the group, then visit
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the chat id
   (negative number) into `TELEGRAM_CHAT_ID`.
4. Per-customer override: each customer can specify its own `tg_chat_id`
   (different customers' alerts go to different groups).

Test from the UI: open any customer → **Alerts** tab → *Send test TG message*.

---

## 📐 Data model

| Table          | Purpose |
|----------------|---------|
| `customers`    | name, contact, **provider**, **api_key**, **api_user** (for source2 Basic auth), **api_base_url**, **unit_price**, **alert_threshold**, optional `tg_chat_id`, status, `last_sync_at` |
| `recharges`    | top-up history per customer |
| `usage_records`| daily traffic (`traffic_gb`, snapshot `unit_price`, computed `amount`); UPSERT on `(customer_id, usage_date)` |
| `alert_logs`   | every alert sent (used for cooldown) |
| `sync_logs`    | every upstream pull (used for debugging) |

Balance is **derived** in real time:

```
balance = Σ recharges.amount − Σ usage_records.amount
```

API keys are stored only on the server; the UI shows them masked
(`ApiKey_…cdef`) and never returns the raw value.

---

## 🌐 REST API

All endpoints respond with `{ "ok": true|false, "data"|"error": ... }`.

If `ADMIN_TOKEN` is set, send it via the `x-admin-token` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/customers?month=YYYY-MM` | List + current-month stats (api_key masked) |
| `GET`  | `/api/customers/:id`           | Customer detail + monthly bills |
| `POST` | `/api/customers`               | Create customer (incl. provider/api_key) |
| `PUT`  | `/api/customers/:id`           | Update — empty `api_key` keeps the existing one |
| `DEL`  | `/api/customers/:id`           | Delete (cascades) |
| `POST` | `/api/customers/:id/sync`      | Pull traffic from upstream `{start_date?, end_date?}` |
| `POST` | `/api/sync/all`                | Pull every active customer |
| `GET`  | `/api/sync/logs?customer_id=:id` | Sync history |
| `GET`  | `/api/customers/:id/recharges` | List recharges |
| `POST` | `/api/customers/:id/recharges` | Add recharge `{amount, method, remark}` |
| `DEL`  | `/api/recharges/:rid`          | Delete a recharge |
| `GET`  | `/api/customers/:id/usage?month=YYYY-MM` | List usage |
| `POST` | `/api/customers/:id/usage`     | Manual upsert `{usage_date, traffic_gb, [unit_price], [remark]}` |
| `DEL`  | `/api/usage/:uid`              | Delete a usage row |
| `GET`  | `/api/customers/:id/bills`     | Monthly aggregated bills |
| `GET`  | `/api/alerts/logs?customer_id=:id` | Alert history |
| `POST` | `/api/alerts/check`            | Run balance check now `{force?, customer_id?}` |
| `POST` | `/api/alerts/test`             | Send a test TG message |

---

## ⏰ Schedulers

- **Alert** (`ALERT_CRON`, default `0 * * * *`): for every active
  customer with `alert_threshold > 0`, send a TG alert if
  `balance < threshold` and last alert was ≥ `ALERT_COOLDOWN_MIN` ago.
- **Sync** (`SYNC_CRON`, default `15 * * * *`): pull daily traffic from
  each customer's upstream provider.

Manually trigger from the UI (*🔄 Sync all* / *⚡️ Check alerts*) or:

```bash
curl -X POST http://localhost:3000/api/sync/all  -H 'x-admin-token: ...'
curl -X POST http://localhost:3000/api/alerts/check -H 'x-admin-token: ...'
```

---

## 🛠 Project layout

```
.
├── package.json
├── .env.example
├── data/md/CDN2(1).md         # source1 API doc
├── public/                    # static UI (no build step)
│   ├── index.html
│   ├── css/app.css
│   └── js/app.js
└── src/
    ├── server.js              # express + cron bootstrap
    ├── db/index.js            # SQLite schema + tiny migrations
    ├── routes/api.js          # REST endpoints
    ├── services/
    │   ├── stats.js           # balance / monthly aggregation
    │   ├── telegram.js        # TG Bot API
    │   ├── alert.js           # threshold check + cooldown
    │   ├── sync.js            # pull→upsert pipeline
    │   └── providers/
    │       ├── http.js        # tiny HTTPS helper
    │       ├── source1.js     # /api/v1.0/domain/domain-statistics
    │       └── source2.js     # CDNetworks usage2
    └── scripts/
        ├── init-db.js
        └── seed.js            # demo customers (with the user's API keys)
```

---

## 🔒 Notes

- API keys are stored as plaintext in SQLite — protect the DB file.
- Default admin token in `.env.example` is `change-me-please`; change it
  before exposing the service.
- For production: put behind nginx/Caddy with HTTPS; firewall the port.
