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
  ["bindings", "Hotspot bindings", "tenant-admin"],
  ["usage", "Usage & sessions", "staff"],
  ["vouchers", "Vouchers", "staff"],
  ["notifications", "Notifications", "staff"],
  ["tickets", "Support tickets", "staff"],
  ["reports", "Reports & exports", "admin"],
  ["staff", "Staff", "admin"],
  ["settings", "ISP settings", "tenant-admin"],
  ["integrity", "Data integrity", "platform"]
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

function settingsFieldMarkup(field, value) {
  const name = escapeHtml(field.name);
  const label = escapeHtml(field.label);
  const help = field.help ? `<small>${escapeHtml(field.help)}</small>` : "";
  if (field.type === "boolean") {
    return `<label class="workspace-setting-toggle"><input type="checkbox" name="${name}" ${value ? "checked" : ""}><span>${label}</span>${help}</label>`;
  }
  if (field.type === "textarea") {
    return `<label class="${field.wide ? "workspace-form-wide" : ""}">${label}<textarea name="${name}" maxlength="${field.maxLength || 5000}" rows="${field.rows || 3}">${escapeHtml(value ?? "")}</textarea>${help}</label>`;
  }
  return `<label class="${field.wide ? "workspace-form-wide" : ""}">${label}<input name="${name}" type="${field.type || "text"}" value="${escapeHtml(value ?? "")}"${field.min !== undefined ? ` min="${field.min}"` : ""}${field.minLength ? ` minlength="${field.minLength}"` : ""}${field.max !== undefined ? ` max="${field.max}"` : ""}${field.maxLength ? ` maxlength="${field.maxLength}"` : ""}>${help}</label>`;
}

function settingsFormMarkup(title, endpoint, values, fields) {
  return `<form class="workspace-form workspace-settings-form" data-settings-endpoint="${escapeHtml(endpoint)}"><h3>${escapeHtml(title)}</h3><div class="workspace-form-grid">${fields.map((field) => settingsFieldMarkup(field, values[field.name])).join("")}</div><div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Save ${escapeHtml(title.toLowerCase())}</button></div></form>`;
}

function voucherFormMarkup(plans) {
  const activePlans = plans.filter((plan) => String(plan.status || "").toLowerCase() === "active");
  return `<form class="workspace-form" id="workspace-voucher-form"><h3>Generate a voucher batch</h3><div class="workspace-form-grid"><label>Package<select name="plan_id" required>${activePlans.map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} · ${escapeHtml(plan.currency || "KES")} ${amountCell(plan.price)}</option>`).join("")}</select></label><label>Number of vouchers<input name="count" type="number" min="1" max="500" value="10" required></label><label>Code format<input name="code_format" maxlength="50" value="XXXX-XXXX-XXXX" required></label><label>Expire unused codes after (days)<input name="expires_in_days" type="number" min="1" max="3650" placeholder="No pre-use expiry"></label></div><p class="workspace-note">Generated voucher credentials are shown once after creation. Store or print them securely.</p><div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit" ${activePlans.length ? "" : "disabled"}>Generate vouchers</button><button class="workspace-secondary-button" type="button" data-voucher-cancel>Cancel</button></div>${activePlans.length ? "" : `<div class="workspace-error" role="alert">Create or activate a package before generating vouchers.</div>`}</form>`;
}

function planFormMarkup(plan = {}) {
  return `<form class="workspace-form" id="workspace-plan-form">
    <div class="workspace-form-heading"><div><span class="workspace-kicker">${plan.id ? "EDIT PACKAGE" : "NEW PACKAGE"}</span><h3>${plan.id ? "Update internet package" : "Create an internet package"}</h3></div><button type="button" class="workspace-inline-link" data-plan-cancel>Cancel</button></div>
    <div class="workspace-form-grid">
      <label>Package name<input name="name" required minlength="1" maxlength="100" value="${escapeHtml(plan.name || "")}"></label>
      <label>Package type<select name="plan_type"><option value="HOTSPOT" ${plan.plan_type === "HOTSPOT" ? "selected" : ""}>Hotspot</option><option value="PPPOE" ${plan.plan_type === "PPPOE" ? "selected" : ""}>PPPoE</option></select></label>
      <label>Price (KES)<input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(plan.price ?? "0")}"></label>
      <label>Validity value<input name="validity_value" type="number" min="1" step="1" required value="${escapeHtml(plan.duration_minutes ? plan.duration_minutes : (plan.validity_days ?? 30))}"></label>
      <label>Validity unit<select name="validity_unit">${["minutes","hours","days","months"].map((unit) => `<option value="${unit}" ${(plan.duration_minutes && unit === "minutes") || (!plan.duration_minutes && unit === "days") ? "selected" : ""}>${unit}</option>`).join("")}</select></label>
      <label>Speed limit (Kbps)<input name="download_speed" type="number" min="0" step="1" required value="${escapeHtml(plan.download_speed ?? "0")}"></label>
      <label>Upload speed (Kbps)<input name="upload_speed" type="number" min="0" step="1" required value="${escapeHtml(plan.upload_speed ?? "0")}"></label>
      <label>Data limit (GB; -1 unlimited)<input name="data_limit" type="number" min="-1" step="1" value="${escapeHtml(plan.data_limit ?? "-1")}"></label>
    </div>
    <input type="hidden" name="currency" value="KES">
    <input type="hidden" name="billing_cycle" value="ONE_TIME">
    <input type="hidden" name="validity_days" value="${escapeHtml(plan.validity_days ?? "30")}">
    <input type="hidden" name="duration_minutes" value="${escapeHtml(plan.duration_minutes ?? "")}">    </div>
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
  const slug = organization?.slug || "";
  const portalUrl = `${location.origin}/portal${slug ? `?tenant=${encodeURIComponent(slug)}` : ""}`;
  return `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;height:100vh;overflow:hidden;font:14px Arial,sans-serif}iframe{width:100%;height:100vh;border:0}</style><body><iframe src="${portalUrl}" title="${escapeHtml(organization?.name || "ISP")} captive portal preview" loading="lazy"></iframe></body></html>`;
}
function table(columns, rows, empty = "No records were returned.") {
  if (!rows.length) return `<div class="workspace-empty">${escapeHtml(empty)}</div>`;
  const visibleColumns = columns.filter((column) => column.key !== "payhero_channel_id");
  return `<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${visibleColumns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${visibleColumns.map((column) => `<td>${column.render ? column.render(row) : escapeHtml(row[column.key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
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
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const tabsToShow = customer ? [] : tabs.filter(([id, , access]) =>
    access === "staff" ||
    (access === "platform" && isOwner) ||
    (access === "admin" && isAdmin) ||
    (access === "tenant-admin" && role === "isp_admin") ||
    (role === "isp_technician" && id === "overview")
  );
  const organization = organizations.find((item) => item.slug === selectedSlug);
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || user.email || "Operator";
  const nav = (group, entries) => entries.length ? `<div class="workspace-nav-group"><span>${group}</span>${entries.map(([id, label]) => `<button type="button" class="workspace-tab ${id === "overview" ? "active" : ""}" data-workspace-tab="${id}" aria-current="${id === "overview" ? "page" : "false"}"><i aria-hidden="true">${({ overview: "◈", organizations: "▦", leads: "◇", subscribers: "◎", plans: "◫", subscriptions: "↗", billing: "＄", gateways: "◈", routers: "⌁", portal: "◉", bindings: "⌑", usage: "▥", vouchers: "▤", notifications: "◌", tickets: "◌", reports: "▧", staff: "⚙", settings: "⚙", integrity: "✓" })[id]}</i><span>${label}</span></button>`).join("")}</div>` : "";
  return `<div class="workspace-shell ${isMobile ? "sidebar-collapsed" : ""}">
      <aside class="workspace-sidebar">
        <a class="workspace-brand" href="/app" aria-label="ISPFlow workspace"><span class="workspace-brand-mark">I</span><span>ispflow<small>NETWORK CONSOLE</small></span></a>
        <div class="workspace-tenant-chip"><span class="workspace-online-dot"></span><div><small>WORKSPACE</small><strong>${escapeHtml(organization?.name || user.organization_name || (isOwner ? "Select organization" : "ISP Operations"))}</strong></div></div>
        <nav class="workspace-tabs" aria-label="Operator workspace">
          ${nav("OVERVIEW", tabsToShow.filter(([id]) => id === "overview"))}
          ${nav("PLATFORM", tabsToShow.filter(([id]) => id === "organizations"))}
          ${nav("CUSTOMERS", tabsToShow.filter(([id]) => ["leads", "subscribers", "plans", "subscriptions"].includes(id)))}
          ${nav("NETWORK", tabsToShow.filter(([id]) => ["routers", "portal", "bindings", "usage", "vouchers"].includes(id)))}
          ${nav("PAYMENTS & BILLING", tabsToShow.filter(([id]) => ["billing", "gateways"].includes(id)))}
          ${nav("OPERATIONS", tabsToShow.filter(([id]) => ["notifications", "tickets", "reports"].includes(id)))}
          ${nav("SETTINGS", tabsToShow.filter(([id]) => ["staff", "settings"].includes(id)))}
          ${nav("PLATFORM TOOLS", tabsToShow.filter(([id]) => id === "integrity"))}
        </nav>
        <div class="workspace-sidebar-bottom"><span class="workspace-avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</span><div class="workspace-user"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role.replaceAll("_", " ") || "user")}</small></div><button class="workspace-signout" id="logout-button" type="button" aria-label="Sign out">↗</button></div>
      </aside>
      <main class="workspace-main">
        <header class="workspace-toolbar">
          <div class="workspace-crumb"><span>ISPFlow</span><b>/</b><strong>${escapeHtml(tabs.find(([id]) => id === "overview")?.[1] || "Overview")}</strong></div>
          <div class="workspace-tools">${orgHeader(isOwner, organizations, selectedSlug)}<button class="workspace-menu-toggle" id="workspace-menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded="${!isMobile}">☰ <span>Menu</span></button><button class="workspace-refresh" id="workspace-refresh" type="button" aria-label="Refresh data">↻ <span>Refresh</span></button></div>
        </header>
        ${customer ? `<section class="workspace-panel workspace-customer-panel"><div class="workspace-section-heading"><div><span class="workspace-kicker">CUSTOMER ACCOUNT</span><h2>Welcome, ${escapeHtml(name)}</h2><p>${escapeHtml(organization?.name || user.organization_name || "Your ISP")} · private account and billing information</p></div><button class="workspace-secondary-button" id="logout-button" type="button">Sign out</button></div><section class="workspace-customer-content" id="workspace-panel" aria-live="polite"><div class="workspace-loading">Loading your account…</div></section></section>` : `
        <div class="workspace-current-org">${organization ? `Connected to <strong>${escapeHtml(organization.name)}</strong><span class="workspace-connected">● Connected</span>` : isOwner ? "Select an organization to load its tenant-scoped data." : "Tenant-scoped workspace"}</div>
        <section class="workspace-welcome"><div><span class="workspace-kicker">NETWORK OVERVIEW</span><h1>Good to see you, ${escapeHtml(user.organization_name || (name.split(" ")[0]))}!</h1><p>Welcome back. Here's what's happening with your ISP today.</p></div><div class="workspace-welcome-date">${escapeHtml(new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }))}</div></section>
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
    subscriberNotice: "",
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
    channelNotice: "",
    creatingVouchers: false,
    voucherNotice: "",
    voucherBatch: null,
    notificationNotice: "",
    bindingRouterId: "",
    bindingNotice: "",
    settingsNotice: "",
    customerRenewal: null
  };

  const request = async (path, options = {}) => {
    const apiPath = path.replace("/api/v1/support/tickets", "/api/v1/tickets");
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
    if (isOwner && state.selectedSlug) {
      const organization = state.organizations.find((item) => item.slug === state.selectedSlug);
      headers["X-Organization-Slug"] = state.selectedSlug;
      if (organization?.id) headers["X-Tenant-ID"] = String(organization.id);
    }
    try {
      return await api(apiPath, { ...options, headers });
    } catch (error) {
      if (String(error?.message || "").startsWith("401:")) {
        sessionStorage.removeItem("ispflow.access");
        sessionStorage.removeItem("ispflow.refresh");
        sessionStorage.removeItem("ispflow.orgSlug");
        window.location.href = "/";
      }
      throw error;
    }
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
    if (isOwner && !state.selectedSlug && !["organizations", "integrity"].includes(state.activeTab)) {
      panel.innerHTML = `<div class="workspace-empty"><h2>Select an ISP organization</h2><p>Choose an organization above. Tenant data is not loaded until an explicit organization is selected.</p>${state.organizations.length ? "" : "No organizations are available to this platform account."}</div>`;
      return;
    }
    panel.innerHTML = `<div class="workspace-loading" role="status">Loading live backend data…</div>`;
    try {
      if (role === "customer") {
        const slug = String(user.organization_slug || "");
        if (!slug || !user.id) {
          panel.innerHTML = renderError("Customer account", new Error("The signed-in account is missing its ISP organization context."));
          return;
        }
        const customerPath = `/api/v1/portal/pppoe/${encodeURIComponent(slug)}`;
        const query = new URLSearchParams({ user_id: String(user.id) });
        const results = await Promise.allSettled([
          request(`${customerPath}/dashboard?${query}`),
          request(`${customerPath}/usage?${query}&days=30`),
          request(`${customerPath}/payments?${query}&limit=20`),
          request(`${customerPath}/plans?${query}`)
        ]);
        if (results[0].status === "rejected") throw results[0].reason;
        const dashboard = payloadOf(results[0].value);
        const usage = results[1].status === "fulfilled" ? listOf(results[1].value, "usage") : [];
        const payments = results[2].status === "fulfilled" ? listOf(results[2].value, "payments") : [];
        const plans = results[3].status === "fulfilled" ? listOf(results[3].value, "plans") : [];
        const active = dashboard.subscription;
        const renewal = state.customerRenewal;
        panel.innerHTML = `${sectionHeading("Your internet account", "Review your current service, recent network usage, and payment history. Renewals activate only after the payment service verifies payment.")}${state.customerRenewalNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.customerRenewalNotice)}</div>` : ""}<div class="workspace-metrics"><div class="workspace-metric"><span>Service status</span><strong>${escapeHtml(active?.status || "No active plan")}</strong><small>${escapeHtml(active?.plan_name || "Choose a package to get started")}</small></div><div class="workspace-metric"><span>Data used this month</span><strong>${escapeHtml(dashboard.usage?.data_used_gb ?? 0)} GB</strong><small>${escapeHtml(dashboard.usage?.total_duration_hours ?? 0)} hours online</small></div><div class="workspace-metric"><span>Service ends</span><strong>${dateCell(active?.end_date)}</strong><small>Account: ${escapeHtml(dashboard.customer?.username || user.username || "Customer")}</small></div></div>${results[1].status === "rejected" ? `<div class="workspace-error" role="alert">Usage history unavailable: ${escapeHtml(results[1].reason.message || "request failed")}</div>` : table([{ label: "Date", key: "date" }, { label: "Data used", render: (item) => `${amountCell(Number(item.data_used_mb || 0) / 1024)} GB` }, { label: "Online time", render: (item) => `${amountCell(Number(item.duration || 0) / 3600)} h` }], usage, "No recent usage records.")}${results[2].status === "rejected" ? `<div class="workspace-error" role="alert">Payment history unavailable: ${escapeHtml(results[2].reason.message || "request failed")}</div>` : `<h3>Payment history</h3>${table([{ label: "Reference", key: "payment_reference" }, { label: "Description", key: "description" }, { label: "Amount", render: (item) => `${escapeHtml(item.currency || "KES")} ${amountCell(item.amount)}` }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Date", render: (item) => dateCell(item.created_at) }], payments, "No payment records were returned.")}`}${results[3].status === "rejected" ? `<div class="workspace-error" role="alert">Renewal packages unavailable: ${escapeHtml(results[3].reason.message || "request failed")}</div>` : `<form class="workspace-form" id="workspace-customer-renew-form"><h3>Renew or change your package</h3><div class="workspace-form-grid"><label>Package<select name="plan_id" required>${plans.map((plan) => `<option value="${escapeHtml(plan.id)}" ${plan.is_current ? "selected" : ""}>${escapeHtml(plan.name)} · ${escapeHtml(plan.currency)} ${amountCell(plan.price)} · ${escapeHtml(plan.validity_days)} days</option>`).join("")}</select></label><label>Mobile money phone<input name="phone_number" inputmode="tel" autocomplete="tel" maxlength="20" value="${escapeHtml(dashboard.customer?.phone || user.phone || "")}"></label></div><div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit" ${plans.length ? "" : "disabled"}>Continue to secure payment</button></div>${plans.length ? "" : `<div class="workspace-empty">No active renewal packages are available right now.</div>`}</form>`}${renewal ? `<section class="workspace-dashboard-card workspace-customer-renewal"><h3>Payment for renewal</h3><p>${escapeHtml(renewal.message || "Complete payment to renew your service.")}</p>${renewal.checkout_url ? `<a class="workspace-primary-button workspace-payment-link" href="${escapeHtml(renewal.checkout_url)}" target="_blank" rel="noopener noreferrer">Open secure payment page</a>` : ""}${renewal.reference ? `<p>Reference: <strong>${escapeHtml(renewal.reference)}</strong></p><button type="button" class="workspace-secondary-button" id="workspace-customer-verify">Check payment status</button>` : ""}${state.customerRenewalResult ? `<div class="${state.customerRenewalResult.success ? "workspace-note" : "workspace-error"}" role="status">${escapeHtml(state.customerRenewalResult.message || state.customerRenewalResult.status || "Payment status updated.")}</div>` : ""}</section>` : ""}${results.slice(1).some((result) => result.status === "rejected") ? `<p class="workspace-note">Some account panels could not load. The error messages appear above; refresh after the service is available.</p>` : ""}`;
        panel.querySelector("#workspace-customer-renew-form")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const button = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(form).entries());
          button.disabled = true;
          feedback.hidden = true;
          try {
            state.customerRenewal = await request(`${customerPath}/renew?${query}`, {
              method: "POST",
              body: JSON.stringify({ plan_id: Number(values.plan_id), phone_number: String(values.phone_number || "").trim() })
            });
            state.customerRenewalResult = null;
            state.customerRenewalNotice = "Payment intent created. Service will renew only after payment is confirmed.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            button.disabled = false;
          }
        });
        panel.querySelector("#workspace-customer-verify")?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            const params = new URLSearchParams({ reference: state.customerRenewal.reference });
            state.customerRenewalResult = payloadOf(await request(`${customerPath}/payment/verify?${params}`));
            state.customerRenewalNotice = state.customerRenewalResult.message || "Payment status checked.";
            if (state.customerRenewalResult.success) state.customerRenewal = null;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Payment status could not be checked: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        });
        return;
      }
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
          ...(isAdmin ? [{ label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-customer-edit="${escapeHtml(item.id)}">Edit</button><button type="button" class="workspace-row-action ${item.is_active ? "workspace-row-danger" : ""}" data-customer-status="${escapeHtml(item.id)}" data-active="${item.is_active ? "true" : "false"}">${item.is_active ? "Deactivate" : "Activate"}</button>` }] : [])
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
        panel.querySelectorAll("[data-customer-status]").forEach((button) => button.addEventListener("click", async () => {
          const isActive = button.dataset.active === "true";
          if (!window.confirm(`${isActive ? "Deactivate" : "Activate"} this customer account?`)) return;
          button.disabled = true;
          try {
            await request(`/api/v1/users/${encodeURIComponent(button.dataset.customerStatus)}/${isActive ? "deactivate" : "activate"}`, { method: "PATCH" });
            state.subscriberNotice = `Customer account ${isActive ? "deactivated" : "activated"}.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Customer status could not be changed: ${error.message || String(error)}`;
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
          const validityMultipliers = { minutes: 1, hours: 60, days: 1440, months: 43200 };
          const validityValue = Number(body.validity_value || 0);
          const validityUnit = String(body.validity_unit || "days");
          if (validityValue > 0) {
            body.duration_minutes = validityValue * (validityMultipliers[validityUnit] || 1440);
            body.validity_days = Math.max(1, Math.ceil((validityValue * (validityMultipliers[validityUnit] || 1440)) / 1440));
          }
          delete body.validity_value;
          delete body.validity_unit;
          body.fup_enabled = body.fup_enabled === "true";
          body.currency = String(body.currency || "KES").trim().toUpperCase();
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
        panel.innerHTML = `${sectionHeading("Subscriptions & access types", "Assignments start pending. Payment verification controls activation; administrators can suspend or cancel existing access here.")}<div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-subscription-create">Assign package</button>` : ""}</div>${state.subscriptionNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.subscriptionNotice)}</div>` : ""}${isAdmin && state.creatingSubscription ? subscriptionFormMarkup(customers, plans, routers) : ""}${table([
          { label: "Username", key: "username" }, { label: "Package", key: "plan_name" }, { label: "Router", key: "router_name" },
          { label: "Access type", key: "subscription_type" }, { label: "Status", render: (item) => statusCell(item.status) },
          { label: "Router synced", render: (item) => item.is_router_synced ? "Yes" : "No" },
          { label: "Ends", render: (item) => dateCell(item.end_date) },
          ...(isAdmin ? [{ label: "Actions", render: (item) => {
            const status = String(item.status || "").toLowerCase();
            if (["cancelled"].includes(status)) return "—";
            return `${status === "active" ? `<button type="button" class="workspace-row-action" data-subscription-action="suspend" data-subscription-id="${escapeHtml(item.id)}">Suspend</button>` : ""}<button type="button" class="workspace-row-action workspace-row-danger" data-subscription-action="cancel" data-subscription-id="${escapeHtml(item.id)}">Cancel</button>`;
          } }] : [])
        ], subscriptions, "No subscriptions were returned.")}`;
        panel.querySelector("#workspace-subscription-create")?.addEventListener("click", () => {
          state.creatingSubscription = true;
          loadSection();
        });
        panel.querySelectorAll("[data-subscription-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingSubscription = false;
          loadSection();
        }));
        panel.querySelectorAll("[data-subscription-action]").forEach((button) => button.addEventListener("click", async () => {
          const action = button.dataset.subscriptionAction;
          const id = button.dataset.subscriptionId;
          const verb = action === "suspend" ? "Suspend" : "Cancel";
          if (!window.confirm(`${verb} this subscription?`)) return;
          button.disabled = true;
          try {
            const body = {
              subscription_id: Number(id),
              reason: `Action requested by ISP administrator from workspace (${action}).`
            };
            await request(`/api/v1/subscriptions/${encodeURIComponent(id)}/${action}`, {
              method: "PATCH",
              body: JSON.stringify(body)
            });
            state.subscriptionNotice = `Subscription ${verb.toLowerCase()} request completed.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Subscription could not be ${action === "suspend" ? "suspended" : "cancelled"}: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
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
        const settings = await request("/api/v1/tenant/captive-portal/settings");
        const themes = await request("/api/v1/tenant/captive-portal/themes");
        let portalPackages = [];
        try {
          let slug = state.selectedSlug || "";
          if (!slug) {
            try {
              const orgInfo = await request("/api/v1/tenant/settings/organization");
              slug = orgInfo?.slug || orgInfo?.data?.slug || "";
            } catch (e) {
              slug = "";
            }
          }
          state.portalPreviewSlug = slug;
          if (slug) portalPackages = await request(`/api/v1/portal/hotspot/${encodeURIComponent(slug)}/packages`);
        } catch (error) {
          portalPackages = [];
        }
        if (!Array.isArray(portalPackages)) portalPackages = portalPackages?.data || [];
        const themeList = themes?.themes || ["modern", "minimal", "professional", "colorful", "dark", "light", "gradient", "classic"];
        const layoutList = themes?.layouts || ["grid-2", "grid-3", "list", "compact", "large", "featured"];
        const sortList = themes?.sort_modes || ["manual", "price", "validity", "featured"];
        const colorKeys = ["primary", "background", "surface", "text", "accent", "card_label", "card_surface", "button", "button_text"];
        const defaultColors = {
          primary: "#9100B0", background: "#1e1b4b", surface: "#ffffff", text: "#ffffff",
          accent: "#2563eb", card_label: "#1e3a8a", card_surface: "#dbeafe", button: "#ffffff", button_text: "#1e3a8a"
        };
        const currentColors = settings.colors || {};
        const visibility = settings.visibility || {};
        const sectionVisible = (key) => visibility[key] !== false;
        panel.innerHTML = `${sectionHeading("Captive portal customization", "Edit, preview, and publish the tenant-specific captive portal. Changes are saved as a draft and published only when you choose.")}${state.portalNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.portalNotice)}</div>` : ""}
        <div class="workspace-portal-grid">
          <form class="workspace-form" id="workspace-captive-form">
            <h3 class="workspace-subheading">Branding</h3>
            <div class="workspace-form-grid">
              <label>ISP display name<input name="isp_name" maxlength="200" value="${escapeHtml(settings.isp_name || "")}"></label>
              <label>Logo URL<input name="logo_url" type="url" maxlength="500" value="${escapeHtml(settings.logo_url || "")}"></label>
              <label>Tagline<input name="tagline" maxlength="300" value="${escapeHtml(settings.tagline || "")}"></label>
              <label>Support phone<input name="support_phone" maxlength="50" value="${escapeHtml(settings.support_phone || "")}"></label>
              <label>WhatsApp contact<input name="whatsapp_contact" maxlength="50" value="${escapeHtml(settings.whatsapp_contact || "")}"></label>
              <label class="workspace-form-wide">Footer text<textarea name="footer_info" rows="3" maxlength="2000">${escapeHtml(settings.footer_info || "")}</textarea></label>
              <label class="workspace-form-wide">Contact information<textarea name="contact_info" rows="3" maxlength="2000">${escapeHtml(settings.contact_info || "")}</textarea></label>
              <label>Welcome heading<input name="welcome_heading" maxlength="200" value="${escapeHtml(settings.welcome_heading || "")}"></label>
              <label>Instructions<textarea name="instructions" rows="3" maxlength="2000">${escapeHtml(settings.instructions || "")}</textarea></label>
              <label>Payment instructions<textarea name="payment_instructions" rows="3" maxlength="2000">${escapeHtml(settings.payment_instructions || "")}</textarea></label>
              <label>Success message<input name="success_message" maxlength="300" value="${escapeHtml(settings.success_message || "")}"></label>
              <label>Connection status text<input name="connection_status_text" maxlength="200" value="${escapeHtml(settings.connection_status_text || "")}"></label>
            </div>
            <h3 class="workspace-subheading">Theme and layout</h3>
            <div class="workspace-form-grid">
              <label>Theme<select name="theme">${themeList.map((t) => `<option value="${escapeHtml(t)}" ${settings.theme === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}</select></label>
              <label>Font<select name="font_family"><option value="inherit" ${(settings.typography?.font_family || "inherit") === "inherit" ? "selected" : ""}>Default</option><option value="Arial, sans-serif" ${settings.typography?.font_family === "Arial, sans-serif" ? "selected" : ""}>Arial</option><option value="Verdana, sans-serif" ${settings.typography?.font_family === "Verdana, sans-serif" ? "selected" : ""}>Verdana</option><option value="Georgia, serif" ${settings.typography?.font_family === "Georgia, serif" ? "selected" : ""}>Georgia</option></select></label>
              <label>Layout<select name="layout">${layoutList.map((l) => `<option value="${escapeHtml(l)}" ${settings.layout === l ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></label>
              <label>Sort mode<select name="sort_mode">${sortList.map((m) => `<option value="${escapeHtml(m)}" ${settings.sort_mode === m ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}</select></label>
              <label>Mobile columns<input name="mobile_columns" type="number" min="1" max="4" value="${escapeHtml(settings.mobile_columns ?? 1)}"></label>
              <label>Tablet columns<input name="tablet_columns" type="number" min="1" max="4" value="${escapeHtml(settings.tablet_columns ?? 2)}"></label>
              <label>Desktop columns<input name="desktop_columns" type="number" min="1" max="4" value="${escapeHtml(settings.desktop_columns ?? 2)}"></label>
              <label>Card spacing<input name="card_spacing" type="number" min="0" max="64" value="${escapeHtml(settings.card_spacing ?? 14)}"></label>
            </div>
            <h3 class="workspace-subheading">Colours</h3>
            <div class="workspace-form-grid">
              ${colorKeys.map((key) => `<label>${escapeHtml(key.replaceAll("_", " "))}<input name="color_${key}" type="color" value="${escapeHtml(currentColors[key] || defaultColors[key])}"></label>`).join("")}
            </div>
            <h3 class="workspace-subheading">Section visibility</h3>
            <div class="workspace-form-grid">
              ${["voucher", "reconnect", "packages", "active_login", "mpesa", "connect_tv", "troubleshoot", "contact", "footer", "floating_support"].map((key) => `<label>${escapeHtml(key.replaceAll("_", " "))}<select name="vis_${key}"><option value="true" ${sectionVisible(key) ? "selected" : ""}>Visible</option><option value="false" ${!sectionVisible(key) ? "selected" : ""}>Hidden</option></select></label>`).join("")}
            </div>
            <div class="workspace-form-feedback" role="alert" hidden></div>
            <div class="workspace-form-actions">
              <button class="workspace-primary-button" type="submit" id="captive-save">Save Draft</button>
              <button class="workspace-secondary-button" type="button" id="captive-publish">Publish Changes</button>
              <button class="workspace-secondary-button" type="button" id="captive-restore">Restore Default Theme</button>
            </div>
          </form>
          <div class="workspace-portal-preview-wrap">
            <div class="workspace-card-heading"><div><span class="workspace-kicker">PREVIEW</span><h2>Portal preview</h2></div><span class="workspace-status">Draft</span></div>
            <iframe id="captive-preview" class="workspace-portal-preview" title="Captive portal preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
            <div class="workspace-form-actions"><button type="button" class="workspace-secondary-button" id="captive-preview-mobile">Mobile preview</button><button type="button" class="workspace-secondary-button" id="captive-preview-desktop">Desktop preview</button></div>
            <p class="workspace-note">Preview uses sample package data and unsaved field values. It does not initiate payments or activate service.</p>
          </div>
        </div>`;
        const form = panel.querySelector("#workspace-captive-form");
        const feedback = form.querySelector(".workspace-form-feedback");
        const preview = panel.querySelector("#captive-preview");
        const previewFrame = panel.querySelector("#captive-preview");
        const updatePreview = () => {
          const slug = state.portalPreviewSlug || state.selectedSlug || "";
          const url = slug ? `/portal?tenant=${encodeURIComponent(slug)}&preview=1&t=${Date.now()}` : "/portal";
          previewFrame.src = url;
        };
        form.addEventListener("input", updatePreview);
        updatePreview();
        const collectPayload = () => {
          const values = Object.fromEntries(new FormData(form).entries());
          const colors = {};
          for (const key of colorKeys) colors[key] = values[`color_${key}`] || null;
          const visibilityPayload = {};
          for (const key of ["voucher", "reconnect", "packages", "active_login", "mpesa", "connect_tv", "troubleshoot", "contact", "footer", "floating_support"]) {
            visibilityPayload[key] = values[`vis_${key}`] === "true";
          }
          return {
            theme: values.theme,
            layout: values.layout,
            sort_mode: values.sort_mode,
            mobile_columns: Number(values.mobile_columns),
            tablet_columns: Number(values.tablet_columns),
            desktop_columns: Number(values.desktop_columns),
            card_spacing: Number(values.card_spacing),
            isp_name: values.isp_name || null,
            logo_url: values.logo_url || null,
            tagline: values.tagline || null,
            support_phone: values.support_phone || null,
            whatsapp_contact: values.whatsapp_contact || null,
            footer_info: values.footer_info || null,
            contact_info: values.contact_info || null,
            welcome_heading: values.welcome_heading || null,
            instructions: values.instructions || null,
            payment_instructions: values.payment_instructions || null,
            success_message: values.success_message || null,
            connection_status_text: values.connection_status_text || null,
            colors,
            visibility: visibilityPayload,
            typography: { font_family: values.font_family || "inherit" },
          };
        };
        const previewBox = panel.querySelector("#captive-preview");
        panel.querySelector("#captive-preview-mobile")?.addEventListener("click", () => { previewBox.style.width = "360px"; previewBox.style.height = "640px"; });
        panel.querySelector("#captive-preview-desktop")?.addEventListener("click", () => { previewBox.style.width = "100%"; previewBox.style.height = "700px"; });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = form.querySelector("#captive-save");
          submit.disabled = true;
          feedback.hidden = true;
          try {
            await request("/api/v1/tenant/captive-portal/settings", { method: "PUT", body: JSON.stringify(collectPayload()) });
            state.portalNotice = "Captive portal draft saved.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || "Save failed.";
            feedback.hidden = false;
          } finally {
            submit.disabled = false;
          }
        });
        panel.querySelector("#captive-publish")?.addEventListener("click", async () => {
          const submit = panel.querySelector("#captive-publish");
          submit.disabled = true;
          feedback.hidden = true;
          try {
            await request("/api/v1/tenant/captive-portal/settings", { method: "PUT", body: JSON.stringify(collectPayload()) });
            await request("/api/v1/tenant/captive-portal/publish", { method: "POST", body: JSON.stringify({ notes: "Published from dashboard" }) });
            state.portalNotice = "Captive portal published.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || "Publish failed.";
            feedback.hidden = false;
          } finally {
            submit.disabled = false;
          }
        });
        panel.querySelector("#captive-restore")?.addEventListener("click", async () => {
          if (!window.confirm("Restore the default captive portal theme?")) return;
          const submit = panel.querySelector("#captive-restore");
          submit.disabled = true;
          feedback.hidden = true;
          try {
            await request("/api/v1/tenant/captive-portal/settings", { method: "PUT", body: JSON.stringify({ theme: "modern", colors: defaultColors, visibility: {} }) });
            state.portalNotice = "Default theme restored.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || "Restore failed.";
            feedback.hidden = false;
          } finally {
            submit.disabled = false;
          }
        });
        return;
      }
      if (state.activeTab === "bindings") {
        const routersResult = await request("/api/v1/routers/?page=1&size=100");
        const routers = listOf(routersResult, "items");
        if (!state.bindingRouterId || !routers.some((router) => String(router.id) === state.bindingRouterId)) {
          state.bindingRouterId = String(routers[0]?.id || "");
        }
        const bindingResult = state.bindingRouterId
          ? await request(`/api/v1/ip-bindings/${encodeURIComponent(state.bindingRouterId)}`)
          : [];
        const bindings = Array.isArray(bindingResult) ? bindingResult : listOf(bindingResult, "bindings");
        panel.innerHTML = `${sectionHeading("Hotspot IP bindings", "Manage live MikroTik IP/MAC bindings on a router belonging to this ISP. Create, disable, and delete actions are applied directly to that router.")}${state.bindingNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.bindingNotice)}</div>` : ""}<div class="workspace-list-toolbar"><label class="workspace-inline-field">Router<select id="workspace-binding-router" aria-label="Choose router">${routers.map((router) => `<option value="${escapeHtml(router.id)}" ${String(router.id) === state.bindingRouterId ? "selected" : ""}>${escapeHtml(router.name || `Router ${router.id}`)} · ${escapeHtml(router.ip_address || "unknown address")}</option>`).join("")}</select></label></div>${routers.length ? `<form class="workspace-form" id="workspace-binding-form"><h3>Add an IP/MAC binding</h3><div class="workspace-form-grid"><label>IP address<input name="address" maxlength="45" inputmode="decimal"></label><label>MAC address<input name="mac_address" maxlength="17" placeholder="AA:BB:CC:DD:EE:FF"></label><label>Binding type<select name="type"><option value="regular">Regular</option><option value="bypassed">Bypassed</option><option value="blocked">Blocked</option></select></label><label>Comment<input name="comment" maxlength="200"></label></div><div class="workspace-form-feedback" role="alert" hidden></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Apply binding to router</button></div></form>${table([{ label: "IP address", key: "address" }, { label: "MAC address", key: "mac_address" }, { label: "Type", render: (item) => statusCell(item.type) }, { label: "Server", key: "server" }, { label: "Comment", key: "comment" }, { label: "Disabled", render: (item) => item.disabled ? "Yes" : "No" }, { label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-binding-toggle="${escapeHtml(item.id)}" data-disabled="${item.disabled ? "true" : "false"}">${item.disabled ? "Enable" : "Disable"}</button><button type="button" class="workspace-row-action workspace-row-danger" data-binding-delete="${escapeHtml(item.id)}">Delete</button>` }], bindings, "No IP bindings were returned for this router.")}` : `<div class="workspace-empty"><h3>No tenant routers available</h3><p>Add a router and verify its connection before managing bindings.</p></div>`}`;
        panel.querySelector("#workspace-binding-router")?.addEventListener("change", (event) => {
          state.bindingRouterId = event.currentTarget.value;
          state.bindingNotice = "";
          loadSection();
        });
        panel.querySelector("#workspace-binding-form")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const values = Object.fromEntries(new FormData(form).entries());
          const body = {
            address: String(values.address || "").trim() || null,
            mac_address: String(values.mac_address || "").trim() || null,
            type: values.type,
            comment: String(values.comment || "").trim() || null
          };
          if (!body.address && !body.mac_address) {
            feedback.textContent = "Enter an IP address, a MAC address, or both.";
            feedback.hidden = false;
            return;
          }
          if (!window.confirm("Apply this binding directly to the selected router now?")) return;
          submit.disabled = true;
          feedback.hidden = true;
          try {
            await request(`/api/v1/ip-bindings/${encodeURIComponent(state.bindingRouterId)}`, {
              method: "POST",
              body: JSON.stringify(body)
            });
            state.bindingNotice = "Binding applied to the router.";
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
          }
        });
        panel.querySelectorAll("[data-binding-toggle]").forEach((button) => button.addEventListener("click", async () => {
          const disabled = button.dataset.disabled === "true";
          if (!window.confirm(`${disabled ? "Enable" : "Disable"} this router binding?`)) return;
          button.disabled = true;
          try {
            await request(`/api/v1/ip-bindings/${encodeURIComponent(state.bindingRouterId)}/${encodeURIComponent(button.dataset.bindingToggle)}`, {
              method: "PATCH",
              body: JSON.stringify({ disabled: !disabled })
            });
            state.bindingNotice = `Binding ${disabled ? "enabled" : "disabled"} on the router.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Binding could not be updated: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-binding-delete]").forEach((button) => button.addEventListener("click", async () => {
          if (!window.confirm("Permanently remove this binding from the router?")) return;
          button.disabled = true;
          try {
            await request(`/api/v1/ip-bindings/${encodeURIComponent(state.bindingRouterId)}/${encodeURIComponent(button.dataset.bindingDelete)}`, { method: "DELETE" });
            state.bindingNotice = "Binding removed from the router.";
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Binding could not be removed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
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
        const [voucherResult, statsResult, planResult] = await Promise.allSettled([
          request("/api/v1/vouchers/?page=1&size=100"),
          request("/api/v1/vouchers/stats"),
          state.creatingVouchers ? request("/api/v1/plans/?page=1&size=100") : Promise.resolve(null)
        ]);
        if (voucherResult.status === "rejected") throw voucherResult.reason;
        const vouchers = listOf(voucherResult.value, "vouchers");
        const stats = statsResult.status === "fulfilled" ? payloadOf(statsResult.value) : {};
        const plans = planResult.status === "fulfilled" ? listOf(planResult.value, "plans") : [];
        const batch = state.voucherBatch?.vouchers;
        panel.innerHTML = `${sectionHeading("Voucher inventory", "Generate, review, disable, and re-enable voucher codes for active tenant packages.")}${state.voucherNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.voucherNotice)}</div>` : ""}<div class="workspace-metrics"><div class="workspace-metric"><span>Total vouchers</span><strong>${escapeHtml(stats.total_vouchers ?? "—")}</strong></div><div class="workspace-metric"><span>Active</span><strong>${escapeHtml(stats.active_vouchers ?? "—")}</strong></div><div class="workspace-metric"><span>Used</span><strong>${escapeHtml(stats.used_vouchers ?? "—")}</strong></div><div class="workspace-metric"><span>Expired</span><strong>${escapeHtml(stats.expired_vouchers ?? "—")}</strong></div></div><div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-voucher-create">Generate vouchers</button>` : ""}</div>${statsResult.status === "rejected" ? `<div class="workspace-error" role="alert">Voucher statistics unavailable: ${escapeHtml(statsResult.reason.message || "request failed")}</div>` : ""}${state.creatingVouchers ? planResult.status === "rejected" ? `<div class="workspace-error" role="alert">Packages unavailable: ${escapeHtml(planResult.reason.message || "request failed")}</div>` : voucherFormMarkup(plans) : ""}${batch ? `<section class="workspace-dashboard-card workspace-voucher-batch"><div class="workspace-card-heading"><div><span class="workspace-kicker">NEW VOUCHER BATCH</span><h2>${escapeHtml(state.voucherBatch.count)} codes · batch ${escapeHtml(state.voucherBatch.batch_id)}</h2></div><button type="button" class="workspace-inline-link" data-voucher-batch-dismiss>Dismiss</button></div><p class="workspace-note">Save these credentials now. Voucher passwords are not displayed in the inventory list.</p>${table([{ label: "Voucher", key: "code" }, { label: "Username", key: "hotspot_username" }, { label: "Password", key: "hotspot_password" }], batch, "No vouchers returned.")}</section>` : ""}${table([
          { label: "Voucher", render: (item) => escapeHtml(item.code ? `****${String(item.code).slice(-4)}` : "—") },
          { label: "Package", key: "plan_name" }, { label: "Status", render: (item) => statusCell(item.status) },
          { label: "Bandwidth", key: "bandwidth_limit" }, { label: "Used", render: (item) => dateCell(item.used_at) },
          { label: "Expires", render: (item) => dateCell(item.expires_at) },
          ...(isAdmin ? [{ label: "Actions", render: (item) => {
            const status = String(item.status || "").toLowerCase();
            if (!["active", "disabled"].includes(status)) return "—";
            return `<button type="button" class="workspace-row-action ${status === "active" ? "workspace-row-danger" : ""}" data-voucher-status="${escapeHtml(item.id)}" data-status="${status}">${status === "active" ? "Disable" : "Re-enable"}</button>`;
          } }] : [])
        ], vouchers, "No vouchers were returned.")}`;
        panel.querySelector("#workspace-voucher-create")?.addEventListener("click", () => {
          state.creatingVouchers = true;
          state.voucherNotice = "";
          loadSection();
        });
        panel.querySelectorAll("[data-voucher-cancel]").forEach((button) => button.addEventListener("click", () => {
          state.creatingVouchers = false;
          loadSection();
        }));
        panel.querySelector("[data-voucher-batch-dismiss]")?.addEventListener("click", () => {
          state.voucherBatch = null;
          loadSection();
        });
        panel.querySelectorAll("[data-voucher-status]").forEach((button) => button.addEventListener("click", async () => {
          const nextStatus = button.dataset.status === "active" ? "disabled" : "active";
          if (!window.confirm(`${nextStatus === "disabled" ? "Disable" : "Re-enable"} this voucher?`)) return;
          button.disabled = true;
          try {
            await request(`/api/v1/vouchers/${encodeURIComponent(button.dataset.voucherStatus)}`, {
              method: "PATCH",
              body: JSON.stringify({ status: nextStatus })
            });
            state.voucherNotice = `Voucher ${nextStatus === "disabled" ? "disabled" : "re-enabled"}.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Voucher status could not be changed: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelector("#workspace-voucher-form")?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('button[type="submit"]');
          const feedback = form.querySelector(".workspace-form-feedback");
          const raw = Object.fromEntries(new FormData(form).entries());
          const body = {
            plan_id: Number(raw.plan_id),
            count: Number(raw.count),
            code_format: String(raw.code_format).trim(),
            expires_in_days: raw.expires_in_days ? Number(raw.expires_in_days) : null
          };
          submit.disabled = true;
          feedback.hidden = true;
          try {
            state.voucherBatch = await request("/api/v1/vouchers/generate", {
              method: "POST",
              body: JSON.stringify(body)
            });
            state.creatingVouchers = false;
            state.voucherNotice = `${state.voucherBatch.count} voucher credentials generated. Store them securely.`;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
          }
        });
        return;
      }

      if (state.activeTab === "notifications") {
        const result = await request("/api/v1/notifications/?page=1&size=50");
        const payload = payloadOf(result);
        const notifications = listOf(result, "notifications");
        panel.innerHTML = `${sectionHeading("Your notifications", "This inbox is scoped to your signed-in user account. Delivery settings are managed separately in ISP settings.")}${state.notificationNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.notificationNotice)}</div>` : ""}<div class="workspace-metrics"><div class="workspace-metric"><span>Notifications</span><strong>${escapeHtml(payload.total ?? notifications.length)}</strong></div><div class="workspace-metric"><span>Unread on this page</span><strong>${notifications.filter((item) => !item.is_read).length}</strong></div></div>${table([{ label: "Title", key: "title" }, { label: "Message", key: "message" }, { label: "Type", render: (item) => statusCell(item.notification_type) }, { label: "Priority", render: (item) => statusCell(item.priority) }, { label: "Received", render: (item) => dateCell(item.created_at) }, { label: "Status", render: (item) => item.is_read ? "Read" : "Unread" }, { label: "Actions", render: (item) => `<button type="button" class="workspace-row-action" data-notification-read="${escapeHtml(item.id)}" data-read="${item.is_read ? "true" : "false"}">${item.is_read ? "Mark unread" : "Mark read"}</button><button type="button" class="workspace-row-action workspace-row-danger" data-notification-delete="${escapeHtml(item.id)}">Delete</button>` }], notifications, "No notifications are available for this account.")}<div class="workspace-pagination"><span>Page ${escapeHtml(payload.page ?? 1)} · ${escapeHtml(payload.total ?? notifications.length)} notifications</span></div>`;
        panel.querySelectorAll("[data-notification-read]").forEach((button) => button.addEventListener("click", async () => {
          const action = button.dataset.read === "true" ? "unread" : "read";
          button.disabled = true;
          try {
            await request(`/api/v1/notifications/${encodeURIComponent(button.dataset.notificationRead)}/${action}`, { method: "PATCH" });
            state.notificationNotice = `Notification marked ${action}.`;
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Notification could not be updated: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
        panel.querySelectorAll("[data-notification-delete]").forEach((button) => button.addEventListener("click", async () => {
          if (!window.confirm("Delete this notification from your inbox?")) return;
          button.disabled = true;
          try {
            await request(`/api/v1/notifications/${encodeURIComponent(button.dataset.notificationDelete)}`, { method: "DELETE" });
            state.notificationNotice = "Notification deleted.";
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Notification could not be deleted: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        }));
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
          : [];
        const channelLoadError = results[0].status === "rejected"
          ? results[0].reason.message || "Payment channel status is unavailable."
          : "";
        panel.innerHTML = `${sectionHeading("Payment gateways", "Configure PayHero payment channels per tenant. PayHero generates the internal channel ID automatically.")}${state.channelNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.channelNotice)}</div>` : ""}<div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-channel-create">Register PayHero channel</button>` : ""}</div>${state.creatingChannel ? `<form class="workspace-form" id="workspace-channel-form"><div class="workspace-form-grid"><label>Payment method<select name="channel_type"><option value="till">Till</option><option value="paybill">PayBill</option><option value="bank">Bank</option></select></label><label>Short code / Till number<input name="short_code" required></label><label>Merchant account number<input name="account_number" required></label><label>Description<input name="description"></label></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Save and register with PayHero</button><button class="workspace-secondary-button" type="button" data-channel-cancel>Cancel</button></div><div class="workspace-form-feedback" role="alert" hidden></div></form>` : ""}${table([{ label: "Method", key: "channel_type" }, { label: "Short code", key: "short_code" }, { label: "PayHero ID", key: "payhero_channel_id" }, { label: "Status", render: (item) => statusCell(item.status) }, { label: "Active", render: (item) => item.is_active ? "Yes" : "No" }, { label: "Verified", render: (item) => item.is_verified ? "Yes" : "No" }], state.paymentChannels, "No payment channels configured.")}`;
        if (channelLoadError) {
          const errorNotice = document.createElement("div");
          errorNotice.className = "workspace-error";
          errorNotice.setAttribute("role", "alert");
          errorNotice.textContent = channelLoadError;
          panel.append(errorNotice);
        } else if (!state.paymentChannels.length) {
          const statusNotice = document.createElement("div");
          statusNotice.className = "workspace-note";
          statusNotice.setAttribute("role", "status");
          statusNotice.textContent = "Not configured. Register a PayHero channel to begin.";
          panel.append(statusNotice);
        }
        const channelErrors = state.paymentChannels.map((channel) => channel.last_error).filter(Boolean);
        if (channelErrors.length) {
          const errorNotice = document.createElement("div");
          errorNotice.className = "workspace-error";
          errorNotice.setAttribute("role", "alert");
          errorNotice.textContent = channelErrors.join(" ");
          panel.append(errorNotice);
        }
        const configChannelForm = panel.querySelector("#workspace-channel-form");
        configChannelForm?.querySelector(".workspace-form-grid")?.insertAdjacentHTML(
          "beforeend",
          `<label>PayHero account ID (not the channel ID)<input name="account_id" type="number" min="1" step="1" autocomplete="off"><small>PayHero requires this merchant account ID to create a channel. The channel ID is generated automatically. Required for the first channel; leave blank on retries to reuse the saved account.</small></label><label>PayHero Basic Auth token<input name="api_token" type="password" autocomplete="new-password"><small>Paste the Basic Auth token from your PayHero API Keys page. ISPFlow encrypts it at rest. Leave blank on a retry to reuse the saved token.</small></label>`
        );
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
          request("/api/v1/reports/analytics/dashboard-charts")
        ]);
        const analytics = results[0].status === "fulfilled" ? payloadOf(results[0].value) : null;
        if (!analytics && results[1].status === "rejected") throw results[0].reason;
        const billing = analytics?.billing || {};
        const subscriptions = analytics?.subscriptions || {};
        const routers = analytics?.routers || {};
        const charts = results[1].status === "fulfilled" ? payloadOf(results[1].value) : null;
        panel.innerHTML = `${sectionHeading("Reports & CSV exports", "Analytics are returned by the backend. CSV downloads are authenticated and tenant-scoped.")}${analytics ? `<div class="workspace-metrics"><div class="workspace-metric"><span>Invoice revenue · 30d</span><strong>${amountCell(billing.total_revenue)}</strong></div><div class="workspace-metric"><span>Subscriptions created · 30d</span><strong>${escapeHtml(subscriptions.total_subscriptions ?? "—")}</strong></div><div class="workspace-metric"><span>Routers online</span><strong>${escapeHtml(routers.online_routers ?? "—")} / ${escapeHtml(routers.total_routers ?? "—")}</strong></div></div>` : `<div class="workspace-error">Analytics unavailable: ${escapeHtml(results[0].reason.message || "request failed")}</div>`}${charts ? `<div class="workspace-dashboard-grid workspace-report-charts">${chartPanel("Payments by month", charts.payments_chart || [], "month", "payments")}${chartPanel("Plan utilization", charts.package_utilization_chart || [], "name", "value")}${chartPanel("Subscriber activity", charts.active_users_chart || [], "day", "hotspot")}</div>` : `<div class="workspace-error">Chart data unavailable: ${escapeHtml(results[1].status === "rejected" ? results[1].reason.message || "request failed" : "No chart series returned.")}</div>`}<div class="workspace-export-actions"><button class="button button-light" data-export="subscriptions">Download subscriptions CSV</button><button class="button button-light" data-export="billing">Download billing CSV</button></div><h3 class="workspace-subheading">Payment Channels (PayHero)</h3>${state.channelNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.channelNotice)}</div>` : ""}<div class="workspace-list-toolbar">${isAdmin ? `<button class="workspace-primary-button" type="button" id="workspace-channel-create">Register channel</button>` : ""}</div>${state.creatingChannel ? `<form class="workspace-form" id="workspace-channel-form"><div class="workspace-form-grid"><label>Channel type<select name="channel_type"><option value="till">Till</option><option value="paybill">PayBill</option><option value="bank">Bank</option></select></label><label>Short code / Till number<input name="short_code" required></label><label>Account number<input name="account_number"></label><label>Description<input name="description"></label></div><div class="workspace-form-actions"><button class="workspace-primary-button" type="submit">Register with PayHero</button><button class="workspace-secondary-button" type="button" data-channel-cancel>Cancel</button></div><div class="workspace-form-feedback" role="alert" hidden></div></form>` : ""}${table([{ label: "Type", key: "channel_type" }, { label: "Short code", key: "short_code" }, { label: "PayHero ID", key: "payhero_channel_id" }, { label: "Active", render: (item) => item.is_active ? "Yes" : "No" }, { label: "Verified", render: (item) => item.is_verified ? "Yes" : "No" }], state.paymentChannels, "No payment channels registered.")}</div>`;
        panel.querySelectorAll(".workspace-export-actions").forEach((exports) => {
          let sibling = exports.nextElementSibling;
          while (sibling) {
            const next = sibling.nextElementSibling;
            sibling.remove();
            sibling = next;
          }
        });
        panel.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", () => exportCsv(button.dataset.export, button)));
        return;
      }

      if (state.activeTab === "integrity") {
        if (!isOwner) {
          panel.innerHTML = renderError("Data integrity", new Error("This platform-level check is not available to ISP tenants."));
          return;
        }
        const result = await request("/api/v1/admin/data-integrity/check");
        panel.innerHTML = `${sectionHeading("Platform data integrity", "This check is global and platform-owner-only. It is read-only; tenant administrators cannot access it.")}${state.integrityNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.integrityNotice)}</div>` : ""}<div class="workspace-form-actions"><button class="workspace-secondary-button" type="button" id="workspace-integrity-log">Log reported issues</button></div><pre class="workspace-json">${escapeHtml(JSON.stringify(payloadOf(result), null, 2))}</pre>`;
        panel.querySelector("#workspace-integrity-log")?.addEventListener("click", async (event) => {
          if (!window.confirm("Write the current global integrity findings to the system log?")) return;
          const button = event.currentTarget;
          button.disabled = true;
          try {
            const logged = await request("/api/v1/admin/data-integrity/log-issues", { method: "POST" });
            state.integrityNotice = payloadOf(logged).message || "Integrity findings logged.";
            await loadSection();
          } catch (error) {
            button.disabled = false;
            const alert = document.createElement("div");
            alert.className = "workspace-error";
            alert.setAttribute("role", "alert");
            alert.textContent = `Integrity findings could not be logged: ${error.message || String(error)}`;
            panel.prepend(alert);
          }
        });
        return;
      }

      if (state.activeTab === "settings") {
        const endpoints = ["organization", "business", "hotspot", "pppoe", "notifications"];
        const results = [];
        for (const endpoint of endpoints) {
          try {
            results.push({ status: "fulfilled", value: await request(`/api/v1/tenant/settings/${endpoint}`) });
          } catch (reason) {
            results.push({ status: "rejected", reason });
          }
        }
        const settingsFields = {
          organization: [
            { name: "name", label: "ISP name", maxLength: 200 },
            { name: "phone", label: "Contact phone", maxLength: 20 },
            { name: "address", label: "Address", maxLength: 500, wide: true },
            { name: "timezone", label: "Timezone (IANA)", maxLength: 64, help: "Example: Africa/Nairobi." }
          ],
          business: [
            { name: "currency", label: "Currency", minLength: 3, maxLength: 3 },
            { name: "tax_rate", label: "Tax rate (%)", type: "number", min: 0, max: 100 },
            { name: "invoice_prefix", label: "Invoice prefix", maxLength: 10 },
            { name: "invoice_notes", label: "Invoice notes", type: "textarea", wide: true },
            { name: "terms_and_conditions", label: "Terms and conditions", type: "textarea", wide: true, rows: 5 },
            { name: "privacy_policy", label: "Privacy policy", type: "textarea", wide: true, rows: 5 }
          ],
          hotspot: [
            { name: "username_prefix", label: "Username prefix", maxLength: 10 },
            { name: "hotspot_template", label: "Portal template", maxLength: 50 },
            { name: "prune_inactive_users_days", label: "Prune inactive users after days", type: "number", min: 1, max: 365 },
            { name: "redirect_url", label: "After-login redirect URL", type: "url", maxLength: 500 },
            { name: "voucher_format", label: "Voucher format", maxLength: 50 },
            { name: "voucher_length", label: "Voucher length", type: "number", min: 4, max: 20 },
            { name: "session_timeout_minutes", label: "Session timeout (minutes)", type: "number", min: 1, max: 1440 },
            { name: "show_packages_on_portal", label: "Show packages on portal", type: "boolean" },
            { name: "allow_guest_purchases", label: "Allow guest purchases", type: "boolean" },
            { name: "auto_disconnect_expired", label: "Disconnect expired accounts", type: "boolean" }
          ],
          pppoe: [
            { name: "require_username_approval", label: "Require username approval", type: "boolean" },
            { name: "allow_self_registration", label: "Allow self-registration", type: "boolean" },
            { name: "session_timeout_minutes", label: "Session timeout (minutes)", type: "number", min: 1, max: 1440 },
            { name: "auto_disconnect_expired", label: "Disconnect expired accounts", type: "boolean" },
            { name: "auto_suspend_days", label: "Auto-suspend after days", type: "number", min: 1, max: 365 }
          ],
          notifications: [
            { name: "enable_mikrotik_status_notifications", label: "Router status notifications", type: "boolean" },
            { name: "send_hotspot_payment_confirmation", label: "Hotspot payment confirmations", type: "boolean" },
            { name: "send_pppoe_payment_confirmation", label: "PPPoE payment confirmations", type: "boolean" },
            { name: "send_hotspot_expiry_notification", label: "Hotspot expiry notifications", type: "boolean" },
            { name: "send_pppoe_expiry_notification", label: "PPPoE expiry notifications", type: "boolean" },
            { name: "send_hotspot_expiry_reminder", label: "Hotspot expiry reminders", type: "boolean" },
            { name: "send_pppoe_expiry_reminder", label: "PPPoE expiry reminders", type: "boolean" },
            { name: "enable_email_subscription_reminders", label: "Email subscription reminders", type: "boolean" },
            { name: "send_pppoe_email_reminders", label: "PPPoE email reminders", type: "boolean" },
            { name: "hotspot_payment_confirmation_sms", label: "Hotspot payment SMS template", type: "textarea", wide: true },
            { name: "pppoe_payment_confirmation_sms", label: "PPPoE payment SMS template", type: "textarea", wide: true },
            { name: "hotspot_expiry_notification_sms", label: "Hotspot expiry SMS template", type: "textarea", wide: true },
            { name: "pppoe_expiry_notification_sms", label: "PPPoE expiry SMS template", type: "textarea", wide: true },
            { name: "hotspot_expiry_reminder_sms", label: "Hotspot reminder SMS template", type: "textarea", wide: true },
            { name: "pppoe_expiry_reminder_sms", label: "PPPoE reminder SMS template", type: "textarea", wide: true },
            { name: "pppoe_email_reminder_subject", label: "PPPoE email reminder subject", maxLength: 200 },
            { name: "pppoe_email_reminder_message", label: "PPPoE email reminder message", type: "textarea", wide: true, rows: 5 }
          ]
        };
        const content = results.map((result, index) => {
          const endpoint = endpoints[index];
          if (result.status === "rejected") return `<section class="workspace-dashboard-card"><h2>${escapeHtml(endpoint)} settings</h2><div class="workspace-error" role="alert">Could not load: ${escapeHtml(result.reason.message || String(result.reason))}</div></section>`;
          const values = payloadOf(result.value);
          return settingsFormMarkup(endpoint[0].toUpperCase() + endpoint.slice(1), `/api/v1/tenant/settings/${endpoint}`, values, settingsFields[endpoint]);
        }).join("");
        panel.innerHTML = `${sectionHeading("ISP settings", "Manage tenant-scoped organization, billing, hotspot, PPPoE, and notification preferences. Notification templates/settings do not send SMS; delivery is handled by the configured messaging service.")}${state.settingsNotice ? `<div class="workspace-note" role="status">${escapeHtml(state.settingsNotice)}</div>` : ""}<div class="workspace-settings-stack">${content}</div>`;
        panel.querySelectorAll("[data-settings-endpoint]").forEach((form) => form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const target = event.currentTarget;
          const submit = target.querySelector('button[type="submit"]');
          const feedback = target.querySelector(".workspace-form-feedback");
          const body = {};
          for (const field of target.elements) {
            if (!field.name) continue;
            if (field.type === "checkbox") body[field.name] = field.checked;
            else if (field.type === "number") body[field.name] = field.value === "" ? null : Number(field.value);
            else body[field.name] = field.value;
          }
          submit.disabled = true;
          feedback.hidden = true;
          try {
            await request(target.dataset.settingsEndpoint, { method: "PATCH", body: JSON.stringify(body) });
            state.settingsNotice = `${target.querySelector("h3").textContent} saved.`;
            await loadSection();
          } catch (error) {
            feedback.textContent = error.message || String(error);
            feedback.hidden = false;
            submit.disabled = false;
          }
        }));
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
    holder.querySelector("#workspace-menu-toggle")?.addEventListener("click", () => {
      const shell = holder.querySelector(".workspace-shell");
      const collapsed = shell?.classList.toggle("sidebar-collapsed");
      const btn = holder.querySelector("#workspace-menu-toggle");
      if (btn) btn.setAttribute("aria-expanded", String(!collapsed));
    });
    holder.querySelector(".workspace-shell")?.addEventListener("click", (event) => {
      const shell = event.currentTarget;
      if (event.target !== shell || shell.classList.contains("sidebar-collapsed")) return;
      shell.classList.add("sidebar-collapsed");
      holder.querySelector("#workspace-menu-toggle")?.setAttribute("aria-expanded", "false");
    });
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
      if (window.matchMedia("(max-width: 760px)").matches) {
        holder.querySelector(".workspace-shell")?.classList.add("sidebar-collapsed");
        holder.querySelector("#workspace-menu-toggle")?.setAttribute("aria-expanded", "false");
      }
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
  loadSection();
}



