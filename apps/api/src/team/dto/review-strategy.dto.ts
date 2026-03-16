import { ApiPropertyOptional } from '@nestjs/swagger';
import { RISK_PROFILES } from '../../decision/risk-profile';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReviewStrategyDto {
  @ApiPropertyOptional({ description: 'Snapshot id to review. If omitted, latest snapshot is used.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  snapshotId?: number;

  @ApiPropertyOptional({ enum: [3, 5], default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([3, 5])
  horizon?: 3 | 5;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  useSimulation?: boolean;

  @ApiPropertyOptional({ default: 5000, minimum: 100, maximum: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50000)
  numSimulations?: number;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  randomSeed?: number;

  @ApiPropertyOptional({ enum: RISK_PROFILES, default: 'balanced' })
  @IsOptional()
  @IsIn(RISK_PROFILES)
  riskProfile?: 'conservative' | 'balanced' | 'aggressive';
}
