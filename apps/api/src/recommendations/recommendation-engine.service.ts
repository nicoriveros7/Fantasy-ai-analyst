import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, RecommendationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RecommendationFlavor = 'captain' | 'differential' | 'transfer';

interface PlayerSignals {
  formScore: number;
  xGTrend: number;
  xATrend: number;
  fixtureScore: number;
  minutesReliability: number;
  differentialFactor: number;
}

@Injectable()
export class RecommendationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(flavor: RecommendationFlavor, gameweekNumber: number, limit: number) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { number: gameweekNumber },
    });

    if (!gameweek) {
      throw new BadRequestException(`Gameweek ${gameweekNumber} not found`);
    }

    const players = await this.prisma.player.findMany({
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
        matchStats: {
          include: {
            fixture: {
              include: {
                gameweek: {
                  select: {
                    number: true,
                  },
                },
              },
            },
          },
          orderBy: {
            fixture: {
              kickoffAt: 'desc',
            },
          },
          take: 5,
        },
      },
    });

    const upcomingFixtures = await this.prisma.fixture.findMany({
      where: {
        gameweek: {
          number: {
            gte: gameweekNumber,
          },
        },
      },
      include: {
        gameweek: {
          select: {
            number: true,
          },
        },
      },
      orderBy: {
        gameweek: {
          number: 'asc',
        },
      },
    });

    const scored = players
      .map((player) => {
        const recent = player.matchStats;
        const avgFantasyPoints = this.avg(recent.map((entry) => entry.fantasyPoints));
        const avgXg = this.avg(recent.map((entry) => Number(entry.xg)));
        const avgXa = this.avg(recent.map((entry) => Number(entry.xa)));
        const avgMinutes = this.avg(recent.map((entry) => entry.minutes));

        const currentFixture = upcomingFixtures.find(
          (fixture) =>
            fixture.gameweek.number === gameweekNumber &&
            (fixture.homeTeamId === player.teamId || fixture.awayTeamId === player.teamId),
        );

        const nextFixtures = upcomingFixtures
          .filter(
            (fixture) =>
              fixture.gameweek.number >= gameweekNumber &&
              (fixture.homeTeamId === player.teamId || fixture.awayTeamId === player.teamId),
          )
          .slice(0, 2);

        const formScore = this.clamp((avgFantasyPoints / 8) * 10);
        const xGTrend = this.clamp(avgXg * 12);
        const xATrend = this.clamp(avgXa * 18);
        const minutesReliability = this.clamp((avgMinutes / 90) * 10);
        const fixtureScore = this.fixtureScoreFromFixture(currentFixture, player.teamId);
        const futureFixtureScore = nextFixtures.length
          ? this.avg(nextFixtures.map((fixture) => this.fixtureScoreFromFixture(fixture, player.teamId)))
          : fixtureScore;

        const ownershipPct = Number(player.selectedByPct);
        const lowOwnershipFactor = this.clamp(((25 - ownershipPct) / 25) * 10);
        const upsideFactor = this.clamp(formScore * 0.55 + xGTrend * 0.45);
        const valueFactor = this.clamp((formScore / Math.max(Number(player.price), 4.0)) * 8);

        const signals: PlayerSignals = {
          formScore: this.round(formScore),
          xGTrend: this.round(xGTrend),
          xATrend: this.round(xATrend),
          fixtureScore: this.round(flavor === 'transfer' ? futureFixtureScore : fixtureScore),
          minutesReliability: this.round(minutesReliability),
          differentialFactor:
            flavor === 'captain'
              ? this.round(upsideFactor)
              : flavor === 'differential'
                ? this.round(lowOwnershipFactor)
                : this.round(valueFactor),
        };

        let score = this.computeScore(signals);
        if (flavor === 'differential') {
          const ownershipBoost = this.clamp((30 - ownershipPct) / 30, 0, 1);
          score = this.round(score * (0.6 + 0.4 * ownershipBoost));
        }

        const reason = this.buildReason(flavor, signals, ownershipPct);

        return {
          playerId: player.id,
          playerName: player.displayName,
          gameweekId: gameweek.id,
          type: this.toRecommendationType(flavor),
          score,
          reason,
          signals,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    await this.persistRecommendations(scored);

    return {
      type: flavor,
      gameweek: gameweekNumber,
      items: scored,
    };
  }

  private computeScore(signals: PlayerSignals) {
    const value =
      0.3 * signals.formScore +
      0.2 * signals.xGTrend +
      0.15 * signals.xATrend +
      0.2 * signals.fixtureScore +
      0.1 * signals.minutesReliability +
      0.05 * signals.differentialFactor;

    return this.round(value);
  }

  private buildReason(flavor: RecommendationFlavor, signals: PlayerSignals, ownershipPct: number) {
    if (flavor === 'captain') {
      return `Strong recent form, elite xG trend, secure minutes, and high upside make this captaincy pick reliable.`;
    }

    if (flavor === 'differential') {
      return `Low ownership (${ownershipPct.toFixed(1)}%) combined with solid form and attack signals offers differential upside.`;
    }

    return `Balanced form, expected goal involvement, value profile, and favorable near-term fixtures support this transfer target.`;
  }

  private fixtureScoreFromFixture(
    fixture: { homeTeamId: number; awayTeamId: number; homeDifficulty: number; awayDifficulty: number } | undefined,
    teamId: number,
  ) {
    if (!fixture) {
      return 5;
    }

    const difficulty = fixture.homeTeamId === teamId ? fixture.homeDifficulty : fixture.awayDifficulty;
    return this.clamp(10 - (difficulty - 1) * 2.2);
  }

  private toRecommendationType(flavor: RecommendationFlavor): RecommendationType {
    if (flavor === 'captain') {
      return RecommendationType.CAPTAIN;
    }

    if (flavor === 'differential') {
      return RecommendationType.DIFFERENTIAL;
    }

    return RecommendationType.TRANSFER_IN;
  }

  private async persistRecommendations(
    rows: Array<{
      playerId: number;
      gameweekId: number;
      type: RecommendationType;
      score: number;
      reason: string;
      signals: PlayerSignals;
    }>,
  ) {
    if (!rows.length) {
      return;
    }

    const gameweekId = rows[0].gameweekId;
    const type = rows[0].type;

    await this.prisma.$transaction(async (tx) => {
      await tx.recommendation.deleteMany({
        where: {
          gameweekId,
          type,
        },
      });

      for (const row of rows) {
        await tx.recommendation.create({
          data: {
            gameweekId: row.gameweekId,
            playerId: row.playerId,
            type: row.type,
            score: row.score,
            confidenceScore: this.round(row.score / 10),
            title:
              row.type === RecommendationType.CAPTAIN
                ? 'Captain Candidate'
                : row.type === RecommendationType.DIFFERENTIAL
                  ? 'Differential Pick'
                  : 'Transfer Suggestion',
            explanation: row.reason,
            explanationJson: row.signals as unknown as Prisma.InputJsonValue,
            modelVersion: 'deterministic-v1',
          },
        });
      }
    });
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
}