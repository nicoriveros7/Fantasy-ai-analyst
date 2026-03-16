import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTeamSnapshotDto } from './dto/create-team-snapshot.dto';
import { OptimizeLineupDto } from './dto/optimize-lineup.dto';
import { PlanTransfersDto } from './dto/plan-transfers.dto';
import { ReviewStrategyDto } from './dto/review-strategy.dto';
import { SuggestTransfersDto } from './dto/suggest-transfers.dto';
import { ValidateSquadDto } from './dto/validate-squad.dto';
import { AiStrategyReviewService } from './ai-strategy-review.service';
import { LineupOptimizerService } from './lineup-optimizer.service';
import { SquadWeaknessAnalyzerService } from './squad-weakness-analyzer.service';
import { SquadRulesService } from './squad-rules.service';
import { TeamSnapshotsService } from './team-snapshots.service';
import { TransferPlanningService } from './transfer-planning.service';
import { TransferSuggestionService } from './transfer-suggestion.service';

@ApiTags('team')
@Controller('team')
export class TeamController {
  constructor(
    private readonly lineupOptimizerService: LineupOptimizerService,
    private readonly transferSuggestionService: TransferSuggestionService,
    private readonly squadRulesService: SquadRulesService,
    private readonly teamSnapshotsService: TeamSnapshotsService,
    private readonly transferPlanningService: TransferPlanningService,
    private readonly squadWeaknessAnalyzerService: SquadWeaknessAnalyzerService,
    private readonly aiStrategyReviewService: AiStrategyReviewService,
  ) {}

  @Post('snapshots')
  @ApiOperation({ summary: 'Create persistent team snapshot' })
  @ApiResponse({ status: 200 })
  createSnapshot(@Body() payload: CreateTeamSnapshotDto) {
    return this.teamSnapshotsService.createSnapshot(payload);
  }

  @Get('snapshots/latest')
  @ApiOperation({ summary: 'Get latest team snapshot' })
  @ApiResponse({ status: 200 })
  getLatestSnapshot() {
    return this.teamSnapshotsService.getLatestSnapshot();
  }

  @Get('snapshots/:id')
  @ApiOperation({ summary: 'Get team snapshot by id' })
  @ApiResponse({ status: 200 })
  getSnapshotById(@Param('id', ParseIntPipe) id: number) {
    return this.teamSnapshotsService.getSnapshotById(id);
  }

  @Post('validate-squad')
  @ApiOperation({ summary: 'Validate official FPL squad constraints for 15 players' })
  @ApiResponse({ status: 200 })
  validateSquad(@Body() payload: ValidateSquadDto) {
    return this.squadRulesService.validateSquad(payload.players);
  }

  @Post('optimize-lineup')
  @ApiOperation({ summary: 'Optimize starting XI, captaincy, and bench order for a squad' })
  @ApiResponse({ status: 200 })
  optimizeLineup(@Body() payload: OptimizeLineupDto) {
    return this.lineupOptimizerService.optimizeLineup(payload.squadPlayerIds, payload.gameweek ?? 1);
  }

  @Post('suggest-transfers')
  @ApiOperation({ summary: 'Suggest deterministic transfer moves with projected point gain' })
  @ApiResponse({ status: 200 })
  suggestTransfers(@Body() payload: SuggestTransfersDto) {
    return this.transferSuggestionService.suggestTransfers(
      payload.squadPlayerIds,
      payload.budget,
      payload.freeTransfers,
      payload.gameweek ?? 1,
      payload.horizon ?? 1,
    );
  }

  @Post('plan-transfers')
  @ApiOperation({ summary: 'Create deterministic transfer plan over 3 or 5 gameweeks' })
  @ApiResponse({ status: 200 })
  planTransfers(@Body() payload: PlanTransfersDto) {
    return this.transferPlanningService.planTransfers({
      snapshotId: payload.snapshotId,
      horizon: payload.horizon ?? 3,
      maxTransfersPerWeek: payload.maxTransfersPerWeek ?? 2,
      chipAssumptions: payload.chipAssumptions,
      useSimulation: payload.useSimulation ?? false,
      numSimulations: payload.numSimulations,
      randomSeed: payload.randomSeed,
      riskProfile: payload.riskProfile,
    });
  }

  @Post('analyze-weakness')
  @ApiOperation({ summary: 'Analyze deterministic squad weaknesses for latest or selected snapshot' })
  @ApiResponse({ status: 200 })
  async analyzeWeakness(@Body() payload: ReviewStrategyDto) {
    const snapshot = payload.snapshotId
      ? await this.teamSnapshotsService.getSnapshotById(payload.snapshotId)
      : await this.teamSnapshotsService.getLatestSnapshot();

    return this.squadWeaknessAnalyzerService.analyze(snapshot.id, payload.horizon ?? 3);
  }

  @Post('review-strategy')
  @ApiOperation({ summary: 'Generate AI strategy review from deterministic analysis context' })
  @ApiResponse({ status: 200 })
  reviewStrategy(@Body() payload: ReviewStrategyDto) {
    return this.aiStrategyReviewService.reviewStrategy({
      snapshotId: payload.snapshotId,
      horizon: payload.horizon ?? 3,
      useSimulation: payload.useSimulation ?? true,
      numSimulations: payload.numSimulations,
      randomSeed: payload.randomSeed,
      riskProfile: payload.riskProfile,
    });
  }
}
