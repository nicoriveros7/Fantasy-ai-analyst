import { Injectable } from '@nestjs/common';
import { CaptainOptimizerService } from './captain-optimizer.service';
import { RecommendationEngineService } from './recommendation-engine.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly recommendationEngineService: RecommendationEngineService,
    private readonly captainOptimizerService: CaptainOptimizerService,
  ) {}

  getCaptains(gameweek: number, limit: number) {
    return this.recommendationEngineService.getRecommendations('captain', gameweek, limit);
  }

  getDifferentials(gameweek: number, limit: number) {
    return this.recommendationEngineService.getRecommendations('differential', gameweek, limit);
  }

  getTransfers(gameweek: number, limit: number) {
    return this.recommendationEngineService.getRecommendations('transfer', gameweek, limit);
  }

  getAdvancedCaptains(
    gameweek: number,
    limit: number,
    options?: {
      useSimulation?: boolean;
      numSimulations?: number;
      randomSeed?: number;
      riskProfile?: 'conservative' | 'balanced' | 'aggressive';
    },
  ) {
    return this.captainOptimizerService.getAdvancedCaptains(gameweek, limit, options);
  }
}