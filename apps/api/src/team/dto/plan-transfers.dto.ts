import { ApiPropertyOptional } from '@nestjs/swagger';
import { RISK_PROFILES } from '../../decision/risk-profile';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class PlanTransfersDto {
  @ApiPropertyOptional({ description: 'Optional snapshot id. Latest snapshot is used when omitted' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  snapshotId?: number;

  @ApiPropertyOptional({ enum: [3, 5], default: 3 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([3, 5])
  horizon?: 3 | 5;

  @ApiPropertyOptional({ default: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(5)
  maxTransfersPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Optional deterministic assumptions (e.g. { wildcardWeek: 30 })',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  chipAssumptions?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  useSimulation?: boolean;

  @ApiPropertyOptional({ default: 5000, minimum: 100, maximum: 50000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(100)
  @Max(50000)
  numSimulations?: number;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  randomSeed?: number;

  @ApiPropertyOptional({ enum: RISK_PROFILES, default: 'balanced' })
  @IsOptional()
  @IsIn(RISK_PROFILES)
  riskProfile?: 'conservative' | 'balanced' | 'aggressive';
}
