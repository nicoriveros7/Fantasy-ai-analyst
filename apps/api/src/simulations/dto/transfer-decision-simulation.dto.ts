import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class TransferDecisionSimulationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  snapshotId!: number;

  @ApiProperty({ example: 440 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transferOutPlayerId!: number;

  @ApiProperty({ example: 191 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transferInPlayerId!: number;

  @ApiProperty({ enum: [3, 5], example: 3 })
  @Type(() => Number)
  @IsInt()
  @IsIn([3, 5])
  horizon!: 3 | 5;

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
