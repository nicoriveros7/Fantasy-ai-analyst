import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { normalizeRiskProfile, RiskProfile } from '../decision/risk-profile';
import { PrismaService } from '../prisma/prisma.service';
import { SimulationEngineService } from '../simulations/simulation-engine.service';
import { PlayerSimulationContext } from '../simulations/types/simulation.types';

type CandidateScore = {
  playerId: number;
  playerName: string;
  team: string;
  expectedPoints: number;
  safeScore: number;
  upsideScore: number;
  captainScore: number;
  signals: {
    formScore: number;
    xgTrend: number;
    xaTrend: number;
    minutesReliability: number;
    fixtureDifficulty: number;
    fixtureCount: number;
    isBlank: boolean;
    isDouble: boolean;
  };
  simulation?: {
    expectedValue: number;
    median: number;
    upsideScore: number;
    downsideRisk: number;
    probabilityOutperformingAlternatives: number;
    confidence: number;
  };
};

@Injectable()
export class CaptainOptimizerService {
  private readonly logger = new Logger(CaptainOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulationEngine: SimulationEngineService,
  ) {}

  async getAdvancedCaptains(
    gameweekNumber: number,
    limit = 5,
    options?: {
      useSimulation?: boolean;
      numSimulations?: number;
      randomSeed?: number;
      riskProfile?: 'conservative' | 'balanced' | 'aggressive';
      requestCache?: Map<string, unknown>;
    },
  ) {
    const startedAt = Date.now();
    const gameweek = await this.prisma.gameweek.findUnique({ where: { number: gameweekNumber } });
    if (!gameweek) {
      throw new BadRequestException(`Gameweek ${gameweekNumber} not found`);
    }

    const [players, fixtures] = await Promise.all([
      this.prisma.player.findMany({
        include: {
          team: { select: { shortName: true } },
          matchStats: {
            include: { fixture: { include: { gameweek: { select: { number: true } } } } },
            orderBy: { fixture: { kickoffAt: 'desc' } },
            take: 5,
          },
        },
      }),
      this.prisma.fixture.findMany({
        where: { gameweek: { number: gameweekNumber } },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeDifficulty: true,
          awayDifficulty: true,
        },
      }),
    ]);

    const fixtureByTeam = new Map<number, Array<{ difficulty: number }>>();
    for (const fixture of fixtures) {
      const homeList = fixtureByTeam.get(fixture.homeTeamId) ?? [];
      homeList.push({ difficulty: fixture.homeDifficulty });
      fixtureByTeam.set(fixture.homeTeamId, homeList);

      const awayList = fixtureByTeam.get(fixture.awayTeamId) ?? [];
      awayList.push({ difficulty: fixture.awayDifficulty });
      fixtureByTeam.set(fixture.awayTeamId, awayList);
    }

    const scored: CandidateScore[] = players.map((player) => {
      const recent = player.matchStats;
      const avgFantasyPoints = this.avg(recent.map((item) => item.fantasyPoints));
      const avgXg = this.avg(recent.map((item) => Number(item.xg)));
      const avgXa = this.avg(recent.map((item) => Number(item.xa)));
      const avgMinutes = this.avg(recent.map((item) => item.minutes));

      const fixturesForTeam = fixtureByTeam.get(player.teamId) ?? [];
      const fixtureCount = fixturesForTeam.length;
      const isBlank = fixtureCount === 0;
      const isDouble = fixtureCount > 1;

      const fixtureScore =
        fixtureCount > 0
          ? this.clamp(10 - (this.avg(fixturesForTeam.map((f) => f.difficulty)) - 1) * 2.2)
          : 0;

      const formScore = this.clamp((avgFantasyPoints / 8) * 10);
      const xgTrend = this.clamp(avgXg * 12);
      const xaTrend = this.clamp(avgXa * 15);
      const minutesReliability = this.clamp((avgMinutes / 90) * 10);
      const fixtureCountScore = isBlank ? 0 : isDouble ? 10 : 6;

      let expectedPoints =
        2.0 +
        0.34 * formScore +
        0.22 * xgTrend +
        0.16 * xaTrend +
        0.18 * fixtureScore +
        0.1 * minutesReliability;

      if (isBlank) {
        expectedPoints *= 0.1;
      } else if (isDouble) {
        expectedPoints *= 1 + 0.85 * (fixtureCount - 1);
      }

      if (avgMinutes < 55) {
        expectedPoints *= 0.85;
      }

      const safeScore = this.round(
        0.45 * this.clamp(expectedPoints, 0, 15) +
          0.3 * minutesReliability +
          0.15 * fixtureScore +
          0.1 * formScore,
      );

      const upsideScore = this.round(
        0.3 * this.clamp(expectedPoints, 0, 15) +
          0.4 * xgTrend +
          0.2 * xaTrend +
          0.1 * fixtureCountScore,
      );

      const captainScore = this.round(0.55 * safeScore + 0.45 * upsideScore);

      return {
        playerId: player.id,
        playerName: player.displayName,
        team: player.team.shortName,
        expectedPoints: this.round(expectedPoints),
        safeScore,
        upsideScore,
        captainScore,
        signals: {
          formScore: this.round(formScore),
          xgTrend: this.round(xgTrend),
          xaTrend: this.round(xaTrend),
          minutesReliability: this.round(minutesReliability),
          fixtureDifficulty: this.round(fixtureScore),
          fixtureCount,
          isBlank,
          isDouble,
        },
      };
    });

    const eligible = scored.filter((item) => !item.signals.isBlank);
    const useSimulation = options?.useSimulation ?? false;
    const numSimulations = options?.numSimulations ?? 5000;
    const randomSeed = options?.randomSeed ?? 12345;
    const riskProfile = normalizeRiskProfile(options?.riskProfile);

    const deterministicRanked = [...eligible].sort((a, b) => b.captainScore - a.captainScore);
    const deterministicSafe = [...eligible].sort((a, b) => b.safeScore - a.safeScore);
    const deterministicUpside = [...eligible].sort((a, b) => b.upsideScore - a.upsideScore);

    let workingSet = deterministicRanked;
    if (useSimulation && eligible.length > 1) {
      const poolSize = Math.max(limit * 2, 12);
      const poolById = new Map<number, CandidateScore>();
      for (const item of deterministicRanked.slice(0, poolSize)) {
        poolById.set(item.playerId, item);
      }
      for (const item of deterministicSafe.slice(0, poolSize)) {
        poolById.set(item.playerId, item);
      }
      for (const item of deterministicUpside.slice(0, poolSize)) {
        poolById.set(item.playerId, item);
      }

      workingSet = [...poolById.values()];
      await this.applyCaptainSimulations(workingSet, numSimulations, randomSeed, options?.requestCache);
    }

    const safePicks = [...workingSet].sort((a, b) => b.safeScore - a.safeScore).slice(0, limit);
    const upsidePicks = [...workingSet].sort((a, b) => b.upsideScore - a.upsideScore).slice(0, limit);
    const ranked = [...workingSet].sort((a, b) => b.captainScore - a.captainScore);
    const qualityPool = [...workingSet]
      .sort((a, b) => b.expectedPoints - a.expectedPoints)
      .slice(0, Math.max(limit * 2, 8));

    const bestSafeCaptain = useSimulation
      ? [...qualityPool].sort((a, b) => this.safeCaptainComposite(b, riskProfile) - this.safeCaptainComposite(a, riskProfile))[0] ?? null
      : safePicks[0] ?? null;

    const bestUpsideCaptain = useSimulation
      ? [...qualityPool].sort((a, b) => this.upsideCaptainComposite(b, riskProfile) - this.upsideCaptainComposite(a, riskProfile))[0] ?? null
      : upsidePicks[0] ?? null;

    const bestBalancedCaptain = useSimulation
      ? [...qualityPool].sort((a, b) => this.balancedCaptainComposite(b, riskProfile) - this.balancedCaptainComposite(a, riskProfile))[0] ?? null
      : ranked[0] ?? null;

    const result = {
      gameweek: gameweekNumber,
      bestCaptain: ranked[0] ?? null,
      bestViceCaptain: ranked[1] ?? null,
      bestSafeCaptain,
      bestUpsideCaptain,
      bestBalancedCaptain,
      selectedRiskProfile: riskProfile,
      simulationEnabled: useSimulation,
      safeCaptainPicks: safePicks,
      upsideCaptainPicks: upsidePicks,
    };

    this.logger.log(
      `[captain-optimizer] gameweek=${gameweekNumber} useSimulation=${useSimulation} candidates=${eligible.length} simulatedCandidates=${workingSet.length} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  private async applyCaptainSimulations(
    candidates: CandidateScore[],
    numSimulations: number,
    randomSeed: number,
    requestCache?: Map<string, unknown>,
  ) {
    const contexts = new Map<number, PlayerSimulationContext>();
    const pairwise = new Map<number, { wins: number; comparisons: number }>();

    for (const candidate of candidates) {
      pairwise.set(candidate.playerId, { wins: 0, comparisons: 0 });
    }

    for (const candidate of candidates) {
      const context = this.toSimulationContext(candidate);
      contexts.set(candidate.playerId, context);

      const distributionCacheKey = `captain:distribution:${candidate.playerId}:${numSimulations}:${randomSeed + candidate.playerId}`;
      const distribution = this.fromCache(
        requestCache,
        distributionCacheKey,
        () =>
          this.simulationEngine.simulatePlayerDistribution(
            context,
            numSimulations,
            randomSeed + candidate.playerId,
          ),
      );

      candidate.simulation = {
        expectedValue: distribution.summary.expectedValue,
        median: distribution.summary.median,
        upsideScore: distribution.summary.upsideScore,
        downsideRisk: distribution.summary.downsideRisk,
        probabilityOutperformingAlternatives: 0,
        confidence: 0,
      };
    }

    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const candidateA = candidates[i];
        const candidateB = candidates[j];
        const pairSeed = randomSeed + candidateA.playerId * 1000 + candidateB.playerId;
        const pairCacheKey = `captain:h2h:${candidateA.playerId}:${candidateB.playerId}:${numSimulations}:${pairSeed}`;

        const h2h = this.fromCache(requestCache, pairCacheKey, () =>
          this.simulationEngine.simulateHeadToHead(
            contexts.get(candidateA.playerId)!,
            contexts.get(candidateB.playerId)!,
            numSimulations,
            pairSeed,
          ),
        );

        let winsA = 0;
        let winsB = 0;
        for (let k = 0; k < numSimulations; k += 1) {
          const sampleA = h2h.playerA.samples[k];
          const sampleB = h2h.playerB.samples[k];
          if (sampleA > sampleB) {
            winsA += 1;
          } else if (sampleB > sampleA) {
            winsB += 1;
          }
        }

        const normalizedWinsA = winsA / numSimulations;
        const normalizedWinsB = winsB / numSimulations;

        const scoreA = pairwise.get(candidateA.playerId)!;
        scoreA.wins += normalizedWinsA;
        scoreA.comparisons += 1;

        const scoreB = pairwise.get(candidateB.playerId)!;
        scoreB.wins += normalizedWinsB;
        scoreB.comparisons += 1;
      }
    }

    for (const candidate of candidates) {
      const pairResult = pairwise.get(candidate.playerId);
      const probability = pairResult && pairResult.comparisons > 0 ? pairResult.wins / pairResult.comparisons : 0.5;
      candidate.simulation = {
        ...candidate.simulation!,
        probabilityOutperformingAlternatives: this.round(probability),
        confidence: this.round(1 - this.clamp(candidate.simulation!.downsideRisk / 12, 0, 1)),
      };
    }
  }

  private toSimulationContext(candidate: CandidateScore): PlayerSimulationContext {
    return {
      playerId: candidate.playerId,
      gameweek: 0,
      expectedPoints: candidate.expectedPoints,
      xgTrend: candidate.signals.xgTrend,
      xaTrend: candidate.signals.xaTrend,
      minutesReliability: candidate.signals.minutesReliability,
      fixtureDifficulty: candidate.signals.fixtureDifficulty,
      fixtureCount: candidate.signals.fixtureCount,
      isBlank: candidate.signals.isBlank,
      isDouble: candidate.signals.isDouble,
    };
  }

  private safeCaptainComposite(candidate: CandidateScore, profile: RiskProfile) {
    if (!candidate.simulation) {
      return candidate.safeScore;
    }

    const profileWeights =
      profile === 'conservative'
        ? { outperform: 0.4, confidence: 0.3, ev: 0.2, median: 0.1 }
        : profile === 'aggressive'
          ? { outperform: 0.2, confidence: 0.15, ev: 0.3, median: 0.35 }
          : { outperform: 0.35, confidence: 0.25, ev: 0.25, median: 0.15 };

    return (
      profileWeights.outperform * candidate.simulation.probabilityOutperformingAlternatives +
      profileWeights.confidence * candidate.simulation.confidence +
      profileWeights.ev * this.normalize(candidate.simulation.expectedValue, 0, 15) +
      profileWeights.median * this.normalize(candidate.simulation.median, 0, 15)
    );
  }

  private upsideCaptainComposite(candidate: CandidateScore, profile: RiskProfile) {
    if (!candidate.simulation) {
      return candidate.upsideScore;
    }

    const profileWeights =
      profile === 'conservative'
        ? { upside: 0.25, ev: 0.35, outperform: 0.3, xMetrics: 0.1 }
        : profile === 'aggressive'
          ? { upside: 0.55, ev: 0.2, outperform: 0.15, xMetrics: 0.1 }
          : { upside: 0.45, ev: 0.25, outperform: 0.2, xMetrics: 0.1 };

    return (
      profileWeights.upside * this.normalize(candidate.simulation.upsideScore, 0, 18) +
      profileWeights.ev * this.normalize(candidate.simulation.expectedValue, 0, 15) +
      profileWeights.outperform * candidate.simulation.probabilityOutperformingAlternatives +
      profileWeights.xMetrics * this.normalize(candidate.signals.xgTrend + candidate.signals.xaTrend, 0, 20)
    );
  }

  private balancedCaptainComposite(candidate: CandidateScore, profile: RiskProfile) {
    if (!candidate.simulation) {
      return candidate.captainScore;
    }

    const profileWeights =
      profile === 'conservative'
        ? { ev: 0.3, outperform: 0.34, median: 0.24, confidence: 0.12 }
        : profile === 'aggressive'
          ? { ev: 0.33, outperform: 0.2, median: 0.18, confidence: 0.09, upside: 0.2 }
          : { ev: 0.34, outperform: 0.28, median: 0.22, confidence: 0.16 };

    if (profile === 'aggressive') {
      return (
        profileWeights.ev * this.normalize(candidate.simulation.expectedValue, 0, 15) +
        profileWeights.outperform * candidate.simulation.probabilityOutperformingAlternatives +
        profileWeights.median * this.normalize(candidate.simulation.median, 0, 15) +
        profileWeights.confidence * candidate.simulation.confidence +
        (profileWeights.upside ?? 0) * this.normalize(candidate.simulation.upsideScore, 0, 18)
      );
    }

    return (
      profileWeights.ev * this.normalize(candidate.simulation.expectedValue, 0, 15) +
      profileWeights.outperform * candidate.simulation.probabilityOutperformingAlternatives +
      profileWeights.median * this.normalize(candidate.simulation.median, 0, 15) +
      profileWeights.confidence * candidate.simulation.confidence
    );
  }

  private normalize(value: number, min: number, max: number) {
    if (max <= min) {
      return 0;
    }
    return this.clamp((value - min) / (max - min), 0, 1);
  }

  private avg(values: number[]) {
    if (!values.length) {
      return 0;
    }
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }

  private clamp(value: number, min = 0, max = 10) {
    return Math.min(max, Math.max(min, value));
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
