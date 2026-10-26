# ISPFlow Billing Business Logic Checklist

Status legend: verified | implemented-unverified | missing | blocked

## 1. Customer and subscription management
- Customer registration with name/phone/username/service type: implemented-unverified
- Organization/branch/package/router/billing assignment: implemented-unverified
- PPPoE and hotspot support: implemented-unverified
- Duplicate username prevention: implemented-unverified
- Status/subscription tracking: implemented-unverified
- Profile updates/suspension/reactivation/closure: implemented-unverified
- Record linkage: implemented-unverified
- Tenant/branch access restrictions: verified (tests)

## 2. Service packages and pricing
- Package fields: implemented-unverified
- KES currency: verified
- Validation of prices/durations/speeds: implemented-unverified
- Package edit not silently changing subscribers: implemented-unverified

## 3. Subscription activation and expiry
- State machine: implemented-unverified
- Payment-gated activation: implemented-unverified
- Start/expiry date policy: implemented-unverified
- Renewal before/after expiry: implemented-unverified
- Scheduled expiry detection: implemented-unverified (expiry_manager)
- Suspension/reactivation authorization sync: implemented-unverified
- Idempotent renewal: implemented (PayHero callback idempotency + apply)
- State transition logging: implemented-unverified

## 4. Invoices and billing cycles
- Invoice numbering/identifiers: verified
- Invoice fields/line items/totals: verified (tests)
- Invoice states: implemented-unverified
- Duplicate invoice prevention: implemented-unverified
- Partial payments/balance: implemented (apply_payment_to_invoice)
- Decimal-safe arithmetic: partial (Decimal used in billing service; float in stats)
- Invoice != payment: verified (invoice status DRAFT, payment separate)

## 5. Payment processing
- Payment lifecycle: implemented-unverified
- References/transaction IDs: verified
- Amount/currency verification: implemented (PayHero callback amount check)
- Secure callback verification: partial (no signature verification for PayHero)
- Idempotency: implemented (PayHero callback)
- Delayed/duplicated/failed/reversed/out-of-order handling: partial
- Reconciliation/admin review: implemented-unverified
- Payment allocation: implemented
- Receipts only for valid payments: implemented-unverified

## 6. Automatic payment-to-internet activation
- Verified payment activates subscription: implemented (PayHero callback now creates Payment, applies invoice, activates subscription)
- RADIUS/router sync: implemented-unverified (SubscriptionRouterSyncService)
- Transactional outbox/retry: partial (router sync failure logged, payment preserved)
- Duplicate activation prevention: implemented (idempotency + _activate no-op if active)

## 7. MikroTik/PPPoE/FreeRADIUS
- Router registration/config: implemented-unverified
- PPPoE credentials: implemented-unverified
- RADIUS auth/accounting: implemented-unverified
- Speed policy mapping: implemented-unverified
- Session visibility: implemented-unverified
- Expiry/suspension enforcement: implemented-unverified
- CoA/session termination: implemented-unverified
- Diagnostics: implemented-unverified

## 8. Hotspot and voucher billing
- Package assignment/validity: implemented-unverified
- Unique voucher codes: implemented-unverified
- Bulk generation: implemented-unverified
- States: implemented-unverified
- Redemption/expiry: implemented-unverified
- Speed/quota: implemented-unverified
- MAC binding: implemented-unverified
- Duplicate redemption prevention: implemented-unverified

## 9. Renewals, grace periods, suspension
- Reminders/expiry processing/grace: implemented-unverified
- Auto suspension: implemented-unverified
- Payment during grace: implemented-unverified
- Reactivation: implemented-unverified
- Manual adjustments/audit: implemented-unverified
- Failed job retry: implemented-unverified

## 10. Reconciliation, reporting, audit
- Reports reconcile: implemented-unverified
- No double-counting: partial (stats use float)
- Audit trail: implemented-unverified

## 11. Automated tests
- Existing suite: 172 passed (3 skipped) baseline
- PayHero callback activation: missing tests
- Decimal arithmetic: missing tests

## 12. Execution
- Changes committed/pushed: pending
