import { Injectable, Logger } from '@nestjs/common';
import { normalizeRiskProfile } from '../decision/risk-profile';
import { PrismaService } from '../prisma/prisma.service';
import { SimulationEngineService } from '../simulations/simulation-engine.service';
import { PlayerSimulationContext } from '../simulations/types/simulation.types';
import { FixtureRunAnalyzerService } from '../teams/fixture-run-analyzer.service';
import { ExpectedPointsService } from './expected-points.service';
import { TeamSnapshotsService } from './team-snapshots.service';
import { TransferSuggestionService } from './transfer-suggestion.service';

type SnapshotPlayer = {
  playerId: number;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
};

type TransferCandidate = {
  out: { playerId: number; name: string; price: number; expectedPoints: number };
  in: { playerId: number; name: string; price: number; expectedPoints: number };
  projectedPointGain: number;
  budgetImpact: number;
  simulation?: {
    projectedGainEV: number;
    projectedGainMedian: number;
    probabilityTransferBeatsNoTransfer: number;
    downsideRisk: number;
  };
};

@Injectable()
export class SquadWeaknessAnalyzerService {
  private readonly logger = new Logger(SquadWeaknessAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsService: TeamSnapshotsService,
    private readonly fixtureRunAnalyzer: FixtureRunAnalyzerService,
    private readonly transferSuggestionService: TransferSuggestionService,
    private readonly expectedPointsService: ExpectedPointsService,
    private readonly simulationEngine: SimulationEngineService,
  ) {}

  async analyze(
    snapshotId: number,
    horizon: 3 | 5,
    riskProfile?: 'conservative' | 'balanced' | 'aggressive',
    options?: {
      useSimulation?: boolean;
      numSimulations?: number;
      randomSeed?: number;
      requestCache?: Map<string, unknown>;
      precomputedTransferSuggestions?: TransferCandidate[];
    },
  ) {
    const startedAt = Date.now();
    const snapshot = await this.snapshotsService.getSnapshotById(snapshotId);
    const normalizedRiskProfile = normalizeRiskProfile(riskProfile);
    const useSimulation = options?.useSimulation ?? true;
    const numSimulations = options?.numSimulations ?? 4000;
    const randomSeed = options?.randomSeed ?? 12345;
    const playerIds = snapshot.squadPlayerIds;
    const snapshotPlayers: SnapshotPlayer[] = snapshot.players;

    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: {
        team: { select: { shortName: true } },
        matchStats: {
          orderBy: { fixture: { kickoffAt: 'desc' } },
          take: 5,
          select: {
            minutes: true,
            fantasyPoints: true,
            xg: true,
            xa: true,
          },
        },
      },
    });

    const playerById = new Map(players.map((player) => [player.id, player]));

    const byExpected = snapshotPlayers
      .map((entry: SnapshotPlayer) => {
        const player = playerById.get(entry.playerId);
        const score = player
          ? this.estimateExpected(
              player.matchStats.map((s) => ({
                fantasyPoints: s.fantasyPoints,
                xg: Number(s.xg),
                xa: Number(s.xa),
                minutes: s.minutes,
              })),
            )
          : 0;

        return {
          playerId: entry.playerId,
          playerName: entry.name,
          position: entry.position,
          team: player?.team.shortName ?? 'UNK',
          expectedPoints: this.round(score),
        };
      })
      .sort((a: { expectedPoints: number }, b: { expectedPoints: number }) =>
        a.expectedPoints - b.expectedPoints,
      )
      .slice(0, 4);

    const runAnalysis = await this.fixtureRunAnalyzer.analyze(horizon === 3 ? 3 : 5);
    const hardestTeams = new Set(runAnalysis.hardestFixtureRuns.map((item) => item.team));

    const fixtureExposure = snapshotPlayers
      .map((entry: SnapshotPlayer) => {
        const player = playerById.get(entry.playerId);
        const team = player?.team.shortName ?? 'UNK';
        return {
          playerId: entry.playerId,
          playerName: entry.name,
          team,
          hasToughRun: hardestTeams.has(team),
        };
      })
      .filter((item: { hasToughRun: boolean }) => item.hasToughRun);

    const rotationSignals = snapshotPlayers
      .map((entry: SnapshotPlayer) => {
        const player = playerById.get(entry.playerId);
        const minutesSamples = player?.matchStats.map((s) => s.minutes) ?? [];
        const avgMinutes = this.avg(minutesSamples);
        return {
          playerId: entry.playerId,
          playerName: entry.name,
          position: entry.position,
          sampleSize: minutesSamples.length,
          avgMinutes: this.round(avgMinutes),
        };
      });

    const rotationRisks = rotationSignals
      .filter((item: { sampleSize: number; avgMinutes: number }) => item.sampleSize >= 2 && item.avgMinutes < 65)
      .sort((a: { avgMinutes: number }, b: { avgMinutes: number }) => a.avgMinutes - b.avgMinutes);

    const unknownMinutesData = rotationSignals
      .filter((item: { sampleSize: number }) => item.sampleSize < 2)
      .map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        position: item.position,
        sampleSize: item.sampleSize,
      }));

    const candidateTransfers: TransferCandidate[] = options?.precomputedTransferSuggestions?.length
      ? options.precomputedTransferSuggestions
      : (
          await this.transferSuggestionService.suggestTransfers(
            playerIds,
            Number(snapshot.budget),
            1,
            snapshot.gameweek,
            horizon,
          )
        ).recommendedTransfers;

    const simulatedUpgrades = await Promise.all(
      candidateTransfers.slice(0, 3).map(async (transfer, index) => {
        if (transfer.simulation || !useSimulation) {
          return {
            ...transfer,
            simulation: transfer.simulation ?? {
              projectedGainEV: transfer.projectedPointGain,
              projectedGainMedian: transfer.projectedPointGain,
              probabilityTransferBeatsNoTransfer: 0.5,
              downsideRisk: 0,
            },
          };
        }

        const [outCtx, inCtx] = await Promise.all([
          this.buildPlayerContextCached(transfer.out.playerId, snapshot.gameweek, options?.requestCache),
          this.buildPlayerContextCached(transfer.in.playerId, snapshot.gameweek, options?.requestCache),
        ]);

        const simCacheKey = `weakness:gain:${transfer.out.playerId}:${transfer.in.playerId}:${snapshot.gameweek}:${horizon}:${numSimulations}:${randomSeed + snapshotId * 1000 + index}`;
        const simulation = this.fromCache(options?.requestCache, simCacheKey, () =>
          this.simulationEngine.simulateGainDistribution(
            outCtx,
            inCtx,
            horizon,
            numSimulations,
            randomSeed + snapshotId * 1000 + index,
          ),
        );

        return {
          ...transfer,
          simulation: {
            projectedGainEV: simulation.gainSummary.expectedValue,
            projectedGainMedian: simulation.gainSummary.median,
            probabilityTransferBeatsNoTransfer: simulation.probabilityTransferBeatsNoTransfer,
            downsideRisk: simulation.gainSummary.downsideRisk,
          },
        };
      }),
    );

    const downsideRiskFlags = simulatedUpgrades
      .filter((item) => item.simulation.projectedGainEV > 0 && item.simulation.downsideRisk < -1.5)
      .map((item) => ({
        transfer: `${item.out.name} -> ${item.in.name}`,
        downsideRisk: item.simulation.downsideRisk,
      }));

    const upsideOpportunities = simulatedUpgrades
      .filter((item) => item.simulation.probabilityTransferBeatsNoTransfer >= 0.6)
      .map((item) => ({
        transfer: `${item.out.name} -> ${item.in.name}`,
        projectedGainEV: item.simulation.projectedGainEV,
        probabilityTransferBeatsNoTransfer: item.simulation.probabilityTransferBeatsNoTransfer,
      }));

    const avgProbability =
      simulatedUpgrades.length > 0
        ? simulatedUpgrades.reduce((acc, item) => acc + item.simulation.probabilityTransferBeatsNoTransfer, 0) /
          simulatedUpgrades.length
        : 0.5;

    const simulationConfidenceIndicators = {
      transferConfidence: this.round(avgProbability),
      downsideExposure:
        downsideRiskFlags.length > 1 ? 'high' : downsideRiskFlags.length === 1 ? 'medium' : 'low',
      minutesDataCoverage: this.round(
        snapshotPlayers.length > 0
          ? (snapshotPlayers.length - unknownMinutesData.length) / snapshotPlayers.length
          : 0,
      ),
    };

    const saferAlternatives = [...simulatedUpgrades]
      .sort(
        (a, b) =>
          (b.simulation.probabilityTransferBeatsNoTransfer - Math.max(0, -b.simulation.downsideRisk) * 0.05) -
          (a.simulation.probabilityTransferBeatsNoTransfer - Math.max(0, -a.simulation.downsideRisk) * 0.05),
      )
      .slice(0, 2);

    const aggressiveAlternatives = [...simulatedUpgrades]
      .sort((a, b) => b.simulation.projectedGainEV - a.simulation.projectedGainEV)
      .slice(0, 2);

    const result = {
      snapshotId,
      horizon,
      selectedRiskProfile: normalizedRiskProfile,
      weakSpotsByExpectedPoints: byExpected,
      poorFixtureExposure: fixtureExposure,
      minutesRotationRisks: rotationRisks,
      unknownMinutesData,
      topUpgradeOpportunities: simulatedUpgrades,
      downsideRiskFlags,
      upsideOpportunities,
      simulationConfidenceIndicators,
      profileAdjustedAlternatives: {
        saferAlternatives,
        aggressiveAlternatives,
      },
    };

    this.logger.log(
      `[squad-weakness] snapshotId=${snapshotId} horizon=${horizon} useSimulation=${useSimulation} transfersAnalyzed=${simulatedUpgrades.length} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  private async buildPlayerContext(playerId: number, gameweek: number): Promise<PlayerSimulationContext> {
    const projection = await this.expectedPointsService.calculateProjection(playerId, gameweek);
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

  private async buildPlayerContextCached(
    playerId: number,
    gameweek: number,
    requestCache?: Map<string, unknown>,
  ): Promise<PlayerSimulationContext> {
    const cacheKey = `player-context:${playerId}:${gameweek}`;
    if (!requestCache) {
      return this.buildPlayerContext(playerId, gameweek);
    }

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<PlayerSimulationContext>;
    }

    const contextPromise = this.buildPlayerContext(playerId, gameweek);
    requestCache.set(cacheKey, contextPromise);
    return contextPromise;
  }

  private estimateExpected(stats: Array<{ fantasyPoints: number; xg: number; xa: number; minutes: number }>) {
    const avgPoints = this.avg(stats.map((item) => item.fantasyPoints));
    const avgXg = this.avg(stats.map((item) => item.xg));
    const avgXa = this.avg(stats.map((item) => item.xa));
    const avgMinutes = this.avg(stats.map((item) => item.minutes));

    return 1.8 + avgPoints * 0.45 + avgXg * 2.1 + avgXa * 1.8 + (avgMinutes / 90) * 1.2;
  }

  private avg(values: number[]) {
    if (!values.length) {
      return 0;
    }
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private fromCache<T>(requestCache: Map<string, unknown> | undefined, key: string, factory: () => T): T {
    if (!requestCache) {
      return factory();
    }

    if (requestCache.has(key)) {
      return requestCache.get(key) as T;
    }

    const value = factory();
    requestCache.set(key, value);
    return value;
  }
}
