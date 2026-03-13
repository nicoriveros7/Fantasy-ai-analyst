import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetPlayersQueryDto, POSITION_VALUES } from './dto/get-players-query.dto';
import { GetPlayerStatsQueryDto } from './dto/get-player-stats-query.dto';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'List players with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'teamId', required: false, type: Number })
  @ApiQuery({ name: 'position', required: false, enum: POSITION_VALUES })
  @ApiQuery({ name: 'q', required: false, type: String })
  findAll(@Query() query: GetPlayersQueryDto) {
    return this.playersService.findAll(query);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get player recent stats and form aggregation' })
  @ApiQuery({ name: 'lastN', required: false, type: Number })
  async getPlayerStats(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetPlayerStatsQueryDto,
  ) {
    const result = await this.playersService.getPlayerStats(id, query.lastN ?? 5);
    if (!result) {
      throw new NotFoundException(`Player ${id} not found`);
    }

    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get player by id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const player = await this.playersService.findOne(id);
    if (!player) {
      throw new NotFoundException(`Player ${id} not found`);
    }

    return player;
  }
}