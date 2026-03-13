import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetPlayersQueryDto } from './dto/get-players-query.dto';
import { StatsAggregationService } from './stats-aggregation.service';

@Injectable()
export class PlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsAggregationService: StatsAggregationService,
  ) {}

  async findAll(query: GetPlayersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.position ? { position: query.position } : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' as const } },
              { lastName: { contains: query.q, mode: 'insensitive' as const } },
              { displayName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.player.findMany({
        where,
        skip,
        take: limit,
        include: {
          team: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
        orderBy: [{ displayName: 'asc' }],
      }),
      this.prisma.player.count({ where }),
    ]);

    const normalizedItems = items.map((player: any) => ({
      ...player,
      price: Number(player.price),
      ownershipPct: Number(player.ownershipPct),
      selectedByPct: Number(player.selectedByPct),
    }));

    return {
      items: normalizedItems,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    });

    if (!player) {
      return null;
    }

    return {
      ...player,
      price: Number(player.price),
      ownershipPct: Number(player.ownershipPct),
      selectedByPct: Number(player.selectedByPct),
    };
  }

  async getPlayerStats(id: number, lastN = 5) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    });

    if (!player) {
      return null;
    }

    const matchStats = await this.prisma.matchStat.findMany({
      where: { playerId: id },
      include: {
        fixture: {
          include: {
            gameweek: {
              select: {
                id: true,
                number: true,
              },
            },
            homeTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
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
      take: lastN,
    });

    const normalizedMatches = matchStats.map((item) => ({
      id: item.id,
      fixtureId: item.fixtureId,
      kickoffAt: item.fixture.kickoffAt,
      gameweek: item.fixture.gameweek,
      opponent:
        item.fixture.homeTeamId === player.teamId ? item.fixture.awayTeam : item.fixture.homeTeam,
      isHome: item.fixture.homeTeamId === player.teamId,
      minutes: item.minutes,
      goals: item.goals,
      assists: item.assists,
      xg: Number(item.xg),
      xa: Number(item.xa),
      shots: item.shots,
      keyPasses: item.keyPasses,
      fantasyPoints: item.fantasyPoints,
    }));

    const last5MatchesStats = this.statsAggregationService.last5MatchesStats(
      normalizedMatches.map((match) => ({
        minutes: match.minutes,
        goals: match.goals,
        assists: match.assists,
        xg: match.xg,
        xa: match.xa,
        shots: match.shots,
        fantasyPoints: match.fantasyPoints,
      })),
    );

    const formScore = this.statsAggregationService.formScore(
      normalizedMatches.map((match) => ({
        minutes: match.minutes,
        goals: match.goals,
        assists: match.assists,
        xg: match.xg,
        xa: match.xa,
        shots: match.shots,
        fantasyPoints: match.fantasyPoints,
      })),
    );

    return {
      player: {
        ...player,
        price: Number(player.price),
        ownershipPct: Number(player.ownershipPct),
        selectedByPct: Number(player.selectedByPct),
      },
      lastN,
      matches: normalizedMatches,
      last5MatchesStats,
      formScore,
    };
  }
}