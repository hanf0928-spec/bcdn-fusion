'use strict';

const db = require('../db');

/**
 * P&L model — 3 dimensions: provider × scene × cost-mode
 * --------------------------------------------------------------------
 *   revenue          = SUM(usage_records.amount)  // per customer
 *                    where amount = traffic_fee + request_fee + domain_fee
 *                          traffic_fee = traffic_gb    * customer.unit_price_traffic  (USDT/GB)
 *                          request_fee = request_count * customer.unit_price_request  (USDT/次)
 *                          domain_fee  = domain_count  * customer.unit_price_domain   (USDT/个)
 *
 *   platform_cost    = revenue * scene_costs.platform_cost_ratio  // by revenue %
 *
 *   resource_cost    = traffic_fee + request_fee + domain_fee      // 三项合计
 *     traffic_fee    = SUM(traffic_gb)    * scene_costs.traffic_unit_price
 *     request_fee    = SUM(request_count) * scene_costs.request_unit_price
 *     domain_fee     = SUM(domain_count)  * scene_costs.domain_unit_price
 *
 *   gross_profit     = revenue - platform_cost - resource_cost
 *
 * Both customer pricing (revenue side) and (provider, scene) cost pricing
 * follow the SAME three-mode formula:  traffic-fee + request-fee + domain-fee.
 *
 * Customer pricing lives in `customers.unit_price_{traffic,request,domain}`.
 * Cost pricing lives in `scene_costs` keyed by (provider, scene).
 *
 * NOTE on collection: the upstream collection flow is unchanged — it only
 * populates `traffic_gb`. `request_count` / `domain_count` are placeholders
 * (kept at 0 until the upstream API exposes them), so today only the traffic
 * part is non-zero on both sides — matching current behaviour.
 *
 * Cost aggregates are recomputed on the fly from the raw counts so they stay
 * correct when the cost configuration changes; revenue is a stored snapshot
 * per usage_records row (rewrite with `recomputeUsageAmounts` on price edit).
 */

// =====================================================
// Scene cost helpers (provider × scene)
// =====================================================

/**
 * List scene-cost rows.
 *
 * When `withStats` is true, every (provider, scene) row is augmented with
 * lifetime aggregates of customers attached to that combo:
 *   - customer_count
 *   - total_traffic_gb
 *   - total_request_count
 *   - total_domain_count
 *   - total_revenue
 *   - total_platform_cost
 *   - total_resource_cost
 *   - total_gross_profit
 *   - margin (gross_profit / revenue, null if revenue == 0)
 *
 * This is used by the "融合平台成本设置" modal so the operator can see
 * how each (provider, scene) cost configuration affects real numbers.
 */
function listSceneCosts(withStats = false) {
  const rows = db.prepare(`
    SELECT provider, scene, platform_cost_ratio,
           traffic_unit_price, request_unit_price, domain_unit_price,
           remark, updated_at
    FROM scene_costs
    ORDER BY provider ASC, scene ASC
  `).all();

  if (!withStats) return rows;

  // Aggregate lifetime metrics per (provider, scene) (one round-trip).
  const aggMap = new Map();
  const aggRows = db.prepare(`
    SELECT c.provider                      AS provider,
           c.scene                         AS scene,
           COUNT(DISTINCT c.id)            AS customer_count,
           COALESCE(SUM(u.traffic_gb), 0)  AS traffic_gb,
           COALESCE(SUM(u.request_count), 0) AS request_count,
           COALESCE(SUM(u.domain_count), 0)  AS domain_count,
           COALESCE(SUM(u.amount),     0)  AS revenue
    FROM customers c
    LEFT JOIN usage_records u ON u.customer_id = c.id
    GROUP BY c.provider, c.scene
  `).all();
  for (const r of aggRows) aggMap.set(`${r.provider}|${r.scene}`, r);

  // Customer count per (provider, scene), even when no usage exists yet.
  const cntRows = db.prepare(`
    SELECT provider, scene, COUNT(*) AS n FROM customers GROUP BY provider, scene
  `).all();
  const cntMap = new Map(cntRows.map(r => [`${r.provider}|${r.scene}`, r.n]));

  return rows.map(r => {
    const key = `${r.provider}|${r.scene}`;
    const a = aggMap.get(key) || { traffic_gb: 0, request_count: 0, domain_count: 0, revenue: 0, customer_count: 0 };
    const traffic  = Number(a.traffic_gb || 0);
    const requests = Number(a.request_count || 0);
    const domains  = Number(a.domain_count || 0);
    const revenue  = Number(a.revenue || 0);
    const platformCost = revenue * Number(r.platform_cost_ratio || 0);
    const trafficFee   = traffic  * Number(r.traffic_unit_price || 0);
    const requestFee   = requests * Number(r.request_unit_price || 0);
    const domainFee    = domains  * Number(r.domain_unit_price || 0);
    const resourceCost = trafficFee + requestFee + domainFee;
    const profit = revenue - platformCost - resourceCost;
    return {
      ...r,
      customer_count:        cntMap.get(key) || 0,
      total_traffic_gb:      round4(traffic),
      total_request_count:   round2(requests),
      total_domain_count:    round2(domains),
      total_revenue:         round2(revenue),
      total_platform_cost:   round2(platformCost),
      total_traffic_fee:     round2(trafficFee),
      total_request_fee:     round2(requestFee),
      total_domain_fee:      round2(domainFee),
      total_resource_cost:   round2(resourceCost),
      total_gross_profit:    round2(profit),
      margin: revenue > 0 ? round4(profit / revenue) : null,
    };
  });
}

function getSceneCost(provider, scene) {
  const row = db.prepare(`
    SELECT provider, scene, platform_cost_ratio,
           traffic_unit_price, request_unit_price, domain_unit_price
    FROM scene_costs WHERE provider = ? AND scene = ?
  `).get(provider, scene);
  return row || {
    provider, scene,
    platform_cost_ratio: 0,
    traffic_unit_price: 0,
    request_unit_price: 0,
    domain_unit_price: 0,
  };
}

function setSceneCost(provider, scene, {
  platform_cost_ratio, traffic_unit_price, request_unit_price, domain_unit_price, remark,
}) {
  if (!provider) throw new Error('provider is required');
  if (!scene) throw new Error('scene is required');
  db.prepare(`
    INSERT INTO scene_costs
      (provider, scene, platform_cost_ratio, traffic_unit_price, request_unit_price, domain_unit_price, remark, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(provider, scene) DO UPDATE SET
      platform_cost_ratio = excluded.platform_cost_ratio,
      traffic_unit_price  = excluded.traffic_unit_price,
      request_unit_price  = excluded.request_unit_price,
      domain_unit_price   = excluded.domain_unit_price,
      remark              = excluded.remark,
      updated_at          = excluded.updated_at
  `).run(
    provider,
    scene,
    Number(platform_cost_ratio || 0),
    Number(traffic_unit_price || 0),
    Number(request_unit_price || 0),
    Number(domain_unit_price || 0),
    remark || null,
  );
  return getSceneCost(provider, scene);
}

/** Build a {(provider,scene) -> cost} lookup. */
function buildCostMap() {
  const map = new Map();
  for (const r of listSceneCosts(false)) {
    map.set(`${r.provider}|${r.scene}`, {
      platform:  Number(r.platform_cost_ratio || 0),
      traffic:   Number(r.traffic_unit_price || 0),
      request:   Number(r.request_unit_price || 0),
      domain:    Number(r.domain_unit_price || 0),
    });
  }
  return map;
}

/** Resolve the cost config for a given (provider, scene), falling back to
 *  the provider's default scene ('download') when the exact combo is missing. */
function resolveCost(cm, provider, scene) {
  return cm.get(`${provider}|${scene}`)
      || cm.get(`${provider}|download`)
      || { platform: 0, traffic: 0, request: 0, domain: 0 };
}

// =====================================================
// Provider × scene summary (for overview "by data source" card)
// =====================================================

/**
 * Aggregate metrics grouped by `customers.provider, customers.scene`, for the
 * dashboard's "按融合平台汇总" card.
 *
 * Returns:
 *   [{
 *      provider, scene, customer_count,
 *      // current month
 *      month, month_traffic_gb, month_request_count, month_domain_count,
 *      month_revenue, month_platform_cost, month_resource_cost,
 *      month_traffic_fee, month_request_fee, month_domain_fee,
 *      month_gross_profit, month_margin,
 *      // lifetime
 *      total_traffic_gb, total_request_count, total_domain_count,
 *      total_revenue, total_platform_cost, total_resource_cost,
 *      total_traffic_fee, total_request_fee, total_domain_fee,
 *      total_gross_profit, total_margin,
 *      // configuration snapshot
 *      platform_cost_ratio, traffic_unit_price, request_unit_price, domain_unit_price,
 *   }, ...]
 *
 * Sorted by provider, then scene.
 */
function listProviderSummaries(month) {
  const isAll = month === 'all' || month === 'ALL';
  const m = isAll ? null : (month || nowYearMonth());
  const cm = buildCostMap();

  // Customers per (provider, scene) (count, even if 0 usage).
  const cntRows = db.prepare(`
    SELECT provider, scene, COUNT(*) AS n FROM customers GROUP BY provider, scene
  `).all();
  const cntMap = new Map(cntRows.map(r => [`${r.provider}|${r.scene}`, r.n]));

  // Lifetime aggregates.
  const lifeRows = db.prepare(`
    SELECT c.provider                      AS provider,
           c.scene                         AS scene,
           COALESCE(SUM(u.traffic_gb), 0)  AS traffic_gb,
           COALESCE(SUM(u.request_count), 0) AS request_count,
           COALESCE(SUM(u.domain_count), 0)  AS domain_count,
           COALESCE(SUM(u.amount),     0)  AS revenue
    FROM customers c
    LEFT JOIN usage_records u ON u.customer_id = c.id
    GROUP BY c.provider, c.scene
  `).all();
  const lifeMap = new Map(lifeRows.map(r => [`${r.provider}|${r.scene}`, r]));

  // "Current period" aggregates: month-scoped, or lifetime when isAll.
  const monthRows = isAll
    ? lifeRows
    : db.prepare(`
        SELECT c.provider                      AS provider,
               c.scene                         AS scene,
               COALESCE(SUM(u.traffic_gb), 0)  AS traffic_gb,
               COALESCE(SUM(u.request_count), 0) AS request_count,
               COALESCE(SUM(u.domain_count), 0)  AS domain_count,
               COALESCE(SUM(u.amount),     0)  AS revenue
        FROM customers c
        LEFT JOIN usage_records u
          ON u.customer_id = c.id AND substr(u.usage_date,1,7) = ?
        GROUP BY c.provider, c.scene
      `).all(m);
  const monthMap = new Map(monthRows.map(r => [`${r.provider}|${r.scene}`, r]));

  // Build the union of (provider, scene) from configured costs + customers.
  const combos = new Set();
  for (const r of listSceneCosts(false)) combos.add(`${r.provider}|${r.scene}`);
  for (const r of cntRows) combos.add(`${r.provider}|${r.scene}`);

  const out = [];
  for (const key of combos) {
    const [provider, scene] = key.split('|');
    const cost = resolveCost(cm, provider, scene);

    const life  = lifeMap.get(key) || { traffic_gb: 0, request_count: 0, domain_count: 0, revenue: 0 };
    const lifeTraffic  = Number(life.traffic_gb || 0);
    const lifeRequests = Number(life.request_count || 0);
    const lifeDomains  = Number(life.domain_count || 0);
    const lifeRevenue  = Number(life.revenue || 0);
    const lifePlatform = lifeRevenue * cost.platform;
    const lifeResource = lifeTraffic * cost.traffic + lifeRequests * cost.request + lifeDomains * cost.domain;

    const mo = monthMap.get(key) || { traffic_gb: 0, request_count: 0, domain_count: 0, revenue: 0 };
    const mTraffic  = Number(mo.traffic_gb || 0);
    const mRequests = Number(mo.request_count || 0);
    const mDomains  = Number(mo.domain_count || 0);
    const mRevenue  = Number(mo.revenue || 0);
    const mPlatform = mRevenue * cost.platform;
    const mResource = mTraffic * cost.traffic + mRequests * cost.request + mDomains * cost.domain;

    out.push({
      provider,
      scene,
      customer_count:       cntMap.get(key) || 0,
      // configuration
      platform_cost_ratio:  cost.platform,
      traffic_unit_price:   cost.traffic,
      request_unit_price:   cost.request,
      domain_unit_price:    cost.domain,
      // current period: month or 'all'
      month: isAll ? 'all' : m,
      month_traffic_gb:     round4(mTraffic),
      month_request_count:  round2(mRequests),
      month_domain_count:   round2(mDomains),
      month_revenue:        round2(mRevenue),
      month_platform_cost:  round2(mPlatform),
      month_traffic_fee:    round2(mTraffic * cost.traffic),
      month_request_fee:    round2(mRequests * cost.request),
      month_domain_fee:     round2(mDomains * cost.domain),
      month_resource_cost:  round2(mResource),
      month_gross_profit:   round2(mRevenue - mPlatform - mResource),
      month_margin:         mRevenue > 0 ? round4((mRevenue - mPlatform - mResource) / mRevenue) : null,
      // lifetime
      total_traffic_gb:     round4(lifeTraffic),
      total_request_count:  round2(lifeRequests),
      total_domain_count:   round2(lifeDomains),
      total_revenue:        round2(lifeRevenue),
      total_platform_cost:  round2(lifePlatform),
      total_traffic_fee:    round2(lifeTraffic * cost.traffic),
      total_request_fee:    round2(lifeRequests * cost.request),
      total_domain_fee:     round2(lifeDomains * cost.domain),
      total_resource_cost:  round2(lifeResource),
      total_gross_profit:   round2(lifeRevenue - lifePlatform - lifeResource),
      total_margin:         lifeRevenue > 0 ? round4((lifeRevenue - lifePlatform - lifeResource) / lifeRevenue) : null,
    });
  }
  out.sort((a, b) =>
    String(a.provider).localeCompare(String(b.provider)) ||
    String(a.scene).localeCompare(String(b.scene)));
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
 *   total_requests   = SUM(usage_records.request_count)
 *   total_domains    = SUM(usage_records.domain_count)
 *   total_platform   = total_revenue * scene_cost.platform_cost_ratio (% of revenue)
 *   total_resource   = total_traffic * traffic_unit_price
 *                    + total_requests * request_unit_price
 *                    + total_domains  * domain_unit_price
 *   total_profit     = total_revenue - total_platform - total_resource
 *   balance          = total_recharge - total_revenue
 */
function getCustomerStats(customerId, costMap) {
  const cm = costMap || buildCostMap();
  const c = db.prepare(`SELECT id, provider, scene FROM customers WHERE id = ?`).get(customerId);
  const provider = c ? c.provider : null;
  const scene    = c ? (c.scene || 'download') : 'download';
  const cost = resolveCost(cm, provider, scene);

  const r = db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total
    FROM recharges WHERE customer_id = ?
  `).get(customerId);

  const u = db.prepare(`
    SELECT COALESCE(SUM(amount),0)        AS revenue,
           COALESCE(SUM(traffic_gb),0)    AS traffic,
           COALESCE(SUM(request_count),0) AS requests,
           COALESCE(SUM(domain_count),0)  AS domains
    FROM usage_records WHERE customer_id = ?
  `).get(customerId);

  const totalRecharge = round2(r.total);
  const totalRevenue  = round2(u.revenue);
  const totalTraffic  = round4(u.traffic);
  const totalRequests = round2(u.requests);
  const totalDomains  = round2(u.domains);
  const totalResource = round2(totalTraffic * cost.traffic
                             + totalRequests * cost.request
                             + totalDomains  * cost.domain);
  const totalPlatform = round2(totalRevenue * cost.platform);   // % of revenue
  const totalProfit   = round2(totalRevenue - totalPlatform - totalResource);
  const balance       = round2(totalRecharge - totalRevenue);

  return {
    totalRecharge,
    totalUsage:    totalRevenue, // alias kept for backwards-compat
    totalRevenue,
    totalTraffic,
    totalRequests,
    totalDomains,
    totalPlatformCost: totalPlatform,
    totalTrafficFee:   round2(totalTraffic * cost.traffic),
    totalRequestFee:   round2(totalRequests * cost.request),
    totalDomainFee:    round2(totalDomains * cost.domain),
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
  const c = db.prepare(`SELECT provider, scene FROM customers WHERE id = ?`).get(customerId);
  const cost = resolveCost(cm, c && c.provider, c && (c.scene || 'download'));

  let sql = `
    SELECT substr(usage_date, 1, 7)  AS month,
           ROUND(SUM(traffic_gb), 4) AS traffic_gb,
           ROUND(SUM(request_count), 2) AS request_count,
           ROUND(SUM(domain_count), 2)  AS domain_count,
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
    const traffic  = Number(r.traffic_gb || 0);
    const requests = Number(r.request_count || 0);
    const domains  = Number(r.domain_count || 0);
    const revenue  = Number(r.amount || 0);
    const trafficFee = round2(traffic * cost.traffic);
    const requestFee = round2(requests * cost.request);
    const domainFee  = round2(domains * cost.domain);
    const resource = trafficFee + requestFee + domainFee;
    const platform = round2(revenue * cost.platform);
    return {
      month:         r.month,
      traffic_gb:    round4(traffic),
      request_count: round2(requests),
      domain_count:  round2(domains),
      amount:        round2(revenue),     // legacy
      revenue:       round2(revenue),
      platform_cost: platform,
      traffic_fee:   trafficFee,
      request_fee:   requestFee,
      domain_fee:    domainFee,
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
  // "all" / 'all' / null  =>  use lifetime numbers as the "current period".
  const isAll = month === 'all' || month === 'ALL';
  const m = isAll ? null : (month || nowYearMonth());
  const customers = db.prepare(`SELECT * FROM customers ORDER BY id ASC`).all();
  const cm = buildCostMap();

  const monthRow = db.prepare(`
    SELECT COALESCE(SUM(traffic_gb),0)     AS traffic_gb,
           COALESCE(SUM(request_count),0)  AS request_count,
           COALESCE(SUM(domain_count),0)   AS domain_count,
           COALESCE(SUM(amount),0)         AS amount
    FROM usage_records
    WHERE customer_id = ? AND substr(usage_date,1,7) = ?
  `);

  return customers.map(c => {
    const s = getCustomerStats(c.id, cm);
    const cost = resolveCost(cm, c.provider, c.scene || 'download');

    let monthTraffic, monthRequests, monthDomains, monthRevenue,
        monthResource, monthPlatform, monthProfit;
    if (isAll) {
      // "全区间" mode — current-period numbers are simply the lifetime ones.
      monthTraffic   = s.totalTraffic;
      monthRequests  = s.totalRequests;
      monthDomains   = s.totalDomains;
      monthRevenue   = s.totalRevenue;
      monthResource  = s.totalResourceCost;
      monthPlatform  = s.totalPlatformCost;
      monthProfit    = s.totalGrossProfit;
    } else {
      const mr = monthRow.get(c.id, m);
      monthTraffic   = Number(mr.traffic_gb || 0);
      monthRequests  = Number(mr.request_count || 0);
      monthDomains   = Number(mr.domain_count || 0);
      monthRevenue   = round2(mr.amount);
      monthResource  = round2(monthTraffic * cost.traffic
                           + monthRequests * cost.request
                           + monthDomains  * cost.domain);
      monthPlatform  = round2(monthRevenue * cost.platform);
      monthProfit    = round2(monthRevenue - monthPlatform - monthResource);
    }

    return {
      ...c,
      current_month:        isAll ? 'all' : m,
      month_traffic_gb:     round4(monthTraffic),
      month_request_count:  round2(monthRequests),
      month_domain_count:   round2(monthDomains),
      month_amount:         monthRevenue,
      month_revenue:        monthRevenue,
      month_platform_cost:  monthPlatform,
      month_traffic_fee:    round2(monthTraffic * cost.traffic),
      month_request_fee:    round2(monthRequests * cost.request),
      month_domain_fee:     round2(monthDomains * cost.domain),
      month_resource_cost:  monthResource,
      month_gross_profit:   monthProfit,
      total_recharge:       s.totalRecharge,
      total_usage:          s.totalUsage,
      total_revenue:        s.totalRevenue,
      total_traffic_gb:     s.totalTraffic,
      total_request_count:  s.totalRequests,
      total_domain_count:   s.totalDomains,
      total_platform_cost:  s.totalPlatformCost,
      total_traffic_fee:    s.totalTrafficFee,
      total_request_fee:    s.totalRequestFee,
      total_domain_fee:     s.totalDomainFee,
      total_resource_cost:  s.totalResourceCost,
      total_gross_profit:   s.totalGrossProfit,
      balance:              s.balance,
      low_balance:          s.balance < c.alert_threshold,
      platform_cost_ratio:  cost.platform,
      traffic_unit_price:   cost.traffic,
      request_unit_price:   cost.request,
      domain_unit_price:    cost.domain,
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
    ? db.prepare(`SELECT id, unit_price, unit_price_traffic, unit_price_request, unit_price_domain FROM customers WHERE id = ?`).all(customerId)
    : db.prepare(`SELECT id, unit_price, unit_price_traffic, unit_price_request, unit_price_domain FROM customers`).all();

  // For each usage row of this customer, re-stamp the three price snapshots,
  // compute each fee, and store the SUM in the legacy `amount` column so any
  // existing consumer (`SUM(amount) AS revenue`) keeps working unchanged.
  const upd = db.prepare(`
    UPDATE usage_records
    SET unit_price_traffic = ?,
        unit_price_request = ?,
        unit_price_domain  = ?,
        unit_price         = ?,
        traffic_fee        = ROUND(traffic_gb    * ?, 2),
        request_fee        = ROUND(request_count * ?, 2),
        domain_fee         = ROUND(domain_count  * ?, 2),
        amount             = ROUND(traffic_gb * ? + request_count * ? + domain_count * ?, 2)
    WHERE customer_id = ?
  `);

  let totalRows = 0;
  const tx = db.transaction(() => {
    for (const c of customers) {
      const pT = Number(c.unit_price_traffic || 0);
      const pR = Number(c.unit_price_request || 0);
      const pD = Number(c.unit_price_domain  || 0);
      const r = upd.run(pT, pR, pD, pT, pT, pR, pD, pT, pR, pD, c.id);
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
  // provider × scene aggregates
  listProviderSummaries,
  // scene cost configuration
  listSceneCosts,
  getSceneCost,
  setSceneCost,
  buildCostMap,
  resolveCost,
  // misc
  nowYearMonth,
  round2,
  round4,
};
