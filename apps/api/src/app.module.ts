import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { FixturesModule } from './fixtures/fixtures.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    HealthModule,
    PlayersModule,
    TeamsModule,
    FixturesModule,
    RecommendationsModule,
    AiModule,
    IngestionModule,
    PrismaModule,
  ],
})
export class AppModule {}