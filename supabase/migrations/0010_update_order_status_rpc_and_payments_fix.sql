-- 0010_update_order_status_rpc_and_payments_fix.sql
-- Fixes:
-- 1. Create update_order_status RPC for atomic status transitions with history logging
-- 2. Fix payments table columns for webhook idempotency

-- ============================================================
-- 1. Create update_order_status RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_new_status order_status,
  p_reason TEXT DEFAULT NULL,
  p_quality_check JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status order_status;
  v_customer_id UUID;
  v_actor_id UUID := auth.uid();
BEGIN
  -- 1. Fetch current order and lock for update
  SELECT status, customer_id INTO v_old_status, v_customer_id
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- 2. Validate status transition (basic guard)
  IF v_old_status = p_new_status THEN
    RAISE EXCEPTION 'Order already in status %', p_new_status;
  END IF;

  -- 3. Prevent invalid transitions (e.g., DELIVERED -> PICKUP_SCHEDULED)
  IF v_old_status IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED') 
     AND p_new_status NOT IN ('REFUND_PENDING', 'REFUNDED') THEN
    RAISE EXCEPTION 'Cannot transition from terminal status % to %', v_old_status, p_new_status;
  END IF;

  -- 4. Update order status
  UPDATE orders
  SET 
    status = p_new_status,
    updated_at = NOW(),
    -- Store quality check if provided (for QUALITY_CHECK stage)
    quality_check = COALESCE(p_quality_check, quality_check),
    -- Set estimated delivery when ready for delivery
    estimated_delivery_at = CASE 
      WHEN p_new_status = 'READY_FOR_DELIVERY' THEN NOW() + INTERVAL '4 hours'
      ELSE estimated_delivery_at
    END
  WHERE id = p_order_id;

  -- 5. Log status history
  INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_old_status, p_new_status, v_actor_id, p_reason);

  -- 6. Handle loyalty points on completion
  IF p_new_status = 'COMPLETED' AND v_old_status != 'COMPLETED' THEN
    -- Earn 1 point per 100 INR spent
    PERFORM public.earn_loyalty_points(p_order_id);
  END IF;

  -- 7. Handle refund initiation
  IF p_new_status = 'REFUND_PENDING' AND v_old_status NOT IN ('REFUND_PENDING', 'REFUNDED') THEN
    PERFORM public.initiate_refund(p_order_id);
  END IF;

END;
$$;

-- ============================================================
-- 2. Fix payments table for webhook idempotency
-- ============================================================

-- Add missing columns referenced in process_payment_webhook
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id);

-- Add transaction_id as alias for gateway_transaction_id (for backward compat)
-- We'll use gateway_transaction_id as the primary idempotency key
-- But add this column if code references it
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Backfill transaction_id from gateway_transaction_id
UPDATE payments 
SET transaction_id = gateway_transaction_id 
WHERE transaction_id IS NULL AND gateway_transaction_id IS NOT NULL;

-- Backfill customer_id from orders
UPDATE payments p
SET customer_id = o.customer_id
FROM orders o
WHERE p.order_id = o.id
AND p.customer_id IS NULL;

-- Ensure unique constraint on gateway_transaction_id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_gateway_transaction_id_unique'
  ) THEN
    ALTER TABLE payments 
    ADD CONSTRAINT payments_gateway_transaction_id_unique UNIQUE (gateway_transaction_id);
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);