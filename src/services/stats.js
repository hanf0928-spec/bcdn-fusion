'use strict';

const db = require('../db');

/**
 * P&L model
 * --------------------------------------------------------------------
 *   revenue          = SUM(usage_records.amount)                       // per customer
 *                    = SUM(traffic_gb * customer.unit_price)
 *
 *   resource_cost    = SUM(traffic_gb * provider.resource_cost_price)  // by traffic
 *   platform_cost    = revenue * provider.platform_cost_price          // by revenue %
 *
 *   gross_profit     = revenue - platform_cost - resource_cost
 *
 * Provider-level cost configuration lives in `provider_costs`, keyed by
 * the customer's `provider` column:
 *   - resource_cost_price : USDT / GB     (server / bandwidth / etc.)
 *   - platform_cost_price : ratio 0~1     (% of revenue paid to upstream)
 *
 * NOTE: column name `platform_cost_price` is kept for backwards-compat,
 * but the value is now a *ratio* (0.30 == 30% of revenue), not a price.
 *
 * Costs are computed on the fly from traffic_gb / revenue so they stay
 * correct when configuration changes.
 */

// =====================================================
// Provider cost helpers
// =====================================================

/**
 * List provider cost rows.
 *
 * When `withStats` is true, every row is augmented with lifetime
 * aggregates of customers attached to that provider:
 *   - customer_count
 *   - total_traffic_gb
 *   - total_revenue
 *   - total_platform_cost
 *   - total_resource_cost
 *   - total_gross_profit
 *   - margin (gross_profit / revenue, null if revenue == 0)
 *
 * This is used by the "数据来源成本设置" modal so the operator can see
 * how each provider's cost configuration affects real numbers.
 */
function listProviderCosts(withStats = false) {
  const rows = db.prepare(`
    SELECT provider, platform_cost_price, resource_cost_price, remark, updated_at
    FROM provider_costs
    ORDER BY provider ASC
  `).all();

  if (!withStats) return rows;

  // Aggregate lifetime traffic / revenue per provider (one round-trip).
  const aggMap = new Map();
  const aggRows = db.prepare(`
    SELECT c.provider                      AS provider,
           COUNT(DISTINCT c.id)            AS customer_count,
           COALESCE(SUM(u.traffic_gb), 0)  AS traffic_gb,
           COALESCE(SUM(u.amount),     0)  AS revenue
    FROM customers c
    LEFT JOIN usage_records u ON u.customer_id = c.id
    GROUP BY c.provider
  `).all();
  for (const r of aggRows) aggMap.set(r.provider, r);

  // Customer count per provider, even when no usage exists yet.
  const cntRows = db.prepare(`
    SELECT provider, COUNT(*) AS n FROM customers GROUP BY provider
  `).all();
  const cntMap = new Map(cntRows.map(r => [r.provider, r.n]));

  return rows.map(r => {
    const a = aggMap.get(r.provider) || { traffic_gb: 0, revenue: 0, customer_count: 0 };
    const traffic = Number(a.traffic_gb || 0);
    const revenue = Number(a.revenue || 0);
    const platformCost = revenue * Number(r.platform_cost_price || 0);
    const resourceCost = traffic * Number(r.resource_cost_price || 0);
    const profit = revenue - platformCost - resourceCost;
    return {
      ...r,
      customer_count:      cntMap.get(r.provider) || 0,
      total_traffic_gb:    round4(traffic),
      total_revenue:       round2(revenue),
      total_platform_cost: round2(platformCost),
      total_resource_cost: round2(resourceCost),
      total_gross_profit:  round2(profit),
      margin: revenue > 0 ? round4(profit / revenue) : null,
    };
  });
}

function getProviderCost(provider) {
  const row = db.prepare(`
    SELECT provider, platform_cost_price, resource_cost_price
    FROM provider_costs WHERE provider = ?
  `).get(provider);
  return row || { provider, platform_cost_price: 0, resource_cost_price: 0 };
}

function setProviderCost(provider, { platform_cost_price, resource_cost_price, remark }) {
  if (!provider) throw new Error('provider is required');
  db.prepare(`
    INSERT INTO provider_costs (provider, platform_cost_price, resource_cost_price, remark, updated_at)
    VALUES (?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(provider) DO UPDATE SET
      platform_cost_price = excluded.platform_cost_price,
      resource_cost_price = excluded.resource_cost_price,
      remark              = excluded.remark,
      updated_at          = excluded.updated_at
  `).run(
    provider,
    Number(platform_cost_price || 0),
    Number(resource_cost_price || 0),
    remark || null,
  );
  return getProviderCost(provider);
}

/** Build a {provider -> {platform, resource}} lookup. */
function buildCostMap() {
  const map = new Map();
  for (const r of listProviderCosts(false)) {
    map.set(r.provider, {
      platform: Number(r.platform_cost_price || 0),
      resource: Number(r.resource_cost_price || 0),
    });
  }
  return map;
}

// =====================================================
// Provider-level summary (for overview "by data source" card)
// =====================================================

/**
 * Aggregate metrics grouped by `customers.provider`, for the dashboard's
 * "按数据来源汇总" card.
 *
 * Returns:
 *   [{
 *      provider,
 *      customer_count,
 *      // current month
 *      month, month_traffic_gb, month_revenue,
 *      month_platform_cost, month_resource_cost, month_gross_profit, month_margin,
 *      // lifetime
 *      total_traffic_gb, total_revenue,
 *      total_platform_cost, total_resource_cost, total_gross_profit, total_margin,
 *      // configuration snapshot
 *      platform_cost_price (ratio 0~1), resource_cost_price (USDT/GB),
 *   }, ...]
 *
 * Sorted by provider asc.
 */
function listProviderSummaries(month) {
  const m = month || nowYearMonth();
  const cm = buildCostMap();

  // Customers per provider (count, even if 0 usage).
  const cntRows = db.prepare(`
    SELECT provider, COUNT(*) AS n FROM customers GROUP BY provider
  `).all();
  const cntMap = new Map(cntRows.map(r => [r.provider, r.n]));

  // Lifetime aggregates.
  const lifeRows = db.prepare(`
    SELECT c.provider                      AS provider,
           COALESCE(SUM(u.traffic_gb), 0)  AS traffic_gb,
           COALESCE(SUM(u.amount),     0)  AS revenue
    FROM customers c
    LEFT JOIN usage_records u ON u.customer_id = c.id
    GROUP BY c.provider
  `).all();
  const lifeMap = new Map(lifeRows.map(r => [r.provider, r]));

  // Current-month aggregates.
  const monthRows = db.prepare(`
    SELECT c.provider                      AS provider,
           COALESCE(SUM(u.traffic_gb), 0)  AS traffic_gb,
           COALESCE(SUM(u.amount),     0)  AS revenue
    FROM customers c
    LEFT JOIN usage_records u
      ON u.customer_id = c.id AND substr(u.usage_date,1,7) = ?
    GROUP BY c.provider
  `).all(m);
  const monthMap = new Map(monthRows.map(r => [r.provider, r]));

  // Build the union of providers from configured costs + customers.
  const providers = new Set();
  for (const r of listProviderCosts(false)) providers.add(r.provider);
  for (const r of cntRows) providers.add(r.provider);

  const out = [];
  for (const provider of providers) {
    const cost = cm.get(provider) || { platform: 0, resource: 0 };

    const life  = lifeMap.get(provider)  || { traffic_gb: 0, revenue: 0 };
    const lifeTraffic = Number(life.traffic_gb || 0);
    const lifeRevenue = Number(life.revenue || 0);
    const lifePlatform = lifeRevenue * cost.platform;
    const lifeResource = lifeTraffic * cost.resource;
    const lifeProfit   = lifeRevenue - lifePlatform - lifeResource;

    const mo = monthMap.get(provider) || { traffic_gb: 0, revenue: 0 };
    const mTraffic = Number(mo.traffic_gb || 0);
    const mRevenue = Number(mo.revenue || 0);
    const mPlatform = mRevenue * cost.platform;
    const mResource = mTraffic * cost.resource;
    const mProfit   = mRevenue - mPlatform - mResource;

    out.push({
      provider,
      customer_count:       cntMap.get(provider) || 0,
      // configuration
      platform_cost_price:  cost.platform,
      resource_cost_price:  cost.resource,
      // current month
      month: m,
      month_traffic_gb:     round4(mTraffic),
      month_revenue:        round2(mRevenue),
      month_platform_cost:  round2(mPlatform),
      month_resource_cost:  round2(mResource),
      month_gross_profit:   round2(mProfit),
      month_margin:         mRevenue > 0 ? round4(mProfit / mRevenue) : null,
      // lifetime
      total_traffic_gb:     round4(lifeTraffic),
      total_revenue:        round2(lifeRevenue),
      total_platform_cost:  round2(lifePlatform),
      total_resource_cost:  round2(lifeResource),
      total_gross_profit:   round2(lifeProfit),
      total_margin:         lifeRevenue > 0 ? round4(lifeProfit / lifeRevenue) : null,
    });
  }
  out.sort((a, b) => String(a.provider).localeCompare(String(b.provider)));
  return out;
}

// =====================================================
// Customer-level aggregates
// =====================================================

/**
 * Aggregated balance / billing helpers for ONE customer.
 *
 *   total_recharge   = SUM(recharges.amount)
 *   total_revenue    = SUM(usage_records.amount)
 *   total_traffic    = SUM(usage_records.traffic_gb)
 *   total_platform   = total_revenue * provider.platform_cost_price (% of revenue)
 *   total_resource   = total_traffic * provider.resource_cost_price
 *   total_profit     = total_revenue - total_platform - total_resource
 *   balance          = total_recharge - total_revenue
 */
function getCustomerStats(customerId, costMap) {
  const cm = costMap || buildCostMap();
  const c = db.prepare(`SELECT id, provider FROM customers WHERE id = ?`).get(customerId);
  const provider = c ? c.provider : null;
  const cost = cm.get(provider) || { platform: 0, resource: 0 };

  const r = db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total
    FROM recharges WHERE customer_id = ?
  `).get(customerId);

  const u = db.prepare(`
    SELECT COALESCE(SUM(amount),0)     AS revenue,
           COALESCE(SUM(traffic_gb),0) AS traffic
    FROM usage_records WHERE customer_id = ?
  `).get(customerId);

  const totalRecharge = round2(r.total);
  const totalRevenue  = round2(u.revenue);
  const totalTraffic  = round4(u.traffic);
  const totalResource = round2(u.traffic * cost.resource);
  const totalPlatform = round2(totalRevenue * cost.platform);   // % of revenue
  const totalProfit   = round2(totalRevenue - totalPlatform - totalResource);
  const balance       = round2(totalRecharge - totalRevenue);

  return {
    totalRecharge,
    totalUsage:    totalRevenue, // alias kept for backwards-compat
    totalRevenue,
    totalTraffic,
    totalPlatformCost: totalPlatform,
    totalResourceCost: totalResource,
    totalGrossProfit:  totalProfit,
    balance,
  };
}

/**
 * Monthly traffic / billing breakdown for a customer.
 */
function getCustomerMonthlyUsage(customerId, month, costMap) {
  const cm = costMap || buildCostMap();
  const c = db.prepare(`SELECT provider FROM customers WHERE id = ?`).get(customerId);
  const cost = cm.get(c && c.provider) || { platform: 0, resource: 0 };

  let sql = `
    SELECT substr(usage_date, 1, 7)  AS month,
           ROUND(SUM(traffic_gb), 4) AS traffic_gb,
           ROUND(SUM(amount),     2) AS amount,
           COUNT(*)                  AS days
    FROM usage_records
    WHERE customer_id = ?
  `;
  const params = [customerId];
  if (month) { sql += ` AND substr(usage_date, 1, 7) = ?`; params.push(month); }
  sql += ` GROUP BY month ORDER BY month ASC`;

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => {
    const traffic = Number(r.traffic_gb || 0);
    const revenue = Number(r.amount || 0);
    const resource = round2(traffic * cost.resource);
    const platform = round2(revenue * cost.platform);
    return {
      month:         r.month,
      traffic_gb:    round4(traffic),
      amount:        round2(revenue),     // legacy
      revenue:       round2(revenue),
      platform_cost: platform,
      resource_cost: resource,
      gross_profit:  round2(revenue - platform - resource),
      days:          r.days,
    };
  });
}

/**
 * For dashboard list: every customer + current-month and lifetime metrics.
 */
function listCustomersWithStats(month) {
  const m = month || nowYearMonth();
  const customers = db.prepare(`SELECT * FROM customers ORDER BY id ASC`).all();
  const cm = buildCostMap();

  const monthRow = db.prepare(`
    SELECT COALESCE(SUM(traffic_gb),0) AS traffic_gb,
           COALESCE(SUM(amount),0)     AS amount
    FROM usage_records
    WHERE customer_id = ? AND substr(usage_date,1,7) = ?
  `);

  return customers.map(c => {
    const s = getCustomerStats(c.id, cm);
    const cost = cm.get(c.provider) || { platform: 0, resource: 0 };
    const mr = monthRow.get(c.id, m);

    const monthTraffic = Number(mr.traffic_gb || 0);
    const monthRevenue = round2(mr.amount);
    const monthResource = round2(monthTraffic * cost.resource);
    const monthPlatform = round2(monthRevenue * cost.platform);
    const monthProfit   = round2(monthRevenue - monthPlatform - monthResource);

    return {
      ...c,
      current_month:        m,
      month_traffic_gb:     round4(monthTraffic),
      month_amount:         monthRevenue,
      month_revenue:        monthRevenue,
      month_platform_cost:  monthPlatform,
      month_resource_cost:  monthResource,
      month_gross_profit:   monthProfit,
      total_recharge:       s.totalRecharge,
      total_usage:          s.totalUsage,
      total_revenue:        s.totalRevenue,
      total_traffic_gb:     s.totalTraffic,
      total_platform_cost:  s.totalPlatformCost,
      total_resource_cost:  s.totalResourceCost,
      total_gross_profit:   s.totalGrossProfit,
      balance:              s.balance,
      low_balance:          s.balance < c.alert_threshold,
      platform_cost_price:  cost.platform,
      resource_cost_price:  cost.resource,
    };
  });
}

// ---------- helpers ----------
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }
function nowYearMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Re-stamp every `usage_records` row of the given customer (or all
 * customers when `customerId` is null) so that `unit_price` and
 * `amount` match the customer's *current* `unit_price`.
 */
function recomputeUsageAmounts(customerId = null) {
  const customers = customerId
    ? db.prepare(`SELECT id, unit_price FROM customers WHERE id = ?`).all(customerId)
    : db.prepare(`SELECT id, unit_price FROM customers`).all();

  const upd = db.prepare(`
    UPDATE usage_records
    SET unit_price = ?,
        amount     = ROUND(traffic_gb * ?, 2)
    WHERE customer_id = ?
  `);

  let totalRows = 0;
  const tx = db.transaction(() => {
    for (const c of customers) {
      const price = Number(c.unit_price || 0);
      const r = upd.run(price, price, c.id);
      totalRows += r.changes;
    }
  });
  tx();

  return { customers: customers.length, rows: totalRows };
}

module.exports = {
  // customer aggregates
  getCustomerStats,
  getCustomerMonthlyUsage,
  listCustomersWithStats,
  recomputeUsageAmounts,
  // provider aggregates
  listProviderSummaries,
  // provider cost configuration
  listProviderCosts,
  getProviderCost,
  setProviderCost,
  buildCostMap,
  // misc
  nowYearMonth,
  round2,
  round4,
};
