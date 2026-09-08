-- 0009_fix_loyalty_fk_and_order_items.sql
-- Fixes:
-- 1. Add loyalty_account_id FK to loyalty_transactions referencing loyalty_accounts
-- 2. Add service_id to order_items for proper service mapping

-- ============================================================
-- 1. Fix loyalty_transactions FK relationship
-- ============================================================

-- Add loyalty_account_id column referencing loyalty_accounts(user_id)
ALTER TABLE loyalty_transactions 
ADD COLUMN IF NOT EXISTS loyalty_account_id UUID REFERENCES loyalty_accounts(user_id);

-- Backfill existing records
UPDATE loyalty_transactions 
SET loyalty_account_id = user_id 
WHERE loyalty_account_id IS NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account_id 
ON loyalty_transactions(loyalty_account_id);

-- ============================================================
-- 2. Add service_id to order_items for proper service mapping
-- ============================================================

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);

-- Backfill from orders table (each order has one service_id)
UPDATE order_items oi
SET service_id = o.service_id
FROM orders o
WHERE oi.order_id = o.id
AND oi.service_id IS NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_order_items_service_id 
ON order_items(service_id);

-- Make it NOT NULL after backfill (optional, for future inserts)
-- ALTER TABLE order_items ALTER COLUMN service_id SET NOT NULL;