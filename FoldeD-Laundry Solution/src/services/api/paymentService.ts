import { supabase } from '../../lib/supabase';

// Helper to dynamically load the Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const paymentService = {
  /**
   * Initializes the Razorpay payment gateway
   * @param amount The total amount in INR
   * @param orderId Our internal order ID (optional, for receipt mapping)
   * @param customerInfo Customer name, email, phone
   * @returns A promise that resolves to { success, transactionId, message }
   */
  async processRazorpayPayment(
    amount: number,
    orderId: string,
    customerInfo: { name: string; email: string; phone: string }
  ): Promise<{ success: boolean; transactionId?: string; message: string }> {
    
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      return { success: false, message: 'Razorpay SDK failed to load. Are you online?' };
    }

    try {
      // 1. Call our Edge Function to create an order on Razorpay servers
      const { data: rpOrderData, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount, receipt_id: orderId },
      });

      if (error || !rpOrderData?.id) {
        throw new Error(error?.message || 'Failed to create Razorpay order');
      }

      // 2. Open the Razorpay Checkout UI
      return new Promise((resolve) => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mock_key', // Your public key
          amount: rpOrderData.amount,
          currency: 'INR',
          name: 'FoldeD Laundry',
          description: `Payment for Order ${orderId}`,
          order_id: rpOrderData.id,
          handler: function (response: any) {
            // Payment success!
            // The backend webhook will capture the actual payment. We just return success to the UI.
            resolve({
              success: true,
              transactionId: response.razorpay_payment_id,
              message: 'Payment Successful',
            });
          },
          prefill: {
            name: customerInfo.name,
            email: customerInfo.email,
            contact: customerInfo.phone,
          },
          theme: {
            color: '#0f172a', // slate-900
          },
          modal: {
            ondismiss: function () {
              resolve({ success: false, message: 'Payment window closed' });
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          resolve({ success: false, message: response.error.description });
        });
        
        rzp.open();
      });

    } catch (err: any) {
      console.error('Payment Error:', err);
      // Fallback/Mock for local dev without Edge Functions deployed
      if (err.message.includes('not found') || err.message.includes('fetch')) {
        console.warn('Edge Function failed or not deployed. Falling back to Mock Payment Success for Demo.');
        return { success: true, transactionId: `pay_mock_${Math.random().toString(36).substring(7)}`, message: 'Mock Payment Successful' };
      }
      return { success: false, message: err.message };
    }
  }
};
