import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GameweekStructureService } from './gameweek-structure.service';

@ApiTags('gameweeks')
@Controller('gameweeks')
export class GameweeksController {
  constructor(private readonly gameweekStructureService: GameweekStructureService) {}

  @Get(':id/structure')
  @ApiOperation({ summary: 'Get blank/double gameweek structure by gameweek number' })
  @ApiResponse({ status: 200 })
  getStructure(@Param('id', ParseIntPipe) id: number) {
    return this.gameweekStructureService.getStructure(id);
  }
}
