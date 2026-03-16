import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { CopilotModule } from './copilot/copilot.module';
import { FixturesModule } from './fixtures/fixtures.module';
import { GameweeksModule } from './gameweeks/gameweeks.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SimulationsModule } from './simulations/simulations.module';
import { TeamModule } from './team/team.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    HealthModule,
    PlayersModule,
    TeamsModule,
    FixturesModule,
    GameweeksModule,
    RecommendationsModule,
    SimulationsModule,
    TeamModule,
    AiModule,
    ChatModule,
    CopilotModule,
    IngestionModule,
    PrismaModule,
  ],
})
export class AppModule {}