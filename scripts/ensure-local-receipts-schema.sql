-- One-time, additive setup for the local database. This is intentionally not a
-- TypeORM migration: local startup keeps schema synchronization disabled.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  CREATE TYPE public.receipts_email_status_enum AS ENUM (
    'PENDING', 'SENDING', 'SUBMITTED', 'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  "receiptNumber" varchar(48) NOT NULL,
  snapshot jsonb NOT NULL,
  "pdfPath" varchar(500) NOT NULL,
  "emailStatus" public.receipts_email_status_enum NOT NULL DEFAULT 'PENDING',
  "emailAttempts" integer NOT NULL DEFAULT 0,
  "emailError" text,
  "emailSubmittedAt" timestamptz,
  "emailStartedAt" timestamptz,
  "emailAttemptedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "orderId" uuid NOT NULL,
  "paymentId" uuid NOT NULL,
  "customerId" uuid NOT NULL,
  CONSTRAINT "PK_receipts_id" PRIMARY KEY (id),
  CONSTRAINT "UQ_receipts_receiptNumber" UNIQUE ("receiptNumber"),
  CONSTRAINT "UQ_receipts_paymentId" UNIQUE ("paymentId"),
  CONSTRAINT "FK_receipts_order" FOREIGN KEY ("orderId")
    REFERENCES public.orders(id),
  CONSTRAINT "FK_receipts_payment" FOREIGN KEY ("paymentId")
    REFERENCES public.order_payments(id),
  CONSTRAINT "FK_receipts_customer" FOREIGN KEY ("customerId")
    REFERENCES public.users(id)
);

ALTER TABLE public.receipts
  ALTER COLUMN "receiptNumber" TYPE varchar(48);

CREATE INDEX IF NOT EXISTS "IDX_receipts_customer_created"
  ON public.receipts ("customerId", "createdAt");
