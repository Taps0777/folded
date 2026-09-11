import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// To deploy: supabase functions deploy create-razorpay-order
//
// Secure Razorpay order creation.
// The client sends ONLY the internal FoldeD order_id. The authoritative amount
// is read from the database and the caller is authenticated via Supabase JWT.
// Razorpay credentials live exclusively in Edge Function secrets.

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
      throw new Error("Payment configuration unavailable.")
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Payment configuration unavailable.")
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("Authentication required.")
    }

    const body = await req.json()
    const orderId: string | undefined = body?.order_id
    if (!orderId || typeof orderId !== "string") {
      throw new Error("order_id is required")
    }

    // 1. Verify the caller's JWT and load their identity.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      throw new Error("Authentication failed.")
    }

    // 2. Fetch the authoritative, payable order under the caller's identity.
    //    This RPC enforces ownership + payment state server-side.
    const { data: payable, error: payableError } = await userClient.rpc("get_payable_order", {
      p_order_id: orderId,
    })
    if (payableError || !payable?.ok) {
      throw new Error((payable?.message as string) ?? "Order is not eligible for payment")
    }

    const total = Number(payable.total)
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("Order has no payable amount.")
    }
    const amountPaise = Math.round(total * 100)

    // 3. Create the Razorpay order using the server-side amount.
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: String(payable.order_number ?? orderId).slice(0, 40),
        payment_capture: 1,
        notes: { order_id: orderId },
      }),
    })

    const rzpData = await rzpResponse.json()
    if (!rzpResponse.ok) {
      console.error("Razorpay order creation failed:", JSON.stringify(rzpData))
      throw new Error("Failed to create Razorpay order.")
    }

    // 4. Persist the razorpay_order_id mapping under the service role.
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error: saveError } = await serviceClient.rpc("save_razorpay_order", {
      p_order_id: orderId,
      p_razorpay_order_id: rzpData.id,
      p_amount: total,
    })
    if (saveError) {
      console.error("Failed to persist Razorpay order:", saveError.message)
      throw new Error("Failed to persist Razorpay order.")
    }

    return json({
      id: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      order_id: orderId,
      key_id: RAZORPAY_KEY_ID,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment could not be initiated"
    console.error("create-razorpay-order error:", message)
    return json({ error: message }, 400)
  }
})