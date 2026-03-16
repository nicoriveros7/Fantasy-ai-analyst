import { Module } from '@nestjs/common';
import { GameweeksModule } from '../gameweeks/gameweeks.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { SimulationEngineService } from '../simulations/simulation-engine.service';
import { TeamsModule } from '../teams/teams.module';
import { AiStrategyReviewService } from './ai-strategy-review.service';
import { TeamController } from './team.controller';
import { ExpectedPointsService } from './expected-points.service';
import { LineupRulesService } from './lineup-rules.service';
import { LineupOptimizerService } from './lineup-optimizer.service';
import { SquadWeaknessAnalyzerService } from './squad-weakness-analyzer.service';
import { SquadRulesService } from './squad-rules.service';
import { TeamSnapshotsService } from './team-snapshots.service';
import { TransferPlanningService } from './transfer-planning.service';
import { TransferSuggestionService } from './transfer-suggestion.service';

@Module({
  imports: [GameweeksModule, TeamsModule, RecommendationsModule],
  controllers: [TeamController],
  providers: [
    ExpectedPointsService,
    SquadRulesService,
    LineupRulesService,
    LineupOptimizerService,
    TransferSuggestionService,
    SimulationEngineService,
    TeamSnapshotsService,
    TransferPlanningService,
    SquadWeaknessAnalyzerService,
    AiStrategyReviewService,
  ],
  exports: [
    ExpectedPointsService,
    TransferSuggestionService,
    TeamSnapshotsService,
    TransferPlanningService,
    SquadWeaknessAnalyzerService,
  ],
})
export class TeamModule {}
