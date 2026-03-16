export const RISK_PROFILES = ['conservative', 'balanced', 'aggressive'] as const;

export type RiskProfile = (typeof RISK_PROFILES)[number];

export function normalizeRiskProfile(profile?: string | null): RiskProfile {
  if (profile === 'conservative' || profile === 'aggressive' || profile === 'balanced') {
    return profile;
  }

  return 'balanced';
}
