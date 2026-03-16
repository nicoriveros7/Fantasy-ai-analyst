import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

interface SquadValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class SquadRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async validateSquad(playerIds: number[]): Promise<SquadValidationResult> {
    const errors: string[] = [];

    if (playerIds.length !== 15) {
      errors.push('Squad must contain exactly 15 players');
    }

    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== playerIds.length) {
      errors.push('Squad contains duplicate players');
    }

    const players = await this.prisma.player.findMany({
      where: { id: { in: [...uniqueIds] } },
      select: {
        id: true,
        position: true,
        teamId: true,
      },
    });

    if (players.length !== uniqueIds.size) {
      errors.push('Some players were not found');
    }

    const counts: Record<Position, number> = {
      GK: 0,
      DEF: 0,
      MID: 0,
      FWD: 0,
    };

    const teamCounts = new Map<number, number>();

    for (const player of players) {
      counts[player.position] += 1;
      teamCounts.set(player.teamId, (teamCounts.get(player.teamId) ?? 0) + 1);
    }

    if (counts.GK !== 2) {
      errors.push('Squad must contain exactly 2 goalkeepers');
    }
    if (counts.DEF !== 5) {
      errors.push('Squad must contain exactly 5 defenders');
    }
    if (counts.MID !== 5) {
      errors.push('Squad must contain exactly 5 midfielders');
    }
    if (counts.FWD !== 3) {
      errors.push('Squad must contain exactly 3 forwards');
    }

    for (const [teamId, count] of teamCounts.entries()) {
      if (count > 3) {
        errors.push(`Squad cannot include more than 3 players from team ${teamId}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
