import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { normalizeRiskProfile } from '../decision/risk-profile';
import { CaptainOptimizerService } from '../recommendations/captain-optimizer.service';
import { FixtureRunAnalyzerService } from '../teams/fixture-run-analyzer.service';
import { TeamSnapshotsService } from './team-snapshots.service';
import { TransferPlanningService } from './transfer-planning.service';
import { SquadWeaknessAnalyzerService } from './squad-weakness-analyzer.service';

@Injectable()
export class AiStrategyReviewService {
  private readonly logger = new Logger(AiStrategyReviewService.name);
  private static readonly REVIEW_SIMULATION_MAX = 2000;

  constructor(
    private readonly snapshotsService: TeamSnapshotsService,
    private readonly transferPlanningService: TransferPlanningService,
    private readonly captainOptimizerService: CaptainOptimizerService,
    private readonly fixtureRunAnalyzerService: FixtureRunAnalyzerService,
    private readonly squadWeaknessAnalyzerService: SquadWeaknessAnalyzerService,
  ) {}

  async reviewStrategy(params: {
    snapshotId?: number;
    horizon: 3 | 5;
    useSimulation?: boolean;
    numSimulations?: number;
    randomSeed?: number;
    riskProfile?: 'conservative' | 'balanced' | 'aggressive';
  }) {
    const requestStartedAt = Date.now();
    const snapshot = params.snapshotId
      ? await this.snapshotsService.getSnapshotById(params.snapshotId)
      : await this.snapshotsService.getLatestSnapshot();

    if (!snapshot) {
      throw new BadRequestException('No snapshot found. Create a snapshot first.');
    }

    const useSimulation = params.useSimulation ?? true;
    const riskProfile = normalizeRiskProfile(params.riskProfile);
    const requestedSimulations = params.numSimulations ?? 5000;
    const effectiveNumSimulations = useSimulation
      ? Math.min(Math.max(requestedSimulations, 100), AiStrategyReviewService.REVIEW_SIMULATION_MAX)
      : params.numSimulations;
    const requestCache = new Map<string, unknown>();

    const transferPlanPromise = this.measureStep('transfer-plan', () =>
      this.transferPlanningService.planTransfers({
        snapshotId: snapshot.id,
        horizon: params.horizon,
        maxTransfersPerWeek: 2,
        useSimulation,
        numSimulations: effectiveNumSimulations,
        randomSeed: params.randomSeed,
        riskProfile,
        requestCache,
      }),
    );

    const captainPlanPromise = this.measureStep('captain-plan', () =>
      this.captainOptimizerService.getAdvancedCaptains(snapshot.gameweek, 5, {
        useSimulation,
        numSimulations: effectiveNumSimulations,
        randomSeed: params.randomSeed,
        riskProfile,
        requestCache,
      }),
    );

    const fixtureRunsPromise = this.measureStep('fixture-runs', () =>
      this.fixtureRunAnalyzerService.analyze(params.horizon === 3 ? 3 : 5),
    );

    const transferPlan = await transferPlanPromise;

    const weaknessReportPromise = this.measureStep('weakness-report', () =>
      this.squadWeaknessAnalyzerService.analyze(snapshot.id, params.horizon, riskProfile, {
        useSimulation,
        numSimulations: effectiveNumSimulations,
        randomSeed: params.randomSeed,
        requestCache,
        precomputedTransferSuggestions: transferPlan.byGameweek[0]?.recommendedTransfers,
      }),
    );

    const [captainPlan, fixtureRuns, weaknessReport] = await Promise.all([
      captainPlanPromise,
      fixtureRunsPromise,
      weaknessReportPromise,
    ]);

    const simulationInsights = {
      captainSimulationResults: {
        bestSafeCaptain: captainPlan.bestSafeCaptain,
        bestUpsideCaptain: captainPlan.bestUpsideCaptain,
        bestBalancedCaptain: captainPlan.bestBalancedCaptain,
      },
      transferSimulationResults: transferPlan.byGameweek.map((week) => ({
        gameweek: week.gameweek,
        transfersUsed: week.transfersUsed,
        simulationSignals: week.recommendedTransfers
          .filter((transfer) => transfer.simulation)
          .map((transfer) => ({
            transfer: `${transfer.out.name} -> ${transfer.in.name}`,
            projectedGainEV: transfer.simulation?.projectedGainEV,
            projectedGainMedian: transfer.simulation?.projectedGainMedian,
            probabilityTransferBeatsNoTransfer: transfer.simulation?.probabilityTransferBeatsNoTransfer,
            downsideRisk: transfer.simulation?.downsideRisk,
          })),
      })),
      downsideRiskFlags: weaknessReport.downsideRiskFlags,
      upsideOpportunities: weaknessReport.upsideOpportunities,
      simulationConfidenceIndicators: {
        captainConfidence:
          captainPlan.bestBalancedCaptain?.simulation?.confidence ??
          captainPlan.bestBalancedCaptain?.simulation?.probabilityOutperformingAlternatives ??
          null,
        transferConfidence: weaknessReport.simulationConfidenceIndicators.transferConfidence,
        minutesDataCoverage: weaknessReport.simulationConfidenceIndicators.minutesDataCoverage,
      },
      selectedRiskProfile: riskProfile,
    };

    const deterministicContext = {
      snapshot,
      selectedRiskProfile: riskProfile,
      transferPlan,
      captainPlan,
      fixtureRuns: {
        easiestFixtureRuns: fixtureRuns.easiestFixtureRuns,
        hardestFixtureRuns: fixtureRuns.hardestFixtureRuns,
      },
      weaknessReport,
      simulationInsights,
    };

    const aiResponse = await this.measureStep('ai-review-call', () => this.callAiServiceWithContext(deterministicContext));

    this.logger.log(
      `[review-strategy] total=${Date.now() - requestStartedAt}ms snapshotId=${snapshot.id} horizon=${params.horizon} riskProfile=${riskProfile} useSimulation=${useSimulation} requestedSimulations=${requestedSimulations} effectiveSimulations=${effectiveNumSimulations ?? 'n/a'}`,
    );

    return {
      snapshotId: snapshot.id,
      horizon: params.horizon,
      deterministicContext,
      review: aiResponse,
    };
  }

  private async callAiServiceWithContext(context: Record<string, unknown>) {
    const aiServiceUrl = process.env.AI_SERVICE_URL?.replace(/\/$/, '');
    if (!aiServiceUrl) {
      throw new ServiceUnavailableException('AI service URL not configured');
    }

    const selectedRiskProfile = String(context.selectedRiskProfile ?? 'balanced');

    const prompt = [
      'You are a Fantasy Premier League strategy assistant.',
      'Use ONLY the provided deterministic context.',
      `The selected risk profile is: ${selectedRiskProfile}.`,
      'Your recommendations must be profile-adjusted and mention safer vs more aggressive alternatives when relevant.',
      'Return STRICT JSON with keys: summary, keyRisks, topOpportunities, recommendedActionThisWeek, optionalCaptainSuggestion.',
      'Reference safe vs upside captaincy, transfer risk vs reward, and short-term vs medium-term tradeoffs explicitly.',
      'keyRisks and topOpportunities must be arrays of strings.',
      'Context:',
      JSON.stringify(context),
    ].join('\n');

    let response: Response;
    try {
      response = await fetch(`${aiServiceUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: prompt }),
      });
    } catch (error) {
      throw new ServiceUnavailableException('AI service unavailable');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(`AI service returned ${response.status}`);
    }

    const payload = await response.json();
    const answer = typeof payload?.answer === 'string' ? payload.answer : '';

    const parsed = this.parseJsonSafely(answer);
    if (!parsed) {
      return {
        summary: answer || 'No AI summary available',
        keyRisks: [],
        topOpportunities: [],
        recommendedActionThisWeek: 'No action provided',
        optionalCaptainSuggestion: null,
      };
    }

    if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.keyRisks) || !Array.isArray(parsed.topOpportunities)) {
      throw new InternalServerErrorException('AI response did not match required structure');
    }

    return {
      summary: parsed.summary,
      keyRisks: parsed.keyRisks.map(String),
      topOpportunities: parsed.topOpportunities.map(String),
      recommendedActionThisWeek: String(parsed.recommendedActionThisWeek ?? 'No action provided'),
      optionalCaptainSuggestion:
        parsed.optionalCaptainSuggestion === undefined || parsed.optionalCaptainSuggestion === null
          ? null
          : String(parsed.optionalCaptainSuggestion),
    };
  }

  private parseJsonSafely(input: string): Record<string, unknown> | null {
    if (!input) {
      return null;
    }

    try {
      return JSON.parse(input);
    } catch {
      const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);
      if (!fencedMatch?.[1]) {
        return null;
      }
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        return null;
      }
    }
  }

  private async measureStep<T>(label: string, callback: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      return await callback();
    } finally {
      this.logger.log(`[review-strategy] step=${label} durationMs=${Date.now() - startedAt}`);
    }
  }
}
