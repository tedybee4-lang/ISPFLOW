import "./styles.css";
import { mountWorkspace } from "./workspace.js";

const DEFAULT_API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://127.0.0.1:8000"
  : "https://api.ispflow.co.ke";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");

const featureItems = [
  ["Subscriber CRM & leads", "Manage customer and lead records through tenant-scoped APIs; bulk import and sales automation still need verification.", "partial"],
  ["PPPoE operations", "PPPoE service and provisioning surfaces exist. Validate authentication on configured RouterOS or RADIUS infrastructure.", "partial"],
  ["Hotspot captive portal", "Hotspot portal and handoff endpoints exist. Templates, redirects and internet access need a controlled router test.", "partial"],
  ["MikroTik provisioning", "RouterOS integration and polling-agent workflows exist; real changes require an authorized lab router.", "partial"],
  [\"Payment automation\", \"PayHero is the shared platform gateway. Tenant payment destinations are registered per ISP.\"],
  ["Invoices & billing", "Invoice and payment records can be managed through API routes; reconciliation and activation need end-to-end verification.", "partial"],
  ["Voucher management", "Voucher generation and redemption endpoints exist; allocation and settlement need operational verification.", "partial"],
  ["Customer self-service", "Customer portal APIs cover parts of supported hotspot and PPPoE workflows; the complete customer UI is not implemented.", "partial"],
  ["Router monitoring", "Router status and agent-reported health are available when a router and reporting agent are configured.", "partial"],
  ["Support & tickets", "Support ticket APIs exist; SLA, escalation and staff workflow coverage remains incomplete.", "partial"],
  ["Reports & analytics", "Tenant-scoped analytics and export routes exist; metrics depend on available operational data.", "partial"],
  ["Multi-tenant SaaS & roles", "Organizations, tenant scope and platform/ISP roles exist; verify all authorization boundaries before production.", "partial"],
  ["FreeRADIUS & RADIUS accounting", "No verified FreeRADIUS authentication or accounting integration is included in this checkout.", "unavailable"],
  [\"PayHero\", \"Tenant payment destinations and STK push are implemented and tested.\", \"implemented\"]
];

const integrationItems = [
  { name: "MikroTik RouterOS", state: "Implemented in repository", detail: "RouterOS API and polling-agent/provisioning code are present. A real router, credentials and end-to-end access test are still required." },
  { name: "M-PESA", state: "Retired", detail: "Direct M-PESA integration has been removed. Payments are now processed through PayHero." },
  { name: "PayHero", state: "Implemented", detail: "PayHero is configured as the shared platform gateway. Tenant payment destinations and STK push are implemented and tested." },
  { name: "FreeRADIUS / RADIUS", state: "Not verified", detail: "No FreeRADIUS client or accounting integration was confirmed in this checkout. RADIUS setup requires implementation and a test server." },
  { name: "Notifications", state: "Configuration-dependent", detail: "Delivery is delegated to a central notifications service in the backend. No local provider is configured or verified." },
  { name: "Redis", state: "Local service available", detail: "Redis is used for local caching, rate limits and multi-step onboarding sessions. The local instance is not an external customer service." }
];

const featureDetails = {
  subscribers: ["Subscriber CRM", "Subscriber and user management APIs are present. Verify import/export behavior and tenant scoping against the deployed configuration before migration."],
  pppoe: ["PPPoE", "The backend exposes PPPoE portal and provisioning flows. A database status is not evidence that a PPPoE session authenticated; validate using a configured test router/RADIUS."],
  hotspot: ["Hotspot captive portal", "Hotspot portal APIs and RouterOS provisioning workflows exist. Router template deployment, certificate trust, redirect and actual Internet access require a controlled test router."],
  provisioning: ["MikroTik provisioning", "Provisioning workflows, RouterOS integrations and router-agent code are present. Apply changes only to an authorized lab router and confirm the resulting service."],
  billing: ["Billing & payments", "Billing and payment routes exist. Payments are processed via PayHero."],
  vouchers: ["Vouchers", "Voucher-related backend surfaces exist. Stock, allocations, redemption and settlement should be tested against the operator's actual process."],
  support: ["Support operations", "Support-related APIs are present. SLA configuration, escalation and analytics require operational verification."],
  reports: ["Reports & analytics", "Reporting APIs are present. The public marketing site does not display private operational data."],
  tenants: ["Multi-tenant operations", "Organization models, onboarding and authorization exist. Isolation must be verified for each endpoint before production use."],
  accounting: ["Network accounting", "Accounting displays and enforcement depend on configured RouterOS/RADIUS capabilities. A network-enforced quota or accounting feed is not assumed."],
  monitoring: ["Router monitoring", "Router health depends on configured routers/agents. This local preview has no real router connected."],
  customer: ["Customer self-service", "Customer portal APIs exist. End-to-end renewal and support workflows depend on tenant, payment and network configuration."]
};

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function routeLink(path, label, className = "") {
  return `<a class="${className}" data-route href="${path}">${label}</a>`;
}

function icon(name) {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M8 8a5.5 5.5 0 0 0 0 8m8-8a5.5 5.5 0 0 1 0 8"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    bolt: '<path d="m13 2-3 8h7l-6 12 2-9H6l7-11Z"/>',
    chart: '<path d="M3 3v18h18M8 15l4-4 4 3 5-7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    receipt: '<path d="M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2-4-2Z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.layers}</svg>`;
}

function logo() {
  return `<a class="brand" data-route href="/" aria-label="ISPFlow home"><span class="brand-mark">if</span><span>ISP<span class="brand-accent">Flow</span></span></a>`;
}

function header() {
  return `<header class="site-header"><div class="container nav-wrap">
    ${logo()}
    <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button>
    <nav class="main-nav" aria-label="Main navigation">
      ${routeLink("/", "Product")}
      ${routeLink("/features", "Features")}
      ${routeLink("/integrations", "Integrations")}
      ${routeLink("/pricing", "Pricing")}
      ${routeLink("/docs", "Documentation")}
      ${routeLink("/contact", "Contact")}
      <div class="nav-actions">${routeLink("/login", "Sign in", "nav-signin")}${routeLink("/register", "Get started", "button button-small button-dark")}</div>
    </nav>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container">
    <div class="footer-top"><div class="footer-brand">${logo()}<p>One workspace for the work behind a better-connected ISP.</p></div>
      <div class="footer-col"><strong>Explore</strong>${routeLink("/features", "Features")}${routeLink("/integrations", "Integrations")}${routeLink("/pricing", "Pricing")}${routeLink("/docs", "Documentation")}</div>
      <div class="footer-col"><strong>ISPFlow</strong>${routeLink("/about", "About")}${routeLink("/contact", "Contact")}${routeLink("/status", "Service status")}${routeLink("/login", "Sign in")}</div>
      <div class="footer-col"><strong>Policies</strong>${routeLink("/privacy", "Privacy")}${routeLink("/terms", "Terms")}</div>
    </div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ISPFlow</span><span>Product capabilities vary by configuration and connected equipment.</span></div>
  </div></footer>`;
}

function shell(content) {
  return `${header()}<main id="main-content">${content}</main>${footer()}`;
}

function statusTag(state) {
  const label = state === "implemented" ? "In repository" : state === "unavailable" ? "Not verified" : "Configuration-dependent";
  return `<span class="status-tag status-${state}">${label}</span>`;
}

function homePage() {
  const cards = [
    ["users", "Subscriber operations", "Keep service, customer and operational workflows in view."],
    ["receipt", "Billing workflows", "Follow billing records and payment status without conflating a request with a verified payment."],
    ["radio", "Network provisioning", "Connect supported RouterOS workflows to the wider subscriber lifecycle."],
    ["chart", "Operational visibility", "Bring available network, customer and finance signals into one place."]
  ];
  return `<section class="hero"><div class="container hero-grid"><div class="hero-copy">
    <div class="eyebrow"><span class="eyebrow-dot"></span> A connected workspace for internet providers</div>
    <h1>ISP billing.<br><span>Network in flow.</span></h1>
    <p class="hero-intro">Bring ISP billing, MikroTik network management, automatic provisioning workflows and customer payment records into one operational workspace. See what is configured, what needs attention, and what still depends on your network or provider.</p>
    <div class="hero-actions">${routeLink("/register", "Get started " + icon("arrow"), "button button-dark")}${routeLink("/features", "Explore features", "button button-light")}</div>
    <p class="hero-note">${icon("shield")} Live access depends on your network, provider and configuration.</p>
  </div><div class="hero-visual" aria-label="Illustrative ISPFlow product dashboard preview">
    <div class="preview-window"><div class="preview-bar"><div class="window-dots"><i></i><i></i><i></i></div><span>ispflow / overview</span><span class="preview-status"><b></b> Preview</span></div>
      <div class="preview-body"><aside class="preview-side"><div class="preview-mini-logo">if</div><span class="side-active"></span><i></i><i></i><i></i><i></i></aside>
        <div class="preview-main"><div class="preview-title"><div><small>MONDAY, OCTOBER 19</small><h3>Network overview</h3></div><span class="preview-avatar">A</span></div>
          <div class="metric-grid"><div class="metric-card"><span>Subscribers</span><strong>1,248</strong><em>Illustrative</em></div><div class="metric-card"><span>Billing status</span><strong>Ready</strong><em>Illustrative</em></div></div>
          <div class="network-card"><div class="network-head"><b>Network activity</b><span>Illustrative data</span></div><div class="chart-area"><div class="chart-y"><span>80</span><span>60</span><span>40</span><span>20</span></div><svg viewBox="0 0 420 110" preserveAspectRatio="none" role="img" aria-label="Illustrative network activity line chart"><path d="M0 80 C35 78 42 48 78 57 S125 88 159 62 S206 52 235 58 S281 20 313 36 S358 61 388 28 S405 33 420 12" fill="none" stroke="#8cae31" stroke-width="3"/><path d="M0 80 C35 78 42 48 78 57 S125 88 159 62 S206 52 235 58 S281 20 313 36 S358 61 388 28 S405 33 420 12 V110 H0Z" fill="url(#fill)" opacity=".16"/><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#b5d94a"/><stop offset="1" stop-color="#b5d94a" stop-opacity="0"/></linearGradient></defs></svg></div><div class="chart-x"><span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span></div></div>
          <div class="preview-bottom"><span><i class="status-dot green"></i> Router status</span><b>Illustrative only</b><span>Automations <i class="status-dot green"></i></span></div>
        </div>
      </div><div class="preview-disclaimer">Illustrative product preview · not live customer or network data</div>
    </div><div class="float-chip chip-one">${icon("bolt")} Provisioning workflows</div><div class="float-chip chip-two">${icon("layers")} One connected view</div>
  </div></div></section>
  <section class="trust-strip"><div class="container trust-inner"><span>BUILT FOR THE EVERYDAY WORK OF AN ISP</span><div><span>${icon("users")} Subscribers</span><span>${icon("receipt")} Billing</span><span>${icon("radio")} Network</span><span>${icon("chart")} Operations</span></div></div></section>
  <section class="section section-white" id="how-it-works"><div class="container"><div class="section-heading"><div class="eyebrow">A clearer operating rhythm</div><h2>From first connection<br>to a growing network.</h2><p>Bring the moving parts of ISP operations together in a workflow your team can understand.</p></div>
    <div class="steps-grid"><article class="step-card"><span class="step-no">01</span><div class="step-icon">${icon("radio")}</div><h3>Connect your network</h3><p>Register supported routers and prepare the access methods your service uses.</p></article><article class="step-card"><span class="step-no">02</span><div class="step-icon">${icon("users")}</div><h3>Organize subscribers</h3><p>Manage customer and service information with role-aware operational workflows.</p></article><article class="step-card"><span class="step-no">03</span><div class="step-icon">${icon("receipt")}</div><h3>Track billing & payments</h3><p>Keep invoices, payment verification and service activation as distinct steps.</p></article><article class="step-card"><span class="step-no">04</span><div class="step-icon">${icon("bolt")}</div><h3>Provision with care</h3><p>Apply supported network changes, verify outcomes and make failures visible.</p></article></div>
  </div></section>
  <section class="section section-sage"><div class="container"><div class="section-heading section-heading-row"><div><div class="eyebrow">One platform, connected workflows</div><h2>Tools for the real work<br>behind connectivity.</h2></div><p>Explore the operational areas ISPFlow is built around. Implementation and availability varies by feature; external providers and network equipment require configuration.</p></div>
    <div class="feature-grid">${cards.map(([ico, title, copy]) => `<article class="feature-card"><div class="feature-icon">${icon(ico)}</div><h3>${title}</h3><p>${copy}</p>${routeLink("/features", "See capabilities " + icon("arrow"), "text-link")}</article>`).join("")}</div>
    <div class="home-feature-catalogue" aria-label="ISPFlow feature areas">${featureItems.map(([name, , state]) => `<a href="/features" data-route class="home-feature-chip"><span>${esc(name)}</span>${statusTag(state)}</a>`).join("")}</div>
    <div class="feature-cta">${routeLink("/features", "View the full feature catalogue " + icon("arrow"), "button button-dark")}</div>
  </div></section>
  <section class="section integrations-band"><div class="container integrations-layout"><div><div class="eyebrow eyebrow-light">Designed to connect</div><h2>Integrations with clear status—not guesswork.</h2><p>See what is implemented in this repository, what needs provider setup, and what still requires engineering work.</p>${routeLink("/integrations", "Explore integrations " + icon("arrow"), "button button-lime")}</div>
    <div class="integration-list"><div><span class="integration-symbol mikrotik-symbol">M</span><span><b>MikroTik RouterOS</b><small>RouterOS API and provisioning workflows in repository</small></span><i class="mini-check">${icon("check")}</i></div><div><span class="integration-symbol mpesa-symbol">P</span><span><b>PayHero</b><small>Shared platform payment gateway · tenant payment destinations</small></span><i class="mini-check">${icon("check")}</i></div><div><span class="integration-symbol">R</span><span><b>FreeRADIUS</b><small>Not verified in this checkout</small></span><i class="mini-pending">?</i></div></div>
  </div></section>
  <section class="section section-white"><div class="container value-layout"><div class="value-copy"><div class="eyebrow">Less fragmentation. More clarity.</div><h2>Make operational work easier to see.</h2><p>Keep important service steps in one place, make follow-up clearer and help teams understand what has—and has not—completed.</p><ul class="check-list"><li>${icon("check")} Reduce manual hand-offs between billing and network work</li><li>${icon("check")} See configured router and service workflows together</li><li>${icon("check")} Keep provider verification separate from payment initiation</li><li>${icon("check")} Give staff a more consistent operational view</li></ul></div><div class="value-note"><div class="value-note-icon">${icon("shield")}</div><h3>Honest about the last mile.</h3><p>Software can organize workflows. Actual Internet access still depends on your router, authentication setup, payment provider and local network.</p>${routeLink("/integrations", "Review integration status " + icon("arrow"), "text-link")}</div></div></section>
  <section class="section section-sage pricing-teaser"><div class="container pricing-teaser-inner"><div><div class="eyebrow">Straightforward next step</div><h2>Pricing is coming soon.</h2><p>We won’t invent plan prices. Contact the ISPFlow team when a verified pricing catalogue is available.</p></div><div class="pricing-teaser-actions">${routeLink("/pricing", "View pricing status", "button button-light")}${routeLink("/contact", "Contact us " + icon("arrow"), "text-link")}</div></div></section>
  <section class="section section-white"><div class="container"><div class="section-heading"><div class="eyebrow">Questions, answered carefully</div><h2>Before you connect your network.</h2></div><div class="faq-grid"><details><summary>Which access types are supported?</summary><p>The backend includes PPPoE and Hotspot portal/provisioning surfaces. Actual service authentication must be verified on your RouterOS or configured authentication infrastructure.</p></details><details><summary>Can I take live payments in this local preview?</summary><p>No. The local environment uses placeholder payment settings. PayHero integration code exists, but no real payment has been initiated or verified.</p></details><details><summary>Does every phone automatically open the captive portal?</summary><p>Not always. Device captive-network behavior, DNS, HTTPS trust and RouterOS configuration all matter. Manual portal navigation may be needed.</p></details><details><summary>How is data secured?</summary><p>Use the deployment guidance and review the security configuration before production. This local preview is loopback-bound and does not establish production security compliance.</p></details></div></div></section>
  <section class="final-cta"><div class="container final-cta-inner"><div><div class="eyebrow eyebrow-light">Ready when your setup is</div><h2>Bring your ISP operations into flow.</h2><p>Create an operator account or explore the platform documentation.</p></div><div>${routeLink("/register", "Get started " + icon("arrow"), "button button-lime")}${routeLink("/contact", "Talk to the team", "final-link")}</div></div></section>`;
}

function pageIntro(kicker, title, description) {
  return `<section class="page-hero"><div class="container"><div class="eyebrow">${esc(kicker)}</div><h1>${title}</h1><p>${esc(description)}</p></div></section>`;
}

function featuresPage() {
  return `${pageIntro("FEATURE CATALOGUE", "The capabilities behind<br>your ISP operations.", "A transparent view of what's present in the backend and what still needs configuration, hardware or implementation.")}<section class="section section-white"><div class="container"><div class="feature-catalogue">${featureItems.map(([name, detail, state]) => `<article class="catalogue-card"><div class="catalogue-top">${icon(name.includes("Subscriber") ? "users" : name.includes("Billing") ? "receipt" : name.includes("Router") || name.includes("PPPoE") || name.includes("Hotspot") ? "radio" : "layers")}${statusTag(state)}</div><h2>${esc(name)}</h2><p>${esc(detail)}</p></article>`).join("")}</div><div class="notice notice-neutral">${icon("shield")} <span>“In repository” means source code exists; it does not imply a live provider, router or end-to-end workflow has been configured and tested.</span></div></div></section>`;
}

function featurePage(slug) {
  const detail = featureDetails[slug];
  if (!detail) return notFoundPage();
  return `${pageIntro("FEATURE DETAIL", esc(detail[0]), detail[1])}<section class="section section-white"><div class="container narrow"><div class="notice notice-neutral">${icon("shield")} <span>Local implementation status is documented from this checkout. No live customer or router data is shown on this public page.</span></div><h2>What to verify</h2><ul class="check-list"><li>${icon("check")} Confirm the corresponding API and permissions for your role.</li><li>${icon("check")} Test in an isolated tenant and lab environment first.</li><li>${icon("check")} Record integration status and any external dependencies.</li></ul>${routeLink("/integrations", "Review integration catalogue " + icon("arrow"), "button button-dark")}</div></section>`;
}

function integrationsPage() {
  return `${pageIntro("INTEGRATIONS", "Know what connects.<br>Know what still needs work.", "Integration availability is stated from the local source tree. Provider credentials and real network tests are never implied.")}<section class="section section-white"><div class="container"><div class="integration-catalogue">${integrationItems.map((item) => `<article class="integration-card"><div class="integration-card-head"><span class="integration-monogram">${esc(item.name.slice(0, 1))}</span><span class="status-tag ${item.state.startsWith("Implemented") ? "status-implemented" : item.state.startsWith("Not") ? "status-unavailable" : "status-partial"}">${esc(item.state)}</span></div><h2>${esc(item.name)}</h2><p>${esc(item.detail)}</p></article>`).join("")}</div><div class="notice notice-warning">${icon("shield")} <span>Do not test against production payment accounts or live routers from this local build.</span></div></div></section>`;
}

function pricingPage() {
  return `${pageIntro("PRICING", "Pricing coming soon.", "No verified ISPFlow plan prices are configured in this repository. We won't make up numbers.")}<section class="section section-white"><div class="container narrow"><div class="pricing-card"><span class="pricing-overline">ISPFlow plans</span><h2>Contact us for availability</h2><p>Plan names, limits and prices will be published after they are approved and configured.</p>${routeLink("/contact", "Ask about pricing " + icon("arrow"), "button button-dark")}</div><p class="muted center">This page intentionally does not display sample prices or fabricated plan comparisons.</p></div></section>`;
}

function aboutPage() {
  return `${pageIntro("ABOUT ISPFLOW", "Built around the work<br>that keeps ISPs moving.", "ISPFlow is a product for internet service providers to coordinate subscriber operations, billing and supported network workflows.")}<section class="section section-white"><div class="container two-col"><article><h2>A connected operations platform</h2><p>The product direction is to bring customer, billing and network activity into a shared, permission-aware workflow. Features are being verified against the implementation—not assumed from a menu or a mockup.</p><p>This workspace currently includes the ISP billing backend and a new public frontend. The local frontend preview uses illustrative dashboard graphics only.</p></article><aside class="notice notice-neutral">${icon("shield")}<span>No customer counts, testimonials, performance results or company contact details are claimed here without verified source data.</span></aside></div></section>`;
}

function contactPage() {
  const email = import.meta.env.VITE_CONTACT_EMAIL || "";
  return `${pageIntro("CONTACT", "Let’s talk about your ISP.", "For pricing, onboarding or product questions, use a verified ISPFlow contact channel.")}<section class="section section-white"><div class="container narrow">
    ${email ? `<form class="form-card" id="contact-form"><label>Your name<input name="name" autocomplete="name" required maxlength="100"></label><label>Your work email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>How can we help?<textarea name="message" rows="5" required maxlength="3000"></textarea></label><button class="button button-dark" type="submit">Prepare message ${icon("arrow")}</button><p class="form-note">Your mail application will open; the message is not sent from this website.</p></form>` : `<div class="notice notice-warning">${icon("shield")}<span>A verified sales/support email or contact form endpoint has not been configured for this build. ISPFlow must supply a contact channel before this page can accept inquiries.</span></div>`}
  </div></section>`;
}

function docsPage() {
  return `${pageIntro("DOCUMENTATION", "Explore the API and<br>operator guidance.", "The local backend exposes interactive API documentation. Use it to inspect actual endpoint contracts.")}<section class="section section-white"><div class="container doc-links"><a class="doc-card" href="${esc(API_BASE)}/docs" target="_blank" rel="noreferrer"><span class="doc-icon">${icon("layers")}</span><h2>Interactive API docs</h2><p>Open the running backend's Swagger UI.</p><span class="text-link">Open Swagger UI ${icon("arrow")}</span></a><a class="doc-card" href="${esc(API_BASE)}/redoc" target="_blank" rel="noreferrer"><span class="doc-icon">${icon("receipt")}</span><h2>ReDoc reference</h2><p>Browse API operations and response schemas.</p><span class="text-link">Open ReDoc ${icon("arrow")}</span></a><a class="doc-card" href="${esc(API_BASE)}/openapi.json" target="_blank" rel="noreferrer"><span class="doc-icon">${icon("chart")}</span><h2>OpenAPI document</h2><p>Inspect the OpenAPI contract served by this backend.</p><span class="text-link">View OpenAPI ${icon("arrow")}</span></a></div></section>`;
}

function legalPage(kind) {
  const privacy = kind === "privacy";
  return `${pageIntro("POLICY · DRAFT FOR REVIEW", privacy ? "Privacy information." : "Terms of service.", "This local product copy is a draft, not approved legal advice or a published ISPFlow policy.")}<section class="section section-white"><article class="container narrow legal-copy"><div class="notice notice-warning">${icon("shield")}<span>Before a public launch, the ISPFlow operator must review and publish an accurate policy covering the actual company, retention periods, processors and jurisdiction.</span></div>
    <h2>${privacy ? "Information and use" : "Using the service"}</h2><p>${privacy ? "The application may process operator account details, organization information, subscriber records, billing events and network configuration supplied by its users. This draft does not define a final retention schedule or list of data processors." : "Access to ISPFlow should be limited to authorized users. Operators remain responsible for lawful use of their networks, accurate customer information, payment-provider configuration and appropriate staff permissions."}</p>
    <h2>${privacy ? "Security and sharing" : "Availability and integrations"}</h2><p>${privacy ? "Production security controls, access logging, backup handling and any third-party sharing must be documented and verified by the operator before deployment. Do not submit live customer or payment information to this local preview." : "Features depend on the configured backend, network equipment and external providers. A software status or payment request is not a guarantee of Internet access, provider settlement or uninterrupted service."}</p>
    <h2>Contact and updates</h2><p>A verified policy contact and effective date have not yet been supplied. This draft should not be treated as the final ${privacy ? "privacy notice" : "agreement"}.</p></article></section>`;
}

function forgotPasswordPage() {
  return `${pageIntro("ACCOUNT RECOVERY", "Password recovery is not configured.", "This backend checkout does not expose a password-reset endpoint. We won't collect your email or claim that a reset was sent.")}<section class="section section-white"><div class="container narrow"><div class="notice notice-warning">${icon("shield")}<span>Ask your ISPFlow administrator to reset your account through an approved process. A verified recovery channel must be implemented before this route can offer self-service recovery.</span></div>${routeLink("/login", "Return to sign in", "button button-dark")}</div></section>`;
}

function statusPage() {
  return `${pageIntro("SERVICE STATUS", "A transparent status check.", "This page checks the local backend API only. It does not infer worker, payment-provider, RADIUS or router health.")}<section class="section section-white"><div class="container narrow"><div class="status-panel"><div><span class="status-pulse" id="api-dot"></span><b id="api-state">Checking backend…</b></div><p id="api-detail">Requesting the backend health endpoint.</p><button class="button button-light" id="status-refresh" type="button">Check again</button></div><p class="muted">Other services are shown as unknown until they expose real, safely observable health checks.</p></div></section>`;
}

function loginPage() {
  return `${pageIntro("OPERATOR SIGN IN", "Welcome back.", "Sign in to the ISPFlow backend. Your credentials are sent only to the configured API.")}<section class="section section-white"><div class="container narrow"><form class="form-card" id="login-form"><div class="form-error" id="login-error" role="alert" hidden></div><label>Username or email<input name="username" autocomplete="username" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-dark button-full" type="submit">Sign in ${icon("arrow")}</button><div class="form-links">${routeLink("/forgot-password", "Forgot password?")}${routeLink("/register", "Create an ISP account")}</div><p class="form-note">Authentication is verified by the backend. This public site does not display or store your password.</p></form></div></section>`;
}

function registerPage() {
  return `${pageIntro("ISP ACCOUNT REGISTRATION", "Start with the details.<br>Configure the network later.", "Create an ISP organization and its first operator account. Router and payment setup are optional for browsing and onboarding.")}<section class="section section-white"><div class="container narrow"><div class="stepper" id="signup-stepper"><span class="active">1 <i>Verify email</i></span><b></b><span>2 <i>Business</i></span><b></b><span>3 <i>Owner account</i></span></div><div id="signup-content"></div><p class="form-note">Email verification depends on the backend's configured delivery channel. The local development backend may return a development-only code; production must deliver it through a verified provider.</p></div></section>`;
}

function appPage() {
  return `<section class="workspace-section"><div class="container workspace-container"><div id="workspace-content" class="workspace-loading" role="status">Verifying your authenticated session…</div></div></section>`;
}

function notFoundPage() {
  return `${pageIntro("PAGE NOT FOUND", "This route isn't available.", "The requested page may have moved.")}<section class="section section-white"><div class="container narrow">${routeLink("/", "Back to ISPFlow home", "button button-dark")}</div></section>`;
}

const titles = {
  "/": ["ISPFlow — Run your ISP, end to end", "ISPFlow combines ISP billing, MikroTik network management, provisioning workflows and customer payment records in one workspace."],
  "/features": ["Features | ISPFlow", "Explore ISPFlow features and their verified implementation status."],
  "/integrations": ["Integrations | ISPFlow", "See which ISPFlow integrations are implemented, configuration-dependent or not verified."],
  "/pricing": ["Pricing | ISPFlow", "ISPFlow pricing is coming soon; no unverified prices are displayed."],
  "/about": ["About | ISPFlow", "Learn about ISPFlow, a connected operations workspace for internet service providers."],
  "/contact": ["Contact | ISPFlow", "Contact ISPFlow about ISP operations and onboarding."],
  "/docs": ["Documentation | ISPFlow", "Open ISPFlow backend API documentation and schema."],
  "/privacy": ["Privacy | ISPFlow", "Draft privacy information for the ISPFlow local preview."],
  "/terms": ["Terms | ISPFlow", "Draft terms information for the ISPFlow local preview."],
  "/login": ["Sign in | ISPFlow", "Sign in to ISPFlow operator services."],
  "/register": ["Register | ISPFlow", "Register an ISP organization with ISPFlow."],
  "/forgot-password": ["Account recovery | ISPFlow", "Account recovery status for ISPFlow."],
  "/status": ["Service status | ISPFlow", "Check the local ISPFlow backend API health endpoint."],
  "/app": ["Workspace | ISPFlow", "Authenticated ISPFlow operator workspace."]
};

function render() {
  const path = decodeURIComponent(location.pathname).replace(/\/+$/, "") || "/";
  document.querySelector("#app").classList.toggle("public-site", path !== "/app");
  let content;
  if (path === "/") content = homePage();
  else if (path === "/features") content = featuresPage();
  else if (path.startsWith("/features/")) content = featurePage(path.slice("/features/".length));
  else if (path === "/integrations") content = integrationsPage();
  else if (path === "/pricing") content = pricingPage();
  else if (path === "/about") content = aboutPage();
  else if (path === "/contact") content = contactPage();
  else if (path === "/docs") content = docsPage();
  else if (path === "/privacy" || path === "/terms") content = legalPage(path.slice(1));
  else if (path === "/login") content = loginPage();
  else if (path === "/register") content = registerPage();
  else if (path === "/forgot-password") content = forgotPasswordPage();
  else if (path === "/status") content = statusPage();
  else if (path === "/app") content = appPage();
  else content = notFoundPage();

  document.querySelector("#app").innerHTML = path === "/app"
    ? `<main id="main-content">${content}</main>`
    : shell(content);
  const [title, description] = titles[path] || ["Feature details | ISPFlow", "ISPFlow feature information."];
  document.title = title;
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('meta[property="og:title"]').content = title;
  document.querySelector('meta[property="og:description"]').content = description;
  window.scrollTo(0, 0);
  bindPage(path);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`The API request to ${API_BASE} timed out after 15 seconds.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not connect to the API at ${API_BASE}. Check that the backend is running and that its CORS origins include this site.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  let body = {};
  try { body = await response.json(); } catch { /* Non-JSON API error is rendered generically. */ }
  if (!response.ok) {
    const message = body.detail || body.message || `Request failed (${response.status})`;
    throw new Error(typeof message === "string" ? `${response.status}: ${message}` : `${response.status}: ${JSON.stringify(message)}`);
  }
  return body;
}

function bindPage(path) {
  const nav = document.querySelector(".main-nav");
  const toggle = document.querySelector(".menu-toggle");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("nav-open", open);
  });

  document.querySelectorAll("[data-route]").forEach((link) => link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({}, "", link.getAttribute("href"));
    render();
  }));

  if (path === "/login") bindLogin();
  if (path === "/register") bindRegistration();
  if (path === "/status") bindStatus();
  if (path === "/app") bindWorkspace();
  if (path === "/contact") bindContact();
}

window.addEventListener("popstate", render);
render();

function bindLogin() {
  const form = document.querySelector("#login-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = document.querySelector("#login-error");
    const button = form.querySelector("button[type=submit]");
    errorBox.hidden = true;
    button.disabled = true;
    button.textContent = "Signing in…";
    const values = new FormData(form);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: values.get("username"), password: values.get("password") })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Sign-in failed. Check your credentials and try again.");
      const data = body.data || body;
      if (!data.access_token) throw new Error("The API response did not include an access token.");
      sessionStorage.setItem("ispflow.access", data.access_token);
      if (data.refresh_token) sessionStorage.setItem("ispflow.refresh", data.refresh_token);
      history.pushState({}, "", "/app");
      render();
    } catch (error) {
      errorBox.textContent = error instanceof TypeError
        ? `Could not connect to the API at ${API_BASE}. Check that the backend is running and that its CORS origins include this site.`
        : error.message || "Sign-in failed.";
      errorBox.hidden = false;
      button.disabled = false;
      button.innerHTML = `Sign in ${icon("arrow")}`;
    }
  });
}

function bindRegistration() {
  const holder = document.querySelector("#signup-content");
  const stepper = document.querySelector("#signup-stepper");
  const state = { step: 1, email: "", verificationCode: "", business: null };
  const setStep = (step) => {
    state.step = step;
    [...stepper.querySelectorAll("span")].forEach((item, index) => {
      item.classList.toggle("active", index + 1 <= step);
      item.classList.toggle("complete", index + 1 < step);
    });
    draw();
  };
  const message = (text, kind = "neutral") => `<div class="notice notice-${kind}" role="status">${icon("shield")}<span>${esc(text)}</span></div>`;
  const bindSubmit = (selector, action) => {
    const form = holder.querySelector(selector);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const feedback = form.querySelector(".form-error");
      button.disabled = true;
      button.textContent = "Please wait…";
      feedback.hidden = true;
      try {
        await action(new FormData(form));
      } catch (error) {
        feedback.textContent = error.message;
        feedback.hidden = false;
        button.disabled = false;
        button.textContent = form.dataset.button || "Continue";
      }
    });
  };
  function draw(info = "") {
    const prefix = info;
    if (state.step === 1) {
      holder.innerHTML = `${prefix}<form class="form-card" id="signup-email"><div class="form-error" role="alert" hidden></div><label>Work email<input name="email" type="email" autocomplete="email" required maxlength="254" value="${esc(state.email)}"></label><button class="button button-dark button-full" data-button="Send verification code" type="submit">Send verification code ${icon("arrow")}</button></form>`;
      bindSubmit("#signup-email", async (form) => {
        const email = String(form.get("email")).trim().toLowerCase();
        const check = await api("/api/v1/onboarding/check-email", { method: "POST", body: JSON.stringify({ email }) });
        if (!check.available) throw new Error(check.message || "This email is already registered.");
        const sent = await api("/api/v1/onboarding/send-verification", { method: "POST", body: JSON.stringify({ email }) });
        state.email = email;
        const devCode = sent.message?.match(/\[DEV:\s*(\d{6})\]/)?.[1];
        state.verificationCode = devCode || "";
        setStep(1.5);
        draw(`${message(devCode ? `Development-only email verification code: ${devCode}` : sent.message, devCode ? "warning" : "neutral")}`);
      });
    } else if (state.step === 1.5) {
      holder.innerHTML = `${prefix}<form class="form-card" id="signup-verify"><div class="form-error" role="alert" hidden></div><p class="form-note">Enter the six-digit code sent to <strong>${esc(state.email)}</strong>.</p><label>Verification code<input name="verification_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required value="${esc(state.verificationCode)}"></label><button class="button button-dark button-full" data-button="Verify email" type="submit">Verify email ${icon("arrow")}</button><button class="link-button" type="button" id="signup-back">Use a different email</button></form>`;
      bindSubmit("#signup-verify", async (form) => {
        await api("/api/v1/onboarding/verify-code", { method: "POST", body: JSON.stringify({ email: state.email, verification_code: form.get("verification_code") }) });
        setStep(2);
      });
      holder.querySelector("#signup-back").addEventListener("click", () => { state.email = ""; state.verificationCode = ""; setStep(1); });
    } else if (state.step === 2) {
      holder.innerHTML = `${prefix}<form class="form-card" id="signup-business"><div class="form-error" role="alert" hidden></div><label>ISP or business name<input name="business_name" required minlength="2" maxlength="200" autocomplete="organization"></label><label>Access method<select name="business_type" required><option value="hybrid">Hotspot and PPPoE</option><option value="hotspot">Hotspot</option><option value="pppoe">PPPoE</option></select></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" placeholder="+254712345678" pattern="\\+?[1-9][0-9]{1,14}" required></label><div class="form-row"><label>Country<input name="country" value="Kenya" maxlength="100" required></label><label>City <span class="optional">(optional)</span><input name="city" maxlength="100"></label></div><button class="button button-dark button-full" data-button="Save business details" type="submit">Save business details ${icon("arrow")}</button></form>`;
      bindSubmit("#signup-business", async (form) => {
        state.business = Object.fromEntries(form.entries());
        await api("/api/v1/onboarding/business-details", { method: "POST", body: JSON.stringify({ email: state.email, ...state.business }) });
        setStep(3);
      });
    } else {
      holder.innerHTML = `${prefix}<form class="form-card" id="signup-owner"><div class="form-error" role="alert" hidden></div><p class="form-note">Create the first organization owner account for <strong>${esc(state.email)}</strong>.</p><div class="form-row"><label>First name<input name="admin_first_name" autocomplete="given-name" required minlength="1" maxlength="100"></label><label>Last name<input name="admin_last_name" autocomplete="family-name" required minlength="1" maxlength="100"></label></div><label>Password<input name="password" type="password" autocomplete="new-password" minlength="12" required><small>Use at least 12 characters for this account.</small></label><label>Confirm password<input name="confirm_password" type="password" autocomplete="new-password" minlength="12" required></label><button class="button button-dark button-full" data-button="Create operator account" type="submit">Create operator account ${icon("arrow")}</button></form><div class="setup-optional"><b>Network setup can wait.</b><p>Routers, payment providers and Hotspot/PPPoE configuration are optional while browsing. Configure them later in a controlled environment.</p></div>`;
      bindSubmit("#signup-owner", async (form) => {
        const password = form.get("password");
        if (password !== form.get("confirm_password")) throw new Error("Passwords do not match.");
        const result = await api("/api/v1/onboarding/security-setup", { method: "POST", body: JSON.stringify({
          email: state.email,
          admin_first_name: form.get("admin_first_name"),
          admin_last_name: form.get("admin_last_name"),
          password,
          confirm_password: form.get("confirm_password")
        }) });
        if (!result.access_token) throw new Error("The organization was created but the API did not return a login token. Contact your administrator.");
        sessionStorage.setItem("ispflow.access", result.access_token);
        history.pushState({}, "", "/app");
        render();
      });
    }
  }
  draw();
}

function bindStatus() {
  const button = document.querySelector("#status-refresh");
  const check = async () => {
    const label = document.querySelector("#api-state");
    const detail = document.querySelector("#api-detail");
    const dot = document.querySelector("#api-dot");
    button.disabled = true;
    label.textContent = "Checking backend…";
    try {
      const result = await api("/health");
      label.textContent = `Backend API: ${result.status || "responding"}`;
      detail.textContent = `Health endpoint returned successfully${result.version ? ` (version ${result.version})` : ""}. This does not verify routers, workers or payment providers.`;
      dot.classList.add("healthy");
    } catch (error) {
      label.textContent = "Backend API: unavailable";
      detail.textContent = `Could not verify the backend: ${error.message}`;
      dot.classList.remove("healthy");
    } finally { button.disabled = false; }
  };
  button?.addEventListener("click", check);
  check();
}

async function bindWorkspace() {
  const holder = document.querySelector("#workspace-content");
  const token = sessionStorage.getItem("ispflow.access");
  if (!token) {
    history.replaceState({}, "", "/login");
    render();
    return;
  }
  try {
    const response = await api("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    const user = response.data || response;
    holder.className = "workspace-content";
    await mountWorkspace(holder, { user, token, api, apiBase: API_BASE });
  } catch (error) {
    if (String(error.message || "").startsWith("401:")) {
      sessionStorage.removeItem("ispflow.access");
      sessionStorage.removeItem("ispflow.refresh");
      history.replaceState({}, "", "/login");
      render();
      return;
    }
    holder.className = "workspace-content";
    holder.innerHTML = `<section class="workspace-panel"><div class="workspace-error" role="alert"><strong>Workspace could not connect.</strong><p>${esc(error.message || String(error))}</p><a class="button button-light" href="/login" data-route>Return to sign in</a></div></section>`;
    holder.querySelector("[data-route]")?.addEventListener("click", (event) => {
      event.preventDefault();
      history.pushState({}, "", "/login");
      render();
    });
  }
}

function bindContact() {
  const form = document.querySelector("#contact-form");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = import.meta.env.VITE_CONTACT_EMAIL;
    if (!target) return;
    const values = new FormData(form);
    const subject = encodeURIComponent(`ISPFlow inquiry from ${values.get("name")}`);
    const body = encodeURIComponent(`Name: ${values.get("name")}\nEmail: ${values.get("email")}\n\n${values.get("message")}`);
    location.href = `mailto:${encodeURIComponent(target)}?subject=${subject}&body=${body}`;
  });
}

