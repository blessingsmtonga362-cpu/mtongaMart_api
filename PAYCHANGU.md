# PayChangu mobile money

## Flow

Flutter sends an authenticated request to NestJS to create an order from the server's cart and current product prices. The server snapshots items and calculates the total, including MK 2,000 courier delivery or free Limbe Store pickup. Flutter then starts Airtel Money or TNM Mpamba against that order. NestJS generates a unique `MTM-` reference and calls PayChangu Direct Charge; no PayChangu secret is sent to Flutter.

The payment is saved as `PROCESSING` before the provider request. The client receives the payment id and polls the authenticated status endpoint. A successful status is only applied after the Direct Charge verification endpoint confirms the reference, amount, and currency. The successful payment and `PAID` order update are committed in one database transaction. A timeout leaves the payment reconcilable under its original charge id.

## Endpoints

- `POST /orders` (JWT): `{ "deliveryMethod": "shop" }` or `{ "deliveryMethod": "courier" }`. The response contains the order id, item snapshot, server-calculated subtotal, delivery amount, total, currency, and `PENDING_PAYMENT` status.
- `GET /orders/:id` (JWT): returns that customer's order only.
- `POST /payments/initialize` (JWT): `{ "orderId": "<uuid>", "operator": "airtel", "mobile": "0991234567" }`. Operator is `airtel` or `tnm`. The response is `{ "id": "<payment-uuid>", "orderId": "<order-uuid>", "reference": "MTM-<uuid>", "status": "PROCESSING" }`.
- `GET /payments/:paymentId/status` (JWT): returns the same safe payment summary and reconciles pending states against PayChangu.
- `GET /payments/orders/:orderId/status` (JWT): retrieves the latest payment for the customer's order, allowing the app to recover its status screen after being closed.
- `POST /payments/webhook` (public): PayChangu webhook endpoint. Configure this exact URL in the PayChangu dashboard.

## Provider specifications verified against PayChangu docs

The implementation uses `POST https://api.paychangu.com/mobile-money/payments/initialize` with `mobile`, `mobile_money_operator_ref_id`, `amount` (string), and unique `charge_id`; optional customer email and names are included. `GET /mobile-money/payments/{chargeId}/verify` verifies Direct Charge. The provider requires a Bearer secret key. The documented operator references are Airtel `20be6c20-adeb-4b5b-a7ba-0769820df4fb` and TNM `27494cb5-ba9e-437f-a114-4e7a7686bcca`; these are configurable in case PayChangu changes them. PayChangu's Direct Charge examples return MWK or the alias MK, so both representations are accepted as Malawi Kwacha, with exact numeric amount equality required.

PayChangu's webhook guide specifies a `Signature` header containing the SHA-256 HMAC of the raw request body keyed by the dashboard webhook secret. The handler compares this in constant time and re-queries the charge before updating the order. Duplicate success webhooks are idempotent. Configure Nest raw-body capture in `main.ts` for this check.

## Environment and setup

Copy the payment variable names from `.env.example` into the backend environment. Set the test-mode API secret and webhook secret from **Settings → API Keys & Webhooks** in the PayChangu dashboard. Do not commit `.env`, put credentials in Flutter, or log provider authorization data. Set the dashboard webhook URL to `https://<public-api-host>/payments/webhook` and enable payment notifications.

To test Airtel, use a PayChangu test-mode account and an Airtel test number accepted by the merchant dashboard; select Airtel Money in checkout. Repeat with a TNM Mpamba test number and TNM selection. Approve or reject the on-device prompt according to PayChangu's sandbox instructions, then confirm the app changes state only after `/payments/:id/status` returns a backend-verified result. Never use a real number for automated tests.

For production, replace the test secret/webhook secret with live credentials, use the production dashboard webhook URL, confirm the current operator reference ids in `GET https://api.paychangu.com/mobile-money/`, and test with low-value controlled transactions before launch.

## Application-specific decisions and limits

The API has no prior order lifecycle, so the integration adds a minimal order and item snapshot from the existing cart. Delivery amount is server-owned. The database already contains a legacy `payments` table with an older checkout schema, so the PayChangu order-backed entity uses a separate `order_payments` table and leaves that legacy table untouched. Existing TypeORM configuration has `synchronize: true` and no migration setup; it will create the new order and order_payments tables in the current project configuration. No standalone migration is included because the repository has no migration runner or baseline migrations. Production deployment should adopt a reviewed migration plan before disabling synchronization.

Phone numbers are sent to PayChangu in national `0XX...` format as in the Direct Mobile Money request shape and checked against Airtel (098/099) and TNM (088/089) prefixes. A webhook event is only a notification: the verification response is authoritative. Initialization is always non-final; only a successful verification can mark the order paid.
