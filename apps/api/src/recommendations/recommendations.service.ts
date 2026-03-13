import { Injectable } from '@nestjs/common';
import { RecommendationEngineService } from './recommendation-engine.service';

@Injectable()
export class RecommendationsService {
  constructor(private readonly recommendationEngineService: RecommendationEngineService) {}

  getCaptains(gameweek: number, limit: number) {
    return this.recommendationEngineService.getRecommendations('captain', gameweek, limit);
  }

  getDifferentials(gameweek: number, limit: number) {
    return this.recommendationEngineService.getRecommendations('differential', gameweek, limit);
  }

  getTransfers(gameweek: number, limit: number) {
    return this.recommendationEngineService.getRecommendations('transfer', gameweek, limit);
  }
}