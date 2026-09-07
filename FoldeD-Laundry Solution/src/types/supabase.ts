export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: 'customer' | 'pickup_staff' | 'laundry_staff' | 'delivery_staff' | 'admin';
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: any;
        Update: any;
      };
      addresses: { Row: any; Insert: any; Update: any };
      service_areas: { Row: any; Insert: any; Update: any };
      services: { Row: any; Insert: any; Update: any };
      items: { Row: any; Insert: any; Update: any };
      coupons: { Row: any; Insert: any; Update: any };
      orders: { Row: any; Insert: any; Update: any };
      order_items: { Row: any; Insert: any; Update: any };
      order_status_history: { Row: any; Insert: any; Update: any };
      payments: { Row: any; Insert: any; Update: any };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
