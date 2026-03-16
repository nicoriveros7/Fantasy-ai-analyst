import { BadRequestException, Injectable } from '@nestjs/common';
import { ExpectedPointsService } from '../team/expected-points.service';
import { TeamSnapshotsService } from '../team/team-snapshots.service';
import { PrismaService } from '../prisma/prisma.service';
import { SimulationEngineService } from './simulation-engine.service';
import { PlayerSimulationContext } from './types/simulation.types';

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectedPointsService: ExpectedPointsService,
    private readonly teamSnapshotsService: TeamSnapshotsService,
    private readonly simulationEngine: SimulationEngineService,
  ) {}

  async simulateCaptainDecision(input: {
    playerAId: number;
    playerBId: number;
    gameweek: number;
    numSimulations: number;
    randomSeed?: number;
  }) {
    const [contextA, contextB] = await Promise.all([
      this.buildPlayerContext(input.playerAId, input.gameweek),
      this.buildPlayerContext(input.playerBId, input.gameweek),
    ]);

    const result = this.simulationEngine.simulateHeadToHead(
      contextA,
      contextB,
      input.numSimulations,
      input.randomSeed,
    );

    return {
      expectedPointsA: result.playerA.summary.expectedValue,
      expectedPointsB: result.playerB.summary.expectedValue,
      medianA: result.playerA.summary.median,
      medianB: result.playerB.summary.median,
      probabilityAOutscoresB: result.probabilityAOutscoresB,
      upsideScoreA: result.playerA.summary.upsideScore,
      upsideScoreB: result.playerB.summary.upsideScore,
      downsideRiskA: result.playerA.summary.downsideRisk,
      downsideRiskB: result.playerB.summary.downsideRisk,
      recommendedCaptain: result.probabilityAOutscoresB >= 0.5 ? contextA.playerId : contextB.playerId,
      reasoningSignals: {
        playerA: {
          playerId: contextA.playerId,
          xgTrend: contextA.xgTrend,
          xaTrend: contextA.xaTrend,
          minutesReliability: contextA.minutesReliability,
          fixtureDifficulty: contextA.fixtureDifficulty,
          fixtureCount: contextA.fixtureCount,
          blankOrDouble: { isBlank: contextA.isBlank, isDouble: contextA.isDouble },
        },
        playerB: {
          playerId: contextB.playerId,
          xgTrend: contextB.xgTrend,
          xaTrend: contextB.xaTrend,
          minutesReliability: contextB.minutesReliability,
          fixtureDifficulty: contextB.fixtureDifficulty,
          fixtureCount: contextB.fixtureCount,
          blankOrDouble: { isBlank: contextB.isBlank, isDouble: contextB.isDouble },
        },
      },
    };
  }

  async simulateTransferDecision(input: {
    snapshotId: number;
    transferOutPlayerId: number;
    transferInPlayerId: number;
    horizon: 3 | 5;
    numSimulations: number;
    randomSeed?: number;
  }) {
    const snapshot = await this.teamSnapshotsService.getSnapshotById(input.snapshotId);
    if (!snapshot.squadPlayerIds.includes(input.transferOutPlayerId)) {
      throw new BadRequestException('transferOutPlayerId is not in snapshot squad');
    }
    if (snapshot.squadPlayerIds.includes(input.transferInPlayerId)) {
      throw new BadRequestException('transferInPlayerId is already in snapshot squad');
    }

    const [outContext, inContext] = await Promise.all([
      this.buildPlayerContext(input.transferOutPlayerId, snapshot.gameweek),
      this.buildPlayerContext(input.transferInPlayerId, snapshot.gameweek),
    ]);

    const gain = this.simulationEngine.simulateGainDistribution(
      outContext,
      inContext,
      input.horizon,
      input.numSimulations,
      input.randomSeed,
    );

    const projectedGainEV = gain.gainSummary.expectedValue;
    const projectedGainMedian = gain.gainSummary.median;
    const downsideRisk = gain.gainSummary.downsideRisk;

    return {
      projectedGainEV,
      projectedGainMedian,
      probabilityTransferBeatsNoTransfer: gain.probabilityTransferBeatsNoTransfer,
      downsideRisk,
      recommendation:
        projectedGainEV > 0 && gain.probabilityTransferBeatsNoTransfer >= 0.55 ? 'make-transfer' : 'hold-transfer',
      reasoningSignals: {
        transferOut: {
          playerId: outContext.playerId,
          expectedPoints: outContext.expectedPoints,
          xgTrend: outContext.xgTrend,
          xaTrend: outContext.xaTrend,
          minutesReliability: outContext.minutesReliability,
          fixtureDifficulty: outContext.fixtureDifficulty,
        },
        transferIn: {
          playerId: inContext.playerId,
          expectedPoints: inContext.expectedPoints,
          xgTrend: inContext.xgTrend,
          xaTrend: inContext.xaTrend,
          minutesReliability: inContext.minutesReliability,
          fixtureDifficulty: inContext.fixtureDifficulty,
        },
        horizon: input.horizon,
      },
    };
  }

  private async buildPlayerContext(playerId: number, gameweek: number): Promise<PlayerSimulationContext> {
    const [projection, player] = await Promise.all([
      this.expectedPointsService.calculateProjection(playerId, gameweek),
      this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }),
    ]);

    if (!player) {
      throw new BadRequestException(`Player ${playerId} not found`);
    }

    return {
      playerId,
      gameweek,
      expectedPoints: projection.expectedPoints,
      xgTrend: projection.signals.xgTrend,
      xaTrend: projection.signals.xaTrend,
      minutesReliability: projection.signals.minutesReliability,
      fixtureDifficulty: projection.signals.fixtureDifficulty,
      fixtureCount: projection.structure.fixtureCount,
      isBlank: projection.structure.isBlank,
      isDouble: projection.structure.isDouble,
    };
  }
}
