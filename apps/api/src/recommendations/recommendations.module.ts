import { Module } from '@nestjs/common';
import { SimulationEngineService } from '../simulations/simulation-engine.service';
import { CaptainOptimizerService } from './captain-optimizer.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
	controllers: [RecommendationsController],
	providers: [RecommendationsService, RecommendationEngineService, CaptainOptimizerService, SimulationEngineService],
	exports: [RecommendationEngineService, CaptainOptimizerService],
})
export class RecommendationsModule {}