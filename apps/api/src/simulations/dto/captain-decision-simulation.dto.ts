import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CaptainDecisionSimulationDto {
  @ApiProperty({ example: 32 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playerAId!: number;

  @ApiProperty({ example: 27 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playerBId!: number;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gameweek!: number;

  @ApiProperty({ example: 10000, minimum: 100, maximum: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50000)
  numSimulations!: number;

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  randomSeed!: number;
}
