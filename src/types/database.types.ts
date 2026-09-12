export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          city: string
          created_at: string | null
          full_name: string | null
          id: string
          is_default: boolean | null
          label: string | null
          landmark: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          pincode: string
          state: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          city: string
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          pincode: string
          state: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          pincode?: string
          state?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alteration_services: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number
          unit?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean | null
          code: string
          discount_type: string
          discount_value: number
          id: string
          maximum_discount: number | null
          minimum_order_value: number | null
          per_user_limit: number | null
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          discount_type: string
          discount_value: number
          id?: string
          maximum_discount?: number | null
          minimum_order_value?: number | null
          per_user_limit?: number | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          discount_type?: string
          discount_value?: number
          id?: string
          maximum_discount?: number | null
          minimum_order_value?: number | null
          per_user_limit?: number | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          id: string
          name: string
          price: number
          service_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          price: number
          service_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          service_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          balance: number | null
          created_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          loyalty_account_id: string | null
          order_id: string | null
          points: number
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          loyalty_account_id?: string | null
          order_id?: string | null
          points: number
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          loyalty_account_id?: string | null
          order_id?: string | null
          points?: number
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_id: string | null
          order_id: string | null
          quantity: number
          service_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          order_id?: string | null
          quantity: number
          service_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          item_id?: string | null
          order_id?: string | null
          quantity?: number
          service_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          old_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string | null
          reason: string | null
          timestamp: string | null
        }
        Insert: {
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string | null
          reason?: string | null
          timestamp?: string | null
        }
        Update: {
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string | null
          reason?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bag_id: string | null
          coupon_id: string | null
          created_at: string | null
          customer_id: string | null
          delivery_address_id: string | null
          delivery_agent_id: string | null
          delivery_fee: number
          delivery_pin: string | null
          discount: number
          estimated_delivery_at: string | null
          express_fee: number
          id: string
          laundry_stage: string | null
          measured_weight_kg: number | null
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address_id: string | null
          pickup_agent_id: string | null
          pickup_date: string | null
          pickup_time_slot: string | null
          quality_check: Json | null
          service_id: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string | null
        }
        Insert: {
          bag_id?: string | null
          coupon_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivery_address_id?: string | null
          delivery_agent_id?: string | null
          delivery_fee?: number
          delivery_pin?: string | null
          discount?: number
          estimated_delivery_at?: string | null
          express_fee?: number
          id?: string
          laundry_stage?: string | null
          measured_weight_kg?: number | null
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address_id?: string | null
          pickup_agent_id?: string | null
          pickup_date?: string | null
          pickup_time_slot?: string | null
          quality_check?: Json | null
          service_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string | null
        }
        Update: {
          bag_id?: string | null
          coupon_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivery_address_id?: string | null
          delivery_agent_id?: string | null
          delivery_fee?: number
          delivery_pin?: string | null
          discount?: number
          estimated_delivery_at?: string | null
          express_fee?: number
          id?: string
          laundry_stage?: string | null
          measured_weight_kg?: number | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address_id?: string | null
          pickup_agent_id?: string | null
          pickup_date?: string | null
          pickup_time_slot?: string | null
          quality_check?: Json | null
          service_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_address_id_fkey"
            columns: ["pickup_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_agent_id_fkey"
            columns: ["pickup_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          customer_id: string | null
          gateway: string | null
          gateway_transaction_id: string | null
          id: string
          order_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          gateway?: string | null
          gateway_transaction_id?: string | null
          id?: string
          order_id?: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          gateway?: string | null
          gateway_transaction_id?: string | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          order_id: string | null
          rating: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          order_id?: string | null
          rating?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          order_id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          area_name: string | null
          city: string
          delivery_radius_km: number | null
          id: string
          is_active: boolean | null
          is_delivery_available: boolean | null
          is_pickup_available: boolean | null
          pincode: string
        }
        Insert: {
          area_name?: string | null
          city: string
          delivery_radius_km?: number | null
          id?: string
          is_active?: boolean | null
          is_delivery_available?: boolean | null
          is_pickup_available?: boolean | null
          pincode: string
        }
        Update: {
          area_name?: string | null
          city?: string
          delivery_radius_km?: number | null
          id?: string
          is_active?: boolean | null
          is_delivery_available?: boolean | null
          is_pickup_available?: boolean | null
          pincode?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean | null
          base_price: number | null
          created_at: string | null
          description: string | null
          estimated_processing_hours: number | null
          express_surcharge: number | null
          id: string
          maximum_quantity: number | null
          minimum_quantity: number | null
          name: string
          price_per_kg: number | null
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          base_price?: number | null
          created_at?: string | null
          description?: string | null
          estimated_processing_hours?: number | null
          express_surcharge?: number | null
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number | null
          name: string
          price_per_kg?: number | null
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          base_price?: number | null
          created_at?: string | null
          description?: string | null
          estimated_processing_hours?: number | null
          express_surcharge?: number | null
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number | null
          name?: string
          price_per_kg?: number | null
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean | null
          free_deliveries: number | null
          free_pickups: number | null
          id: string
          included_kg: number
          monthly_price: number
          name: string
        }
        Insert: {
          active?: boolean | null
          free_deliveries?: number | null
          free_pickups?: number | null
          id?: string
          included_kg: number
          monthly_price: number
          name: string
        }
        Update: {
          active?: boolean | null
          free_deliveries?: number | null
          free_pickups?: number | null
          id?: string
          included_kg?: number
          monthly_price?: number
          name?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          order_id: string | null
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          end_date: string | null
          id: string
          plan_id: string | null
          start_date: string | null
          status: string | null
          used_deliveries: number | null
          used_kg: number | null
          used_pickups: number | null
          user_id: string | null
        }
        Insert: {
          end_date?: string | null
          id?: string
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          used_deliveries?: number | null
          used_kg?: number | null
          used_pickups?: number | null
          user_id?: string | null
        }
        Update: {
          end_date?: string | null
          id?: string
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          used_deliveries?: number | null
          used_kg?: number | null
          used_pickups?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_override_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      advance_laundry_stage: {
        Args: { p_order_id: string; p_stage: string }
        Returns: Json
      }
      assign_delivery_agent: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: Json
      }
      assign_pickup_agent: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: Json
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      confirm_refund: {
        Args: {
          p_amount: number
          p_failure_reason?: string
          p_order_id: string
          p_razorpay_payment_id: string
          p_razorpay_refund_id: string
          p_status: string
        }
        Returns: string
      }
      create_order_secure: {
        Args: {
          p_address_id: string
          p_coupon_code?: string
          p_customer_id: string
          p_is_express: boolean
          p_items?: Json
          p_loyalty_points?: number
          p_pickup_date: string
          p_pickup_slot: string
          p_service_id: string
          p_special_instructions?: string
          p_weight_kg?: number
        }
        Returns: Json
      }
      earn_loyalty_points: { Args: { p_order_id: string }; Returns: undefined }
      get_auth_user_role: { Args: never; Returns: string }
      get_delivery_pin: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_order_payment_status: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_payable_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      initiate_refund: { Args: { p_order_id: string }; Returns: undefined }
      process_payment_failed: {
        Args: { p_order_id: string; p_razorpay_payment_id: string }
        Returns: string
      }
      process_payment_webhook: {
        Args: {
          p_amount: number
          p_currency?: string
          p_order_id: string
          p_razorpay_order_id: string
          p_razorpay_payment_id: string
        }
        Returns: string
      }
      record_pickup: {
        Args: {
          p_bag_id: string
          p_measured_weight_kg: number
          p_order_id: string
        }
        Returns: Json
      }
      request_refund: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      save_razorpay_order: {
        Args: {
          p_amount: number
          p_order_id: string
          p_razorpay_order_id: string
        }
        Returns: Json
      }
      submit_quality_check: {
        Args: {
          p_order_id: string
          p_passed: boolean
          p_quality_check: Json
        }
        Returns: Json
      }
      update_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
          p_quality_check?: Json
          p_reason?: string
        }
        Returns: Json
      }
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number }
        Returns: Json
      }
      verify_delivery_pin: {
        Args: { p_order_id: string; p_pin: string }
        Returns: Json
      }
    }
    Enums: {
      order_status:
        | "PENDING_PAYMENT"
        | "CONFIRMED"
        | "PICKUP_ASSIGNED"
        | "PICKUP_SCHEDULED"
        | "PICKED_UP"
        | "RECEIVED_AT_FACILITY"
        | "PROCESSING"
        | "WASHING"
        | "DRYING"
        | "IRONING"
        | "FOLDING"
        | "QUALITY_CHECK"
        | "READY_FOR_DELIVERY"
        | "DELIVERY_ASSIGNED"
        | "OUT_FOR_DELIVERY"
        | "DELIVERED"
        | "COMPLETED"
        | "CANCELLED"
        | "FAILED_PICKUP"
        | "DELIVERY_FAILED"
        | "REFUND_PENDING"
        | "REFUNDED"
        | "ORDER_PLACED"
        | "PICKUP_STARTED"
        | "SORTING"
        | "IRONING_FOLDING"
        | "ON_HOLD"
      payment_status:
        | "PENDING"
        | "SUCCESS"
        | "FAILED"
        | "REFUND_PENDING"
        | "REFUND_FAILED"
        | "REFUNDED"
        | "PARTIALLY_REFUNDED"
      pricing_type: "PER_KG" | "PER_ITEM" | "FIXED"
      user_role:
        | "customer"
        | "pickup_staff"
        | "laundry_staff"
        | "delivery_staff"
        | "admin"
    }
    CompositeTypes: {
      new_order_item: {
        service_id: string | null
        quantity: number | null
        weight: number | null
        unit_price: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PICKUP_ASSIGNED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "RECEIVED_AT_FACILITY",
        "PROCESSING",
        "WASHING",
        "DRYING",
        "IRONING",
        "FOLDING",
        "QUALITY_CHECK",
        "READY_FOR_DELIVERY",
        "DELIVERY_ASSIGNED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COMPLETED",
        "CANCELLED",
        "FAILED_PICKUP",
        "DELIVERY_FAILED",
        "REFUND_PENDING",
        "REFUNDED",
        "ORDER_PLACED",
        "PICKUP_STARTED",
        "SORTING",
        "IRONING_FOLDING",
        "ON_HOLD",
      ],
      payment_status: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ],
      pricing_type: ["PER_KG", "PER_ITEM", "FIXED"],
      user_role: [
        "customer",
        "pickup_staff",
        "laundry_staff",
        "delivery_staff",
        "admin",
      ],
    },
  },
} as const
