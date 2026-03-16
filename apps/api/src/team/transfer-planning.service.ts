import { Injectable, Logger } from '@nestjs/common';
import { normalizeRiskProfile, RiskProfile } from '../decision/risk-profile';
import { SimulationEngineService } from '../simulations/simulation-engine.service';
import { PlayerSimulationContext } from '../simulations/types/simulation.types';
import { ExpectedPointsService } from './expected-points.service';
import { TeamSnapshotsService } from './team-snapshots.service';
import { TransferSuggestionService } from './transfer-suggestion.service';

@Injectable()
export class TransferPlanningService {
  private readonly logger = new Logger(TransferPlanningService.name);

  constructor(
    private readonly snapshotsService: TeamSnapshotsService,
    private readonly transferSuggestionService: TransferSuggestionService,
    private readonly expectedPointsService: ExpectedPointsService,
    private readonly simulationEngine: SimulationEngineService,
  ) {}

  async planTransfers(input: {
    snapshotId?: number;
    horizon: 3 | 5;
    maxTransfersPerWeek: number;
    chipAssumptions?: Record<string, unknown>;
    useSimulation?: boolean;
    numSimulations?: number;
    randomSeed?: number;
    riskProfile?: 'conservative' | 'balanced' | 'aggressive';
    requestCache?: Map<string, unknown>;
  }) {
    const startedAt = Date.now();
    const snapshot = input.snapshotId
      ? await this.snapshotsService.getSnapshotById(input.snapshotId)
      : await this.snapshotsService.getLatestSnapshot();

    let squadPlayerIds: number[] = [...snapshot.squadPlayerIds];
    let budget = Number(snapshot.budget);
    let freeTransfers = snapshot.freeTransfers;
    const startGameweek = snapshot.gameweek;
    const riskProfile = normalizeRiskProfile(input.riskProfile);

    const byGameweek: Array<{
      gameweek: number;
      action: 'transfers' | 'roll';
      transfersUsed: number;
      recommendedTransfers: Array<{
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
      }>;
      projectedPointGain: number;
      budget: number;
      freeTransfersNextWeek: number;
      notes?: string[];
    }> = [];

    let totalProjectedGain = 0;

    for (let offset = 0; offset < input.horizon; offset += 1) {
      const gameweek = startGameweek + offset;
      const transferCap = Math.min(Math.max(1, input.maxTransfersPerWeek), Math.max(1, freeTransfers));
      const remainingWeeks = input.horizon - offset;
      const projectionHorizon: 1 | 3 | 5 = remainingWeeks >= 5 ? 5 : remainingWeeks >= 3 ? 3 : 1;

      const suggestion = await this.transferSuggestionService.suggestTransfers(
        squadPlayerIds,
        budget,
        transferCap,
        gameweek,
        projectionHorizon,
      );

      type PlannedTransfer = {
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

      let recommendedTransfers: PlannedTransfer[] = suggestion.recommendedTransfers;
      if ((input.useSimulation ?? false) && recommendedTransfers.length > 0) {
        const simulations = await Promise.all(
          recommendedTransfers.map(async (transfer, index) => {
            const [outContext, inContext] = await Promise.all([
              this.buildPlayerContextCached(transfer.out.playerId, gameweek, input.requestCache),
              this.buildPlayerContextCached(transfer.in.playerId, gameweek, input.requestCache),
            ]);

            const gainCacheKey = `transfer:gain:${transfer.out.playerId}:${transfer.in.playerId}:${gameweek}:${input.horizon}:${input.numSimulations ?? 5000}:${(input.randomSeed ?? 12345) + gameweek * 100 + index}`;

            const sim = this.fromCache(input.requestCache, gainCacheKey, () =>
              this.simulationEngine.simulateGainDistribution(
                outContext,
                inContext,
                input.horizon,
                input.numSimulations ?? 5000,
                (input.randomSeed ?? 12345) + gameweek * 100 + index,
              ),
            );

            return {
              ...transfer,
              simulation: {
                projectedGainEV: sim.gainSummary.expectedValue,
                projectedGainMedian: sim.gainSummary.median,
                probabilityTransferBeatsNoTransfer: sim.probabilityTransferBeatsNoTransfer,
                downsideRisk: sim.gainSummary.downsideRisk,
              },
            };
          }),
        );

        recommendedTransfers = simulations
          .sort(
            (a, b) => this.transferSimulationScore(b, riskProfile) - this.transferSimulationScore(a, riskProfile),
          )
          .slice(0, transferCap);
      }

      const weekProjectedGain = Number(
        recommendedTransfers
          .reduce(
            (acc, transfer) => acc + (transfer.simulation?.projectedGainEV ?? transfer.projectedPointGain),
            0,
          )
          .toFixed(2),
      );

      const avgTransferProbability =
        recommendedTransfers.length > 0
          ? recommendedTransfers.reduce(
              (acc, transfer) => acc + (transfer.simulation?.probabilityTransferBeatsNoTransfer ?? 0.5),
              0,
            ) / recommendedTransfers.length
          : 0;

      const shouldRoll =
        (input.useSimulation ?? false)
          ? this.shouldRollByProfile(weekProjectedGain, avgTransferProbability, freeTransfers, riskProfile)
          : suggestion.projectedPointGain <= 0.25 && freeTransfers < 2;

      if (shouldRoll) {
        freeTransfers = Math.min(2, freeTransfers + 1);
        byGameweek.push({
          gameweek,
          action: 'roll',
          transfersUsed: 0,
          recommendedTransfers: [],
          projectedPointGain: 0,
          budget: Number(budget.toFixed(2)),
          freeTransfersNextWeek: freeTransfers,
          notes: ['Rolled transfer to preserve flexibility'],
        });
        continue;
      }

      for (const transfer of recommendedTransfers) {
        const outIndex = squadPlayerIds.findIndex((id) => id === transfer.out.playerId);
        if (outIndex >= 0) {
          squadPlayerIds.splice(outIndex, 1, transfer.in.playerId);
        }
        budget = Number((budget - transfer.budgetImpact).toFixed(2));
      }

      const transfersUsed = recommendedTransfers.length;
      freeTransfers = Math.min(2, Math.max(0, freeTransfers - transfersUsed) + 1);
      totalProjectedGain += weekProjectedGain;

      const notes: string[] = [];
      if (input.chipAssumptions && Object.keys(input.chipAssumptions).length > 0) {
        notes.push('Chip assumptions provided (informational only in deterministic planner)');
      }
      notes.push(`Risk profile: ${riskProfile}`);

      byGameweek.push({
        gameweek,
        action: transfersUsed > 0 ? 'transfers' : 'roll',
        transfersUsed,
        recommendedTransfers,
        projectedPointGain: weekProjectedGain,
        budget: Number(budget.toFixed(2)),
        freeTransfersNextWeek: freeTransfers,
        notes,
      });
    }

    const result = {
      snapshotId: snapshot.id,
      startGameweek,
      horizon: input.horizon,
      selectedRiskProfile: riskProfile,
      totalProjectedGain: Number(totalProjectedGain.toFixed(2)),
      byGameweek,
    };

    this.logger.log(
      `[transfer-planning] snapshotId=${snapshot.id} horizon=${input.horizon} useSimulation=${input.useSimulation ?? false} durationMs=${Date.now() - startedAt}`,
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

  private transferSimulationScore(transfer: {
    projectedPointGain: number;
    simulation?: {
      projectedGainEV: number;
      projectedGainMedian: number;
      probabilityTransferBeatsNoTransfer: number;
      downsideRisk: number;
    };
  }, riskProfile: RiskProfile) {
    if (!transfer.simulation) {
      return transfer.projectedPointGain;
    }

    if (riskProfile === 'conservative') {
      return (
        0.3 * transfer.simulation.projectedGainEV +
        0.2 * transfer.simulation.projectedGainMedian +
        4.5 * transfer.simulation.probabilityTransferBeatsNoTransfer -
        0.5 * Math.max(0, -transfer.simulation.downsideRisk)
      );
    }

    if (riskProfile === 'aggressive') {
      return (
        0.5 * transfer.simulation.projectedGainEV +
        0.25 * transfer.simulation.projectedGainMedian +
        2.2 * transfer.simulation.probabilityTransferBeatsNoTransfer -
        0.15 * Math.max(0, -transfer.simulation.downsideRisk)
      );
    }

    return (
      0.4 * transfer.simulation.projectedGainEV +
      0.2 * transfer.simulation.projectedGainMedian +
      3.5 * transfer.simulation.probabilityTransferBeatsNoTransfer -
      0.25 * Math.max(0, -transfer.simulation.downsideRisk)
    );
  }

  private shouldRollByProfile(
    weekProjectedGain: number,
    avgTransferProbability: number,
    freeTransfers: number,
    riskProfile: RiskProfile,
  ) {
    if (riskProfile === 'conservative') {
      return weekProjectedGain <= 0.35 && avgTransferProbability < 0.62 && freeTransfers < 2;
    }

    if (riskProfile === 'aggressive') {
      return weekProjectedGain <= 0.05 && avgTransferProbability < 0.52 && freeTransfers < 2;
    }

    return weekProjectedGain <= 0.2 && avgTransferProbability < 0.57 && freeTransfers < 2;
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
