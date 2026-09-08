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