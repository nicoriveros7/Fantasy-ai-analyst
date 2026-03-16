import { Module } from '@nestjs/common';
import { TeamModule } from '../team/team.module';
import { SimulationsController } from './simulations.controller';
import { SimulationEngineService } from './simulation-engine.service';
import { SimulationsService } from './simulations.service';

@Module({
  imports: [TeamModule],
  controllers: [SimulationsController],
  providers: [SimulationEngineService, SimulationsService],
  exports: [SimulationEngineService, SimulationsService],
})
export class SimulationsModule {}
