import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// To deploy: supabase functions deploy razorpay-webhook
//
// Razorpay webhook. Every payload is verified with HMAC-SHA256 using
// RAZORPAY_WEBHOOK_SECRET. All state changes are delegated to SECURITY DEFINER
// RPCs that are idempotent (unique constraints + row locks).

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

async function computeSignature(secret: string, payloadText: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payloadText))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

serve(async (req) => {
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })

  try {
    const signature = req.headers.get("x-razorpay-signature")
    if (!signature) {
      return json({ error: "Missing signature" }, 400)
    }
    if (!RAZORPAY_WEBHOOK_SECRET) {
      return json({ error: "Webhook not configured" }, 500)
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Webhook not configured" }, 500)
    }

    const payloadText = await req.text()
    const expectedSignature = await computeSignature(RAZORPAY_WEBHOOK_SECRET, payloadText)
    if (expectedSignature !== signature) {
      return json({ error: "Invalid signature" }, 401)
    }

    const payload = JSON.parse(payloadText)
    const event = payload.event
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (event === "payment.captured") {
      const payment = payload.payload?.payment?.entity
      const orderId = payment?.notes?.order_id
      if (!orderId) return json({ error: "Missing order_id" }, 400)

      const { error } = await serviceClient.rpc("process_payment_webhook", {
        p_order_id: orderId,
        p_razorpay_order_id: payment.order_id,
        p_razorpay_payment_id: payment.id,
        p_amount: Number(payment.amount) / 100,
        p_currency: payment.currency,
      })
      if (error) return json({ error: error.message }, 500)
    } else if (event === "payment.failed") {
      const payment = payload.payload?.payment?.entity
      const orderId = payment?.notes?.order_id
      if (!orderId) return json({ error: "Missing order_id" }, 400)

      const { error } = await serviceClient.rpc("process_payment_failed", {
        p_order_id: orderId,
        p_razorpay_payment_id: payment.id,
      })
      if (error) return json({ error: error.message }, 500)
    } else if (event === "refund.processed" || event === "refund.pending") {
      const refund = payload.payload?.refund?.entity
      if (!refund?.payment_id) return json({ error: "Missing refund payment_id" }, 400)

      // Map refund back to the FoldeD order via the payment record.
      const { data: payRow, error: payErr } = await serviceClient
        .from("payments")
        .select("order_id")
        .eq("razorpay_payment_id", refund.payment_id)
        .limit(1)
        .maybeSingle()
      if (payErr) return json({ error: payErr.message }, 500)
      const orderId = refund.notes?.order_id ?? payRow?.order_id
      if (!orderId) return json({ error: "Cannot map refund to order" }, 400)

      const { error } = await serviceClient.rpc("confirm_refund", {
        p_order_id: orderId,
        p_razorpay_refund_id: refund.id,
        p_razorpay_payment_id: refund.payment_id,
        p_amount: Number(refund.amount) / 100,
        p_status: "SUCCESS",
        p_failure_reason: null,
      })
      if (error) return json({ error: error.message }, 500)
    } else if (event === "refund.failed") {
      const refund = payload.payload?.refund?.entity
      if (!refund?.payment_id) return json({ error: "Missing refund payment_id" }, 400)

      const { data: payRow, error: payErr } = await serviceClient
        .from("payments")
        .select("order_id")
        .eq("razorpay_payment_id", refund.payment_id)
        .limit(1)
        .maybeSingle()
      if (payErr) return json({ error: payErr.message }, 500)
      const orderId = refund.notes?.order_id ?? payRow?.order_id
      if (!orderId) return json({ error: "Cannot map refund to order" }, 400)

      const { error } = await serviceClient.rpc("confirm_refund", {
        p_order_id: orderId,
        p_razorpay_refund_id: refund.id,
        p_razorpay_payment_id: refund.payment_id,
        p_amount: Number(refund.amount) / 100,
        p_status: "FAILED",
        p_failure_reason: refund.failure_reason ?? "Refund failed at gateway",
      })
      if (error) return json({ error: error.message }, 500)
    }

    return json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing error"
    console.error("Webhook error:", message)
    return json({ error: message }, 400)
  }
})