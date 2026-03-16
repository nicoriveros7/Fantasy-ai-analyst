import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { FplDataProvider } from './providers/fpl/fpl-data.provider';
import { FplHttpClient } from './providers/fpl/fpl-http.client';
import { SeedDataProvider } from './providers/seed/seed-data.provider';
import { FANTASY_DATA_PROVIDER } from './providers/fantasy-data-provider.token';

@Module({
	imports: [RecommendationsModule],
	controllers: [IngestionController],
	providers: [
		IngestionService,
		SeedDataProvider,
		FplDataProvider,
		FplHttpClient,
		{
			provide: FANTASY_DATA_PROVIDER,
			useFactory: (seedProvider: SeedDataProvider, fplProvider: FplDataProvider) =>
				process.env.DATA_PROVIDER === 'fpl' ? fplProvider : seedProvider,
			inject: [SeedDataProvider, FplDataProvider],
		},
	],
	exports: [IngestionService, FANTASY_DATA_PROVIDER],
})
export class IngestionModule {}