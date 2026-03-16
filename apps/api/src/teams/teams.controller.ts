import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetFixtureRunQueryDto } from './dto/get-fixture-run-query.dto';
import { FixtureRunAnalyzerService } from './fixture-run-analyzer.service';
import { GetTeamsQueryDto } from './dto/get-teams-query.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly fixtureRunAnalyzerService: FixtureRunAnalyzerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List teams with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  findAll(@Query() query: GetTeamsQueryDto) {
    return this.teamsService.findAll(query);
  }

  @Get('fixture-run')
  @ApiOperation({ summary: 'Analyze easiest and hardest fixture runs for the next 3, 5, or 8 gameweeks' })
  @ApiQuery({ name: 'next', required: false, enum: [3, 5, 8] })
  @ApiQuery({ name: 'startGameweek', required: false, type: Number })
  getFixtureRun(@Query() query: GetFixtureRunQueryDto) {
    return this.fixtureRunAnalyzerService.analyze(query.next ?? 5, query.startGameweek);
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