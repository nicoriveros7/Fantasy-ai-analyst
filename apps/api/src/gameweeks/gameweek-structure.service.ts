import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameweekStructureService {
  constructor(private readonly prisma: PrismaService) {}

  async getStructure(gameweekNumber: number) {
    const gameweek = await this.prisma.gameweek.findUnique({
      where: { number: gameweekNumber },
    });

    if (!gameweek) {
      throw new NotFoundException(`Gameweek ${gameweekNumber} not found`);
    }

    const [teams, fixtures] = await Promise.all([
      this.prisma.team.findMany({
        select: {
          id: true,
          shortName: true,
        },
      }),
      this.prisma.fixture.findMany({
        where: { gameweekId: gameweek.id },
        select: {
          homeTeamId: true,
          awayTeamId: true,
        },
      }),
    ]);

    const fixtureCountByTeam = new Map<number, number>();
    for (const team of teams) {
      fixtureCountByTeam.set(team.id, 0);
    }

    for (const fixture of fixtures) {
      fixtureCountByTeam.set(fixture.homeTeamId, (fixtureCountByTeam.get(fixture.homeTeamId) ?? 0) + 1);
      fixtureCountByTeam.set(fixture.awayTeamId, (fixtureCountByTeam.get(fixture.awayTeamId) ?? 0) + 1);
    }

    const fixtureCountByShortName = new Map<string, number>();
    for (const team of teams) {
      const shortName = team.shortName;
      const teamFixtureCount = fixtureCountByTeam.get(team.id) ?? 0;
      fixtureCountByShortName.set(shortName, (fixtureCountByShortName.get(shortName) ?? 0) + teamFixtureCount);
    }

    const shortNames = [...fixtureCountByShortName.keys()].sort();
    const doubleTeams = shortNames.filter((shortName) => (fixtureCountByShortName.get(shortName) ?? 0) > 1);
    const blankTeams = shortNames.filter((shortName) => (fixtureCountByShortName.get(shortName) ?? 0) === 0);

    return {
      gameweek: gameweek.number,
      doubleTeams,
      blankTeams,
    };
  }
}
