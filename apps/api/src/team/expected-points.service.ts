import { Injectable, NotFoundException } from '@nestjs/common';
import { GameweekStructureService } from '../gameweeks/gameweek-structure.service';
import { PrismaService } from '../prisma/prisma.service';

interface ProjectionSignals {
  formScore: number;
  xgTrend: number;
  xaTrend: number;
  fixtureDifficultyScore: number;
  minutesReliability: number;
}

@Injectable()
export class ExpectedPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameweekStructureService: GameweekStructureService,
  ) {}

  async expectedPoints(playerId: number, gameweekNumber: number): Promise<number> {
    const projection = await this.calculateProjection(playerId, gameweekNumber);
    return projection.expectedPoints;
  }

  async expectedPointsOverHorizon(
    playerId: number,
    startGameweek: number,
    horizon: 1 | 3 | 5,
  ): Promise<number> {
    let total = 0;
    for (let offset = 0; offset < horizon; offset += 1) {
      const gameweek = startGameweek + offset;
      const points = await this.expectedPoints(playerId, gameweek);
      total += points;
    }
    return Number(total.toFixed(2));
  }

  async calculateProjection(playerId: number, gameweekNumber: number) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        matchStats: {
          include: {
            fixture: {
              include: {
                gameweek: {
                  select: { number: true },
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

    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found`);
    }

    const upcomingFixtures = await this.prisma.fixture.findMany({
      where: {
        gameweek: { number: gameweekNumber },
        OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
      },
      select: {
        homeTeamId: true,
        homeDifficulty: true,
        awayDifficulty: true,
      },
    });

    const gameweekStructure = await this.gameweekStructureService.getStructure(gameweekNumber);

    const recent = player.matchStats;
    const avgFantasyPoints = this.avg(recent.map((item) => item.fantasyPoints));
    const avgXg = this.avg(recent.map((item) => Number(item.xg)));
    const avgXa = this.avg(recent.map((item) => Number(item.xa)));
    const minutesReliabilityRaw = recent.length
      ? recent.filter((item) => item.minutes >= 60).length / recent.length
      : 0.7;

    const signals: ProjectionSignals = {
      formScore: this.clamp(avgFantasyPoints * 1.25, 0, 10),
      xgTrend: this.clamp(avgXg * 12, 0, 10),
      xaTrend: this.clamp(avgXa * 15, 0, 10),
      fixtureDifficultyScore: this.avg(
        upcomingFixtures.map((fixture) => this.fixtureDifficultyScore(fixture, player.teamId)),
      ) || 5,
      minutesReliability: this.clamp(minutesReliabilityRaw * 10, 0, 10),
    };

    let expectedPoints = this.round(
      2.0 +
        0.34 * signals.formScore +
        0.22 * signals.xgTrend +
        0.16 * signals.xaTrend +
        0.18 * signals.fixtureDifficultyScore +
        0.1 * signals.minutesReliability,
    );

    const fixtureCount = upcomingFixtures.length;
    const isBlank = fixtureCount === 0;
    const isDouble = fixtureCount > 1;

    if (isBlank) {
      expectedPoints = this.round(expectedPoints * 0.1);
    } else if (isDouble) {
      const multiplier = 1 + 0.85 * (fixtureCount - 1);
      expectedPoints = this.round(expectedPoints * multiplier);
    }

    return {
      playerId,
      gameweek: gameweekNumber,
      expectedPoints,
      signals: {
        formScore: this.round(signals.formScore),
        xgTrend: this.round(signals.xgTrend),
        xaTrend: this.round(signals.xaTrend),
        fixtureDifficulty: this.round(signals.fixtureDifficultyScore),
        minutesReliability: this.round(signals.minutesReliability),
      },
      structure: {
        fixtureCount,
        isBlank,
        isDouble,
        doubleTeams: gameweekStructure.doubleTeams,
        blankTeams: gameweekStructure.blankTeams,
      },
    };
  }

  private fixtureDifficultyScore(
    fixture:
      | {
          homeTeamId: number;
          homeDifficulty: number;
          awayDifficulty: number;
        }
      | null,
    playerTeamId: number,
  ) {
    if (!fixture) {
      return 5;
    }

    const difficulty = fixture.homeTeamId === playerTeamId ? fixture.homeDifficulty : fixture.awayDifficulty;
    return this.clamp(10 - (difficulty - 1) * 2.2, 0, 10);
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
