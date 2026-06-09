/* eslint-disable no-undef */
// ============================================================
// BCDN Fusion — frontend
// Layout: top tab bar (Overview + each customer) → single page area
// ============================================================

const API = {
  token: localStorage.getItem('bcdn_admin_token') || '',
  async request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['x-admin-token'] = this.token;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      const t = prompt('请输入管理员 Token：');
      if (t) {
        localStorage.setItem('bcdn_admin_token', t);
        this.token = t;
        return this.request(method, url, body);
      }
      throw new Error('unauthorized');
    }
    const j = await res.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j.data;
  },
  get(url)        { return this.request('GET',    url); },
  post(url, b)    { return this.request('POST',   url, b); },
  put(url, b)     { return this.request('PUT',    url, b); },
  del(url)        { return this.request('DELETE', url); },
};

const UI = {
  toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white';
    el.classList.add(type === 'error' ? 'bg-rose-600' : (type === 'info' ? 'bg-sky-600' : 'bg-emerald-600'));
    el.classList.remove('hidden');
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.add('hidden'), 3500);
  },
  openModal(id)  { document.getElementById(id).classList.remove('hidden'); },
  closeModal(id) { document.getElementById(id).classList.add('hidden'); },
};

// ----- helpers -----
// NOTE: backend stores traffic in GB and unit_price in USDT/GB.
// The UI presents everything in TB and USDT/TB using SI 1000-base
// (1 TB = 1000 GB), matching common CDN billing practice. Conversion
// happens only at the presentation/edge layer; nothing on the server
// changes.
const GB_PER_TB = 1000;
const fmt = {
  money(n)   { return Number(n || 0).toFixed(2); },
  /** GB → "X.XXXX TB" (number only). */
  traffic(gb) { return (Number(gb || 0) / GB_PER_TB).toFixed(4); },
  /** USDT/GB → "X.XX" USDT/TB (number only, 2 decimals). */
  pricePerTB(pricePerGB) { return (Number(pricePerGB || 0) * GB_PER_TB).toFixed(2); },
  ymdNow() { return new Date().toISOString().slice(0, 10); },
  monthNow() { return new Date().toISOString().slice(0, 7); },
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

const PROVIDER_LABEL = {
  source1: 'CCDN',
  source2: 'YCDN',
};

// ============================================================
// State
// ============================================================
const state = {
  month: fmt.monthNow(),
  customers: [],
  providerSummaries: [],
  view: { type: 'overview' }, // {type:'overview'} | {type:'customer', id}
  detailTab: 'overview',
  detail: null,    // cached detail of currently-shown customer
  chart: null,
};

// ============================================================
// Boot / data loading
// ============================================================
async function loadCustomers() {
  state.customers = await API.get(`/api/customers?month=${state.month}`);
  renderTopTabs();
}

async function loadProviderSummaries() {
  try {
    state.providerSummaries = await API.get(`/api/provider-summaries?month=${state.month}`);
  } catch (e) {
    state.providerSummaries = [];
  }
}

async function reloadAndRender() {
  try {
    await Promise.all([loadCustomers(), loadProviderSummaries()]);
    await renderPage();
  } catch (e) {
    UI.toast('加载失败：' + e.message, 'error');
  }
}

// ============================================================
// Top tab bar
// ============================================================
function renderTopTabs() {
  const el = document.getElementById('top-tabs');
  const tabs = [
    `<button class="top-tab ${state.view.type === 'overview' ? 'active' : ''}" onclick="goOverview()">
       <span class="mr-1">📊</span>总览
     </button>`,
    ...state.customers.map(c => {
      const active = state.view.type === 'customer' && state.view.id === c.id;
      const low = c.low_balance ? '<span class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>' : '';
      return `<button class="top-tab ${active ? 'active' : ''}" onclick="goCustomer(${c.id})">
        ${fmt.esc(c.name)}${low}
      </button>`;
    }),
  ];
  el.innerHTML = tabs.join('');
}

function goOverview() {
  state.view = { type: 'overview' };
  renderTopTabs();
  renderPage();
}
function goCustomer(id) {
  state.view = { type: 'customer', id };
  state.detailTab = 'overview';
  renderTopTabs();
  renderPage();
}

// ============================================================
// Page renderer
// ============================================================
async function renderPage() {
  const el = document.getElementById('page');
  if (state.view.type === 'overview') return renderOverviewPage(el);
  return renderCustomerPage(el, state.view.id);
}

// ============================================================
// Overview page
// ============================================================
function renderOverviewPage(el) {
  const list = state.customers;
  const totalCustomers = list.length;
  const totalBalance     = list.reduce((s, c) => s + Number(c.balance || 0), 0);
  const totalRecharge    = list.reduce((s, c) => s + Number(c.total_recharge || 0), 0);
  const totalRevenueAll  = list.reduce((s, c) => s + Number(c.total_revenue ?? c.total_usage ?? 0), 0);
  const totalPlatformAll = list.reduce((s, c) => s + Number(c.total_platform_cost || 0), 0);
  const totalResourceAll = list.reduce((s, c) => s + Number(c.total_resource_cost || 0), 0);
  const totalProfitAll   = list.reduce((s, c) => s + Number(c.total_gross_profit  || 0), 0);
  const monthTraffic     = list.reduce((s, c) => s + Number(c.month_traffic_gb || 0), 0);
  const monthRevenue     = list.reduce((s, c) => s + Number(c.month_revenue ?? c.month_amount ?? 0), 0);
  const monthPlatform    = list.reduce((s, c) => s + Number(c.month_platform_cost || 0), 0);
  const monthResource    = list.reduce((s, c) => s + Number(c.month_resource_cost || 0), 0);
  const monthProfit      = list.reduce((s, c) => s + Number(c.month_gross_profit  || 0), 0);
  const lowBalance       = list.filter(c => c.low_balance).length;
  const profitClass      = monthProfit >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const totalProfitClass = totalProfitAll >= 0 ? 'text-emerald-600' : 'text-rose-600';

  el.innerHTML = `
    <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat-card">
        <div class="stat-label">客户数量</div>
        <div class="stat-value num">${totalCustomers}</div>
        <div class="stat-foot">${lowBalance > 0 ? `<span class="text-rose-600 font-medium">${lowBalance} 个低于阈值</span>` : '余额均充足'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${state.month} 流量</div>
        <div class="stat-value num">${fmt.traffic(monthTraffic)} <span class="text-base text-slate-400">TB</span></div>
        <div class="stat-foot">本月营收 $ ${fmt.money(monthRevenue)} USDT</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${state.month} 成本</div>
        <div class="stat-value num">$ ${fmt.money(monthPlatform + monthResource)} <span class="text-base text-slate-400">USDT</span></div>
        <div class="stat-foot">平台 $${fmt.money(monthPlatform)} · 资源 $${fmt.money(monthResource)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${state.month} 毛利</div>
        <div class="stat-value num ${profitClass}">$ ${fmt.money(monthProfit)} <span class="text-base text-slate-400">USDT</span></div>
        <div class="stat-foot">${monthRevenue > 0 ? `毛利率 ${(monthProfit / monthRevenue * 100).toFixed(1)}%` : '本月未产生营收'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总余额</div>
        <div class="stat-value num">$ ${fmt.money(totalBalance)} <span class="text-base text-slate-400">USDT</span></div>
        <div class="stat-foot">充值 $${fmt.money(totalRecharge)} − 营收 $${fmt.money(totalRevenueAll)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">累计营收</div>
        <div class="stat-value num">$ ${fmt.money(totalRevenueAll)} <span class="text-base text-slate-400">USDT</span></div>
        <div class="stat-foot">全部客户历史消费</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">累计成本</div>
        <div class="stat-value num">$ ${fmt.money(totalPlatformAll + totalResourceAll)} <span class="text-base text-slate-400">USDT</span></div>
        <div class="stat-foot">平台 $${fmt.money(totalPlatformAll)} · 资源 $${fmt.money(totalResourceAll)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">累计毛利</div>
        <div class="stat-value num ${totalProfitClass}">$ ${fmt.money(totalProfitAll)} <span class="text-base text-slate-400">USDT</span></div>
        <div class="stat-foot">${totalRevenueAll > 0 ? `毛利率 ${(totalProfitAll / totalRevenueAll * 100).toFixed(1)}%` : '暂无营收'}</div>
      </div>
    </section>

    ${renderProviderSummarySection()}

    <section class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 class="text-base font-semibold">客户列表</h2>
        <div class="text-xs text-slate-500">共 ${totalCustomers} 个客户 · 财务口径以当前月为准</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th class="text-left px-6 py-3">客户</th>
              <th class="text-left px-4 py-3">融合平台</th>
              <th class="text-right px-4 py-3">单价（USDT/TB）</th>
              <th class="text-right px-4 py-3">本月流量（TB）</th>
              <th class="text-right px-4 py-3">本月营收（USDT）</th>
              <th class="text-right px-4 py-3">平台成本</th>
              <th class="text-right px-4 py-3">资源成本</th>
              <th class="text-right px-4 py-3">本月毛利</th>
              <th class="text-right px-4 py-3">余额</th>
              <th class="text-center px-4 py-3">告警阈值</th>
              <th class="text-right px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${list.length ? list.map(c => overviewRow(c)).join('') : `
              <tr><td colspan="11" class="text-center text-slate-400 py-12">
                暂无客户，点击右上角「+ 新建客户」开始。
              </td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function overviewRow(c) {
  const lowBadge   = c.low_balance ? `<span class="badge badge-red ml-2">余额不足</span>` : '';
  const statusBadge = c.status === 'active'
    ? `<span class="badge badge-green">启用</span>`
    : `<span class="badge badge-slate">停用</span>`;
  const providerBadge = `<span class="badge badge-slate">${fmt.esc(PROVIDER_LABEL[c.provider] || c.provider || '—')}</span>`;
  const monthRevenue = Number(c.month_revenue ?? c.month_amount ?? 0);
  const monthProfit  = Number(c.month_gross_profit || 0);
  const profitClass  = monthProfit >= 0 ? 'text-emerald-700' : 'text-rose-600';
  return `
    <tr>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <button class="font-medium text-slate-800 hover:text-indigo-600 text-left" onclick="goCustomer(${c.id})">${fmt.esc(c.name)}</button>
          ${statusBadge}${lowBadge}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">${fmt.esc(c.contact || '—')}</div>
      </td>
      <td class="px-4 py-4">${providerBadge}</td>
      <td class="px-4 py-4 text-right num">${fmt.pricePerTB(c.unit_price)}</td>
      <td class="px-4 py-4 text-right num">${fmt.traffic(c.month_traffic_gb)}</td>
      <td class="px-4 py-4 text-right num">$ ${fmt.money(monthRevenue)}</td>
      <td class="px-4 py-4 text-right num text-slate-500">$ ${fmt.money(c.month_platform_cost)}</td>
      <td class="px-4 py-4 text-right num text-slate-500">$ ${fmt.money(c.month_resource_cost)}</td>
      <td class="px-4 py-4 text-right num font-semibold ${profitClass}">$ ${fmt.money(monthProfit)}</td>
      <td class="px-4 py-4 text-right num font-semibold ${c.low_balance ? 'text-rose-600' : 'text-slate-900'}">$ ${fmt.money(c.balance)}</td>
      <td class="px-4 py-4 text-center text-xs text-slate-500">$ ${fmt.money(c.alert_threshold)}</td>
      <td class="px-4 py-4 text-right whitespace-nowrap">
        <button class="btn-link text-emerald-700 hover:bg-emerald-50" onclick="openRechargeModal(${c.id})">+ 充值</button>
        <button class="btn-link" onclick="goCustomer(${c.id})">打开</button>
        <button class="btn-link" onclick="openCustomerModal(${c.id})">编辑</button>
        <button class="btn-link btn-danger" onclick="deleteCustomer(${c.id}, '${fmt.esc(c.name)}')">删除</button>
      </td>
    </tr>
  `;
}

// ----- by-data-source summary (overview page) -----
function renderProviderSummarySection() {
  const list = state.providerSummaries || [];
  if (!list.length) return '';

  const cards = list.map(p => {
    const label = PROVIDER_LABEL[p.provider] || p.provider;
    const monthRev    = Number(p.month_revenue || 0);
    const monthCost   = Number(p.month_platform_cost || 0) + Number(p.month_resource_cost || 0);
    const monthProfit = Number(p.month_gross_profit || 0);
    const totalRev    = Number(p.total_revenue || 0);
    const totalCost   = Number(p.total_platform_cost || 0) + Number(p.total_resource_cost || 0);
    const totalProfit = Number(p.total_gross_profit || 0);
    const monthMargin = p.month_margin != null ? (Number(p.month_margin) * 100).toFixed(1) + '%' : '—';
    const totalMargin = p.total_margin != null ? (Number(p.total_margin) * 100).toFixed(1) + '%' : '—';
    const monthClass  = monthProfit >= 0 ? 'text-emerald-600' : 'text-rose-600';
    const totalClass  = totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600';
    const platPct     = (Number(p.platform_cost_price || 0) * 100).toFixed(2);
    const resTB       = (Number(p.resource_cost_price || 0) * GB_PER_TB).toFixed(2);

    return `
      <div class="border border-slate-200 rounded-xl bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="font-semibold text-slate-800">${fmt.esc(label)}</div>
            <div class="text-xs text-slate-400 mt-0.5">${fmt.esc(p.provider)} · ${p.customer_count} 个客户</div>
          </div>
          <div class="text-right text-xs text-slate-500 leading-snug">
            <div>平台 <span class="text-slate-700 font-medium">${platPct}%</span></div>
            <div>资源 <span class="text-slate-700 font-medium">$${resTB}</span>/TB</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-slate-500 mb-1">本月（${fmt.esc(state.month)}）</div>
            <div class="flex items-baseline justify-between"><span class="text-slate-500">流量</span><span class="num text-slate-800">${fmt.traffic(p.month_traffic_gb)} TB</span></div>
            <div class="flex items-baseline justify-between"><span class="text-slate-500">营收</span><span class="num text-slate-800">$ ${fmt.money(monthRev)}</span></div>
            <div class="flex items-baseline justify-between"><span class="text-slate-500">成本</span><span class="num text-slate-500">$ ${fmt.money(monthCost)}</span></div>
            <div class="flex items-baseline justify-between border-t border-slate-200 mt-1.5 pt-1.5">
              <span class="text-slate-500">毛利 <span class="text-slate-400">(${monthMargin})</span></span>
              <span class="num font-semibold ${monthClass}">$ ${fmt.money(monthProfit)}</span>
            </div>
          </div>

          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-slate-500 mb-1">累计</div>
            <div class="flex items-baseline justify-between"><span class="text-slate-500">流量</span><span class="num text-slate-800">${fmt.traffic(p.total_traffic_gb)} TB</span></div>
            <div class="flex items-baseline justify-between"><span class="text-slate-500">营收</span><span class="num text-slate-800">$ ${fmt.money(totalRev)}</span></div>
            <div class="flex items-baseline justify-between"><span class="text-slate-500">成本</span><span class="num text-slate-500">$ ${fmt.money(totalCost)}</span></div>
            <div class="flex items-baseline justify-between border-t border-slate-200 mt-1.5 pt-1.5">
              <span class="text-slate-500">毛利 <span class="text-slate-400">(${totalMargin})</span></span>
              <span class="num font-semibold ${totalClass}">$ ${fmt.money(totalProfit)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  const cols = list.length >= 2 ? 'md:grid-cols-2' : '';

  return `
    <section class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-slate-800">按融合平台汇总</h2>
        <button class="btn-link text-xs text-violet-700 hover:bg-violet-50" onclick="openProviderCostModal()">⚙️ 调整成本配置</button>
      </div>
      <div class="grid grid-cols-1 ${cols} gap-4">${cards}</div>
    </section>`;
}

// ============================================================
// Customer page (full page, with sub-tabs)
// ============================================================
async function renderCustomerPage(el, id) {
  el.innerHTML = `<div class="text-center text-slate-400 py-20">加载中…</div>`;
  let c, recharges, usage, alerts;
  try {
    [c, recharges, usage, alerts] = await Promise.all([
      API.get(`/api/customers/${id}`),
      API.get(`/api/customers/${id}/recharges`),
      API.get(`/api/customers/${id}/usage?month=${state.month}`),
      API.get(`/api/alerts/logs?customer_id=${id}`),
    ]);
  } catch (e) {
    el.innerHTML = `<div class="text-center text-rose-600 py-20">加载失败：${fmt.esc(e.message)}</div>`;
    return;
  }
  state.detail = { c, recharges, usage, alerts };

  const lastSync = c.last_sync_at
    ? `<span class="text-emerald-600">${fmt.esc(c.last_sync_at)}</span>`
    : `<span class="text-slate-400">从未同步</span>`;
  const apiKeyShown = c.has_api_key
    ? `<span class="font-mono text-slate-600">${fmt.esc(c.api_key_masked)}</span>`
    : `<span class="text-rose-600">未配置</span>`;

  el.innerHTML = `
    <!-- Header card -->
    <section class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl font-bold tracking-tight">${fmt.esc(c.name)}</h2>
            <span class="badge ${c.status === 'active' ? 'badge-green' : 'badge-slate'}">${c.status === 'active' ? '启用' : '停用'}</span>
            <span class="badge badge-slate">${fmt.esc(PROVIDER_LABEL[c.provider] || c.provider || '—')}</span>
            ${c.balance < c.alert_threshold ? `<span class="badge badge-red">余额不足</span>` : ''}
          </div>
          <div class="text-xs text-slate-500 mt-1">
            ${fmt.esc(c.contact || '—')} · API Key：${apiKeyShown} · 最近同步：${lastSync}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onclick="openRechargeModal(${c.id})">
            ＋ 充值
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-sky-600 text-white hover:bg-sky-700" onclick="syncCustomer(${c.id})">
            🔄 立即同步
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-violet-100 text-violet-800 hover:bg-violet-200" onclick="recomputeCustomer(${c.id})" title="按当前单价重算所有历史账单与余额">
            🧮 重算账单
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" onclick="openCustomerModal(${c.id})">
            ⚙️ 设置
          </button>
          <button class="px-3 py-1.5 text-xs rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200" onclick="checkAlertOne(${c.id}, false)">
            ⚡️ 检查告警
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <div class="stat-card"><div class="stat-label">余额</div>
          <div class="stat-value num ${c.balance < c.alert_threshold ? 'text-rose-600' : ''}">$ ${fmt.money(c.balance)} <span class="text-base text-slate-400">USDT</span></div>
          <div class="stat-foot">阈值 $ ${fmt.money(c.alert_threshold)} USDT</div></div>
        <div class="stat-card"><div class="stat-label">累计充值</div>
          <div class="stat-value num">$ ${fmt.money(c.total_recharge)} <span class="text-base text-slate-400">USDT</span></div></div>
        <div class="stat-card"><div class="stat-label">累计流量</div>
          <div class="stat-value num">${fmt.traffic(c.total_traffic_gb)} <span class="text-base text-slate-400">TB</span></div></div>
        <div class="stat-card"><div class="stat-label">单价</div>
          <div class="stat-value num">$ ${fmt.pricePerTB(c.unit_price)}</div>
          <div class="stat-foot">USDT 每 TB</div></div>
        <div class="stat-card"><div class="stat-label">累计营收</div>
          <div class="stat-value num">$ ${fmt.money(c.total_revenue ?? c.total_usage)} <span class="text-base text-slate-400">USDT</span></div>
          <div class="stat-foot">流量 × 客户单价</div></div>
        <div class="stat-card"><div class="stat-label">累计平台成本</div>
          <div class="stat-value num">$ ${fmt.money(c.total_platform_cost)} <span class="text-base text-slate-400">USDT</span></div>
          <div class="stat-foot">占营收 ${(Number(c.platform_cost_price || 0) * 100).toFixed(2)}%</div></div>
        <div class="stat-card"><div class="stat-label">累计资源成本</div>
          <div class="stat-value num">$ ${fmt.money(c.total_resource_cost)} <span class="text-base text-slate-400">USDT</span></div>
          <div class="stat-foot">单价 ${fmt.pricePerTB(c.resource_cost_price)} USDT/TB</div></div>
        <div class="stat-card"><div class="stat-label">累计毛利</div>
          <div class="stat-value num ${Number(c.total_gross_profit) >= 0 ? 'text-emerald-600' : 'text-rose-600'}">$ ${fmt.money(c.total_gross_profit)} <span class="text-base text-slate-400">USDT</span></div>
          <div class="stat-foot">${Number(c.total_revenue ?? 0) > 0 ? `毛利率 ${(Number(c.total_gross_profit) / Number(c.total_revenue) * 100).toFixed(1)}%` : '—'}</div></div>
      </div>
    </section>

    <!-- Sub tabs -->
    <div class="tabs">
      ${[
        ['overview',  '概览'],
        ['usage',     '用量'],
        ['recharges', '充值'],
        ['alerts',    '告警'],
      ].map(([t, label]) =>
        `<div class="tab ${state.detailTab===t?'active':''}" onclick="switchDetailTab('${t}')">${label}</div>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;
  renderDetailTab();
}

function switchDetailTab(t) {
  state.detailTab = t;
  document.querySelectorAll('#page .tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === t || el.getAttribute('onclick') === `switchDetailTab('${t}')`);
  });
  renderDetailTab();
}

function renderDetailTab() {
  const el = document.getElementById('tab-content');
  if (!el) return;
  const t = state.detailTab;
  // Whenever we leave the overview sub-tab, kill the chart so the next
  // render recreates it on a fresh canvas (prevents Chart.js leaks /
  // ghost auto-resize loops).
  if (t !== 'overview' && state.chart) {
    try { state.chart.destroy(); } catch (_) {}
    state.chart = null;
  }
  if (t === 'overview')   return renderDetailOverview(el);
  if (t === 'usage')      return renderUsage(el);
  if (t === 'recharges')  return renderRecharges(el);
  if (t === 'alerts')     return renderAlerts(el);
}

// ----- detail: overview (chart + monthly bills) -----
function renderDetailOverview(el) {
  const { c } = state.detail;
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="md:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
        <div class="section-title">月度流量与金额趋势</div>
        <div class="chart-box"><canvas id="chart-monthly"></canvas></div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="section-title">客户信息</div>
        <dl class="text-sm space-y-2">
          <div class="flex justify-between"><dt class="text-slate-500">融合平台</dt><dd>${fmt.esc(PROVIDER_LABEL[c.provider] || c.provider)}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">API 用户名</dt><dd class="font-mono text-xs">${fmt.esc(c.api_user || '（无）')}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">API 基础地址</dt><dd class="font-mono text-xs text-right break-all">${fmt.esc(c.api_base_url || '（默认）')}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">状态</dt><dd>${c.status === 'active' ? '启用' : '停用'}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">单价</dt><dd class="num">$ ${fmt.pricePerTB(c.unit_price)} USDT / TB</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">告警阈值</dt><dd class="num">$ ${fmt.money(c.alert_threshold)} USDT</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">TG chat_id</dt><dd class="font-mono text-xs">${fmt.esc(c.tg_chat_id || '（使用全局）')}</dd></div>
          <div class="pt-2 border-t border-slate-100"><dt class="text-slate-500 mb-1">备注</dt><dd class="text-slate-700 whitespace-pre-wrap">${fmt.esc(c.remark || '—')}</dd></div>
        </dl>
      </div>
    </div>

    <div class="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 section-title m-0">月度账单</div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
          <tr><th class="text-left px-4 py-2">月份</th>
              <th class="text-right px-4 py-2">天数</th>
              <th class="text-right px-4 py-2">流量（TB）</th>
              <th class="text-right px-4 py-2">营收（USDT）</th>
              <th class="text-right px-4 py-2">平台成本</th>
              <th class="text-right px-4 py-2">资源成本</th>
              <th class="text-right px-4 py-2">毛利</th></tr>
        </thead>
        <tbody>
          ${(c.monthly || []).map(m => {
            const profit = Number(m.gross_profit ?? (Number(m.revenue ?? m.amount) - Number(m.platform_cost || 0) - Number(m.resource_cost || 0)));
            return `
            <tr class="border-t border-slate-100">
              <td class="px-4 py-2 font-medium">${fmt.esc(m.month)}</td>
              <td class="px-4 py-2 text-right num">${m.days}</td>
              <td class="px-4 py-2 text-right num">${fmt.traffic(m.traffic_gb)}</td>
              <td class="px-4 py-2 text-right num">$ ${fmt.money(m.revenue ?? m.amount)}</td>
              <td class="px-4 py-2 text-right num text-slate-500">$ ${fmt.money(m.platform_cost)}</td>
              <td class="px-4 py-2 text-right num text-slate-500">$ ${fmt.money(m.resource_cost)}</td>
              <td class="px-4 py-2 text-right num font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}">$ ${fmt.money(profit)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="7" class="text-center text-slate-400 py-6">暂无用量记录</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const monthly = c.monthly || [];
  if (state.chart) {
    try { state.chart.destroy(); } catch (_) {}
    state.chart = null;
  }
  const ctx = document.getElementById('chart-monthly').getContext('2d');
  state.chart = new Chart(ctx, {
    data: {
      labels: monthly.map(m => m.month),
      datasets: [
        { type: 'bar',  label: '流量（TB）', data: monthly.map(m => Number(m.traffic_gb || 0) / GB_PER_TB), backgroundColor: 'rgba(99,102,241,.6)', yAxisID: 'y' },
        { type: 'line', label: '营收（USDT）',   data: monthly.map(m => Number(m.revenue ?? m.amount ?? 0)), borderColor: '#10b981', backgroundColor: '#10b98122', yAxisID: 'y1', tension: .3 },
        { type: 'line', label: '成本（USDT）',   data: monthly.map(m => Number(m.platform_cost || 0) + Number(m.resource_cost || 0)), borderColor: '#f97316', backgroundColor: '#f9731622', borderDash: [5,4], yAxisID: 'y1', tension: .3 },
        { type: 'line', label: '毛利（USDT）',   data: monthly.map(m => Number(m.gross_profit ?? (Number(m.revenue ?? m.amount ?? 0) - Number(m.platform_cost || 0) - Number(m.resource_cost || 0)))), borderColor: '#8b5cf6', backgroundColor: '#8b5cf622', yAxisID: 'y1', tension: .3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y:  { type: 'linear', position: 'left',  title: { display: true, text: 'TB' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'USDT' }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

// ----- usage tab -----
function renderUsage(el) {
  const { usage } = state.detail;
  el.innerHTML = `
    <form id="form-usage" class="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3">
      <div><label class="block text-xs text-slate-500 mb-1">日期 *</label>
        <input name="usage_date" type="date" required value="${fmt.ymdNow()}" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
      <div><label class="block text-xs text-slate-500 mb-1">流量（TB） *</label>
        <input name="traffic_tb" type="number" step="0.0001" min="0" required class="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32" /></div>
      <div><label class="block text-xs text-slate-500 mb-1">指定单价（USDT/TB）</label>
        <input name="unit_price_tb" type="number" step="0.01" min="0" placeholder="默认快照" class="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32" /></div>
      <div class="flex-1 min-w-[200px]"><label class="block text-xs text-slate-500 mb-1">备注</label>
        <input name="remark" class="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full" /></div>
      <button class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ 新增 / 更新</button>
    </form>
    <div class="text-xs text-slate-500 mb-2">当前查看 <b>${fmt.esc(state.month)}</b> 的用量记录，可在顶部切换月份。</div>
    <table class="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
      <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
        <tr><th class="text-left px-4 py-2">日期</th>
            <th class="text-right px-4 py-2">流量（TB）</th>
            <th class="text-right px-4 py-2">单价（USDT/TB）</th>
            <th class="text-right px-4 py-2">金额（USDT）</th>
            <th class="text-left px-4 py-2">备注</th>
            <th class="text-right px-4 py-2">操作</th></tr>
      </thead>
      <tbody>
        ${usage.map(r => `
          <tr class="border-t border-slate-100">
            <td class="px-4 py-2 font-medium">${fmt.esc(r.usage_date)}</td>
            <td class="px-4 py-2 text-right num">${fmt.traffic(r.traffic_gb)}</td>
            <td class="px-4 py-2 text-right num text-slate-500">${fmt.pricePerTB(r.unit_price)}</td>
            <td class="px-4 py-2 text-right num">$ ${fmt.money(r.amount)}</td>
            <td class="px-4 py-2 text-slate-600 text-xs">${fmt.esc(r.remark || '—')}</td>
            <td class="px-4 py-2 text-right"><button class="btn-link btn-danger" onclick="delUsage(${r.id})">删除</button></td>
          </tr>`).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-6">${fmt.esc(state.month)} 暂无用量记录，可点击「立即同步」获取。</td></tr>`}
      </tbody>
    </table>
  `;
  document.getElementById('form-usage').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    // UI inputs are in TB / USDT-per-TB; convert back to the GB-based
    // values the backend understands.
    const tbVal = parseFloat(f.traffic_tb.value);
    const payload = {
      usage_date: f.usage_date.value,
      traffic_gb: Number.isFinite(tbVal) ? tbVal * GB_PER_TB : 0,
      remark: f.remark.value || null,
    };
    if (f.unit_price_tb.value) {
      const tbPrice = parseFloat(f.unit_price_tb.value);
      if (Number.isFinite(tbPrice)) payload.unit_price = tbPrice / GB_PER_TB;
    }
    try {
      await API.post(`/api/customers/${state.view.id}/usage`, payload);
      UI.toast('用量已保存');
      await reloadCurrent();
    } catch (err) { UI.toast(err.message, 'error'); }
  });
}

// ----- recharges tab -----
function renderRecharges(el) {
  const { recharges } = state.detail;
  el.innerHTML = `
    <form id="form-recharge" class="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3">
      <div><label class="block text-xs text-slate-500 mb-1">金额（USDT） *</label>
        <input name="amount" type="number" step="0.01" min="0.01" required class="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32" /></div>
      <div><label class="block text-xs text-slate-500 mb-1">充值方式</label>
        <input name="method" placeholder="转账 / USDT / 其他" class="px-3 py-2 border border-slate-300 rounded-lg text-sm w-44" /></div>
      <div class="flex-1 min-w-[200px]"><label class="block text-xs text-slate-500 mb-1">备注</label>
        <input name="remark" class="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full" /></div>
      <button class="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">+ 新增充值</button>
    </form>
    <table class="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
      <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
        <tr><th class="text-left px-4 py-2">时间</th>
            <th class="text-right px-4 py-2">金额（USDT）</th>
            <th class="text-left px-4 py-2">方式</th>
            <th class="text-left px-4 py-2">备注</th>
            <th class="text-right px-4 py-2">操作</th></tr>
      </thead>
      <tbody>
        ${recharges.map(r => `
          <tr class="border-t border-slate-100">
            <td class="px-4 py-2 text-slate-600">${fmt.esc(r.created_at)}</td>
            <td class="px-4 py-2 text-right font-semibold num text-emerald-700">$ ${fmt.money(r.amount)}</td>
            <td class="px-4 py-2">${fmt.esc(r.method || '—')}</td>
            <td class="px-4 py-2 text-slate-600">${fmt.esc(r.remark || '—')}</td>
            <td class="px-4 py-2 text-right"><button class="btn-link btn-danger" onclick="delRecharge(${r.id})">删除</button></td>
          </tr>`).join('') || `<tr><td colspan="5" class="text-center text-slate-400 py-6">暂无充值记录</td></tr>`}
      </tbody>
    </table>
  `;
  document.getElementById('form-recharge').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await API.post(`/api/customers/${state.view.id}/recharges`, {
        amount: parseFloat(f.amount.value),
        method: f.method.value || null,
        remark: f.remark.value || null,
      });
      UI.toast('充值记录已添加');
      await reloadCurrent();
    } catch (err) { UI.toast(err.message, 'error'); }
  });
}

// ----- alerts tab -----
function renderAlerts(el) {
  const { alerts } = state.detail;
  el.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <button class="px-3 py-1.5 text-xs rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200" onclick="checkAlertOne(${state.view.id}, false)">检查告警</button>
      <button class="px-3 py-1.5 text-xs rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200" onclick="checkAlertOne(${state.view.id}, true)">强制发送（跳过冷却）</button>
      <button class="px-3 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" onclick="testTGForCustomer()">发送 TG 测试消息</button>
    </div>
    <table class="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
      <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
        <tr><th class="text-left px-4 py-2">时间</th>
            <th class="text-left px-4 py-2">类型</th>
            <th class="text-right px-4 py-2">余额</th>
            <th class="text-right px-4 py-2">阈值</th>
            <th class="text-left px-4 py-2">内容</th></tr>
      </thead>
      <tbody>
        ${alerts.map(a => {
          const typeLabel = a.type === 'low_balance' ? '余额不足' : a.type;
          return `
          <tr class="border-t border-slate-100">
            <td class="px-4 py-2 text-slate-600">${fmt.esc(a.sent_at)}</td>
            <td class="px-4 py-2"><span class="badge badge-amber">${fmt.esc(typeLabel)}</span></td>
            <td class="px-4 py-2 text-right num">$ ${fmt.money(a.balance)}</td>
            <td class="px-4 py-2 text-right num">$ ${fmt.money(a.threshold)}</td>
            <td class="px-4 py-2 text-xs text-slate-500"><pre class="whitespace-pre-wrap font-sans">${fmt.esc(a.message || '')}</pre></td>
          </tr>`;}).join('') || `<tr><td colspan="5" class="text-center text-slate-400 py-6">暂无告警记录</td></tr>`}
      </tbody>
    </table>
  `;
}

// ============================================================
// Customer create/edit modal
// ============================================================
function openCustomerModal(id) {
  const form = document.getElementById('form-customer');
  form.reset();
  form.id.value = '';
  document.getElementById('customer-modal-title').textContent = id ? '编辑客户' : '新建客户';
  document.getElementById('api-key-hint').textContent = '';

  if (id) {
    API.get(`/api/customers/${id}`).then(c => {
      form.id.value           = c.id;
      form.name.value         = c.name || '';
      form.contact.value      = c.contact || '';
      form.status.value       = c.status || 'active';
      form.provider.value     = c.provider || 'source1';
      form.api_user.value     = c.api_user || '';
      form.api_base_url.value = c.api_base_url || '';
      // Backend stores USDT/GB; the form input asks for USDT/TB.
      form.unit_price.value   = c.unit_price != null
        ? Number((Number(c.unit_price) * GB_PER_TB).toFixed(2))
        : 0;
      form.alert_threshold.value = c.alert_threshold ?? 0;
      form.tg_chat_id.value   = c.tg_chat_id || '';
      form.remark.value       = c.remark || '';
      document.getElementById('api-key-hint').textContent = c.has_api_key
        ? `当前密钥：${c.api_key_masked}`
        : '尚未设置 API 密钥。';
    }).catch(e => UI.toast(e.message, 'error'));
  }
  UI.openModal('modal-customer');
}

document.getElementById('form-customer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const editing = !!f.id.value;
  const apiKeyVal = f.api_key.value.trim();

  // Form's unit_price is in USDT/TB; backend stores USDT/GB.
  const unitPriceTB = parseFloat(f.unit_price.value || '0');
  const payload = {
    name: f.name.value.trim(),
    contact: f.contact.value.trim() || null,
    status: f.status.value,
    provider: f.provider.value,
    api_user: f.api_user.value.trim() || null,
    api_base_url: f.api_base_url.value.trim() || null,
    unit_price: Number.isFinite(unitPriceTB) ? unitPriceTB / GB_PER_TB : 0,
    alert_threshold: parseFloat(f.alert_threshold.value || '0'),
    tg_chat_id: f.tg_chat_id.value.trim() || null,
    remark: f.remark.value.trim() || null,
  };
  // For update, only send api_key if user typed a new value
  if (!editing || apiKeyVal) payload.api_key = apiKeyVal || null;

  try {
    if (editing) {
      await API.put(`/api/customers/${f.id.value}`, payload);
      UI.toast('客户已更新');
    } else {
      await API.post('/api/customers', payload);
      UI.toast('客户已创建');
    }
    UI.closeModal('modal-customer');
    await reloadAndRender();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
});

async function deleteCustomer(id, name) {
  if (!confirm(`确定删除客户「${name}」吗？其充值与用量记录将一并删除。`)) return;
  try {
    await API.del(`/api/customers/${id}`);
    UI.toast('客户已删除');
    if (state.view.type === 'customer' && state.view.id === id) state.view = { type: 'overview' };
    await reloadAndRender();
  } catch (e) { UI.toast(e.message, 'error'); }
}

// ============================================================
// Sync / alert / per-customer actions
// ============================================================
async function syncCustomer(id) {
  UI.toast('同步已启动…', 'info');
  try {
    const r = await API.post(`/api/customers/${id}/sync`, {});
    UI.toast(`已同步 ${r.days} 天，${(Number(r.traffic_gb || 0) / GB_PER_TB).toFixed(4)} TB`);
    await reloadCurrent();
    await loadCustomers();
    renderTopTabs();
  } catch (e) { UI.toast('同步失败：' + e.message, 'error'); }
}

async function recomputeCustomer(id) {
  if (!confirm('将按当前单价重算该客户全部历史账单与余额，确定继续？')) return;
  try {
    const r = await API.post(`/api/customers/${id}/recompute`, {});
    UI.toast(`已重算 ${r.rows} 条记录`);
    await reloadAndRender();
  } catch (e) { UI.toast('重算失败：' + e.message, 'error'); }
}

async function checkAlertOne(id, force) {
  try {
    const r = await API.post('/api/alerts/check', { customer_id: id, force: !!force });
    UI.toast(`已检查：${r.checked}，已告警：${r.alerted}`);
    await reloadCurrent();
  } catch (e) { UI.toast(e.message, 'error'); }
}

async function testTGForCustomer() {
  const c = state.detail.c;
  const chatId = c.tg_chat_id || '';
  try {
    await API.post('/api/alerts/test', {
      chat_id: chatId || undefined,
      text: `🔔 BCDN 测试：客户「${c.name}」 Bot 连通正常。`,
    });
    UI.toast('测试消息已发送。');
  } catch (e) { UI.toast(e.message, 'error'); }
}

async function delUsage(id) {
  if (!confirm('确定删除这条用量记录？')) return;
  try {
    await API.del(`/api/usage/${id}`);
    UI.toast('已删除');
    await reloadCurrent();
  } catch (e) { UI.toast(e.message, 'error'); }
}
async function delRecharge(id) {
  if (!confirm('确定删除这条充值记录？')) return;
  try {
    await API.del(`/api/recharges/${id}`);
    UI.toast('已删除');
    await reloadCurrent();
  } catch (e) { UI.toast(e.message, 'error'); }
}

// ----- Quick recharge (modal triggered from list / customer header) -----
function openRechargeModal(customerId) {
  const c = state.customers.find(x => x.id === customerId)
         || (state.detail && state.detail.c && state.detail.c.id === customerId ? state.detail.c : null);
  if (!c) { UI.toast('客户不存在', 'error'); return; }

  const f = document.getElementById('form-quick-recharge');
  f.reset();
  f.customer_id.value = c.id;
  document.getElementById('recharge-customer-name').textContent =
    `${c.name}（当前余额 $ ${fmt.money(c.balance)} USDT）`;
  UI.openModal('modal-recharge');
  setTimeout(() => f.amount.focus(), 50);
}

document.getElementById('form-quick-recharge').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const id = parseInt(f.customer_id.value, 10);
  const amount = parseFloat(f.amount.value);
  if (!id || !(amount > 0)) {
    UI.toast('请输入有效的充值金额', 'error');
    return;
  }
  try {
    await API.post(`/api/customers/${id}/recharges`, {
      amount,
      method: f.method.value.trim() || null,
      remark: f.remark.value.trim() || null,
    });
    UI.closeModal('modal-recharge');
    UI.toast(`充值成功：+ $ ${amount.toFixed(2)} USDT`);
    await reloadAndRender();
  } catch (err) {
    UI.toast('充值失败：' + err.message, 'error');
  }
});

/** Re-fetch the data needed for the currently shown page. */
async function reloadCurrent() {
  await Promise.all([loadCustomers(), loadProviderSummaries()]);
  await renderPage();
}

// ============================================================
// Top-bar actions
// ============================================================
document.getElementById('btn-add-customer').addEventListener('click', () => openCustomerModal());

document.getElementById('btn-check-alert').addEventListener('click', async () => {
  try {
    const r = await API.post('/api/alerts/check', {});
    UI.toast(`告警检查完成：共 ${r.checked} 个客户，${r.alerted} 个触发告警`);
    await reloadAndRender();
  } catch (e) { UI.toast(e.message, 'error'); }
});

document.getElementById('btn-sync-all').addEventListener('click', async () => {
  UI.toast('全量同步已启动…', 'info');
  try {
    const r = await API.post('/api/sync/all', {});
    const okCount = r.results.filter(x => x.ok).length;
    UI.toast(`已同步 ${okCount}/${r.total} 个客户`);
    await reloadAndRender();
  } catch (e) { UI.toast('同步失败：' + e.message, 'error'); }
});

document.getElementById('btn-provider-costs').addEventListener('click', () => openProviderCostModal());

// ============================================================
// Provider-cost modal
//   GET  /api/provider-costs           -> list of {provider, platform_cost_price, resource_cost_price}
//   PUT  /api/provider-costs/:provider -> upsert {platform_cost_price, resource_cost_price}
//
// Prices are stored as USDT/GB on the server but edited as USDT/TB in
// the UI (× 1000), matching the customer unit-price convention.
// ============================================================
async function openProviderCostModal() {
  UI.openModal('modal-provider-costs');
  const body = document.getElementById('provider-costs-body');
  body.innerHTML = `<div class="text-center text-slate-400 py-10">加载中…</div>`;
  let rows;
  try {
    rows = await API.get('/api/provider-costs?with_stats=1');
  } catch (e) {
    body.innerHTML = `<div class="text-center text-rose-600 py-10">加载失败：${fmt.esc(e.message)}</div>`;
    return;
  }
  if (!rows || !rows.length) {
    body.innerHTML = `<div class="text-center text-slate-500 py-10">暂无可配置的融合平台。</div>`;
    return;
  }

  body.innerHTML = `
    <form id="form-provider-costs" class="space-y-4">
      ${rows.map(r => {
        const platPct = (Number(r.platform_cost_price) * 100).toFixed(2);
        const resTB   = (Number(r.resource_cost_price) * GB_PER_TB).toFixed(2);
        const cnt     = Number(r.customer_count || 0);
        const traffic = fmt.traffic(r.total_traffic_gb);
        const revenue = fmt.money(r.total_revenue);
        const platCost = fmt.money(r.total_platform_cost);
        const resCost  = fmt.money(r.total_resource_cost);
        const profit   = Number(r.total_gross_profit || 0);
        const profitClass = profit >= 0 ? 'text-emerald-700' : 'text-rose-600';
        const margin = (r.margin != null) ? `${(Number(r.margin) * 100).toFixed(1)}%` : '—';
        return `
        <div class="border border-slate-200 rounded-lg p-4" data-provider="${fmt.esc(r.provider)}">
          <div class="flex items-center justify-between mb-3">
            <div class="font-semibold text-slate-800">${fmt.esc(PROVIDER_LABEL[r.provider] || r.provider)}</div>
            <span class="badge badge-slate text-xs">${fmt.esc(r.provider)}</span>
          </div>

          <div class="bg-slate-50 border border-slate-100 rounded-lg p-3 mb-3 text-xs">
            <div class="text-slate-500 mb-1.5">该来源累计指标（${cnt} 个客户）</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1">
              <div class="flex items-baseline justify-between"><span class="text-slate-500">流量</span><span class="num text-slate-800">${traffic} TB</span></div>
              <div class="flex items-baseline justify-between"><span class="text-slate-500">营收</span><span class="num text-slate-800">$ ${revenue}</span></div>
              <div class="flex items-baseline justify-between"><span class="text-slate-500">平台成本</span><span class="num text-slate-500">$ ${platCost}</span></div>
              <div class="flex items-baseline justify-between"><span class="text-slate-500">资源成本</span><span class="num text-slate-500">$ ${resCost}</span></div>
              <div class="flex items-baseline justify-between col-span-2 border-t border-slate-200 mt-1 pt-1">
                <span class="text-slate-500">毛利 <span class="text-slate-400">(${margin})</span></span>
                <span class="num font-semibold ${profitClass}">$ ${fmt.money(profit)}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">平台成本比例（%）</label>
              <div class="relative">
                <input class="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg text-sm num"
                       name="platform_pct" type="number" step="0.01" min="0" max="100" value="${platPct}" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
              <div class="text-xs text-slate-400 mt-1">按营收百分比计费，例如 30 表示 30%</div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">资源成本（USDT / TB）</label>
              <input class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm num"
                     name="resource_tb" type="number" step="0.01" min="0" value="${resTB}" />
              <div class="text-xs text-slate-400 mt-1">按实际用量计费（服务器、带宽等）</div>
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-xs font-medium text-slate-600 mb-1">备注</label>
            <input class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                   name="remark" value="${fmt.esc(r.remark || '')}" />
          </div>
          <div class="text-xs text-slate-400 mt-2">最近更新：${fmt.esc(r.updated_at || '—')}</div>
        </div>`;
      }).join('')}
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50" onclick="UI.closeModal('modal-provider-costs')">取消</button>
        <button type="submit" class="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700">保存全部</button>
      </div>
    </form>
  `;

  document.getElementById('form-provider-costs').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cards = e.target.querySelectorAll('[data-provider]');
    try {
      for (const card of cards) {
        const provider = card.dataset.provider;
        const platPct = parseFloat(card.querySelector('[name=platform_pct]').value || '0');
        const resTB   = parseFloat(card.querySelector('[name=resource_tb]').value || '0');
        const remark  = card.querySelector('[name=remark]').value.trim() || null;
        await API.put(`/api/provider-costs/${encodeURIComponent(provider)}`, {
          // platform_cost_price is stored as a 0~1 ratio.
          platform_cost_price: Number.isFinite(platPct) ? platPct / 100      : 0,
          // resource_cost_price is USDT/GB (UI uses USDT/TB).
          resource_cost_price: Number.isFinite(resTB)   ? resTB  / GB_PER_TB : 0,
          remark,
        });
      }
      UI.closeModal('modal-provider-costs');
      UI.toast('成本设置已保存');
      await reloadAndRender();
    } catch (err) {
      UI.toast('保存失败：' + err.message, 'error');
    }
  });
}

const monthPicker = document.getElementById('month-picker');
monthPicker.value = state.month;
monthPicker.addEventListener('change', () => {
  state.month = monthPicker.value || fmt.monthNow();
  reloadAndRender();
});

// Boot
reloadAndRender();

// Expose for inline handlers
window.openCustomerModal     = openCustomerModal;
window.deleteCustomer        = deleteCustomer;
window.goOverview            = goOverview;
window.goCustomer            = goCustomer;
window.switchDetailTab       = switchDetailTab;
window.delRecharge           = delRecharge;
window.delUsage              = delUsage;
window.checkAlertOne         = checkAlertOne;
window.testTGForCustomer     = testTGForCustomer;
window.syncCustomer          = syncCustomer;
window.recomputeCustomer     = recomputeCustomer;
window.openRechargeModal     = openRechargeModal;
window.openProviderCostModal = openProviderCostModal;
window.UI                    = UI;
