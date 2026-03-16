import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetRecommendationsQueryDto } from './dto/get-recommendations-query.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('captains')
  @ApiOperation({ summary: 'Get captain recommendations for a gameweek' })
  @ApiQuery({ name: 'gameweek', required: true, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCaptains(@Query() query: GetRecommendationsQueryDto) {
    return this.recommendationsService.getCaptains(query.gameweek, query.limit ?? 5);
  }

  @Get('captains/advanced')
  @ApiOperation({ summary: 'Get advanced captain and vice-captain recommendations with risk profiles' })
  @ApiQuery({ name: 'gameweek', required: true, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'useSimulation', required: false, type: Boolean })
  @ApiQuery({ name: 'numSimulations', required: false, type: Number })
  @ApiQuery({ name: 'randomSeed', required: false, type: Number })
  @ApiQuery({ name: 'riskProfile', required: false, enum: ['conservative', 'balanced', 'aggressive'] })
  getAdvancedCaptains(@Query() query: GetRecommendationsQueryDto) {
    return this.recommendationsService.getAdvancedCaptains(query.gameweek, query.limit ?? 5, {
      useSimulation: query.useSimulation ?? false,
      numSimulations: query.numSimulations,
      randomSeed: query.randomSeed,
      riskProfile: query.riskProfile,
    });
  }

  @Get('differentials')
  @ApiOperation({ summary: 'Get differential recommendations for a gameweek' })
  @ApiQuery({ name: 'gameweek', required: true, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDifferentials(@Query() query: GetRecommendationsQueryDto) {
    return this.recommendationsService.getDifferentials(query.gameweek, query.limit ?? 5);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get transfer recommendations for a gameweek' })
  @ApiQuery({ name: 'gameweek', required: true, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTransfers(@Query() query: GetRecommendationsQueryDto) {
    return this.recommendationsService.getTransfers(query.gameweek, query.limit ?? 5);
  }
}