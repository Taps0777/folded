-- Secure Payment Webhook RPC to handle Idempotency
CREATE OR REPLACE FUNCTION process_payment_webhook(
  p_order_id UUID,
  p_transaction_id TEXT,
  p_amount NUMERIC
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- We use security definer so we can call this from an authenticated webhook worker 
  -- or service role.
  
  -- 1. Fetch Order and lock for update to prevent race conditions
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- 2. Idempotency Check
  -- If payment is already successful, do not double-process
  IF v_order.payment_status = 'SUCCESS' THEN
    RETURN 'Already processed';
  END IF;

  -- 3. Verification Check (In a real app, verify signature here. We verify amount)
  IF p_amount != v_order.total THEN
    -- Amount mismatch
    UPDATE orders SET payment_status = 'FAILED' WHERE id = p_order_id;
    RETURN 'Amount mismatch';
  END IF;

  -- 4. Process Payment
  UPDATE orders 
  SET payment_status = 'SUCCESS',
      updated_at = now()
  WHERE id = p_order_id;

  -- Insert into a payments table for audit
  INSERT INTO payments (order_id, customer_id, amount, status, transaction_id)
  VALUES (p_order_id, v_order.customer_id, p_amount, 'SUCCESS', p_transaction_id);

  RETURN 'Payment successful';
END;
$$;
