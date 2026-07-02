import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export type PlanLevel = 'Starter' | 'Pro' | 'Enterprise';

export interface PlanFeatures {
  portal: boolean;
  booking: boolean;
  blog: boolean;
  reviews: boolean;
  maxUsers: number;
}

export const PLAN_FEATURES: Record<PlanLevel, PlanFeatures> = {
  Starter: {
    portal: false,
    booking: false,
    blog: false,
    reviews: false,
    maxUsers: 1,
  },
  Pro: {
    portal: false,
    booking: false,
    blog: false,
    reviews: false,
    maxUsers: 5,
  },
  Enterprise: {
    portal: true,
    booking: true,
    blog: true,
    reviews: true,
    maxUsers: 999,
  },
};

/**
 * Checks if a given plan level supports a specific feature.
 */
export function hasFeature(plan: PlanLevel | string | undefined, feature: keyof Omit<PlanFeatures, 'maxUsers'>): boolean {
  if (!plan) return false;
  const normalizedPlan = (plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()) as PlanLevel;
  const features = PLAN_FEATURES[normalizedPlan];
  if (!features) return false;
  return features[feature];
}

/**
 * Server-side helper to verify if an organization's plan supports a specific feature.
 */
export async function verifyFeatureForOrganization(
  organizationId: string,
  feature: keyof Omit<PlanFeatures, 'maxUsers'>
): Promise<boolean> {
  // Bypasses RLS since it's checking organization status for public API
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('organizations')
      .select('current_plan')
      .eq('id', organizationId)
      .maybeSingle();

    if (error || !data) return false;
    return hasFeature(data.current_plan, feature);
  } catch (err) {
    console.error('Error in verifyFeatureForOrganization:', err);
    return false;
  }
}
