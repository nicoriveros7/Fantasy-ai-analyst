export interface SimulationInputConfig {
  numSimulations: number;
  randomSeed?: number;
}

export interface PlayerSimulationContext {
  playerId: number;
  gameweek: number;
  expectedPoints: number;
  xgTrend: number;
  xaTrend: number;
  minutesReliability: number;
  fixtureDifficulty: number;
  fixtureCount: number;
  isBlank: boolean;
  isDouble: boolean;
}

export interface DistributionSummary {
  expectedValue: number;
  median: number;
  upsideScore: number;
  downsideRisk: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export interface PlayerSimulationResult {
  playerId: number;
  samples: number[];
  summary: DistributionSummary;
}

export interface HeadToHeadSimulationResult {
  playerA: PlayerSimulationResult;
  playerB: PlayerSimulationResult;
  probabilityAOutscoresB: number;
}
