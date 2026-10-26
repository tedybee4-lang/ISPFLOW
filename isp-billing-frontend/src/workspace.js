const tabs = [
  ["overview", "Overview", "admin"],
  ["organizations", "Organizations", "platform"],
  ["leads", "CRM leads", "admin"],
  ["subscribers", "Subscribers", "admin"],
  ["plans", "Packages", "staff"],
  ["subscriptions", "Subscriptions", "staff"],
  ["billing", "Billing", "admin"],
  ["gateways", "Payment gateways", "admin"],
  ["routers", "Routers", "staff"],
  ["portal", "Captive portal", "tenant-admin"],
  ["usage", "Usage & sessions", "staff"],
  ["vouchers", "Vouchers", "staff"],
  ["tickets", "Support tickets", "staff"],
  ["reports", "Reports & exports", "admin"],
  ["staff", "Staff & settings", "admin"]
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function roleOf(user) {
  return String(user?.role || "").toLowerCase().replace(/^.*\./, "");
}

function payloadOf(result) {
  return result?.data || result || {};
}

function listOf(result, key) {
  const payload = payloadOf(result);
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload[key]) ? payload[key] : [];
}

function dateCell(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : escapeHtml(date.toLocaleString());
}

function amountCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? escapeHtml(amount.toLocaleString(undefined, { maximumFractionDigits: 2 }))
    : escapeHtml(value);
}

function statusCell(value) {
  return `<span class="workspace-status">${escapeHtml(String(value ?? "unknown").replaceAll("_", " "))}</span>`;
}

function planFormMarkup(plan = {}) {
  return `<form class="workspace-form" id="workspace-plan-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">${plan.id ? "EDIT PACKAGE" : "NEW PACKAGE"}</span><h3>${plan.id ? "Update internet package" : "Create an internet package"}</h3></div><button type="button" class="workspace-inline-link" data-plan-cancel>Cancel</button></div>
    <div class="workspace-form-grid">
      <label>Package name<input name="name" required minlength="1" maxlength="100" value="${escapeHtml(plan.name || "")}"></label>
      <label>Access type<select name="plan_type"><option value="INTERNET" ${plan.plan_type === "INTERNET" ? "selected" : ""}>Internet</option><option value="HOTSPOT" ${plan.plan_type === "HOTSPOT" ? "selected" : ""}>Hotspot</option><option value="PPPOE" ${plan.plan_type === "PPPOE" ? "selected" : ""}>PPPoE</option><option value="BOTH" ${plan.plan_type === "BOTH" ? "selected" : ""}>Hotspot & PPPoE</option></select></label>
      <label>Price<input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(plan.price ?? "0")}"></label>
      <label>Currency<input name="currency" minlength="3" maxlength="3" required value="${escapeHtml(plan.currency || "KES")}"></label>
      <label>Billing cycle<select name="billing_cycle">${["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"].map((cycle) => `<option value="${cycle}" ${plan.billing_cycle === cycle ? "selected" : ""}>${cycle.replaceAll("_", " ").toLowerCase()}</option>`).join("")}</select></label>
      <label>Download speed (Kbps)<input name="download_speed" type="number" min="0" step="1" required value="${escapeHtml(plan.download_speed ?? "0")}"></label>
      <label>Upload speed (Kbps)<input name="upload_speed" type="number" min="0" step="1" required value="${escapeHtml(plan.upload_speed ?? "0")}"></label>
      <label>Validity (days)<input name="validity_days" type="number" min="1" step="1" required value="${escapeHtml(plan.validity_days ?? "30")}"></label>
      <label>Duration override (minutes)<input name="duration_minutes" type="number" min="1" step="1" value="${escapeHtml(plan.duration_minutes ?? "")}"><small>Optional; takes precedence over whole-day validity.</small></label>
      <label>Data limit (GB; -1 unlimited)<input name="data_limit" type="number" min="-1" step="1" value="${escapeHtml(plan.data_limit ?? "-1")}"></label>
      <label>Fair-use policy<select name="fup_enabled"><option value="false" ${plan.fup_enabled ? "" : "selected"}>Disabled</option><option value="true" ${plan.fup_enabled ? "selected" : ""}>Enabled</option></select></label>
      <label>Fair-use threshold (GB)<input name="fup_threshold" type="number" min="0" step="1" value="${escapeHtml(plan.fup_threshold ?? "")}"></label>
      <label>Fair-use download speed (Kbps)<input name="fup_download_speed" type="number" min="0" step="1" value="${escapeHtml(plan.fup_download_speed ?? "")}"></label>
      <label>Fair-use upload speed (Kbps)<input name="fup_upload_speed" type="number" min="0" step="1" value="${escapeHtml(plan.fup_upload_speed ?? "")}"></label>
      <label>Description<input name="description" maxlength="1000" value="${escapeHtml(plan.description || "")}"></label>
    </div>
    <div class="workspace-form-feedback" role="alert" hidden></div>
    <div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">${plan.id ? "Save changes" : "Create package"}</button><button class="workspace-secondary-button" type="button" data-plan-cancel>Cancel</button></div>
  </form>`;
}

function customerFormMarkup(customer = null) {
  if (customer) {
    return `<form class="workspace-form" id="workspace-customer-form">
      <div class="workspace-form-heading"><div><span class="workspace-kicker">EDIT SUBSCRIBER</span><h3>Update customer details</h3></div><button type="button" class="workspace-inline-link" data-customer-cancel>Cancel</button></div>
      <div class="workspace-form-grid"><label>First name<input name="first_name" required maxlength="50" value="${escapeHtml(customer.first_name || "")}"></label><label>Last name<input name="last_name" required maxlength="50" value="${escapeHtml(customer.last_name || "")}"></label><label>Phone<input name="phone" maxlength="20" value="${escapeHtml(customer.phone || "")}"></label><label>Bio / notes<input name="bio" maxlength="1000" value="${escapeHtml(customer.bio || "")}"></label></div>
      <div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Save changes</button><button class="workspace-secondary-button" type="button" data-customer-cancel>Cancel</button></div>
    </form>`;
  }
  return `<form class="workspace-form" id="workspace-customer-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">NEW SUBSCRIBER</span><h3>Create customer record</h3></div><button type="button" class="workspace-inline-link" data-customer-cancel>Cancel</button></div>
    <div class="workspace-form-grid"><label>Username<input name="username" required minlength="3" maxlength="50" pattern="[A-Za-z0-9_-]+" autocomplete="off"></label><label>Email<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>Temporary password<input name="password" type="password" required minlength="12" maxlength="100" autocomplete="new-password"><small>At least 12 characters with uppercase, lowercase and a number.</small></label><label>First name<input name="first_name" required maxlength="50" autocomplete="given-name"></label><label>Last name<input name="last_name" required maxlength="50" autocomplete="family-name"></label><label>Phone<input name="phone" maxlength="20" pattern="\\+?[1-9][0-9]{7,14}" autocomplete="tel"></label></div>
    <p class="workspace-note">The account is created as a customer with verification pending. No email/SMS is sent from this form.</p><div class="workspace-form-feedback" role="alert" hidden></div>
    <div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Create subscriber</button><button class="workspace-secondary-button" type="button" data-customer-cancel>Cancel</button></div>
  </form>`;
}

function invoiceFormMarkup(customers) {
  return `<form class="workspace-form" id="workspace-invoice-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">NEW INVOICE</span><h3>Create billing record</h3></div><button type="button" class="workspace-inline-link" data-invoice-cancel>Cancel</button></div>
    <div class="workspace-form-grid"><label>Subscriber<select name="user_id" required><option value="">Choose a customer</option>${customers.map((customer) => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.full_name || customer.username)} · ${escapeHtml(customer.email)}</option>`).join("")}</select></label><label>Subtotal<input name="subtotal" type="number" min="0" step="0.01" required value="0"></label><label>Tax amount<input name="tax_amount" type="number" min="0" step="0.01" value="0"></label><label>Discount amount<input name="discount_amount" type="number" min="0" step="0.01" value="0"></label><label>Billing period starts<input name="billing_period_start" type="date"></label><label>Billing period ends<input name="billing_period_end" type="date"></label><label>Notes<input name="notes" maxlength="1000"></label></div>
    <p class="workspace-note">This creates an invoice only. It does not request payment or activate service.</p><div class="workspace-form-feedback" role="alert" hidden></div>
    <div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Create invoice</button><button class="workspace-secondary-button" type="button" data-invoice-cancel>Cancel</button></div>
  </form>`;
}

function subscriptionFormMarkup(customers, plans, routers) {
  return `<form class="workspace-form" id="workspace-subscription-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">NEW SERVICE</span><h3>Assign package to subscriber</h3></div><button type="button" class="workspace-inline-link" data-subscription-cancel>Cancel</button></div>
    <div class="workspace-form-grid">
      <label>Subscriber<select name="user_id" required><option value="">Choose subscriber</option>${customers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.full_name || item.username)} · ${escapeHtml(item.email)}</option>`).join("")}</select></label>
      <label>Package<select name="plan_id" required><option value="">Choose package</option>${plans.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.currency)} ${escapeHtml(item.price)}</option>`).join("")}</select></label>
      <label>Router<select name="router_id" required><option value="">Choose router</option>${routers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.ip_address)}</option>`).join("")}</select></label>
      <label>Access type<select name="subscription_type"><option value="pppoe">PPPoE</option><option value="hotspot">Hotspot</option></select></label>
      <label>Network username<input name="username" required minlength="1" maxlength="50" pattern="[A-Za-z0-9_-]+"></label>
      <label>Initial service password<input name="password" type="password" required minlength="1" maxlength="255" autocomplete="new-password"><small>Sent only to the API for this pending subscription; it is not saved in browser storage.</small></label>
      <label>Service starts<input name="start_date" type="datetime-local" required></label>
      <label>Service ends<input name="end_date" type="datetime-local" required></label>
      <label>Auto-renew<select name="is_auto_renewal"><option value="false">No</option><option value="true">Yes</option></select></label>
      <label class="workspace-form-wide">Notes<textarea name="notes" maxlength="1000" rows="2"></textarea></label>
    </div>
    <p class="workspace-note">Creating a subscription stores it as pending. It does not activate service or issue a router command.</p><div class="workspace-form-feedback" role="alert" hidden></div>
    <div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Create pending subscription</button><button class="workspace-secondary-button" type="button" data-subscription-cancel>Cancel</button></div>
  </form>`;
}

function ticketFormMarkup(customers) {
  return `<form class="workspace-form" id="workspace-ticket-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">NEW SUPPORT TICKET</span><h3>Open customer support case</h3></div><button type="button" class="workspace-inline-link" data-ticket-cancel>Cancel</button></div>
    <div class="workspace-form-grid"><label>Subscriber<select name="user_id" required><option value="">Choose a customer</option>${customers.map((customer) => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.full_name || customer.username)} · ${escapeHtml(customer.email)}</option>`).join("")}</select></label><label>Subject<input name="subject" required minlength="1" maxlength="200"></label><label>Category<select name="category"><option value="technical">Technical</option><option value="billing">Billing</option><option value="account">Account</option><option value="service">Service</option><option value="general">General</option><option value="complaint">Complaint</option><option value="suggestion">Suggestion</option></select></label><label>Priority<select name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label class="workspace-form-wide">Description<textarea name="description" required minlength="1" maxlength="5000" rows="3"></textarea></label></div>
    <div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Create ticket</button><button class="workspace-secondary-button" type="button" data-ticket-cancel>Cancel</button></div>
  </form>`;
}

function organizationFormMarkup(organization = {}) {
  const editing = Boolean(organization.id);
  return `<form class="workspace-form" id="workspace-organization-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">${editing ? "EDIT ORGANIZATION" : "NEW ORGANIZATION"}</span><h3>${editing ? "Update ISP organization" : "Create ISP organization"}</h3></div><button type="button" class="workspace-inline-link" data-organization-cancel>Cancel</button></div>
    <div class="workspace-form-grid">
      <label>Organization name<input name="name" required minlength="1" maxlength="200" value="${escapeHtml(organization.name || "")}"></label>
      ${editing ? "" : `<label>URL slug<input name="slug" required minlength="1" maxlength="100" pattern="[a-z0-9-]+" value="${escapeHtml(organization.slug || "")}"></label>`}
      <label>Organization type<select name="organization_type"><option value="hotspot" ${organization.organization_type === "hotspot" ? "selected" : ""}>Hotspot</option><option value="pppoe" ${organization.organization_type === "pppoe" ? "selected" : ""}>PPPoE</option><option value="hybrid" ${organization.organization_type === "hybrid" ? "selected" : ""}>Hybrid</option></select></label>
      <label>Contact email<input name="email" type="email" required maxlength="100" value="${escapeHtml(organization.email || "")}"></label>
      <label>Phone<input name="phone" maxlength="20" value="${escapeHtml(organization.phone || "")}"></label>
      <label>City<input name="city" maxlength="100" value="${escapeHtml(organization.city || "")}"></label>
      <label>Country<input name="country" required maxlength="100" value="${escapeHtml(organization.country || "Kenya")}"></label>
      ${editing ? "" : `<label>Currency<input name="default_currency" required minlength="3" maxlength="3" value="${escapeHtml(organization.default_currency || "KES")}"></label><label>Timezone<input name="timezone" required maxlength="64" value="${escapeHtml(organization.timezone || "Africa/Nairobi")}"></label><label>Trial days<input name="trial_days" type="number" min="0" max="365" value="14"></label><label>Router limit<input name="max_routers" type="number" min="0" value="5"></label><label>Customer limit<input name="max_customers" type="number" min="0" value="100"></label><label>Staff limit<input name="max_users" type="number" min="0" value="5"></label>`}
    </div>
    <div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">${editing ? "Save organization" : "Create organization"}</button><button class="workspace-secondary-button" type="button" data-organization-cancel>Cancel</button></div>
  </form>`;
}

function routerFormMarkup(router = {}) {
  const editing = Boolean(router.id);
  return `<form class="workspace-form" id="workspace-router-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">${editing ? "EDIT ROUTER" : "ADD ROUTER"}</span><h3>${editing ? "Update router record" : "Register router metadata"}</h3></div><button type="button" class="workspace-inline-link" data-router-cancel>Cancel</button></div>
    <div class="workspace-form-grid">
      <label>Name<input name="name" required maxlength="100" value="${escapeHtml(router.name || "")}"></label>
      <label>Management IPv4 address<input name="ip_address" required pattern="(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)" value="${escapeHtml(router.ip_address || "")}"></label>
      <label>Router type<select name="router_type"><option value="mikrotik" ${String(router.router_type || "").toLowerCase() === "mikrotik" ? "selected" : ""}>MikroTik</option><option value="cisco" ${String(router.router_type || "").toLowerCase() === "cisco" ? "selected" : ""}>Cisco</option><option value="ubiquiti" ${String(router.router_type || "").toLowerCase() === "ubiquiti" ? "selected" : ""}>Ubiquiti</option><option value="other" ${String(router.router_type || "").toLowerCase() === "other" ? "selected" : ""}>Other</option></select></label>
      <label>API port<input name="port" type="number" min="1" max="65535" value="${escapeHtml(router.port ?? 8728)}"></label>
      <label>Location<input name="location" maxlength="200" value="${escapeHtml(router.location || "")}"></label>
      <label>Description<input name="description" maxlength="2000" value="${escapeHtml(router.description || "")}"></label>
    </div>
    <p class="workspace-note">This saves router inventory metadata only. Credentials are not requested or shown. Saving does not connect to or change a router.</p>
    <div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">${editing ? "Save router" : "Add router"}</button><button class="workspace-secondary-button" type="button" data-router-cancel>Cancel</button></div>
  </form>`;
}

function portalPreviewDocument(organization, settings, terms) {
  const title = escapeHtml(organization?.name || "Sample ISP");
  const color = /^#[0-9a-fA-F]{6}$/.test(organization?.primary_color || "")
    ? organization.primary_color
    : "#1f5146";
  return `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f1f5f2;font:14px Arial,sans-serif;color:#243a34}.card{max-width:360px;margin:14px auto;padding:24px;background:#fff;border-radius:16px;box-shadow:0 12px 36px #18372a22}h1{font-size:22px;margin:0 0 6px;color:${color}}p{color:#62736c;line-height:1.5}.sample{font-size:10px;font-weight:bold;letter-spacing:1px;color:#788c82}.plan{padding:12px;margin:10px 0;border:1px solid #dce6df;border-radius:8px}.plan strong{display:block;margin-bottom:5px}label{display:block;margin:12px 0 5px}input{width:100%;padding:11px;border:1px solid #cedbd2;border-radius:7px}button{width:100%;padding:12px;border:0;border-radius:7px;background:${color};color:white;font-weight:bold;margin-top:10px}.terms{max-height:75px;overflow:auto;font-size:11px;white-space:pre-wrap;color:#67766f}</style><body><main class="card"><div class="sample">LOCAL PREVIEW · SAMPLE DATA</div><h1>${title}</h1><p>Connect to this Wi-Fi network and choose an internet package.</p>${settings?.show_packages_on_portal ? `<div class="plan"><strong>Sample daily access</strong>Illustrative package only · price from configured plan list</div>` : ""}<label>Username</label><input aria-label="Sample username" placeholder="Enter username"><label>Password or voucher</label><input aria-label="Sample password or voucher" placeholder="Enter password"><button type="button" disabled>Continue to configured hotspot flow</button><h2 style="font-size:14px;margin:18px 0 5px">Terms</h2><div class="terms">${escapeHtml(terms || "Terms have not been configured.")}</div><p class="sample">Preview only. Not deployed to a router.</p></main></body></html>`;
}

function table(columns, rows, empty = "No records were returned.") {
  if (!rows.length) return `<div class="workspace-empty">${escapeHtml(empty)}</div>`;
  return `<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${column.render ? column.render(row) : escapeHtml(row[column.key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function sectionHeading(title, detail) {
  return `<div class="workspace-section-heading"><div><span class="workspace-kicker">Live backend data</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div></div>`;
}

function tablePanel(title, detail, columns, rows, empty) {
  return `${sectionHeading(title, detail)}${table(columns, rows, empty)}`;
}

function chartPanel(title, rows, labelKey, valueKey) {
  if (!Array.isArray(rows) || !rows.length) {
    return `<article class="workspace-chart"><h3>${escapeHtml(title)}</h3><div class="workspace-empty">No chart data returned.</div></article>`;
  }
  const numeric = rows.map((row) => Number(row[valueKey]) || 0);
  const max = Math.max(...numeric, 1);
  return `<article class="workspace-chart"><h3>${escapeHtml(title)}</h3><div class="workspace-chart-bars" role="img" aria-label="${escapeHtml(title)}">
    ${rows.slice(-12).map((row) => {
      const value = Number(row[valueKey]) || 0;
      const height = Math.max(3, Math.round((value / max) * 100));
      const label = row[labelKey] ?? "";
      return `<div class="workspace-chart-column" title="${escapeHtml(`${label}: ${value}`)}"><span class="workspace-chart-value">${escapeHtml(value.toLocaleString())}</span><span class="workspace-chart-bar" style="height:${height}%"></span><span class="workspace-chart-label">${escapeHtml(String(label).slice(-5))}</span></div>`;
    }).join("")}
  </div></article>`;
}

function orgHeader(isOwner, organizations, selectedSlug) {
  if (!isOwner) return `<span class="workspace-tenant-name">Tenant-scoped workspace</span>`;
  return `<label class="workspace-org-picker">Organization<select id="workspace-org-select" aria-label="Choose an organization"><option value="">Select an ISP organization</option>${organizations.map((item) => `<option value="${escapeHtml(item.slug)}" ${item.slug === selectedSlug ? "selected" : ""}>${escapeHtml(item.name)} (${escapeHtml(item.slug)})</option>`).join("")}</select></label>`;
}

function workspaceMarkup(user, organizations, selectedSlug) {
  const role = roleOf(user);
  const isOwner = role === "platform_owner";
  const isAdmin = isOwner || role === "isp_admin";
  const customer = role === "customer";
  const tabsToShow = customer ? [] : tabs.filter(([id, , access]) =>
    access === "staff" ||
    (access === "platform" && isOwner) ||
    (access === "admin" && isAdmin) ||
    (access === "tenant-admin" && role === "isp_admin") ||
    (role === "isp_technician" && id === "overview")
  );
  const organization = organizations.find((item) => item.slug === selectedSlug);
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || user.email || "Operator";
  const nav = (group, entries) => entries.length ? `<div class="workspace-nav-group"><span>${group}</span>${entries.map(([id, label]) => `<button type="button" class="workspace-tab ${id === "overview" ? "active" : ""}" data-workspace-tab="${id}" aria-current="${id === "overview" ? "page" : "false"}"><i aria-hidden="true">${({ overview: "◈", organizations: "▦", leads: "◇", subscribers: "◎", plans: "◫", subscriptions: "↗", billing: "＄", routers: "⌁", portal: "◉", usage: "▥", vouchers: "▤", tickets: "◌", reports: "▧", staff: "⚙" })[id]}</i><span>${label}</span></button>`).join("")}</div>` : "";
  return `<div class="workspace-shell">
      <aside class="workspace-sidebar">
        <a class="workspace-brand" href="/app" aria-label="ISPFlow workspace"><span class="workspace-brand-mark">I</span><span>ispflow<small>NETWORK CONSOLE</small></span></a>
        <div class="workspace-tenant-chip"><span class="workspace-online-dot"></span><div><small>WORKSPACE</small><strong>${escapeHtml(organization?.name || (isOwner ? "Select organization" : "ISP Operations"))}</strong></div></div>
        <nav class="workspace-tabs" aria-label="Operator workspace">
          ${nav("OVERVIEW", tabsToShow.filter(([id]) => id === "overview"))}
          ${nav("PLATFORM", tabsToShow.filter(([id]) => id === "organizations"))}
          ${nav("CUSTOMERS", tabsToShow.filter(([id]) => ["leads", "subscribers", "plans", "subscriptions"].includes(id)))}
          ${nav("NETWORK", tabsToShow.filter(([id]) => ["routers", "portal", "usage", "vouchers"].includes(id)))}
          ${nav("OPERATIONS", tabsToShow.filter(([id]) => ["billing", "tickets", "reports", "staff"].includes(id)))}
        </nav>
        <div class="workspace-sidebar-bottom"><span class="workspace-avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</span><div class="workspace-user"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role.replaceAll("_", " ") || "user")}</small></div><button class="workspace-signout" id="logout-button" type="button" aria-label="Sign out">↗</button></div>
      </aside>
      <main class="workspace-main">
        <header class="workspace-toolbar">
          <div class="workspace-crumb"><span>ISPFlow</span><b>/</b><strong>${escapeHtml(tabs.find(([id]) => id === "overview")?.[1] || "Overview")}</strong></div>
          <div class="workspace-tools">${orgHeader(isOwner, organizations, selectedSlug)}<button class="workspace-refresh" id="workspace-refresh" type="button" aria-label="Refresh data">↻ <span>Refresh</span></button></div>
        </header>
        ${customer ? `<section class="workspace-panel"><h2>Customer self-service</h2><p>The operator workspace is not available to customer accounts. A complete customer portal UI is not included in this frontend yet.</p><a class="button button-light" href="/docs">Review available portal API documentation</a></section>` : `
        <div class="workspace-current-org">${organization ? `Connected to <strong>${escapeHtml(organization.name)}</strong><span class="workspace-connected">● Connected</span>` : isOwner ? "Select an organization to load its tenant-scoped data." : "Tenant-scoped workspace"}</div>
        <section class="workspace-welcome"><div><span class="workspace-kicker">NETWORK OVERVIEW</span><h1>Good to see you, ${escapeHtml(name.split(" ")[0])}</h1><p>Here is what's happening with your ISP today.</p></div><div class="workspace-welcome-date">${escapeHtml(new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }))}</div></section>
        <section class="workspace-panel" id="workspace-panel" aria-live="polite"><div class="workspace-loading">Loading live data from the backend…</div></section>`}
      </div>
    </div>`;
}

export async function mountWorkspace(holder, { user, token, api, apiBase }) {
  const role = roleOf(user);
  const isOwner = role === "platform_owner";
  const isAdmin = isOwner || role === "isp_admin";
  const state = {
    organizations: [],
    organizationError: null,
    selectedSlug: isOwner ? sessionStorage.getItem("ispflow.orgSlug") || "" : "",
    activeTab: "overview",
    planPage: 1,
    planSearch: "",
    subscriberPage: 1,
    subscriberSearch: "",
    editingCustomer: null,
    creatingInvoice: false,
    invoiceNotice: "",
    invoicePage: 1,
    invoiceSearch: "",
    paymentPage: 1,
    creatingSubscription: false,
    subscriptionNotice: "",
    ticketPage: 1,
    ticketSearch: "",
    ticketStatus: "",
    ticketPriority: "",
    creatingTicket: false,
    ticketNotice: "",
    organizationSearch: "",
    editingOrganization: null,
    organizationNotice: "",
    editingPortal: false,
    editingRouter: null,
    portalNotice: "",
    paymentChannels: [],
    creatingChannel: false,
    channelNotice: ""
  };

  const request = (path, options = {}) => {
    const apiPath = path.replace("/api/v1/support/tickets", "/api/v1/tickets");
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
    if (isOwner && state.selectedSlug) {
      const organization = state.organizations.find((item) => item.slug === state.selectedSlug);
      headers["X-Organization-Slug"] = state.selectedSlug;
      if (organization?.id) headers["X-Tenant-ID"] = String(organization.id);
    }
    return api(apiPath, { ...options, headers });
  };

  const signOut = async () => {
    const button = holder.querySelector("#logout-button");
    if (button) button.disabled = true;
    try { await request("/api/v1/auth/logout", { method: "POST" }); }
    catch { /* Local tokens are cleared even if this backend has no logout route. */ }
    sessionStorage.removeItem("ispflow.access");
    sessionStorage.removeItem("ispflow.refresh");
    sessionStorage.removeItem("ispflow.orgSlug");
    history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (isOwner) {
    try {
      const response = await request("/api/v1/platform/organizations/?page=1&page_size=100");
      state.organizations = listOf(response, "items");
      if (!state.organizations.some((item) => item.slug === state.selectedSlug)) {
        state.selectedSlug = "";
        sessionStorage.removeItem("ispflow.orgSlug");
      }
    } catch (error) {
      state.organizationError = error;
    }
  }

  holder.className = "workspace-content";
  holder.innerHTML = workspaceMarkup(user, state.organizations, state.selectedSlug);

  function renderError(title, error) {
    return `${sectionHeading(title, "The backend returned an error for this authorized view.")}<div class="workspace-error" role="alert"><strong>Could not load this view.</strong><p>${escapeHtml(error.message || String(error))}</p></div>`;
  }

  async function exportCsv(kind, button) {
    const paths = {
      subscriptions: "/api/v1/reports/export/subscriptions/csv",
      billing: "/api/v1/reports/export/billing/csv"
    };
    const headers = { Authorization: `Bearer ${token}` };
    if (isOwner && state.selectedSlug) {
      const organization = state.organizations.find((item) => item.slug === state.selectedSlug);
      headers["X-Organization-Slug"] = state.selectedSlug;
      if (organization?.id) headers["X-Tenant-ID"] = String(organization.id);
    }
    button.disabled = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${apiBase}${paths[kind]}`, { headers, signal: controller.signal });
      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try { detail = (await response.json()).detail || detail; } catch { /* Keep the HTTP status as the error. */ }
        throw new Error(detail);
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${kind}-report.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      const alert = document.createElement("div");
      alert.className = "workspace-error";
      alert.setAttribute("role", "alert");
      alert.textContent = error.name === "AbortError"
        ? `CSV export from ${apiBase} timed out after 15 seconds.`
        : error instanceof TypeError
          ? `Could not connect to ${apiBase} for the CSV export. Check the backend and CORS configuration.`
          : `Export failed: ${error.message || String(error)}`;
      holder.querySelector("#workspace-panel")?.prepend(alert);
    } finally {
      window.clearTimeout(timeout);
      button.disabled = false;
    }
  }

  async function loadSection() {
    const panel = holder.querySelector("#workspace-panel");
    if (!panel) return;
    if (isOwner && state.organizationError) {
      panel.innerHTML = renderError("Organization access", state.organizationError);
      return;
    }
    if (isOwner && !state.selectedSlug && state.activeTab !== "organizations") {
      panel.innerHTML = `<div class="workspace-empty"><h2>Select an ISP organization</h2><p>Choose an organization above. Tenant data is not loaded until an explicit organization is selected.</p>${state.organizations.length ? "" : "No organizations are available to this platform account."}</div>`;
      return;
    }
    panel.innerHTML = `<div class="workspace-loading" role="status">Loading live backend data…</div>`;
    try {
      if (state.activeTab === "overview") {
        if (role === "isp_technician") {
          const [routersResult, subscriptionsResult] = await Promise.all([
            request("/api/v1/routers/?page=1&size=100"),
            request("/api/v1/subscriptions/?page=1&size=100")
          ]);
          const routers = listOf(routersResult, "items");
          const subscriptions = listOf(subscriptionsResult, "subscriptions");
          panel.innerHTML = `${sectionHeading("Network operations", "Current router and subscription records. No router commands or live device queries are issued from this overview.")}<div class="workspace-metrics"><div class="workspace-metric"><span>Routers returned</span><strong>${routers.length}</strong></div><div class="workspace-metric"><span>Subscriptions returned</span><strong>${subscriptions.length}</strong></div><div class="workspace-metric"><span>Active in results</span><strong>${subscriptions.filter((item) => item.status === "active").length}</strong></div></div>${table([{ label: "Router", key: "name" }, { label: "Address", key: "ip_address" }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Last agent poll", render: (item) => dateCell(item.last_poll_at) }], routers.slice(0, 8))}`;
          return;
        }
        const results = await Promise.allSettled([
          request("/api/v1/reports/analytics/dashboard"),
          request("/api/v1/billing/invoices?page=1&size=5"),
          request("/api/v1/routers/?page=1&size=100"),
          request("/api/v1/reports/analytics/dashboard-charts"),
          request("/api/v1/billing/payments?page=1&size=5"),
          request("/api/v1/vouchers/?page=1&size=100")
        ]);
        const report = results[0].status === "fulfilled" ? payloadOf(results[0].value) : null;
        const invoices = results[1].status === "fulfilled" ? listOf(results[1].value, "invoices") : [];
        const routerList = results[2].status === "fulfilled" ? listOf(results[2].value, "items") : [];
        const charts = results[3].status === "fulfilled" ? payloadOf(results[3].value) : null;
        const payments = results[4].status === "fulfilled" ? listOf(results[4].value, "payments") : [];
        const vouchers = results[5].status === "fulfilled" ? listOf(results[5].value, "vouchers") : [];
        if (!report && !invoices.length && results[2].status === "rejected" && results[3].status === "rejected") throw results[0].status === "rejected" ? results[0].reason : results[2].reason;
        const subscriptions = report?.subscriptions || {};
        const billing = report?.billing || {};
        const routers = report?.routers || {};
        const voucherCounts = vouchers.reduce((counts, item) => {
          const key = String(item.status || "unknown").toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {});
        const chartRows = charts?.payments_chart || [];
        panel.innerHTML = `${results[0].status === "rejected" ? `<div class="workspace-error">Analytics unavailable: ${escapeHtml(results[0].reason.message || "request failed")}</div>` : ""}
          <div class="workspace-metrics workspace-metrics-modern">
            <div class="workspace-metric"><span>Active subscriptions</span><strong>${escapeHtml(subscriptions.active_subscriptions ?? "—")}</strong><small>From backend analytics</small></div>
            <div class="workspace-metric"><span>Revenue · 30d</span><strong>${amountCell(billing.total_revenue)}</strong><small>${escapeHtml(billing.paid_invoices ?? "—")} paid invoices</small></div>
            <div class="workspace-metric"><span>Routers online</span><strong>${escapeHtml(routers.online_routers ?? "—")}<small class="workspace-metric-total"> / ${escapeHtml(routers.total_routers ?? "—")}</small></strong><small>Reported router status</small></div>
            <div class="workspace-metric"><span>Voucher codes</span><strong>${vouchers.length || "—"}</strong><small>${escapeHtml(voucherCounts.active ?? 0)} active in returned records</small></div>
          </div>
          <div class="workspace-dashboard-grid">
            <section class="workspace-dashboard-card workspace-dashboard-wide"><div class="workspace-card-heading"><div><span class="workspace-kicker">FINANCIAL PERFORMANCE</span><h2>Monthly payments</h2></div><span class="workspace-source-label">Backend analytics</span></div>${charts ? chartPanel("Payments by month", chartRows, "month", "payments") : `<div class="workspace-error">Chart data unavailable: ${escapeHtml(results[3].status === "rejected" ? results[3].reason.message || "request failed" : "No chart series returned.")}</div>`}</section>
            <section class="workspace-dashboard-card"><div class="workspace-card-heading"><div><span class="workspace-kicker">NETWORK</span><h2>Router status</h2></div><button class="workspace-inline-link" data-workspace-tab="routers">View all</button></div>${results[2].status === "rejected" ? `<div class="workspace-error">${escapeHtml(results[2].reason.message || "Router data unavailable.")}</div>` : routerList.length ? `<div class="workspace-router-list">${routerList.slice(0, 5).map((item) => `<div class="workspace-router-row"><span class="workspace-router-icon">⌁</span><div><strong>${escapeHtml(item.name || "Router")}</strong><small>${escapeHtml(item.ip_address || "Address unavailable")}</small></div>${statusCell(item.status)}</div>`).join("")}</div>` : `<div class="workspace-empty">No router records were returned.</div>`}</section>
            <section class="workspace-dashboard-card"><div class="workspace-card-heading"><div><span class="workspace-kicker">SUBSCRIBERS</span><h2>Usage activity</h2></div><button class="workspace-inline-link" data-workspace-tab="usage">View details</button></div>${charts ? chartPanel("Daily usage (GB)", charts.data_usage_chart || [], "date", "pppoe") : `<div class="workspace-error">Usage chart unavailable.</div>`}<p class="workspace-chart-note">PPPoE series shown; usage is reported by the tenant analytics service.</p></section>
            <section class="workspace-dashboard-card workspace-dashboard-wide"><div class="workspace-card-heading"><div><span class="workspace-kicker">LATEST ACTIVITY</span><h2>Recent payments</h2></div><button class="workspace-inline-link" data-workspace-tab="billing">Open billing</button></div>${results[4].status === "rejected" ? `<div class="workspace-error">${escapeHtml(results[4].reason.message || "Payment data unavailable.")}</div>` : table([{ label: "Reference", key: "payment_number" }, { label: "Amount", render: (item) => amountCell(item.amount) }, { label: "Method", key: "payment_method" }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Date", render: (item) => dateCell(item.payment_date || item.created_at) }], payments, "No payment records were returned.")}</section>
            <section class="workspace-dashboard-card workspace-dashboard-wide"><div class="workspace-card-heading"><div><span class="workspace-kicker">BILLING</span><h2>Recent invoices</h2></div><button class="workspace-inline-link" data-workspace-tab="billing">Open billing</button></div>${results[1].status === "rejected" ? `<div class="workspace-error">${escapeHtml(results[1].reason.message || "Invoice data unavailable.")}</div>` : table([{ label: "Invoice", key: "invoice_number" }, { label: "Total", render: (item) => amountCell(item.total_amount) }, { label: "Balance", render: (item) => amountCell(item.balance) }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Due date", render: (item) => dateCell(item.due_date) }], invoices, "No invoice records were returned.")}</section>
          </div>`;
        panel.querySelectorAll("[data-workspace-tab]").forEach((button) => button.addEventListener("click", () => {
          state.activeTab = button.dataset.workspaceTab;
          holder.querySelectorAll(".workspace-tab").forEach((tab) => {
            const active = tab.dataset.workspaceTab === state.activeTab;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-current", String(active));
          });
          const crumb = holder.querySelector(".workspace-crumb strong");
          if (crumb) crumb.textContent = tabs.find(([id]) => id === state.activeTab)?.[1] || "Overview";
          loadSection();
        }));
        return;
      }

      if (state.activeTab === "leads") {
        const response = await request("/api/v1/leads/?page=1&size=100");
        panel.innerHTML = tablePanel("CRM leads", "Lead records returned by the tenant-scoped CRM API. Conversion and assignment remain controlled backend workflows.", [
          { label: "Lead", key: "name" }, { label: "Company", key: "company" }, { label: "Contact", key: "email" },
          { label: "Phone", key: "phone" }, { label: "Pipeline status", render: (item) => statusCell(item.status) },
          { label: "Source", key: "source" }, { label: "Created", render: (item) => dateCell(item.created_at) }
        ], listOf(response, "items"), "No CRM leads were returned.");
        return;
      }

      if (state.activeTab === "organizations") {
        const query = new URLSearchParams({ page: "1", page_size: "100" });
        if (state.organizationSearch) query.set("search", state.organizationSearch);
        const response = await request(`/api/v1/platform/organizations/?${query.toString()}`);
        const result = payloadOf(response);
        const organizations = listOf(response, "items");
        panel.innerHTML = `${sectionHeading("ISP organizations", "Platform-owner organization records from persistent storage. Creating an organization does not create or invite an identity-provider owner.")}<div class="workspace-list-toolbar"><form id="workspace-organization-search" class="workspace-search"><label class="visually-hidden" for="workspace-organization-search-input">Search organizations</label><input id="workspace-organization-search-input" name="search" type="search" maxlength="100" placeholder="Search name, slug or email" value="${escapeHtml(state.organizationSearch)}"><button class="workspace-secondary-button" type="submit">Search</button></form><button class="workspace-primary-button" type="button" id="workspace-organization-create">New organization</button></div>${state.organizationNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.organizationNotice)}</div>` : ""}${state.editingOrganization ? organizationFormMarkup(state.editingOrganization === "new" ? {} : state.editingOrganization) : ""}${table([
          { label: "Organization", key: "name" },
          { label: "Slug", key: "slug" },
          { label: "Type", render: (item) => statusCell(item.organization_type) },
          { label: "Status", render: (item) => statusCell(item.status) },
          { label: "Contact", key: "email" },
          { label: "Created", render: (item) => dateCell(item.created_at) },
          { label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-organization-edit="${escapeHtml(item.id)}">Edit</button><button type="button" class="workspace-row-action" data-organization-status="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}">${item.status === "suspended" ? "Reactivate" : "Suspend"}</button>` }
        ], organizations, "No ISP organizations matched this search.")}<div class="workspace-pagination"><span>${escapeHtml(result.total ?? organizations.length)} organizations</span><span>Page ${escapeHtml(result.page ?? 1)} of ${escapeHtml(result.pages ?? 1)}</span></div>`;
        panel.querySelector("#workspace-organization-search")?.addEventListener("submit", (event) => {
          event.preventDefault();
          state.organizationSearch = String(new FormData(event.currentTarget).get("search") || "").trim();
          state.editingOrganization = null;
          loadSection();
        });
        panel.querySelector("#workspace-organization-create")?.addEventListener("click", () => {
          state.editingOrganization = "new";
          loadSection();
        });
        panel.querySelectorAll("[data-organization-edit]").forEach((button) => button.addEventListener("click", () => {
          state.editingOrganization = organizations.find((item) => String(item.id) === button.dataset.organizationEdit) || null;
          loadSection();
        }));
        panel.querySelectorAll("[data-organization-status]").forEach((button) => button.addEventListener("click", async () => {
          const isSuspended = button.dataset.status === "suspended";
          const action = isSuspended ? "reactivate" : "suspend";
          if (!window.confirm(`${isSuspended ? "Reactivate" : "Suspend"} this organization?`)) return;
          button.disabled = true;
          try {
            await request(`/api/v1/platform/organizations/${encodeURIComponent(button.dataset.organizationStatus)}/${action}`, { method: "POST" });
            state.organizationNotice = `Organization ${isSuspended ? "reactivated" : "suspended"}.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            state.organizationNotice = "";
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Organization status update failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-organization-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.editingOrganization = null;
          loadSection();
        }));
        panel.querySelector("#workspace-organization-form")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(form).entries());
          for (const key of ["trial_days", "max_routers", "max_customers", "max_users"]) {
            if (key in values) values[key] = Number(values[key]);
          }
          submit.disabled = true;
          submit.textContent = "Saving…";
          feedback.hidden = true;
          try {
            const editing = state.editingOrganization && state.editingOrganization !== "new";
            const id = editing ? state.editingOrganization.id : null;
            await request(editing ? `/api/v1/platform/organizations/${encodeURIComponent(id)}` : "/api/v1/platform/organizations/", {
              method: editing ? "PATCH" : "POST",
              body: JSON.stringify(values)
            });
            state.editingOrganization = null;
            state.organizationNotice = editing ? "Organization updated." : "Organization created.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = state.editingOrganization && state.editingOrganization !== "new" ? "Save organization" : "Create organization";
          }
        });
        return;
      }

      if (state.activeTab === "subscribers") {
        const query = new URLSearchParams({ page: String(state.subscriberPage), size: "20" });
        if (state.subscriberSearch) query.set("search", state.subscriberSearch);
        if (isOwner && state.selectedSlug) {
          const organization = state.organizations.find((item) => item.slug === state.selectedSlug);
          if (organization?.id) query.set("organization_id", String(organization.id));
        }
        const response = await request(`/api/v1/users/customers/?${query.toString()}`);
        const result = payloadOf(response);
        const users = listOf(response, "users");
        const pages = Number(result.pages || 1);
        panel.innerHTML = `${sectionHeading("Subscribers", "Customer records from the tenant-scoped customer API. New accounts are created pending contact verification; this form does not send credentials.")}<div class="workspace-list-toolbar"><form id="workspace-subscriber-search" class="workspace-search"><label class="visually-hidden" for="workspace-subscriber-search-input">Search subscribers</label><input id="workspace-subscriber-search-input" name="search" type="search" maxlength="100" placeholder="Search name, username or email" value="${escapeHtml(state.subscriberSearch)}"><button class="workspace-secondary-button" type="submit">Search</button></form>${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-customer-create">New subscriber</button>` : ""}</div>${state.subscriberNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.subscriberNotice)}</div>` : ""}${isAdmin && state.editingCustomer ? customerFormMarkup(state.editingCustomer === "new" ? null : state.editingCustomer) : ""}${table([{ label: "Name", render: (item) => escapeHtml(item.full_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.username) },
          { label: "Username", key: "username" }, { label: "Email", key: "email" }, { label: "Phone", key: "phone" },
          { label: "Status", render: (item) => statusCell(item.status || (item.is_active ? "active" : "inactive")) },
          { label: "Created", render: (item) => dateCell(item.created_at) },
          ...(isAdmin ? [{ label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-customer-edit="${escapeHtml(item.id)}">Edit</button><button type="button" class="workspace-row-action workspace-row-danger" data-customer-delete="${escapeHtml(item.id)}">Deactivate</button>` }] : [])
        ], users, "No subscriber records matched this search.")}
        <div class="workspace-pagination"><span>Page ${escapeHtml(result.page ?? state.subscriberPage)} of ${escapeHtml(pages)} · ${escapeHtml(result.total ?? users.length)} subscribers</span><div><button type="button" class="workspace-secondary-button" data-subscriber-page="${Math.max(1, state.subscriberPage - 1)}" ${state.subscriberPage <= 1 ? "disabled" : ""}>Previous</button><button type="button" class="workspace-secondary-button" data-subscriber-page="${Math.min(pages, state.subscriberPage + 1)}" ${state.subscriberPage >= pages ? "disabled" : ""}>Next</button></div></div>`;
        panel.querySelector("#workspace-subscriber-search")?.addEventListener("submit", (event) => {
          event.preventDefault();
          state.subscriberSearch = String(new FormData(event.currentTarget).get("search") || "").trim();
          state.subscriberPage = 1;
          state.editingCustomer = null;
          state.subscriberNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-subscriber-page]").forEach((button) => button.addEventListener("click", () => {
          state.subscriberPage = Number(button.dataset.subscriberPage);
          state.editingCustomer = null;
          loadSection();
        }));
        panel.querySelector("#workspace-customer-create")?.addEventListener("click", () => {
          state.editingCustomer = "new";
          state.subscriberNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-customer-edit]").forEach((button) => button.addEventListener("click", () => {
          state.editingCustomer = users.find((item) => String(item.id) === button.dataset.customerEdit) || null;
          state.subscriberNotice = "";
          loadSection();
        }));
        panel.querySelectorAll("[data-customer-delete]").forEach((button) => button.addEventListener("click", async () => {
          if (!window.confirm("Deactivate this customer account? Its record and billing history will be retained.")) return;
          button.disabled = true;
          try {
            await request(`/api/v1/users/${encodeURIComponent(button.dataset.customerDelete)}`, { method: "DELETE" });
            state.subscriberNotice = "Customer account deactivated. Existing records were retained.";
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Customer could not be deactivated: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        const customerForm = panel.querySelector("#workspace-customer-form");
        customerForm?.querySelectorAll("[data-customer-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.editingCustomer = null;
          loadSection();
        }));
        customerForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = customerForm.querySelector('button[type="submit"]');
          const feedback = customerForm.querySelector(".workspace-form-feedback");
          const data = new FormData(customerForm);
          const body = Object.fromEntries(data.entries());
          if (body.phone) body.phone = String(body.phone).trim();
          else body.phone = null;
          for (const field of ["first_name", "last_name", "username", "email"]) {
            if (body[field]) body[field] = String(body[field]).trim();
          }
          submit.disabled = true;
          submit.textContent = "Saving…";
          feedback.hidden = true;
          try {
            if (state.editingCustomer === "new") {
              await request("/api/v1/users/customers/", { method: "POST", body: JSON.stringify(body) });
              state.subscriberNotice = "Subscriber record created with contact verification pending. Configure a delivery integration before sharing sign-in credentials.";
            } else {
              const update = {
                first_name: body.first_name,
                last_name: body.last_name,
                phone: body.phone,
                bio: body.bio || null
              };
              await request(`/api/v1/users/${encodeURIComponent(state.editingCustomer.id)}`, { method: "PATCH", body: JSON.stringify(update) });
              state.subscriberNotice = "Subscriber details saved.";
            }
            state.editingCustomer = null;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = state.editingCustomer === "new" ? "Create subscriber" : "Save changes";
          }
        });
        return;
      }

      if (state.activeTab === "plans") {
        const query = new URLSearchParams({ page: String(state.planPage), size: "20" });
        if (state.planSearch) query.set("search", state.planSearch);
        const response = await request(`/api/v1/plans/?${query.toString()}`);
        const result = payloadOf(response);
        const plans = listOf(response, "plans");
        const pages = Number(result.pages || 1);
        panel.innerHTML = `${sectionHeading("Internet packages", "Search and manage packages in this tenant. Network speed values are shown as stored; verify the router’s configured units before provisioning.")}<div class="workspace-list-toolbar"><form id="workspace-plan-search" class="workspace-search"><label class="visually-hidden" for="workspace-plan-search-input">Search packages</label><input id="workspace-plan-search-input" name="search" type="search" maxlength="100" placeholder="Search packages" value="${escapeHtml(state.planSearch)}"><button class="workspace-secondary-button" type="submit">Search</button></form>${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-plan-create">New package</button>` : ""}</div>${isAdmin && state.editingPlan ? planFormMarkup(state.editingPlan) : ""}${table([{ label: "Package", key: "name" }, { label: "Access type", render: (item) => statusCell(item.plan_type) },
          { label: "Price", render: (item) => `${escapeHtml(item.currency || "KES")} ${amountCell(item.price)}` }, { label: "Billing cycle", key: "billing_cycle" },
          { label: "Download / upload", render: (item) => escapeHtml(`${item.download_speed ?? "—"} / ${item.upload_speed ?? "—"} Kbps`) },
          { label: "Status", render: (item) => statusCell(item.status) },
          ...(isAdmin ? [{ label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-plan-edit="${escapeHtml(item.id)}">Edit</button><button type="button" class="workspace-row-action" data-plan-status="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}">${String(item.status).toLowerCase() === "active" ? "Disable" : "Enable"}</button>` }] : [])
        ], plans, "No packages matched this search.")}
        <div class="workspace-pagination"><span>Page ${escapeHtml(result.page ?? state.planPage)} of ${escapeHtml(pages)} · ${escapeHtml(result.total ?? plans.length)} packages</span><div><button type="button" class="workspace-secondary-button" data-plan-page="${Math.max(1, state.planPage - 1)}" ${state.planPage <= 1 ? "disabled" : ""}>Previous</button><button type="button" class="workspace-secondary-button" data-plan-page="${Math.min(pages, state.planPage + 1)}" ${state.planPage >= pages ? "disabled" : ""}>Next</button></div></div>`;
        const searchForm = panel.querySelector("#workspace-plan-search");
        searchForm?.addEventListener("submit", (event) => {
          event.preventDefault();
          state.planSearch = String(new FormData(searchForm).get("search") || "").trim();
          state.planPage = 1;
          state.editingPlan = null;
          loadSection();
        });
        panel.querySelectorAll("[data-plan-page]").forEach((button) => button.addEventListener("click", () => {
          state.planPage = Number(button.dataset.planPage);
          state.editingPlan = null;
          loadSection();
        }));
        panel.querySelector("#workspace-plan-create")?.addEventListener("click", () => {
          state.editingPlan = {};
          loadSection();
        });
        panel.querySelectorAll("[data-plan-edit]").forEach((button) => button.addEventListener("click", () => {
          state.editingPlan = plans.find((item) => String(item.id) === button.dataset.planEdit) || null;
          loadSection();
        }));
        panel.querySelectorAll("[data-plan-status]").forEach((button) => button.addEventListener("click", async () => {
          const isActive = String(button.dataset.status).toLowerCase() === "active";
          const action = isActive ? "deactivate" : "activate";
          if (!window.confirm(`${isActive ? "Disable" : "Enable"} this package?`)) return;
          button.disabled = true;
          try {
            await request(`/api/v1/plans/${encodeURIComponent(button.dataset.planStatus)}/${action}`, { method: "PATCH" });
            state.editingPlan = null;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Package status could not be changed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        const planForm = panel.querySelector("#workspace-plan-form");
        planForm?.querySelectorAll("[data-plan-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.editingPlan = null;
          loadSection();
        }));
        planForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = planForm.querySelector('button[type="submit"]');
          const feedback = planForm.querySelector(".workspace-form-feedback");
          const data = new FormData(planForm);
          const body = Object.fromEntries(data.entries());
          for (const field of ["price"]) body[field] = Number(body[field]);
          for (const field of ["download_speed", "upload_speed", "validity_days", "data_limit"]) body[field] = Number(body[field] || -1);
          for (const field of ["duration_minutes", "fup_threshold", "fup_download_speed", "fup_upload_speed"]) {
            body[field] = body[field] === "" ? null : Number(body[field]);
          }
          body.fup_enabled = body.fup_enabled === "true";
          body.currency = String(body.currency).trim().toUpperCase();
          body.name = String(body.name).trim();
          body.description = String(body.description).trim() || null;
          submit.disabled = true;
          submit.textContent = "Saving…";
          feedback.hidden = true;
          try {
            if (state.editingPlan?.id) {
              await request(`/api/v1/plans/${encodeURIComponent(state.editingPlan.id)}`, { method: "PATCH", body: JSON.stringify(body) });
            } else {
              await request("/api/v1/plans/", { method: "POST", body: JSON.stringify(body) });
            }
            state.editingPlan = null;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = state.editingPlan?.id ? "Save changes" : "Create package";
          }
        });
        return;
      }

      if (state.activeTab === "subscriptions") {
        const [subscriptionResult, formDataResult] = await Promise.all([
          request("/api/v1/subscriptions/?page=1&size=100"),
          state.creatingSubscription
            ? Promise.all([
                request("/api/v1/users/customers/?page=1&size=100"),
                request("/api/v1/plans/?page=1&size=100"),
                request("/api/v1/routers/?page=1&size=100")
              ])
            : Promise.resolve(null)
        ]);
        const subscriptions = listOf(subscriptionResult, "subscriptions");
        const customers = formDataResult ? listOf(formDataResult[0], "users") : [];
        const plans = formDataResult ? listOf(formDataResult[1], "plans") : [];
        const routers = formDataResult ? listOf(formDataResult[2], "items") : [];
        panel.innerHTML = `${sectionHeading("Subscriptions & access types", "Assignments are persisted as pending. Activation is a separate, service-impacting operation and is deliberately not performed here.")}<div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-subscription-create">Assign package</button>` : ""}</div>${state.subscriptionNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.subscriptionNotice)}</div>` : ""}${isAdmin && state.creatingSubscription ? subscriptionFormMarkup(customers, plans, routers) : ""}${table([
          { label: "Username", key: "username" }, { label: "Package", key: "plan_name" }, { label: "Router", key: "router_name" },
          { label: "Access type", key: "subscription_type" }, { label: "Status", render: (item) => statusCell(item.status) },
          { label: "Router synced", render: (item) => item.is_router_synced ? "Yes" : "No" },
          { label: "Ends", render: (item) => dateCell(item.end_date) }
        ], subscriptions, "No subscriptions were returned.")}`;
        panel.querySelector("#workspace-subscription-create")?.addEventListener("click", () => {
          state.creatingSubscription = true;
          loadSection();
        });
        panel.querySelectorAll("[data-subscription-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingSubscription = false;
          loadSection();
        }));
        panel.querySelector("#workspace-subscription-form")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const body = Object.fromEntries(new FormData(form).entries());
          body.user_id = Number(body.user_id);
          body.plan_id = Number(body.plan_id);
          body.router_id = Number(body.router_id);
          body.is_auto_renewal = body.is_auto_renewal === "true";
          body.start_date = new Date(body.start_date).toISOString();
          body.end_date = new Date(body.end_date).toISOString();
          submit.disabled = true;
          submit.textContent = "Saving pending subscription…";
          feedback.hidden = true;
          try {
            await request("/api/v1/subscriptions/", { method: "POST", body: JSON.stringify(body) });
            state.creatingSubscription = false;
            state.subscriptionNotice = "Pending subscription created. No router activation was performed.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = "Create pending subscription";
          }
        });
        return;
      }

      if (state.activeTab === "billing") {
        const invoiceQuery = new URLSearchParams({ page: String(state.invoicePage), size: "20" });
        if (state.invoiceSearch) invoiceQuery.set("search", state.invoiceSearch);
        const paymentQuery = new URLSearchParams({ page: String(state.paymentPage), size: "20" });
        const results = await Promise.allSettled([
          request(`/api/v1/billing/invoices?${invoiceQuery.toString()}`),
          request(`/api/v1/billing/payments?${paymentQuery.toString()}`),
          state.creatingInvoice ? (async () => {
            const customerQuery = new URLSearchParams({ page: "1", size: "100" });
            if (isOwner && state.selectedSlug) {
              const organization = state.organizations.find((item) => item.slug === state.selectedSlug);
              if (organization?.id) customerQuery.set("organization_id", String(organization.id));
            }
            return request(`/api/v1/users/customers/?${customerQuery.toString()}`);
          })() : Promise.resolve(null)
        ]);
        if (results.every((item) => item.status === "rejected")) throw results[0].reason;
        const invoices = results[0].status === "fulfilled" ? listOf(results[0].value, "invoices") : [];
        const payments = results[1].status === "fulfilled" ? listOf(results[1].value, "payments") : [];
        const invoiceResult = results[0].status === "fulfilled" ? payloadOf(results[0].value) : {};
        const paymentResult = results[1].status === "fulfilled" ? payloadOf(results[1].value) : {};
        const customers = results[2].status === "fulfilled" ? listOf(results[2].value, "users") : [];
        panel.innerHTML = `${sectionHeading("Billing & payment history", "Create tenant invoices and review payment records. This dashboard does not initiate provider payments or mark invoices paid.")}<div class="workspace-list-toolbar"><form id="workspace-invoice-search" class="workspace-search"><label class="visually-hidden" for="workspace-invoice-search-input">Search invoices</label><input id="workspace-invoice-search-input" name="search" type="search" maxlength="100" placeholder="Search invoices" value="${escapeHtml(state.invoiceSearch)}"><button class="workspace-secondary-button" type="submit">Search</button></form>${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-invoice-create">New invoice</button>` : ""}</div>${state.invoiceNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.invoiceNotice)}</div>` : ""}${state.creatingInvoice ? results[2].status === "rejected" ? `<div class="workspace-error">Customer list unavailable: ${escapeHtml(results[2].reason.message || "request failed")}</div>` : invoiceFormMarkup(customers) : ""}<h3>Invoices</h3>${results[0].status === "rejected" ? `<div class="workspace-error">${escapeHtml(results[0].reason.message || "Invoice records unavailable.")}</div>` : table([{ label: "Invoice", key: "invoice_number" }, { label: "Total", render: (item) => amountCell(item.total_amount) }, { label: "Paid", render: (item) => amountCell(item.paid_amount) }, { label: "Balance", render: (item) => amountCell(item.balance) }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Due", render: (item) => dateCell(item.due_date) }], invoices, "No invoice records matched this search.")}<div class="workspace-pagination"><span>Page ${escapeHtml(invoiceResult.page ?? state.invoicePage)} of ${escapeHtml(invoiceResult.pages ?? 1)} · ${escapeHtml(invoiceResult.total ?? invoices.length)} invoices</span><div><button type="button" class="workspace-secondary-button" data-invoice-page="${Math.max(1, state.invoicePage - 1)}" ${state.invoicePage <= 1 ? "disabled" : ""}>Previous</button><button type="button" class="workspace-secondary-button" data-invoice-page="${Math.min(Number(invoiceResult.pages || 1), state.invoicePage + 1)}" ${state.invoicePage >= Number(invoiceResult.pages || 1) ? "disabled" : ""}>Next</button></div></div><h3 class="workspace-subheading">Payments</h3>${results[1].status === "rejected" ? `<div class="workspace-error">${escapeHtml(results[1].reason.message || "Payment records unavailable.")}</div>` : table([{ label: "Payment", key: "payment_number" }, { label: "Amount", render: (item) => amountCell(item.amount) }, { label: "Method", key: "payment_method" }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Date", render: (item) => dateCell(item.payment_date || item.created_at) }], payments, "No payment records were returned.")}<div class="workspace-pagination"><span>Page ${escapeHtml(paymentResult.page ?? state.paymentPage)} of ${escapeHtml(paymentResult.pages ?? 1)} · ${escapeHtml(paymentResult.total ?? payments.length)} payments</span><div><button type="button" class="workspace-secondary-button" data-payment-page="${Math.max(1, state.paymentPage - 1)}" ${state.paymentPage <= 1 ? "disabled" : ""}>Previous</button><button type="button" class="workspace-secondary-button" data-payment-page="${Math.min(Number(paymentResult.pages || 1), state.paymentPage + 1)}" ${state.paymentPage >= Number(paymentResult.pages || 1) ? "disabled" : ""}>Next</button></div></div>`;
        panel.querySelector("#workspace-invoice-search")?.addEventListener("submit", (event) => {
          event.preventDefault();
          state.invoiceSearch = String(new FormData(event.currentTarget).get("search") || "").trim();
          state.invoicePage = 1;
          loadSection();
        });
        panel.querySelectorAll("[data-invoice-page]").forEach((button) => button.addEventListener("click", () => {
          state.invoicePage = Number(button.dataset.invoicePage);
          loadSection();
        }));
        panel.querySelectorAll("[data-payment-page]").forEach((button) => button.addEventListener("click", () => {
          state.paymentPage = Number(button.dataset.paymentPage);
          loadSection();
        }));
        panel.querySelector("#workspace-channel-create")?.addEventListener("click", () => {
          state.creatingChannel = true;
          state.channelNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-channel-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingChannel = false;
          loadSection();
        }));
        const channelForm = panel.querySelector("#workspace-channel-form");
        channelForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = channelForm.querySelector('button[type="submit"]');
          const feedback = channelForm.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(channelForm).entries());
          if (submit) submit.disabled = true;
          if (feedback) { feedback.hidden = true; feedback.textContent = ""; }
          try {
            await request("/api/v1/payhero/channels", { method: "POST", body: JSON.stringify(values) });
            state.creatingChannel = false;
            state.channelNotice = "Payment channel registered with PayHero.";
            await loadSection();
          } catch (error) {
            if (feedback) { feedback.hidden = false; feedback.textContent = error.message || "Channel registration failed."; }
          } finally {
            if (submit) submit.disabled = false;
          }
        });
        panel.querySelector("#workspace-invoice-create")?.addEventListener("click", () => {
          state.creatingInvoice = true;
          state.invoiceNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-invoice-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingInvoice = false;
          loadSection();
        }));
        const invoiceForm = panel.querySelector("#workspace-invoice-form");
        invoiceForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = invoiceForm.querySelector('button[type="submit"]');
          const feedback = invoiceForm.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(invoiceForm).entries());
          const body = {
            user_id: Number(values.user_id),
            subtotal: Number(values.subtotal),
            tax_amount: Number(values.tax_amount || 0),
            discount_amount: Number(values.discount_amount || 0),
            notes: String(values.notes || "").trim() || null
          };
          for (const field of ["billing_period_start", "billing_period_end"]) {
            if (values[field]) body[field] = new Date(`${values[field]}T00:00:00`).toISOString();
          }
          submit.disabled = true;
          submit.textContent = "Creating…";
          feedback.hidden = true;
          try {
            await request("/api/v1/billing/invoices", { method: "POST", body: JSON.stringify(body) });
            state.creatingInvoice = false;
            state.invoiceNotice = "Invoice created. Payment remains a separate verified workflow.";
            state.invoicePage = 1;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = "Create invoice";
          }
        });
        return;
      }

      if (state.activeTab === "routers") {
        const response = await request("/api/v1/routers/?page=1&size=100");
        const routers = listOf(response, "items");
        panel.innerHTML = `${sectionHeading("Router inventory", "Add and edit router metadata. Connection status is shown only from stored API or polling-agent evidence; this screen never executes RouterOS commands.")}<div class="workspace-list-toolbar"><span class="workspace-note">Router credentials remain server-side and are never displayed.</span>${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-router-create">Add router</button>` : ""}</div>${state.editingRouter ? routerFormMarkup(state.editingRouter === "new" ? {} : state.editingRouter) : ""}${table([
          { label: "Router", key: "name" },
          { label: "Address", key: "ip_address" },
          { label: "Type", render: (item) => statusCell(item.router_type) },
          { label: "Status", render: (item) => statusCell(item.status) },
          { label: "Last seen / poll", render: (item) => dateCell(item.last_poll_at || item.last_seen) },
          { label: "Provisioning", render: (item) => statusCell(item.provisioning_status) },
          ...(isAdmin ? [{ label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-router-edit="${escapeHtml(item.id)}">Edit</button>` }] : [])
        ], routers, "No routers were returned.")}`;
        panel.querySelector("#workspace-router-create")?.addEventListener("click", () => {
          state.editingRouter = "new";
          loadSection();
        });
        panel.querySelectorAll("[data-router-edit]").forEach((button) => button.addEventListener("click", () => {
          state.editingRouter = routers.find((item) => String(item.id) === button.dataset.routerEdit) || null;
          loadSection();
        }));
        panel.querySelectorAll("[data-router-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.editingRouter = null;
          loadSection();
        }));
        panel.querySelector("#workspace-router-form")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const body = Object.fromEntries(new FormData(form).entries());
          body.port = Number(body.port);
          submit.disabled = true;
          submit.textContent = "Saving…";
          feedback.hidden = true;
          try {
            const editing = state.editingRouter && state.editingRouter !== "new";
            const id = editing ? state.editingRouter.id : null;
            await request(editing ? `/api/v1/routers/${encodeURIComponent(id)}` : "/api/v1/routers/", {
              method: editing ? "PATCH" : "POST",
              body: JSON.stringify(body)
            });
            state.editingRouter = null;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = state.editingRouter && state.editingRouter !== "new" ? "Save router" : "Add router";
          }
        });
        return;
      }

      if (state.activeTab === "portal") {
        const results = await Promise.allSettled([
          request("/api/v1/tenant/settings/hotspot"),
          request("/api/v1/tenant/settings/business"),
          request("/api/v1/tenant/settings/organization")
        ]);
        const failed = results.find((result) => result.status === "rejected");
        if (failed) throw failed.reason;
        const hotspot = payloadOf(results[0].value);
        const business = payloadOf(results[1].value);
        const organization = payloadOf(results[2].value);
        panel.innerHTML = `${sectionHeading("Captive portal settings", "These controls persist tenant hotspot settings used by backend portal/provisioning flows. Branding is read-only here because the identity service owns it; saving does not upload files to a router.")}${state.portalNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.portalNotice)}</div>` : ""}<form class="workspace-form" id="workspace-portal-form">
          <div class="workspace-form-grid">
            <label>Portal template<select name="hotspot_template"><option value="Aurora" ${hotspot.hotspot_template === "Aurora" ? "selected" : ""}>Aurora (configured default)</option><option value="modern" ${hotspot.hotspot_template === "modern" ? "selected" : ""}>Modern handoff</option></select><small>Template rendering/deployment must be verified on a lab router.</small></label>
            <label>After-login redirect URL<input name="redirect_url" type="url" maxlength="500" value="${escapeHtml(hotspot.redirect_url || "")}"></label>
            <label>Voucher format<input name="voucher_format" maxlength="50" value="${escapeHtml(hotspot.voucher_format || "XXXX-XXXX")}"></label>
            <label>Voucher length<input name="voucher_length" type="number" min="4" max="20" value="${escapeHtml(hotspot.voucher_length ?? 8)}"></label>
            <label>Session timeout (minutes)<input name="session_timeout_minutes" type="number" min="1" max="1440" value="${escapeHtml(hotspot.session_timeout_minutes ?? 60)}"></label>
            <label>Show packages on portal<select name="show_packages_on_portal"><option value="true" ${hotspot.show_packages_on_portal ? "selected" : ""}>Yes</option><option value="false" ${!hotspot.show_packages_on_portal ? "selected" : ""}>No</option></select></label>
            <label>Allow guest purchases<select name="allow_guest_purchases"><option value="true" ${hotspot.allow_guest_purchases ? "selected" : ""}>Yes</option><option value="false" ${!hotspot.allow_guest_purchases ? "selected" : ""}>No</option></select></label>
            <label>Username prefix<input name="username_prefix" minlength="1" maxlength="10" value="${escapeHtml(hotspot.username_prefix || "C")}"></label>
            <label class="workspace-form-wide">Terms shown in local preview<textarea name="terms_and_conditions" maxlength="10000" rows="5">${escapeHtml(business.terms_and_conditions || "")}</textarea></label>
          </div>
          <div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Save portal settings</button><button class="workspace-secondary-button" type="button" id="workspace-portal-preview">Refresh preview</button><button class="workspace-secondary-button" type="button" id="workspace-portal-mobile">Mobile preview</button></div>
        </form><div class="workspace-portal-preview-wrap"><div class="workspace-card-heading"><div><span class="workspace-kicker">LOCAL SAMPLE</span><h2>Portal preview</h2></div><span class="workspace-status">Not deployed</span></div><iframe class="workspace-portal-preview" id="workspace-portal-preview-frame" title="Captive portal sample preview" sandbox></iframe><p class="workspace-note">Preview uses sample content and the currently stored organization name/color. Payment and hotspot authentication are not simulated here.</p></div>`;
        const form = panel.querySelector("#workspace-portal-form");
        const frame = panel.querySelector("#workspace-portal-preview-frame");
        const refreshPreview = () => {
          const data = Object.fromEntries(new FormData(form).entries());
          frame.srcdoc = portalPreviewDocument(organization, {
            show_packages_on_portal: data.show_packages_on_portal === "true"
          }, data.terms_and_conditions);
        };
        refreshPreview();
        panel.querySelector("#workspace-portal-preview")?.addEventListener("click", refreshPreview);
        panel.querySelector("#workspace-portal-mobile")?.addEventListener("click", () => {
          frame.classList.toggle("workspace-portal-mobile");
        });
        form.addEventListener("input", refreshPreview);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(form).entries());
          const boolValue = (value) => value === "true";
          const hotspotBody = {
            hotspot_template: values.hotspot_template,
            redirect_url: values.redirect_url || "",
            voucher_format: values.voucher_format,
            voucher_length: Number(values.voucher_length),
            session_timeout_minutes: Number(values.session_timeout_minutes),
            show_packages_on_portal: boolValue(values.show_packages_on_portal),
            allow_guest_purchases: boolValue(values.allow_guest_purchases),
            username_prefix: values.username_prefix
          };
          submit.disabled = true;
          submit.textContent = "Saving…";
          feedback.hidden = true;
          const [hotspotSave, termsSave] = await Promise.allSettled([
            request("/api/v1/tenant/settings/hotspot", { method: "PATCH", body: JSON.stringify(hotspotBody) }),
            request("/api/v1/tenant/settings/business", { method: "PATCH", body: JSON.stringify({ terms_and_conditions: values.terms_and_conditions }) })
          ]);
          if (hotspotSave.status === "fulfilled" && termsSave.status === "fulfilled") {
            state.portalNotice = "Portal settings saved to the tenant database. Router deployment has not been performed.";
            await loadSection();
            return;
          }
          const messages = [];
          if (hotspotSave.status === "rejected") messages.push(`Hotspot settings: ${hotspotSave.reason.message || String(hotspotSave.reason)}`);
          else messages.push("Hotspot settings were saved.");
          if (termsSave.status === "rejected") messages.push(`Terms: ${termsSave.reason.message || String(termsSave.reason)}`);
          else messages.push("Terms were saved.");
          feedback.textContent = messages.join(" ");
          feedback.hidden = false;
          submit.disabled = false;
          submit.textContent = "Save portal settings";
          refreshPreview();
        });
        return;
      }

      if (state.activeTab === "usage") {
        const response = await request("/api/v1/reports/analytics/dashboard-charts");
        const charts = payloadOf(response);
        const usage = Array.isArray(charts.data_usage_chart) ? charts.data_usage_chart : [];
        const active = Array.isArray(charts.active_users_chart) ? charts.active_users_chart : [];
        panel.innerHTML = `${sectionHeading("Usage & subscriber activity", "Aggregated activity from the analytics API. This view does not query or change live routers.")}<div class="workspace-dashboard-grid">
          <section class="workspace-dashboard-card"><div class="workspace-card-heading"><div><span class="workspace-kicker">LAST 14 DAYS</span><h2>PPPoE data usage (GB)</h2></div></div>${chartPanel("Daily usage", usage, "date", "pppoe")}</section>
          <section class="workspace-dashboard-card"><div class="workspace-card-heading"><div><span class="workspace-kicker">LAST 7 DAYS</span><h2>Active PPPoE activity</h2></div></div>${chartPanel("Active PPPoE users", active, "day", "pppoe")}</section>
        </div><p class="workspace-note">These are backend aggregates, not a live session list. The configured router-agent reports and collection schedules determine freshness.</p>`;
        return;
      }

      if (state.activeTab === "vouchers") {
        const response = await request("/api/v1/vouchers/?page=1&size=100");
        panel.innerHTML = tablePanel("Voucher inventory", "Voucher access codes are masked. This dashboard does not create, redeem or disable vouchers.", [
          { label: "Voucher", render: (item) => escapeHtml(item.code ? `****${String(item.code).slice(-4)}` : "—") },
          { label: "Package", key: "plan_name" }, { label: "Status", render: (item) => statusCell(item.status) },
          { label: "Bandwidth", key: "bandwidth_limit" }, { label: "Used", render: (item) => dateCell(item.used_at) },
          { label: "Expires", render: (item) => dateCell(item.expires_at) }
        ], listOf(response, "vouchers"), "No vouchers were returned.");
        return;
      }

      if (state.activeTab === "tickets") {
        const query = new URLSearchParams({ page: String(state.ticketPage), size: "20" });
        if (state.ticketSearch) query.set("search", state.ticketSearch);
        if (state.ticketStatus) query.set("status", state.ticketStatus);
        if (state.ticketPriority) query.set("priority", state.ticketPriority);
        const results = await Promise.allSettled([
          request(`/api/v1/support/tickets/?${query.toString()}`),
          state.creatingTicket || isAdmin ? (async () => {
            const customerQuery = new URLSearchParams({ page: "1", size: "100" });
            if (isOwner && state.selectedSlug) {
              const organization = state.organizations.find((item) => item.slug === state.selectedSlug);
              if (organization?.id) customerQuery.set("organization_id", String(organization.id));
            }
            return request(`/api/v1/users/customers/?${customerQuery.toString()}`);
          })() : Promise.resolve(null),
          isAdmin ? request("/api/v1/users/staff/?page=1&size=100") : Promise.resolve(null)
        ]);
        if (results[0].status === "rejected") throw results[0].reason;
        const result = payloadOf(results[0].value);
        const tickets = listOf(results[0].value, "tickets");
        const customers = results[1].status === "fulfilled" ? listOf(results[1].value, "users") : [];
        const staff = results[2].status === "fulfilled" ? listOf(results[2].value, "users") : [];
        panel.innerHTML = `${sectionHeading("Support ticket queue", "Search, prioritize and manage support work within this tenant. SLA escalation and customer notifications require separately configured workflows.")}<div class="workspace-list-toolbar"><form id="workspace-ticket-filter" class="workspace-search workspace-ticket-filter"><label class="visually-hidden" for="workspace-ticket-search">Search tickets</label><input id="workspace-ticket-search" name="search" type="search" maxlength="100" placeholder="Search tickets" value="${escapeHtml(state.ticketSearch)}"><select name="status" aria-label="Filter ticket status"><option value="">All statuses</option>${["open", "in_progress", "resolved", "closed", "cancelled"].map((value) => `<option value="${value}" ${state.ticketStatus === value ? "selected" : ""}>${value.replaceAll("_", " ")}</option>`).join("")}</select><select name="priority" aria-label="Filter ticket priority"><option value="">All priorities</option>${["low", "medium", "high", "urgent"].map((value) => `<option value="${value}" ${state.ticketPriority === value ? "selected" : ""}>${value}</option>`).join("")}</select><button class="workspace-secondary-button" type="submit">Filter</button></form>${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-ticket-create">New ticket</button>` : ""}</div>${state.ticketNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.ticketNotice)}</div>` : ""}${isAdmin && results[2].status === "rejected" ? `<div class="workspace-error">Staff directory unavailable; assignment controls cannot be used: ${escapeHtml(results[2].reason.message || "request failed")}</div>` : ""}${state.creatingTicket ? results[1].status === "rejected" ? `<div class="workspace-error">Customer list unavailable: ${escapeHtml(results[1].reason.message || "request failed")}</div>` : ticketFormMarkup(customers) : ""}${table([{ label: "Ticket", key: "ticket_number" }, { label: "Subject", key: "subject" }, { label: "Category", key: "category" }, { label: "Priority", render: (item) => isAdmin ? `<label class="visually-hidden" for="ticket-priority-${escapeHtml(item.id)}">Priority for ticket ${escapeHtml(item.ticket_number)}</label><select class="workspace-role-select" id="ticket-priority-${escapeHtml(item.id)}" data-ticket-priority="${escapeHtml(item.id)}" data-current-priority="${escapeHtml(item.priority)}">${["low", "medium", "high", "urgent"].map((value) => `<option value="${value}" ${value === item.priority ? "selected" : ""}>${value}</option>`).join("")}</select>` : statusCell(item.priority) }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Assigned", render: (item) => isAdmin ? `<label class="visually-hidden" for="ticket-assignee-${escapeHtml(item.id)}">Assignee for ticket ${escapeHtml(item.ticket_number)}</label><select class="workspace-role-select" id="ticket-assignee-${escapeHtml(item.id)}" data-ticket-assignee="${escapeHtml(item.id)}"><option value="">Unassigned</option>${staff.map((staffUser) => `<option value="${escapeHtml(staffUser.id)}" ${String(staffUser.id) === String(item.assigned_to) ? "selected" : ""}>${escapeHtml(staffUser.full_name || staffUser.username)}</option>`).join("")}</select>` : escapeHtml(item.assigned_to ?? "—") }, { label: "Created", render: (item) => dateCell(item.created_at) }, ...(isAdmin ? [{ label: "Actions", render: (item) => `${!["resolved", "closed", "cancelled"].includes(String(item.status).toLowerCase()) ? `<button type="button" class="workspace-row-action" data-ticket-resolve="${escapeHtml(item.id)}">Resolve</button><button type="button" class="workspace-row-action workspace-row-danger" data-ticket-close="${escapeHtml(item.id)}">Close</button>` : ""}` }] : [])], tickets, "No tickets matched the selected filters.")}
        <div class="workspace-pagination"><span>Page ${escapeHtml(result.page ?? state.ticketPage)} of ${escapeHtml(result.pages ?? 1)} · ${escapeHtml(result.total ?? tickets.length)} tickets</span><div><button type="button" class="workspace-secondary-button" data-ticket-page="${Math.max(1, state.ticketPage - 1)}" ${state.ticketPage <= 1 ? "disabled" : ""}>Previous</button><button type="button" class="workspace-secondary-button" data-ticket-page="${Math.min(Number(result.pages || 1), state.ticketPage + 1)}" ${state.ticketPage >= Number(result.pages || 1) ? "disabled" : ""}>Next</button></div></div>`;
        panel.querySelector("#workspace-ticket-filter")?.addEventListener("submit", (event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          state.ticketSearch = String(values.get("search") || "").trim();
          state.ticketStatus = String(values.get("status") || "");
          state.ticketPriority = String(values.get("priority") || "");
          state.ticketPage = 1;
          loadSection();
        });
        panel.querySelectorAll("[data-ticket-page]").forEach((button) => button.addEventListener("click", () => {
          state.ticketPage = Number(button.dataset.ticketPage);
          loadSection();
        }));
        panel.querySelector("#workspace-ticket-create")?.addEventListener("click", () => {
          state.creatingTicket = true;
          state.ticketNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-ticket-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingTicket = false;
          loadSection();
        }));
        const ticketForm = panel.querySelector("#workspace-ticket-form");
        ticketForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = ticketForm.querySelector('button[type="submit"]');
          const feedback = ticketForm.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(ticketForm).entries());
          values.user_id = Number(values.user_id);
          values.category = String(values.category || "").trim() || null;
          submit.disabled = true;
          submit.textContent = "Creating…";
          feedback.hidden = true;
          try {
            await request("/api/v1/support/tickets/", { method: "POST", body: JSON.stringify(values) });
            state.creatingTicket = false;
            state.ticketNotice = "Support ticket created.";
            state.ticketPage = 1;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
            submit.textContent = "Create ticket";
          }
        });
        panel.querySelectorAll("[data-ticket-priority]").forEach((select) => select.addEventListener("change", async () => {
          const previous = select.dataset.currentPriority;
          try {
            await request(`/api/v1/support/tickets/${encodeURIComponent(select.dataset.ticketPriority)}`, { method: "PATCH", body: JSON.stringify({ priority: select.value }) });
            state.ticketNotice = "Ticket priority updated.";
            await loadSection();
          } catch (error) {
            select.value = previous;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.textContent = `Ticket update failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-ticket-assignee]").forEach((select) => select.addEventListener("change", async () => {
          const ticket = tickets.find((item) => String(item.id) === select.dataset.ticketAssignee);
          const previous = ticket?.assigned_to == null ? "" : String(ticket.assigned_to);
          const assignee = select.value === "" ? null : Number(select.value);
          select.disabled = true;
          try {
            await request(`/api/v1/support/tickets/${encodeURIComponent(select.dataset.ticketAssignee)}/assign`, { method: "POST", body: JSON.stringify({ ticket_id: Number(select.dataset.ticketAssignee), assigned_to: assignee }) });
            state.ticketNotice = "Ticket assignment updated.";
            await loadSection();
          } catch (error) {
            select.disabled = false;
            select.value = previous;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.textContent = `Ticket assignment failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-ticket-resolve]").forEach((button) => button.addEventListener("click", async () => {
          const resolution = window.prompt("Enter the resolution note (required):");
          if (!resolution?.trim()) return;
          button.disabled = true;
          try {
            await request(`/api/v1/support/tickets/${encodeURIComponent(button.dataset.ticketResolve)}/resolve`, { method: "POST", body: JSON.stringify({ ticket_id: Number(button.dataset.ticketResolve), resolution: resolution.trim() }) });
            state.ticketNotice = "Ticket resolved.";
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.textContent = `Ticket resolution failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-ticket-close]").forEach((button) => button.addEventListener("click", async () => {
          if (!window.confirm("Close this support ticket?")) return;
          button.disabled = true;
          try {
            await request(`/api/v1/support/tickets/${encodeURIComponent(button.dataset.ticketClose)}/close`, { method: "POST" });
            state.ticketNotice = "Ticket closed.";
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.textContent = `Ticket close failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        return;
      }

      if (state.activeTab === "gateways") {
        const results = await Promise.allSettled([
          request("/api/v1/payhero/channels/local")
        ]);
        state.paymentChannels = results[0].status === "fulfilled"
          ? (Array.isArray(results[0].value) ? results[0].value : (payloadOf(results[0].value)?.channels || []))
          : state.paymentChannels;
        panel.innerHTML = `${sectionHeading("Payment gateways", "Configure PayHero payment channels per tenant. Internal channel IDs are generated automatically.")}${state.channelNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.channelNotice)}</div>` : ""}<div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-channel-create">Register PayHero channel</button>` : ""}</div>${state.creatingChannel ? `<form class="workspace-form" id="workspace-channel-form"><div class="workspace-form-grid"><label>Payment method<select name="channel_type"><option value="till">Till</option><option value="paybill">PayBill</option><option value="bank">Bank</option></select></label><label>Short code / Till number<input name="short_code" required></label><label>Account number<input name="account_number"></label><label>Description<input name="description"></label></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Save and register with PayHero</button><button class="workspace-secondary-button" type="button" data-channel-cancel>Cancel</button></div><div class="workspace-form-feedback" role="alert" hidden></div></form>` : ""}${table([{ label: "Method", key: "channel_type" }, { label: "Short code", key: "short_code" }, { label: "PayHero ID", key: "payhero_channel_id" }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Active", render: (item) => item.is_active ? "Yes" : "No" }, { label: "Verified", render: (item) => item.is_verified ? "Yes" : "No" }], state.paymentChannels, "No payment channels configured.")}`;
        panel.querySelector("#workspace-channel-create")?.addEventListener("click", () => {
          state.creatingChannel = true;
          state.channelNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-channel-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingChannel = false;
          loadSection();
        }));
        const channelForm = panel.querySelector("#workspace-channel-form");
        channelForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = channelForm.querySelector('button[type="submit"]');
          const feedback = channelForm.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(channelForm).entries());
          if (submit) submit.disabled = true;
          if (feedback) { feedback.hidden = true; feedback.textContent = ""; }
          try {
            await request("/api/v1/payhero/channels", { method: "POST", body: JSON.stringify(values) });
            state.creatingChannel = false;
            state.channelNotice = "Payment channel registered with PayHero.";
            await loadSection();
          } catch (error) {
            if (feedback) { feedback.hidden = false; feedback.textContent = error.message || "Channel registration failed."; }
          } finally {
            if (submit) submit.disabled = false;
          }
        });
        return;
      }

      if (state.activeTab === "reports") {
        const results = await Promise.allSettled([
          request("/api/v1/reports/analytics/dashboard"),
          request("/api/v1/reports/analytics/dashboard-charts"),
          request("/api/v1/payhero/channels/local")
        ]);
        const analytics = results[0].status === "fulfilled" ? payloadOf(results[0].value) : null;
        if (!analytics && results[1].status === "rejected") throw results[0].reason;
        state.paymentChannels = results[2].status === "fulfilled"
          ? (Array.isArray(results[2].value) ? results[2].value : (payloadOf(results[2].value)?.channels || []))
          : state.paymentChannels;
        const billing = analytics?.billing || {};
        const subscriptions = analytics?.subscriptions || {};
        const routers = analytics?.routers || {};
        const charts = results[1].status === "fulfilled" ? payloadOf(results[1].value) : null;
        panel.innerHTML = `${sectionHeading("Reports & CSV exports", "Analytics are returned by the backend. CSV downloads are authenticated and tenant-scoped.")}${analytics ? `<div class="workspace-metrics"><div class="workspace-metric"><span>Invoice revenue · 30d</span><strong>${amountCell(billing.total_revenue)}</strong></div><div class="workspace-metric"><span>Subscriptions created · 30d</span><strong>${escapeHtml(subscriptions.total_subscriptions ?? "—")}</strong></div><div class="workspace-metric"><span>Routers online</span><strong>${escapeHtml(routers.online_routers ?? "—")} / ${escapeHtml(routers.total_routers ?? "—")}</strong></div></div>` : `<div class="workspace-error">Analytics unavailable: ${escapeHtml(results[0].reason.message || "request failed")}</div>`}${charts ? `<div class="workspace-dashboard-grid workspace-report-charts">${chartPanel("Payments by month", charts.payments_chart || [], "month", "payments")}${chartPanel("Plan utilization", charts.package_utilization_chart || [], "name", "value")}${chartPanel("Subscriber activity", charts.active_users_chart || [], "day", "hotspot")}</div>` : `<div class="workspace-error">Chart data unavailable: ${escapeHtml(results[1].status === "rejected" ? results[1].reason.message || "request failed" : "No chart series returned.")}</div>`}<div class="workspace-export-actions"><button class="button button-light" data-export="subscriptions">Download subscriptions CSV</button><button class="button button-light" data-export="billing">Download billing CSV</button></div><h3 class="workspace-subheading">Payment Channels (PayHero)</h3>${state.channelNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.channelNotice)}</div>` : ""}<div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-channel-create">Register channel</button>` : ""}</div>${state.creatingChannel ? `<form class="workspace-form" id="workspace-channel-form"><div class="workspace-form-grid"><label>Channel type<select name="channel_type"><option value="till">Till</option><option value="paybill">PayBill</option><option value="bank">Bank</option></select></label><label>Short code / Till number<input name="short_code" required></label><label>Account number<input name="account_number"></label><label>Description<input name="description"></label></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Register with PayHero</button><button class="workspace-secondary-button" type="button" data-channel-cancel>Cancel</button></div><div class="workspace-form-feedback" role="alert" hidden></div></form>` : ""}${table([{ label: "Type", key: "channel_type" }, { label: "Short code", key: "short_code" }, { label: "PayHero ID", key: "payhero_channel_id" }, { label: "Active", render: (item) => item.is_active ? "Yes" : "No" }, { label: "Verified", render: (item) => item.is_verified ? "Yes" : "No" }], state.paymentChannels, "No payment channels registered.")}</div>`;
        panel.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", () => exportCsv(button.dataset.export, button)));
        return;
      }

      if (state.activeTab === "staff") {
        const [staffResult, settingsResult] = await Promise.allSettled([
          request("/api/v1/users/?page=1&size=100"),
          isOwner ? Promise.resolve(null) : request("/api/v1/tenant/settings/organization")
        ]);
        if (staffResult.status === "rejected" && settingsResult.status === "rejected") throw staffResult.reason;
        const users = staffResult.status === "fulfilled" ? listOf(staffResult.value, "users") : [];
        const staff = users.filter((item) => String(item.role || "").toLowerCase() !== "customer");
        const settings = settingsResult.status === "fulfilled" ? payloadOf(settingsResult.value) : null;
        const org = settings || state.organizations.find((item) => item.slug === state.selectedSlug);
        panel.innerHTML = `${sectionHeading("Staff & organization", isAdmin ? "Manage tenant staff roles and account status. The backend enforces the same authorization and organization boundary." : "Staff identity and organization details returned for your account.")}${state.staffNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.staffNotice)}</div>` : ""}<div class="workspace-settings-grid">${org ? `<div class="workspace-metric"><span>Organization</span><strong>${escapeHtml(org.name || "—")}</strong><small>${escapeHtml(org.slug || "")} · ${escapeHtml(org.status || "status unavailable")}</small><small>Currency: ${escapeHtml(org.currency || "not configured")} · Timezone: ${escapeHtml(org.timezone || "not configured")}</small></div>` : `<div class="workspace-error">Organization settings are unavailable for this role or tenant.</div>`}<div class="workspace-metric"><span>Staff records returned</span><strong>${staff.length}</strong><small>Customer accounts are excluded.</small></div></div>${staffResult.status === "rejected" ? `<div class="workspace-error">Staff list unavailable: ${escapeHtml(staffResult.reason.message || "request failed")}</div>` : table([{ label: "Name", render: (item) => escapeHtml(item.full_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.username) }, { label: "Email", key: "email" }, { label: "Role", render: (item) => isAdmin ? `<label class="visually-hidden" for="staff-role-${escapeHtml(item.id)}">Role for ${escapeHtml(item.full_name || item.username)}</label><select id="staff-role-${escapeHtml(item.id)}" class="workspace-role-select" data-staff-role="${escapeHtml(item.id)}" data-current-role="${escapeHtml(item.role)}"><option value="isp_admin" ${item.role === "isp_admin" ? "selected" : ""}>ISP admin</option><option value="isp_technician" ${item.role === "isp_technician" ? "selected" : ""}>Technician</option></select>` : statusCell(item.role) }, { label: "Status", render: (item) => statusCell(item.status || (item.is_active ? "active" : "inactive")) }, { label: "Last login", render: (item) => dateCell(item.last_login) }, ...(isAdmin ? [{ label: "Account", render: (item) => `<button type="button" class="workspace-row-action" data-staff-active="${escapeHtml(item.id)}" data-active="${item.is_active ? "true" : "false"}">${item.is_active ? "Deactivate" : "Activate"}</button>` }] : [])], staff, "No staff accounts were returned.")}`;
        panel.querySelectorAll("[data-staff-role]").forEach((select) => select.addEventListener("change", async () => {
          const previous = select.dataset.currentRole;
          const nextRole = select.value;
          if (!window.confirm(`Change this staff member's role to ${nextRole.replaceAll("_", " ")}?`)) {
            select.value = previous;
            return;
          }
          select.disabled = true;
          try {
            await request(`/api/v1/users/${encodeURIComponent(select.dataset.staffRole)}/role?role=${encodeURIComponent(nextRole)}`, { method: "PATCH" });
            state.staffNotice = "Staff role updated.";
            await loadSection();
          } catch (error) {
            select.disabled = false;
            select.value = previous;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Role update failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-staff-active]").forEach((button) => button.addEventListener("click", async () => {
          const active = button.dataset.active === "true";
          if (!window.confirm(`${active ? "Deactivate" : "Activate"} this staff account?`)) return;
          button.disabled = true;
          try {
            await request(`/api/v1/users/${encodeURIComponent(button.dataset.staffActive)}/${active ? "deactivate" : "activate"}`, { method: "PATCH" });
            state.staffNotice = `Staff account ${active ? "deactivated" : "activated"}.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Account status update failed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
      }
    } catch (error) {
      panel.innerHTML = renderError(tabs.find(([id]) => id === state.activeTab)?.[1] || "Workspace", error);
    }
  }

  function bindControls() {
    holder.querySelector("#logout-button")?.addEventListener("click", signOut);
    holder.querySelector("#workspace-refresh")?.addEventListener("click", loadSection);
    holder.querySelector("#workspace-org-select")?.addEventListener("change", (event) => {
      state.selectedSlug = event.target.value;
      state.activeTab = "overview";
      if (state.selectedSlug) sessionStorage.setItem("ispflow.orgSlug", state.selectedSlug);
      else sessionStorage.removeItem("ispflow.orgSlug");
      holder.innerHTML = workspaceMarkup(user, state.organizations, state.selectedSlug);
      bindControls();
      loadSection();
    });
    holder.querySelectorAll("[data-workspace-tab]").forEach((button) => button.addEventListener("click", () => {
      state.activeTab = button.dataset.workspaceTab;
      holder.querySelectorAll("[data-workspace-tab]").forEach((tab) => {
        const active = tab.dataset.workspaceTab === state.activeTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-current", String(active));
      });
      const crumb = holder.querySelector(".workspace-crumb strong");
      if (crumb) crumb.textContent = tabs.find(([id]) => id === state.activeTab)?.[1] || "Overview";
      loadSection();
    }));
  }

  bindControls();
  if (!["customer"].includes(role)) loadSection();
}
