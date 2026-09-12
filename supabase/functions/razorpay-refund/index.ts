import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// To deploy: supabase functions deploy razorpay-refund
//
// Executes a REAL Razorpay refund for an eligible order.
//  1. The caller (admin or the order's customer) is verified via Supabase JWT.
//  2. request_refund (SECURITY DEFINER) validates eligibility + creates a refund record.
//  3. The Razorpay Refund API is called with the authoritative amount.
//  4. confirm_refund records the gateway outcome (SUCCESS / FAILED).
// A refund is NEVER marked REFUNDED without the gateway confirming it.

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Refund configuration unavailable.")
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Refund configuration unavailable.")
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("Authentication required.")
    }

    const body = await req.json()
    const orderId: string | undefined = body?.order_id
    const reason: string | undefined = body?.reason
    if (!orderId || typeof orderId !== "string") {
      throw new Error("order_id is required")
    }

    // 1. Verify caller JWT.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      throw new Error("Authentication failed.")
    }

    // 2. Authorize + create the refund record under the caller's identity.
    const { data: requested, error: requestError } = await userClient.rpc("request_refund", {
      p_order_id: orderId,
      p_reason: reason ?? null,
    })
    if (requestError || !requested?.ok) {
      throw new Error((requested?.message as string) ?? "Refund request rejected")
    }

    const paymentId: string = requested.razorpay_payment_id
    const amount: number = Number(requested.amount)
    if (!paymentId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid refund details")
    }
    const amountPaise = Math.round(amount * 100)

    // 3. Call the Razorpay Refund API with the authoritative amount.
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const rzpResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: amountPaise,
          notes: { order_id: orderId, refund_id: requested.refund_id },
        }),
      },
    )

    const rzpData = await rzpResponse.json()
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (!rzpResponse.ok) {
      console.error("Razorpay refund failed:", JSON.stringify(rzpData))
      await serviceClient.rpc("confirm_refund", {
        p_order_id: orderId,
        p_razorpay_refund_id: null,
        p_razorpay_payment_id: paymentId,
        p_amount: amount,
        p_status: "FAILED",
        p_failure_reason: rzpData?.error?.description ?? "Refund rejected by gateway",
      })
      return json({ ok: false, error: "Refund was rejected by the payment gateway" }, 502)
    }

    // 4. Record the gateway-confirmed refund.
    const { error: confirmError } = await serviceClient.rpc("confirm_refund", {
      p_order_id: orderId,
      p_razorpay_refund_id: rzpData.id,
      p_razorpay_payment_id: paymentId,
      p_amount: amount,
      p_status: "SUCCESS",
      p_failure_reason: null,
    })
    if (confirmError) {
      throw new Error(confirmError.message)
    }

    return json({ ok: true, refund_id: rzpData.id, amount })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Refund could not be processed"
    console.error("razorpay-refund error:", message)
    return json({ error: message }, 400)
  }
})