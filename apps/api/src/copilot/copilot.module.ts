import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { GameweeksModule } from '../gameweeks/gameweeks.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { TeamModule } from '../team/team.module';
import { TeamsModule } from '../teams/teams.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

@Module({
  imports: [ChatModule, TeamModule, RecommendationsModule, TeamsModule, GameweeksModule],
  controllers: [CopilotController],
  providers: [CopilotService],
})
export class CopilotModule {}
