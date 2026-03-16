import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaptainDecisionSimulationDto } from './dto/captain-decision-simulation.dto';
import { TransferDecisionSimulationDto } from './dto/transfer-decision-simulation.dto';
import { SimulationsService } from './simulations.service';

@ApiTags('simulations')
@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post('captain-decision')
  @ApiOperation({ summary: 'Monte Carlo simulation for captain decision (player A vs player B)' })
  @ApiResponse({ status: 200 })
  captainDecision(@Body() payload: CaptainDecisionSimulationDto) {
    return this.simulationsService.simulateCaptainDecision({
      playerAId: payload.playerAId,
      playerBId: payload.playerBId,
      gameweek: payload.gameweek,
      numSimulations: payload.numSimulations,
      randomSeed: payload.randomSeed,
    });
  }

  @Post('transfer-decision')
  @ApiOperation({ summary: 'Monte Carlo simulation for transfer decision (in vs out) over horizon' })
  @ApiResponse({ status: 200 })
  transferDecision(@Body() payload: TransferDecisionSimulationDto) {
    return this.simulationsService.simulateTransferDecision({
      snapshotId: payload.snapshotId,
      transferOutPlayerId: payload.transferOutPlayerId,
      transferInPlayerId: payload.transferInPlayerId,
      horizon: payload.horizon,
      numSimulations: payload.numSimulations,
      randomSeed: payload.randomSeed,
    });
  }
}
