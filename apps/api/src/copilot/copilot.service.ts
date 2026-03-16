import { Injectable, Logger } from '@nestjs/common';
import { normalizeRiskProfile } from '../decision/risk-profile';
import { CaptainOptimizerService } from '../recommendations/captain-optimizer.service';
import { TeamSnapshotsService } from '../team/team-snapshots.service';
import { TransferPlanningService } from '../team/transfer-planning.service';
import { SquadWeaknessAnalyzerService } from '../team/squad-weakness-analyzer.service';
import { FixtureRunAnalyzerService } from '../teams/fixture-run-analyzer.service';
import { GameweekStructureService } from '../gameweeks/gameweek-structure.service';
import { AiClientService } from '../chat/ai-client.service';
import { CopilotChatRequestDto } from './dto/copilot-chat-request.dto';

type CopilotIntent =
  | 'squad-review'
  | 'captain-choice'
  | 'transfer-decision'
  | 'roll-vs-transfer'
  | 'fixture-swing'
  | 'weakness-analysis';

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly snapshotsService: TeamSnapshotsService,
    private readonly captainOptimizerService: CaptainOptimizerService,
    private readonly transferPlanningService: TransferPlanningService,
    private readonly fixtureRunAnalyzerService: FixtureRunAnalyzerService,
    private readonly gameweekStructureService: GameweekStructureService,
    private readonly squadWeaknessAnalyzerService: SquadWeaknessAnalyzerService,
    private readonly aiClientService: AiClientService,
  ) {}

  async chat(payload: CopilotChatRequestDto) {
    const startedAt = Date.now();
    const riskProfile = normalizeRiskProfile(payload.riskProfile);
    const requestCache = new Map<string, unknown>();

    const snapshot = await this.snapshotsService.getSnapshotById(payload.snapshotId);
    const intent = this.classifyIntent(payload.message);
    const explicitGameweek = this.extractGameweekNumber(payload.message);

    const contextResult = await this.buildIntentContext(intent, {
      snapshotId: snapshot.id,
      gameweek: snapshot.gameweek,
      horizon: payload.horizon,
      riskProfile,
      useSimulation: payload.useSimulation,
      requestCache,
      explicitGameweek,
    });

    const explanationPrompt = [
      'You are an FPL copilot assistant.',
      'Use ONLY the deterministic structured context provided below.',
      `Intent: ${intent}`,
      `User message: ${payload.message}`,
      `Risk profile: ${riskProfile}`,
      'Give a concise, practical recommendation and explicitly mention key tradeoffs.',
      'If confidence is low, state why using the context.',
      'Structured context:',
      JSON.stringify(contextResult.structuredContext),
    ].join('\n');

    let answer = '';
    try {
      const ai = await this.aiClientService.ask(explanationPrompt);
      answer = ai.answer?.trim() || '';
    } catch (error) {
      this.logger.warn(
        `[copilot-chat] AI synthesis failed, using deterministic fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    if (!answer) {
      answer = this.buildFallbackAnswer(intent, contextResult.summaryCards);
    }

    this.logger.log(
      `[copilot-chat] intent=${intent} snapshotId=${snapshot.id} horizon=${payload.horizon} simulation=${payload.useSimulation} durationMs=${Date.now() - startedAt}`,
    );

    return {
      answer,
      usedTools: contextResult.usedTools,
      structuredContext: contextResult.structuredContext,
      summaryCards: contextResult.summaryCards,
    };
  }

  private async buildIntentContext(
    intent: CopilotIntent,
    input: {
      snapshotId: number;
      gameweek: number;
      horizon: 3 | 5;
      riskProfile: 'conservative' | 'balanced' | 'aggressive';
      useSimulation: boolean;
      requestCache: Map<string, unknown>;
      explicitGameweek?: number;
    },
  ) {
    if (intent === 'captain-choice') {
      const captain = await this.captainOptimizerService.getAdvancedCaptains(input.gameweek, 5, {
        useSimulation: input.useSimulation,
        riskProfile: input.riskProfile,
        requestCache: input.requestCache,
      });

      return {
        usedTools: ['captain-optimizer'],
        structuredContext: { captain },
        summaryCards: {
          captainRecommendation: {
            player: captain.bestBalancedCaptain?.playerName ?? null,
            safe: captain.bestSafeCaptain?.playerName ?? null,
            upside: captain.bestUpsideCaptain?.playerName ?? null,
          },
        },
      };
    }

    if (intent === 'fixture-swing') {
      if (input.explicitGameweek) {
        const gameweekStructure = await this.gameweekStructureService.getStructure(input.explicitGameweek);
        return {
          usedTools: ['gameweek-structure'],
          structuredContext: { gameweekStructure },
          summaryCards: {
            gameweekStructure: {
              gameweek: gameweekStructure.gameweek,
              blankTeams: gameweekStructure.blankTeams,
              doubleTeams: gameweekStructure.doubleTeams,
            },
          },
        };
      }

      const fixtureRun = await this.fixtureRunAnalyzerService.analyze(input.horizon);
      return {
        usedTools: ['fixture-run-analyzer'],
        structuredContext: { fixtureRun },
        summaryCards: {
          fixtureRun: {
            easiest: fixtureRun.easiestFixtureRuns.slice(0, 3),
            hardest: fixtureRun.hardestFixtureRuns.slice(0, 3),
          },
        },
      };
    }

    if (intent === 'weakness-analysis') {
      const weakness = await this.squadWeaknessAnalyzerService.analyze(
        input.snapshotId,
        input.horizon,
        input.riskProfile,
        {
          useSimulation: input.useSimulation,
          requestCache: input.requestCache,
        },
      );

      return {
        usedTools: ['squad-weakness-analyzer'],
        structuredContext: { weakness },
        summaryCards: {
          squadWeaknesses: {
            weakSpots: weakness.weakSpotsByExpectedPoints.slice(0, 3),
            upside: weakness.upsideOpportunities.slice(0, 2),
          },
        },
      };
    }

    if (intent === 'transfer-decision' || intent === 'roll-vs-transfer') {
      const transferPlan = await this.transferPlanningService.planTransfers({
        snapshotId: input.snapshotId,
        horizon: input.horizon,
        maxTransfersPerWeek: 2,
        useSimulation: input.useSimulation,
        riskProfile: input.riskProfile,
        requestCache: input.requestCache,
      });

      return {
        usedTools: ['transfer-planning'],
        structuredContext: { transferPlan },
        summaryCards: {
          transferPlan: {
            totalProjectedGain: transferPlan.totalProjectedGain,
            thisWeek: transferPlan.byGameweek[0] ?? null,
          },
        },
      };
    }

    const [captain, transferPlan, fixtureRun, weakness] = await Promise.all([
      this.captainOptimizerService.getAdvancedCaptains(input.gameweek, 5, {
        useSimulation: input.useSimulation,
        riskProfile: input.riskProfile,
        requestCache: input.requestCache,
      }),
      this.transferPlanningService.planTransfers({
        snapshotId: input.snapshotId,
        horizon: input.horizon,
        maxTransfersPerWeek: 2,
        useSimulation: input.useSimulation,
        riskProfile: input.riskProfile,
        requestCache: input.requestCache,
      }),
      this.fixtureRunAnalyzerService.analyze(input.horizon),
      this.squadWeaknessAnalyzerService.analyze(input.snapshotId, input.horizon, input.riskProfile, {
        useSimulation: input.useSimulation,
        requestCache: input.requestCache,
      }),
    ]);

    return {
      usedTools: ['captain-optimizer', 'transfer-planning', 'fixture-run-analyzer', 'squad-weakness-analyzer'],
      structuredContext: {
        captain,
        transferPlan,
        fixtureRun,
        weakness,
      },
      summaryCards: {
        captainRecommendation: {
          player: captain.bestBalancedCaptain?.playerName ?? null,
          safe: captain.bestSafeCaptain?.playerName ?? null,
          upside: captain.bestUpsideCaptain?.playerName ?? null,
        },
        transferPlan: {
          totalProjectedGain: transferPlan.totalProjectedGain,
          thisWeek: transferPlan.byGameweek[0] ?? null,
        },
        fixtureRun: {
          easiest: fixtureRun.easiestFixtureRuns.slice(0, 3),
          hardest: fixtureRun.hardestFixtureRuns.slice(0, 3),
        },
        squadWeaknesses: {
          weakSpots: weakness.weakSpotsByExpectedPoints.slice(0, 3),
          upside: weakness.upsideOpportunities.slice(0, 2),
        },
      },
    };
  }

  private classifyIntent(message: string): CopilotIntent {
    const text = message.toLowerCase();

    if (/(captain|vice|armband)/.test(text)) {
      return 'captain-choice';
    }

    if (/(blank|double|bgw|dgw|fixture|swing|run|schedule|easy fixtures|hard fixtures)/.test(text)) {
      return 'fixture-swing';
    }

    if (/(weak|weakness|problem area|rotation risk|minutes risk|exposure)/.test(text)) {
      return 'weakness-analysis';
    }

    if (/(roll|save transfer|hold transfer|use transfer now|bank transfer)/.test(text)) {
      return 'roll-vs-transfer';
    }

    if (/(transfer|buy|sell|replace|move)/.test(text)) {
      return 'transfer-decision';
    }

    return 'squad-review';
  }

  private extractGameweekNumber(message: string): number | undefined {
    const match = message.match(/(?:\bgw\s*|\bgameweek\s*)(\d{1,2})\b/i);
    if (!match?.[1]) {
      return undefined;
    }

    const parsed = Number(match[1]);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 38) {
      return undefined;
    }

    return parsed;
  }

  private buildFallbackAnswer(intent: CopilotIntent, summaryCards: Record<string, unknown>) {
    const cards = summaryCards as {
      captainRecommendation?: { player?: string | null; safe?: string | null; upside?: string | null };
      transferPlan?: { totalProjectedGain?: number; thisWeek?: { action?: string; transfersUsed?: number } };
      fixtureRun?: { easiest?: Array<{ team?: string }>; hardest?: Array<{ team?: string }> };
      squadWeaknesses?: { weakSpots?: Array<{ playerName?: string }>; upside?: Array<{ transfer?: string }> };
      gameweekStructure?: { gameweek?: number; blankTeams?: string[]; doubleTeams?: string[] };
    };

    const lines: string[] = [];
    lines.push(`Intent detected: ${intent}.`);

    if (cards.captainRecommendation?.player) {
      lines.push(
        `Captain lean: ${cards.captainRecommendation.player} (safe: ${cards.captainRecommendation.safe ?? 'n/a'}, upside: ${cards.captainRecommendation.upside ?? 'n/a'}).`,
      );
    }

    if (cards.transferPlan) {
      lines.push(
        `Transfer plan: projected gain ${cards.transferPlan.totalProjectedGain ?? 'n/a'}, this week action ${cards.transferPlan.thisWeek?.action ?? 'n/a'} with ${cards.transferPlan.thisWeek?.transfersUsed ?? 0} transfer(s).`,
      );
    }

    if (cards.fixtureRun?.easiest?.length) {
      lines.push(
        `Fixture swings: easiest ${cards.fixtureRun.easiest.slice(0, 3).map((t) => t.team).filter(Boolean).join(', ') || 'n/a'}; hardest ${cards.fixtureRun.hardest?.slice(0, 3).map((t) => t.team).filter(Boolean).join(', ') || 'n/a'}.`,
      );
    }

    if (cards.gameweekStructure?.gameweek) {
      lines.push(
        `GW${cards.gameweekStructure.gameweek}: blank teams ${cards.gameweekStructure.blankTeams?.join(', ') || 'none'}; double teams ${cards.gameweekStructure.doubleTeams?.join(', ') || 'none'}.`,
      );
    }

    if (cards.squadWeaknesses?.weakSpots?.length) {
      lines.push(
        `Weak spots: ${cards.squadWeaknesses.weakSpots.slice(0, 3).map((p) => p.playerName).filter(Boolean).join(', ') || 'n/a'}.`,
      );
    }

    lines.push('This is a deterministic fallback summary because AI synthesis was unavailable.');
    return lines.join(' ');
  }
}
