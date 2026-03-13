import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { StatsAggregationService } from './stats-aggregation.service';

@Module({
  controllers: [PlayersController],
  providers: [PlayersService, StatsAggregationService],
})
export class PlayersModule {}