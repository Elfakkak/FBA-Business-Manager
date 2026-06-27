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
      amazon_monthly: {
        Row: {
          ad_spend: number
          created_at: string
          fba_fees: number
          gross_sales: number
          month: string
          net_payout: number
          provenance: string
          referral_fees: number
          refunds: number
          units: number
          updated_at: string
        }
        Insert: {
          ad_spend?: number
          created_at?: string
          fba_fees?: number
          gross_sales?: number
          month: string
          net_payout?: number
          provenance?: string
          referral_fees?: number
          refunds?: number
          units?: number
          updated_at?: string
        }
        Update: {
          ad_spend?: number
          created_at?: string
          fba_fees?: number
          gross_sales?: number
          month?: string
          net_payout?: number
          provenance?: string
          referral_fees?: number
          refunds?: number
          units?: number
          updated_at?: string
        }
        Relationships: []
      }
      amazon_product_perf: {
        Row: {
          avg_units_month: number
          created_at: string
          family_id: string
          net_per_unit: number | null
          sell_price: number | null
          updated_at: string
        }
        Insert: {
          avg_units_month?: number
          created_at?: string
          family_id: string
          net_per_unit?: number | null
          sell_price?: number | null
          updated_at?: string
        }
        Update: {
          avg_units_month?: number
          created_at?: string
          family_id?: string
          net_per_unit?: number | null
          sell_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_product_perf_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_uploads: {
        Row: {
          asset_ref: string | null
          created_at: string
          mime: string | null
          size: number | null
          slot_id: string
        }
        Insert: {
          asset_ref?: string | null
          created_at?: string
          mime?: string | null
          size?: number | null
          slot_id: string
        }
        Update: {
          asset_ref?: string | null
          created_at?: string
          mime?: string | null
          size?: number | null
          slot_id?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          account: string | null
          amount: number
          created_at: string
          descr: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          id: string
          reviewed: boolean
          source: Database["public"]["Enums"]["txn_source"]
          txn_date: string
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount: number
          created_at?: string
          descr?: string | null
          direction: Database["public"]["Enums"]["txn_direction"]
          id: string
          reviewed?: boolean
          source: Database["public"]["Enums"]["txn_source"]
          txn_date: string
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          created_at?: string
          descr?: string | null
          direction?: Database["public"]["Enums"]["txn_direction"]
          id?: string
          reviewed?: boolean
          source?: Database["public"]["Enums"]["txn_source"]
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_fkey"
            columns: ["account"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand: {
        Row: {
          color: string | null
          established: string | null
          gtin_exempt: boolean | null
          id: number
          logo_url: string | null
          name: string | null
          registry_enrolled: boolean | null
          registry_id: string | null
          store_url: string | null
          support_email: string | null
          tagline: string | null
          tm_jurisdiction: string | null
          tm_number: string | null
          tm_owner: string | null
          tm_status: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          color?: string | null
          established?: string | null
          gtin_exempt?: boolean | null
          id?: number
          logo_url?: string | null
          name?: string | null
          registry_enrolled?: boolean | null
          registry_id?: string | null
          store_url?: string | null
          support_email?: string | null
          tagline?: string | null
          tm_jurisdiction?: string | null
          tm_number?: string | null
          tm_owner?: string | null
          tm_status?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          color?: string | null
          established?: string | null
          gtin_exempt?: boolean | null
          id?: number
          logo_url?: string | null
          name?: string | null
          registry_enrolled?: boolean | null
          registry_id?: string | null
          store_url?: string | null
          support_email?: string | null
          tagline?: string | null
          tm_jurisdiction?: string | null
          tm_number?: string | null
          tm_owner?: string | null
          tm_status?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      business_profile: {
        Row: {
          address: string | null
          city: string | null
          company: string | null
          country: string | null
          duns_number: string | null
          ein: string | null
          email: string | null
          entity_type: string | null
          formation_date: string | null
          id: number
          phone: string | null
          registered_agent: string | null
          state: string | null
          state_of_formation: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          duns_number?: string | null
          ein?: string | null
          email?: string | null
          entity_type?: string | null
          formation_date?: string | null
          id?: number
          phone?: string | null
          registered_agent?: string | null
          state?: string | null
          state_of_formation?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          duns_number?: string | null
          ein?: string | null
          email?: string | null
          entity_type?: string | null
          formation_date?: string | null
          id?: number
          phone?: string | null
          registered_agent?: string | null
          state?: string | null
          state_of_formation?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      categorization_rules: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["entry_kind"]
          label: string | null
          match_text: string
          partner: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          label?: string | null
          match_text: string
          partner?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          label?: string | null
          match_text?: string
          partner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      charge_types: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          label: string
          owner: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id: string
          label: string
          owner?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          label?: string
          owner?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          note: string | null
          phone: string | null
          role: string | null
          updated_at: string
          wechat: string | null
        }
        Insert: {
          company: string
          created_at?: string
          email?: string | null
          id: string
          is_primary?: boolean
          name: string
          note?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          wechat?: string | null
        }
        Update: {
          company?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          wechat?: string | null
        }
        Relationships: []
      }
      fba_inbound_items: {
        Row: {
          expected: number
          fnsku: string | null
          inbound_id: string
          received: number
          sku: string
        }
        Insert: {
          expected?: number
          fnsku?: string | null
          inbound_id: string
          received?: number
          sku: string
        }
        Update: {
          expected?: number
          fnsku?: string | null
          inbound_id?: string
          received?: number
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "fba_inbound_items_inbound_id_fkey"
            columns: ["inbound_id"]
            isOneToOne: false
            referencedRelation: "fba_inbounds"
            referencedColumns: ["id"]
          },
        ]
      }
      fba_inbounds: {
        Row: {
          amazon_status: Database["public"]["Enums"]["fba_status"]
          created_at: string
          eta: string | null
          expected: number
          fc: string
          id: string
          mode: string | null
          order_id: string | null
          received: number
          shipment_id: string | null
          sku_count: number
          synced: string | null
          updated_at: string
        }
        Insert: {
          amazon_status?: Database["public"]["Enums"]["fba_status"]
          created_at?: string
          eta?: string | null
          expected?: number
          fc: string
          id: string
          mode?: string | null
          order_id?: string | null
          received?: number
          shipment_id?: string | null
          sku_count?: number
          synced?: string | null
          updated_at?: string
        }
        Update: {
          amazon_status?: Database["public"]["Enums"]["fba_status"]
          created_at?: string
          eta?: string | null
          expected?: number
          fc?: string
          id?: string
          mode?: string | null
          order_id?: string | null
          received?: number
          shipment_id?: string | null
          sku_count?: number
          synced?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fba_inbounds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fba_inbounds_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          opening?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          account: string | null
          amount: number
          created_at: string
          entry_date: string
          id: string
          invoice_id: string | null
          kind: Database["public"]["Enums"]["entry_kind"]
          locked: boolean
          note: string | null
          order_id: string | null
          partner: string | null
          source: Database["public"]["Enums"]["entry_source"]
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount: number
          created_at?: string
          entry_date: string
          id: string
          invoice_id?: string | null
          kind: Database["public"]["Enums"]["entry_kind"]
          locked?: boolean
          note?: string | null
          order_id?: string | null
          partner?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          created_at?: string
          entry_date?: string
          id?: string
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["entry_kind"]
          locked?: boolean
          note?: string | null
          order_id?: string | null
          partner?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_account_fkey"
            columns: ["account"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          currency: string
          rate: number
          updated_at: string
        }
        Insert: {
          currency: string
          rate: number
          updated_at?: string
        }
        Update: {
          currency?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          last_sync: string | null
          note: string | null
          oauth_token: Json | null
          status: Database["public"]["Enums"]["integration_status"]
          sync_state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          last_sync?: string | null
          note?: string | null
          oauth_token?: Json | null
          status?: Database["public"]["Enums"]["integration_status"]
          sync_state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync?: string | null
          note?: string | null
          oauth_token?: Json | null
          status?: Database["public"]["Enums"]["integration_status"]
          sync_state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          billed: number
          charge_type_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          kind: string
          order_line_id: string | null
          ordered_amount: number | null
          owner: string | null
          position: number
          qty: number | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          billed?: number
          charge_type_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          kind?: string
          order_line_id?: string | null
          ordered_amount?: number | null
          owner?: string | null
          position?: number
          qty?: number | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          billed?: number
          charge_type_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          kind?: string
          order_line_id?: string | null
          ordered_amount?: number | null
          owner?: string | null
          position?: number
          qty?: number | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_charge_type_id_fkey"
            columns: ["charge_type_id"]
            isOneToOne: false
            referencedRelation: "charge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          cadence: Json | null
          created_at: string
          currency: string | null
          id: string
          invoice_id: string
          method: string | null
          payment_date: string | null
          proof_kind: string | null
          proof_url: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          cadence?: Json | null
          created_at?: string
          currency?: string | null
          id: string
          invoice_id: string
          method?: string | null
          payment_date?: string | null
          proof_kind?: string | null
          proof_url?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          cadence?: Json | null
          created_at?: string
          currency?: string | null
          id?: string
          invoice_id?: string
          method?: string | null
          payment_date?: string | null
          proof_kind?: string | null
          proof_url?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string | null
          document_url: string | null
          due: string | null
          fx_rate_locked: number | null
          id: string
          issued: string | null
          order_id: string | null
          paid: number
          term_deposit_pct: number | null
          term_net_days: number | null
          term_type: string | null
          terms: string | null
          total: number
          updated_at: string
          vendor: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
        }
        Insert: {
          created_at?: string
          currency?: string | null
          document_url?: string | null
          due?: string | null
          fx_rate_locked?: number | null
          id: string
          issued?: string | null
          order_id?: string | null
          paid?: number
          term_deposit_pct?: number | null
          term_net_days?: number | null
          term_type?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
          vendor: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
        }
        Update: {
          created_at?: string
          currency?: string | null
          document_url?: string | null
          due?: string | null
          fx_rate_locked?: number | null
          id?: string
          issued?: string | null
          order_id?: string | null
          paid?: number
          term_deposit_pct?: number | null
          term_net_days?: number | null
          term_type?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
          vendor?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          id: number
          prefs: Json
        }
        Insert: {
          id?: number
          prefs?: Json
        }
        Update: {
          id?: number
          prefs?: Json
        }
        Relationships: []
      }
      order_costs: {
        Row: {
          amount: number
          amount_cny_ref: number | null
          basis: string
          charge_type_id: string | null
          coverage: string
          created_at: string
          currency: string
          description: string
          id: string
          line_type: string | null
          notes: string | null
          order_id: string
          position: number
          qty: number
          section: string
          treatment: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          amount_cny_ref?: number | null
          basis?: string
          charge_type_id?: string | null
          coverage?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          line_type?: string | null
          notes?: string | null
          order_id: string
          position?: number
          qty?: number
          section?: string
          treatment?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          amount_cny_ref?: number | null
          basis?: string
          charge_type_id?: string | null
          coverage?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          line_type?: string | null
          notes?: string | null
          order_id?: string
          position?: number
          qty?: number
          section?: string
          treatment?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_costs_charge_type_id_fkey"
            columns: ["charge_type_id"]
            isOneToOne: false
            referencedRelation: "charge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          created_at: string
          id: string
          name: string | null
          order_id: string
          slot: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          order_id: string
          slot: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          order_id?: string
          slot?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_inspections: {
        Row: {
          aql: string | null
          completed_date: string | null
          created_at: string
          defects_critical: number | null
          defects_major: number | null
          defects_minor: number | null
          factory_contact: string | null
          folder_link: string | null
          inspector: string | null
          lot_size: number | null
          notes: string | null
          order_id: string
          partner_name: string | null
          report_accepted: boolean
          report_name: string | null
          report_url: string | null
          result: string
          sample_size: number | null
          scheduled_date: string | null
          status: string
          updated_at: string
          visit_type: string | null
        }
        Insert: {
          aql?: string | null
          completed_date?: string | null
          created_at?: string
          defects_critical?: number | null
          defects_major?: number | null
          defects_minor?: number | null
          factory_contact?: string | null
          folder_link?: string | null
          inspector?: string | null
          lot_size?: number | null
          notes?: string | null
          order_id: string
          partner_name?: string | null
          report_accepted?: boolean
          report_name?: string | null
          report_url?: string | null
          result?: string
          sample_size?: number | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
          visit_type?: string | null
        }
        Update: {
          aql?: string | null
          completed_date?: string | null
          created_at?: string
          defects_critical?: number | null
          defects_major?: number | null
          defects_minor?: number | null
          factory_contact?: string | null
          folder_link?: string | null
          inspector?: string | null
          lot_size?: number | null
          notes?: string | null
          order_id?: string
          partner_name?: string | null
          report_accepted?: boolean
          report_name?: string | null
          report_url?: string | null
          result?: string
          sample_size?: number | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_inspections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          created_at: string
          family_id: string | null
          id: string
          order_id: string
          product_name: string | null
          qty: number
          sku: string | null
          unit_cny_ref: number | null
          unit_cost: number | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          family_id?: string | null
          id?: string
          order_id: string
          product_name?: string | null
          qty?: number
          sku?: string | null
          unit_cny_ref?: number | null
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          family_id?: string | null
          id?: string
          order_id?: string
          product_name?: string | null
          qty?: number
          sku?: string | null
          unit_cny_ref?: number | null
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_terms: {
        Row: {
          created_at: string
          deposit_pct: number | null
          net_days: number | null
          order_id: string
          type: Database["public"]["Enums"]["payterm_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_pct?: number | null
          net_days?: number | null
          order_id: string
          type: Database["public"]["Enums"]["payterm_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_pct?: number | null
          net_days?: number | null
          order_id?: string
          type?: Database["public"]["Enums"]["payterm_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_terms_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent: string | null
          created_at: string
          fba_eta: string | null
          id: string
          inspection_required: boolean
          placed_on: string | null
          prelock_status: string | null
          route: string | null
          ship_mode: string | null
          status: Database["public"]["Enums"]["order_status"]
          supplier: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent?: string | null
          created_at?: string
          fba_eta?: string | null
          id: string
          inspection_required?: boolean
          placed_on?: string | null
          prelock_status?: string | null
          route?: string | null
          ship_mode?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent?: string | null
          created_at?: string
          fba_eta?: string | null
          id?: string
          inspection_required?: boolean
          placed_on?: string | null
          prelock_status?: string | null
          route?: string | null
          ship_mode?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "orders_supplier_fkey"
            columns: ["supplier"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["name"]
          },
        ]
      }
      packaging_items: {
        Row: {
          created_at: string
          design_url: string | null
          family_id: string | null
          id: string
          kind: Database["public"]["Enums"]["packaging_kind"]
          name: string
          reorder_point: number | null
          size: string | null
          unit_cost: number
          updated_at: string
          variant_ids: string[]
        }
        Insert: {
          created_at?: string
          design_url?: string | null
          family_id?: string | null
          id: string
          kind?: Database["public"]["Enums"]["packaging_kind"]
          name: string
          reorder_point?: number | null
          size?: string | null
          unit_cost?: number
          updated_at?: string
          variant_ids?: string[]
        }
        Update: {
          created_at?: string
          design_url?: string | null
          family_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["packaging_kind"]
          name?: string
          reorder_point?: number | null
          size?: string | null
          unit_cost?: number
          updated_at?: string
          variant_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "packaging_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_moves: {
        Row: {
          created_at: string
          id: string
          item_id: string
          move_date: string
          note: string | null
          order_id: string | null
          qty: number
          source: string | null
          type: Database["public"]["Enums"]["pkg_move_type"]
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id: string
          item_id: string
          move_date: string
          note?: string | null
          order_id?: string | null
          qty: number
          source?: string | null
          type: Database["public"]["Enums"]["pkg_move_type"]
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          move_date?: string
          note?: string | null
          order_id?: string | null
          qty?: number
          source?: string | null
          type?: Database["public"]["Enums"]["pkg_move_type"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_moves_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_moves_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          email: string | null
          is_new: boolean | null
          name: string
          notes: string | null
          origin: string | null
          payment_terms: string | null
          phone: string | null
          specialty: string | null
          type: Database["public"]["Enums"]["partner_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          is_new?: boolean | null
          name: string
          notes?: string | null
          origin?: string | null
          payment_terms?: string | null
          phone?: string | null
          specialty?: string | null
          type: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          is_new?: boolean | null
          name?: string
          notes?: string | null
          origin?: string | null
          payment_terms?: string | null
          phone?: string | null
          specialty?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
        }
        Relationships: []
      }
      product_tech_packs: {
        Row: {
          asset_ref: string | null
          created_at: string
          doc_date: string | null
          family_id: string
          file_name: string
          file_size: number | null
          id: string
          note: string | null
          version: number
        }
        Insert: {
          asset_ref?: string | null
          created_at?: string
          doc_date?: string | null
          family_id: string
          file_name: string
          file_size?: number | null
          id?: string
          note?: string | null
          version: number
        }
        Update: {
          asset_ref?: string | null
          created_at?: string
          doc_date?: string | null
          family_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          note?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_tech_packs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          ad_sales_30d: number | null
          ad_spend_30d: number | null
          ad_units_30d: number | null
          amazon_meta: Json | null
          asin: string | null
          created_at: string
          family_id: string
          favorite: boolean
          fba_stock: number
          fnsku: string | null
          has_image: boolean
          id: string
          inbound: number
          last_cost_rmb: number | null
          last_cost_usd: number | null
          name: string
          pack: string
          prep: Database["public"]["Enums"]["variant_prep"]
          reorder_point: number | null
          reserved: number
          sale_price: number | null
          sku: string
          status: Database["public"]["Enums"]["variant_status"]
          unfulfillable: number
          updated_at: string
          velocity: number | null
        }
        Insert: {
          ad_sales_30d?: number | null
          ad_spend_30d?: number | null
          ad_units_30d?: number | null
          amazon_meta?: Json | null
          asin?: string | null
          created_at?: string
          family_id: string
          favorite?: boolean
          fba_stock?: number
          fnsku?: string | null
          has_image?: boolean
          id?: string
          inbound?: number
          last_cost_rmb?: number | null
          last_cost_usd?: number | null
          name: string
          pack?: string
          prep?: Database["public"]["Enums"]["variant_prep"]
          reorder_point?: number | null
          reserved?: number
          sale_price?: number | null
          sku: string
          status?: Database["public"]["Enums"]["variant_status"]
          unfulfillable?: number
          updated_at?: string
          velocity?: number | null
        }
        Update: {
          ad_sales_30d?: number | null
          ad_spend_30d?: number | null
          ad_units_30d?: number | null
          amazon_meta?: Json | null
          asin?: string | null
          created_at?: string
          family_id?: string
          favorite?: boolean
          fba_stock?: number
          fnsku?: string | null
          has_image?: boolean
          id?: string
          inbound?: number
          last_cost_rmb?: number | null
          last_cost_usd?: number | null
          name?: string
          pack?: string
          prep?: Database["public"]["Enums"]["variant_prep"]
          reorder_point?: number | null
          reserved?: number
          sale_price?: number | null
          sku?: string
          status?: Database["public"]["Enums"]["variant_status"]
          unfulfillable?: number
          updated_at?: string
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badges: Json
          brand: string
          carton_cm: Json | null
          carton_kg: number | null
          category: string
          color: string | null
          cost_history: Json
          created_at: string
          dim_cm: Json | null
          dim_history: Json | null
          dims: string | null
          favorite: boolean
          id: string
          images: Json
          last_ordered: string | null
          lead_time_days: number
          material: string | null
          moq: number
          order_history: Json
          parent: string
          primary_sku: string | null
          status: string
          supplier: string | null
          supplier_route: string | null
          units_per_carton: number | null
          updated_at: string
          weight_kg: number | null
          weight_lbs: number | null
        }
        Insert: {
          badges?: Json
          brand?: string
          carton_cm?: Json | null
          carton_kg?: number | null
          category: string
          color?: string | null
          cost_history?: Json
          created_at?: string
          dim_cm?: Json | null
          dim_history?: Json | null
          dims?: string | null
          favorite?: boolean
          id: string
          images?: Json
          last_ordered?: string | null
          lead_time_days?: number
          material?: string | null
          moq?: number
          order_history?: Json
          parent: string
          primary_sku?: string | null
          status?: string
          supplier?: string | null
          supplier_route?: string | null
          units_per_carton?: number | null
          updated_at?: string
          weight_kg?: number | null
          weight_lbs?: number | null
        }
        Update: {
          badges?: Json
          brand?: string
          carton_cm?: Json | null
          carton_kg?: number | null
          category?: string
          color?: string | null
          cost_history?: Json
          created_at?: string
          dim_cm?: Json | null
          dim_history?: Json | null
          dims?: string | null
          favorite?: boolean
          id?: string
          images?: Json
          last_ordered?: string | null
          lead_time_days?: number
          material?: string | null
          moq?: number
          order_history?: Json
          parent?: string
          primary_sku?: string | null
          status?: string
          supplier?: string | null
          supplier_route?: string | null
          units_per_carton?: number | null
          updated_at?: string
          weight_kg?: number | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_fkey"
            columns: ["supplier"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["name"]
          },
        ]
      }
      recurring_items: {
        Row: {
          amount: number
          cadence: Database["public"]["Enums"]["recur_cadence"]
          category: string
          created_at: string
          id: string
          match_text: string | null
          name: string
          note: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          cadence?: Database["public"]["Enums"]["recur_cadence"]
          category: string
          created_at?: string
          id: string
          match_text?: string | null
          name: string
          note?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cadence?: Database["public"]["Enums"]["recur_cadence"]
          category?: string
          created_at?: string
          id?: string
          match_text?: string | null
          name?: string
          note?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipment_files: {
        Row: {
          created_at: string
          id: string
          name: string | null
          shipment_id: string | null
          slot: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          shipment_id?: string | null
          slot: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          shipment_id?: string | null
          slot?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_files_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_packing_lines: {
        Row: {
          cartons: number
          created_at: string
          fc: string | null
          id: string
          packed: number
          per_ctn: number
          position: number
          product_name: string | null
          shipment_id: string | null
          sku: string | null
        }
        Insert: {
          cartons?: number
          created_at?: string
          fc?: string | null
          id?: string
          packed?: number
          per_ctn?: number
          position?: number
          product_name?: string | null
          shipment_id?: string | null
          sku?: string | null
        }
        Update: {
          cartons?: number
          created_at?: string
          fc?: string | null
          id?: string
          packed?: number
          per_ctn?: number
          position?: number
          product_name?: string | null
          shipment_id?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_packing_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_tracking: {
        Row: {
          booking_ref: string | null
          carrier: string | null
          checkpoints: Json
          created_at: string
          eta_override: string | null
          last_sync: string | null
          scac: string | null
          shipment_id: string
          stage: Database["public"]["Enums"]["shipment_stage"] | null
          status: string | null
          sub_status: string | null
          tracking_no: string | null
          updated_at: string
        }
        Insert: {
          booking_ref?: string | null
          carrier?: string | null
          checkpoints?: Json
          created_at?: string
          eta_override?: string | null
          last_sync?: string | null
          scac?: string | null
          shipment_id: string
          stage?: Database["public"]["Enums"]["shipment_stage"] | null
          status?: string | null
          sub_status?: string | null
          tracking_no?: string | null
          updated_at?: string
        }
        Update: {
          booking_ref?: string | null
          carrier?: string | null
          checkpoints?: Json
          created_at?: string
          eta_override?: string | null
          last_sync?: string | null
          scac?: string | null
          shipment_id?: string
          stage?: Database["public"]["Enums"]["shipment_stage"] | null
          status?: string | null
          sub_status?: string | null
          tracking_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          archived: boolean
          bol: string | null
          broker: string | null
          cartons: number | null
          cbm: number | null
          created_at: string
          customs: Database["public"]["Enums"]["customs_status"] | null
          destination: string | null
          duties_usd: number | null
          eta: string | null
          etd: string | null
          forwarder: string | null
          freight_usd: number | null
          gross_kg: number | null
          id: string
          incoterm: string | null
          mode: string
          net_kg: number | null
          order_id: string | null
          order_title: string | null
          origin: string | null
          packed: number
          stage: Database["public"]["Enums"]["shipment_stage"]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          bol?: string | null
          broker?: string | null
          cartons?: number | null
          cbm?: number | null
          created_at?: string
          customs?: Database["public"]["Enums"]["customs_status"] | null
          destination?: string | null
          duties_usd?: number | null
          eta?: string | null
          etd?: string | null
          forwarder?: string | null
          freight_usd?: number | null
          gross_kg?: number | null
          id: string
          incoterm?: string | null
          mode: string
          net_kg?: number | null
          order_id?: string | null
          order_title?: string | null
          origin?: string | null
          packed?: number
          stage?: Database["public"]["Enums"]["shipment_stage"]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          bol?: string | null
          broker?: string | null
          cartons?: number | null
          cbm?: number | null
          created_at?: string
          customs?: Database["public"]["Enums"]["customs_status"] | null
          destination?: string | null
          duties_usd?: number | null
          eta?: string | null
          etd?: string | null
          forwarder?: string | null
          freight_usd?: number | null
          gross_kg?: number | null
          id?: string
          incoterm?: string | null
          mode?: string
          net_kg?: number | null
          order_id?: string | null
          order_title?: string | null
          origin?: string | null
          packed?: number
          stage?: Database["public"]["Enums"]["shipment_stage"]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_forwarder_fkey"
            columns: ["forwarder"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_supplier_fkey"
            columns: ["supplier"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["name"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          email: string | null
          incoterm: string | null
          is_new: boolean | null
          lead_time_days: number | null
          moq: number | null
          name: string
          notes: string | null
          origin: string | null
          payment_terms: string | null
          phone: string | null
          route: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          incoterm?: string | null
          is_new?: boolean | null
          lead_time_days?: number | null
          moq?: number | null
          name: string
          notes?: string | null
          origin?: string | null
          payment_terms?: string | null
          phone?: string | null
          route?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          incoterm?: string | null
          is_new?: boolean | null
          lead_time_days?: number | null
          moq?: number | null
          name?: string
          notes?: string | null
          origin?: string | null
          payment_terms?: string | null
          phone?: string | null
          route?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplies: {
        Row: {
          created_at: string
          id: string
          item: string
          order_id: string | null
          order_title: string | null
          qty_ordered: number
          qty_used: number
          supply_date: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          item: string
          order_id?: string | null
          order_title?: string | null
          qty_ordered: number
          qty_used?: number
          supply_date: string
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item?: string
          order_id?: string | null
          order_title?: string | null
          qty_ordered?: number
          qty_used?: number
          supply_date?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplies_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_cost_history: {
        Row: {
          billed: number | null
          created_at: string
          currency: string
          family_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          order_id: string | null
          qty: number | null
          recorded_at: string
          sku: string | null
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          billed?: number | null
          created_at?: string
          currency?: string
          family_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          order_id?: string | null
          qty?: number | null
          recorded_at?: string
          sku?: string | null
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          billed?: number | null
          created_at?: string
          currency?: string
          family_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          order_id?: string | null
          qty?: number | null
          recorded_at?: string
          sku?: string | null
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variant_cost_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_cost_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_cost_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_cost_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_uid: string | null
          created_at: string
          email: string | null
          fin_id: string | null
          id: string
          is_owner: boolean
          is_you: boolean
          name: string
          role: Database["public"]["Enums"]["team_role"]
          section_perms: Json
          share: number | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_uid?: string | null
          created_at?: string
          email?: string | null
          fin_id?: string | null
          id: string
          is_owner?: boolean
          is_you?: boolean
          name: string
          role?: Database["public"]["Enums"]["team_role"]
          section_perms?: Json
          share?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_uid?: string | null
          created_at?: string
          email?: string | null
          fin_id?: string | null
          id?: string
          is_owner?: boolean
          is_you?: boolean
          name?: string
          role?: Database["public"]["Enums"]["team_role"]
          section_perms?: Json
          share?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["team_role"]
      }
      can_view: { Args: { section: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      account_kind: "bank" | "cash"
      customs_status: "Cleared" | "In clearance" | "Pending" | "Docs missing"
      entry_kind: "revenue" | "expense" | "draw" | "contribution"
      entry_source: "amazon" | "manual" | "payables"
      fba_status:
        | "Working"
        | "Shipped"
        | "In transit"
        | "Receiving"
        | "Closed"
        | "Problem"
      integration_status: "connected" | "disconnected" | "error" | "syncing"
      order_status:
        | "draft"
        | "production"
        | "inspection"
        | "transit"
        | "fba"
        | "closed"
      packaging_kind:
        | "Mailer"
        | "Master carton"
        | "Insert"
        | "Polybag"
        | "Label"
        | "Box"
        | "Other"
      partner_type: "Agent" | "Forwarder" | "Inspection"
      payment_status: "Cleared" | "Scheduled" | "Pending"
      payterm_type: "TT" | "LC" | "OA" | "DP" | "DA"
      pkg_move_type: "receive" | "consume"
      recur_cadence: "daily" | "monthly" | "yearly"
      shipment_stage:
        | "Draft"
        | "Booked"
        | "Picked up"
        | "In transit"
        | "Customs"
        | "Delivered"
        | "At FBA"
      team_role: "Owner" | "Partner" | "Operations" | "Viewer"
      txn_direction: "in" | "out"
      txn_source: "amazon" | "mercury"
      variant_prep: "Labeled" | "Stickerless"
      variant_status: "Ready" | "Reorder" | "SKU mislabeled" | "Not linked"
      vendor_type: "Supplier" | "Forwarder" | "Agent" | "Inspection"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_kind: ["bank", "cash"],
      customs_status: ["Cleared", "In clearance", "Pending", "Docs missing"],
      entry_kind: ["revenue", "expense", "draw", "contribution"],
      entry_source: ["amazon", "manual", "payables"],
      fba_status: [
        "Working",
        "Shipped",
        "In transit",
        "Receiving",
        "Closed",
        "Problem",
      ],
      integration_status: ["connected", "disconnected", "error", "syncing"],
      order_status: [
        "draft",
        "production",
        "inspection",
        "transit",
        "fba",
        "closed",
      ],
      packaging_kind: [
        "Mailer",
        "Master carton",
        "Insert",
        "Polybag",
        "Label",
        "Box",
        "Other",
      ],
      partner_type: ["Agent", "Forwarder", "Inspection"],
      payment_status: ["Cleared", "Scheduled", "Pending"],
      payterm_type: ["TT", "LC", "OA", "DP", "DA"],
      pkg_move_type: ["receive", "consume"],
      recur_cadence: ["daily", "monthly", "yearly"],
      shipment_stage: [
        "Draft",
        "Booked",
        "Picked up",
        "In transit",
        "Customs",
        "Delivered",
        "At FBA",
      ],
      team_role: ["Owner", "Partner", "Operations", "Viewer"],
      txn_direction: ["in", "out"],
      txn_source: ["amazon", "mercury"],
      variant_prep: ["Labeled", "Stickerless"],
      variant_status: ["Ready", "Reorder", "SKU mislabeled", "Not linked"],
      vendor_type: ["Supplier", "Forwarder", "Agent", "Inspection"],
    },
  },
} as const
