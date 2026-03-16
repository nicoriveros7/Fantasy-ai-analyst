import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamSnapshotDto } from './dto/create-team-snapshot.dto';
import { SquadRulesService } from './squad-rules.service';

@Injectable()
export class TeamSnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly squadRulesService: SquadRulesService,
  ) {}

  private get snapshotModel(): any {
    return (this.prisma as any).userTeamSnapshot;
  }

  async createSnapshot(payload: CreateTeamSnapshotDto) {
    const validation = await this.squadRulesService.validateSquad(payload.squadPlayerIds);
    if (!validation.isValid) {
      return {
        isValid: false,
        errors: validation.errors,
      };
    }

    const snapshot = await this.snapshotModel.create({
      data: {
        gameweek: payload.gameweek,
        budget: payload.budget,
        freeTransfers: payload.freeTransfers,
        players: {
          create: payload.squadPlayerIds.map((playerId) => ({
            playerId,
          })),
        },
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
                position: true,
                team: {
                  select: {
                    shortName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    return this.mapSnapshot(snapshot);
  }

  async getLatestSnapshot() {
    const snapshot = await this.snapshotModel.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
                position: true,
                team: {
                  select: {
                    shortName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('No team snapshots found');
    }

    return this.mapSnapshot(snapshot);
  }

  async getSnapshotById(id: number) {
    const snapshot = await this.snapshotModel.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
                position: true,
                team: {
                  select: {
                    shortName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`Snapshot ${id} not found`);
    }

    return this.mapSnapshot(snapshot);
  }

  private mapSnapshot(snapshot: any) {
    return {
      id: snapshot.id,
      gameweek: snapshot.gameweek,
      budget: Number(snapshot.budget),
      freeTransfers: snapshot.freeTransfers,
      createdAt: snapshot.createdAt,
      players: snapshot.players.map((entry: any) => ({
        playerId: entry.playerId,
        name: entry.player.displayName,
        position: entry.player.position,
        team: entry.player.team.shortName,
      })),
      squadPlayerIds: snapshot.players.map((entry: any) => entry.playerId),
    };
  }
}
