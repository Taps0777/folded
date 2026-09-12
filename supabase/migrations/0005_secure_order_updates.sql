-- Revoke direct UPDATE permissions on orders table for authenticated users to prevent column tampering (e.g. changing price)
-- Note: We still need RLS for SELECT, but UPDATE will be handled by RPC.
-- Wait, if we revoke UPDATE, the existing RLS policies for UPDATE become moot.
-- Actually, the best way is to use a TRIGGER to prevent non-admins from changing protected columns.

CREATE OR REPLACE FUNCTION protect_order_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the user is an admin, they can change anything
  IF public.get_auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- For non-admins, ensure they don't change financial or assignment fields
  IF NEW.subtotal != OLD.subtotal OR
     NEW.total != OLD.total OR
     NEW.discount != OLD.discount OR
     NEW.delivery_fee != OLD.delivery_fee OR
     NEW.express_fee != OLD.express_fee OR
     NEW.payment_status != OLD.payment_status THEN
     RAISE EXCEPTION 'Unauthorized: Cannot modify financial fields';
  END IF;

  -- Prevent pickup agent from changing delivery agent, etc.
  IF public.get_auth_user_role() = 'pickup_staff' THEN
    IF NEW.delivery_agent_id != OLD.delivery_agent_id THEN
      RAISE EXCEPTION 'Unauthorized: Pickup staff cannot assign delivery agents';
    END IF;
  END IF;

  -- Ensure valid state transitions
  -- For example, pickup staff shouldn't be able to mark as DELIVERED
  IF public.get_auth_user_role() = 'pickup_staff' AND NEW.status NOT IN ('PICKUP_ASSIGNED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_FACILITY', 'FAILED_PICKUP') THEN
    RAISE EXCEPTION 'Unauthorized: Pickup staff cannot set this status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_protection_trigger ON orders;
CREATE TRIGGER order_protection_trigger
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION protect_order_columns();

-- Secure Order Status Update RPC
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_new_status order_status,
  p_reason TEXT DEFAULT NULL,
  p_quality_check JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_role TEXT;
BEGIN
  -- 1. Check access
  v_role := public.get_auth_user_role();
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- If not admin, check assignment
  IF v_role = 'pickup_staff' AND (v_order.pickup_agent_id != auth.uid() OR v_order.pickup_agent_id IS NULL) THEN
    RAISE EXCEPTION 'Unauthorized: Not assigned to this pickup';
  END IF;

  IF v_role = 'delivery_staff' AND (v_order.delivery_agent_id != auth.uid() OR v_order.delivery_agent_id IS NULL) THEN
    RAISE EXCEPTION 'Unauthorized: Not assigned to this delivery';
  END IF;

  -- 2. Update the status
  UPDATE orders 
  SET status = p_new_status,
      quality_check = COALESCE(p_quality_check, v_order.quality_check),
      updated_at = now()
  WHERE id = p_order_id;

  -- 3. Log History
  INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_order.status, p_new_status, auth.uid(), p_reason);

END;
$$;
