import { Module } from '@nestjs/common';
import { GameweeksController } from './gameweeks.controller';
import { GameweekStructureService } from './gameweek-structure.service';

@Module({
  controllers: [GameweeksController],
  providers: [GameweekStructureService],
  exports: [GameweekStructureService],
})
export class GameweeksModule {}
