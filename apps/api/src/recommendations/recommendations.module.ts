import { Module } from '@nestjs/common';
import { RecommendationEngineService } from './recommendation-engine.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
	controllers: [RecommendationsController],
	providers: [RecommendationsService, RecommendationEngineService],
})
export class RecommendationsModule {}