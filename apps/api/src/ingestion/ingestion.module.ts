import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { SeedDataProvider } from './providers/seed/seed-data.provider';
import { FANTASY_DATA_PROVIDER } from './providers/fantasy-data-provider.token';

@Module({
	providers: [
		IngestionService,
		{
			provide: FANTASY_DATA_PROVIDER,
			useClass: SeedDataProvider,
		},
	],
	exports: [IngestionService, FANTASY_DATA_PROVIDER],
})
export class IngestionModule {}