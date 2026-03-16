import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FixtureRunAnalyzerService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(next: 3 | 5 | 8, startGameweek?: number) {
    const baselineGw = startGameweek ?? (await this.resolveCurrentGameweek());
    const untilGw = baselineGw + next - 1;

    const [teams, fixtures] = await Promise.all([
      this.prisma.team.findMany({
        select: {
          id: true,
          shortName: true,
        },
      }),
      this.prisma.fixture.findMany({
        where: {
          gameweek: {
            number: {
              gte: baselineGw,
              lte: untilGw,
            },
          },
        },
        include: {
          gameweek: {
            select: { number: true },
          },
        },
      }),
    ]);

    const teamRuns = teams.map((team) => {
      const runFixtures = fixtures.filter(
        (fixture) => fixture.homeTeamId === team.id || fixture.awayTeamId === team.id,
      );

      const fixtureCountByGw = new Map<number, number>();
      const teamDifficulties: number[] = [];
      for (const fixture of runFixtures) {
        fixtureCountByGw.set(
          fixture.gameweek.number,
          (fixtureCountByGw.get(fixture.gameweek.number) ?? 0) + 1,
        );

        const difficulty = fixture.homeTeamId === team.id ? fixture.homeDifficulty : fixture.awayDifficulty;
        teamDifficulties.push(difficulty);
      }

      let blankCount = 0;
      let doubleCount = 0;
      for (let gw = baselineGw; gw <= untilGw; gw += 1) {
        const count = fixtureCountByGw.get(gw) ?? 0;
        if (count === 0) {
          blankCount += 1;
        } else if (count > 1) {
          doubleCount += count - 1;
        }
      }

      const avgDifficulty = teamDifficulties.length
        ? this.round(this.avg(teamDifficulties))
        : 5;

      const runScoreRaw = (3.5 - avgDifficulty) * 12 + doubleCount * 3 - blankCount * 4;

      return {
        teamId: team.id,
        team: team.shortName,
        fixtureCount: runFixtures.length,
        avgFixtureDifficulty: avgDifficulty,
        blankAdjustments: blankCount,
        doubleAdjustments: doubleCount,
        runScore: this.round(runScoreRaw),
      };
    });

    const dedupedByShortName = new Map<string, (typeof teamRuns)[number]>();
    for (const run of teamRuns) {
      const existing = dedupedByShortName.get(run.team);
      if (!existing || run.fixtureCount > existing.fixtureCount) {
        dedupedByShortName.set(run.team, run);
      }
    }
    const normalizedRuns = [...dedupedByShortName.values()];

    const easiestFixtureRuns = [...normalizedRuns].sort((a, b) => b.runScore - a.runScore).slice(0, 5);
    const hardestFixtureRuns = [...normalizedRuns].sort((a, b) => a.runScore - b.runScore).slice(0, 5);

    return {
      startGameweek: baselineGw,
      next,
      activeTeamCount: normalizedRuns.length,
      easiestFixtureRuns,
      hardestFixtureRuns,
      averageFixtureDifficulty: this.round(this.avg(normalizedRuns.map((item) => item.avgFixtureDifficulty))),
      allTeams: normalizedRuns.sort((a, b) => b.runScore - a.runScore),
    };
  }

  private async resolveCurrentGameweek() {
    const current = await this.prisma.gameweek.findFirst({
      where: { isCurrent: true },
      select: { number: true },
    });
    if (current) {
      return current.number;
    }

    const latest = await this.prisma.gameweek.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return latest?.number ?? 1;
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
}
