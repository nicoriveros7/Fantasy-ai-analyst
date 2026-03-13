import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetTeamsQueryDto } from './dto/get-teams-query.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  findAll(@Query() query: GetTeamsQueryDto) {
    return this.teamsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const team = await this.teamsService.findOne(id);
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }

    return team;
  }
}