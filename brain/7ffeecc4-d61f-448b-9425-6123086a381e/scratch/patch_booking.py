import re

file_path = r'f:\Projects\FoldeD-Laundry Solution\FoldeD-Laundry Solution\src\pages\booking\BookingPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace(
    "import { StorageService } from '../../services/storage';",
    "import { serviceService } from '../../services/api/serviceService';\nimport { addressService } from '../../services/api/addressService';\nimport { orderService } from '../../services/api/orderService';"
)

# Replace state and effects
old_state = """  const services = StorageService.getServices();
  const addresses = StorageService.getAddresses();
  const loyaltyAcc = StorageService.getLoyaltyAccount();

  // State prefill from route state if available
  const preselectedServiceId = (location.state as any)?.preselectedServiceId || services[0]?.id;
  const preselectedWeight = (location.state as any)?.preselectedWeight || 4;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Booking Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId);
  const [weightKg, setWeightKg] = useState<number>(preselectedWeight);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [pickupDate, setPickupDate] = useState('Today');
  const [pickupSlot, setPickupSlot] = useState('10:00 AM - 12:00 PM');
  const [isExpress, setIsExpress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(addresses[0]?.id || '');"""

new_state = """  const [services, setServices] = useState<Service[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loyaltyAcc, setLoyaltyAcc] = useState<any>({ balance: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // State prefill from route state if available
  const preselectedServiceId = (location.state as any)?.preselectedServiceId || '';
  const preselectedWeight = (location.state as any)?.preselectedWeight || 4;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Booking Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId);
  const [weightKg, setWeightKg] = useState<number>(preselectedWeight);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [pickupDate, setPickupDate] = useState('Today');
  const [pickupSlot, setPickupSlot] = useState('10:00 AM - 12:00 PM');
  const [isExpress, setIsExpress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  React.useEffect(() => {
    const init = async () => {
      if (!currentUser) return;
      try {
        const [srvs, addrs] = await Promise.all([
          serviceService.getAllServices(),
          addressService.getAddressesByUser(currentUser.id)
        ]);
        setServices(srvs);
        setAddresses(addrs);
        if (srvs.length > 0 && !selectedServiceId) {
          setSelectedServiceId(srvs[0].id);
        }
        if (addrs.length > 0 && !selectedAddressId) {
          const defaultAddr = addrs.find(a => a.is_default) || addrs[0];
          setSelectedAddressId(defaultAddr.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [currentUser]);"""

content = content.replace(old_state, new_state)

# Replace apply coupon
old_coupon = """  // Handle Coupon Apply
  const handleApplyCoupon = () => {
    if (!couponCode) return;
    const res = StorageService.validateCoupon(couponCode, subtotal);
    if (res.valid) {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: res.discount });
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };"""

new_coupon = """  // Handle Coupon Apply
  const handleApplyCoupon = () => {
    if (!couponCode) return;
    // Stub validation
    if (couponCode === 'FRESH50' && subtotal >= 199) {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: 50 });
      showToast('Coupon applied!', 'success');
    } else if (couponCode === 'CLEAN100' && subtotal >= 199) {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: 100 });
      showToast('Coupon applied!', 'success');
    } else {
      showToast('Invalid coupon or criteria not met', 'error');
    }
  };"""
content = content.replace(old_coupon, new_coupon)

# Replace save address
old_save_addr = """  // Handle Save New Address
  const handleSaveNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrForm.address_line || !newAddrForm.postal_code) {
      showToast('Please fill required address fields', 'error');
      return;
    }
    const created = StorageService.addAddress({
      user_id: currentUser.id,
      ...newAddrForm,
      is_default: false,
    });
    setSelectedAddressId(created.id);
    setNewAddressModalOpen(false);
    showToast('New address saved!', 'success');
  };"""

new_save_addr = """  // Handle Save New Address
  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrForm.address_line || !newAddrForm.postal_code) {
      showToast('Please fill required address fields', 'error');
      return;
    }
    try {
      const created = await addressService.createAddress({
        user_id: currentUser.id,
        name: newAddrForm.name,
        phone: newAddrForm.phone,
        address_line: newAddrForm.address_line,
        landmark: newAddrForm.landmark,
        city: newAddrForm.city,
        state: newAddrForm.state,
        postal_code: newAddrForm.postal_code,
        address_type: newAddrForm.address_type,
        is_default: false,
      });
      setAddresses([...addresses, created]);
      setSelectedAddressId(created.id);
      setNewAddressModalOpen(false);
      showToast('New address saved!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };"""
content = content.replace(old_save_addr, new_save_addr)


# Replace confirm order
old_confirm = """  // Handle Order Submit
  const handleConfirmOrder = () => {
    const chosenAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
    if (!chosenAddress) {
      showToast('Please choose or add a delivery address', 'error');
      return;
    }

    if (useLoyaltyPoints && loyaltyDiscount > 0) {
      StorageService.redeemLoyalty(loyaltyDiscount * 100);
    }

    const chosenAlterations = Object.entries(alterations)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const opt = ALTERATION_OPTIONS.find((o) => o.id === id)!;
        return {
          id,
          name: opt.name,
          price: opt.price,
          quantity: count,
          unit: opt.unit,
        };
      });

    const newOrder = StorageService.createOrder({
      user_id: currentUser.id,
      customer_name: chosenAddress.name || currentUser.full_name,
      customer_phone: chosenAddress.phone || currentUser.phone,
      address: chosenAddress,
      status: 'ORDER_PLACED',
      items: [
        {
          id: `item_1`,
          service_id: activeService.id,
          service_name: activeService.name,
          quantity: 1,
          weight: weightKg,
          unit_price: activeService.base_price,
          total_price: garmentWashSubtotal,
          special_instructions: specialInstructions || undefined,
        },
      ],
      alterations: chosenAlterations.length > 0 ? chosenAlterations : undefined,
      subtotal,
      discount_amount: couponDiscount + loyaltyDiscount,
      delivery_charge: deliveryCharge,
      express_surcharge: expressCharge,
      total_amount: totalAmount,
      payment_status: paymentMethod === 'cod' ? 'PENDING' : 'PAID',
      payment_method: paymentMethod,
      coupon_code: appliedCoupon?.code,
      loyalty_points_used: loyaltyDiscount * 100,
      loyalty_points_earned: Math.round(totalAmount * 0.1),
      pickup_slot_date: pickupDate,
      pickup_slot_time: pickupSlot,
      estimated_delivery: isExpress ? 'Tomorrow (Within 24h)' : 'In 48 Hours',
      notes: specialInstructions,
    });

    setConfirmedOrderId(newOrder.id);
    setConfirmedPin(newOrder.delivery_pin);
    showToast('Pickup Scheduled Successfully!', 'success');
  };"""

new_confirm = """  // Handle Order Submit
  const handleConfirmOrder = async () => {
    const chosenAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
    if (!chosenAddress) {
      showToast('Please choose or add a delivery address', 'error');
      return;
    }

    try {
      const chosenAlterations = Object.entries(alterations)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => {
          const opt = ALTERATION_OPTIONS.find((o) => o.id === id)!;
          return {
            id,
            name: opt.name,
            price: opt.price,
            quantity: count,
            unit: opt.unit,
          };
        });

      const newOrderData = {
        user_id: currentUser.id,
        address: chosenAddress,
        items: [
          {
            service_id: activeService.id,
            quantity: 1,
            weight: weightKg,
            unit_price: activeService.base_price,
            total_price: garmentWashSubtotal,
          },
        ],
        subtotal,
        discount_amount: couponDiscount + loyaltyDiscount,
        delivery_charge: deliveryCharge,
        express_surcharge: expressCharge,
        total_amount: totalAmount,
        payment_status: paymentMethod === 'cod' ? 'PENDING' : 'SUCCESS',
        payment_method: paymentMethod,
        pickup_slot_date: pickupDate,
        pickup_slot_time: pickupSlot,
        notes: specialInstructions,
      };

      const result = await orderService.createOrder(newOrderData);

      setConfirmedOrderId(result.id);
      setConfirmedPin(result.delivery_pin);
      showToast('Pickup Scheduled Successfully!', 'success');
      
      // Simulate WhatsApp Invoice / Notification
      console.log(`[WhatsApp Notification sent to ${currentUser.phone}] Invoice for Order ${result.id} generated.`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };"""

content = content.replace(old_confirm, new_confirm)

# Fix loading and activeService undefined errors
content = content.replace("const activeService: Service = services.find((s) => s.id === selectedServiceId) || services[0];",
"""  const activeService: Service | undefined = services.find((s) => s.id === selectedServiceId) || services[0];

  if (isLoading || !activeService) {
    return <div className="p-10 text-center">Loading booking...</div>;
  }""")


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
