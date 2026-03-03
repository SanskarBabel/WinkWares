// src/lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions
export type UserRole = 'admin' | 'vendor' | 'customer'
export type OnboardingStatus = 'pending' | 'verified' | 'rejected'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  avatar_url?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface Vendor {
  id: string
  profile_id: string
  store_name: string
  slug: string
  description?: string
  logo_url?: string
  banner_url?: string
  commission_rate: number
  onboarding_status: OnboardingStatus
  stripe_connect_id?: string
  business_email?: string
  business_phone?: string
  business_address?: any
  verified_at?: string
  created_at: string
  updated_at: string
}