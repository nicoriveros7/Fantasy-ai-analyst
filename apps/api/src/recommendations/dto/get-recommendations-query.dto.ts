import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RISK_PROFILES } from '../../decision/risk-profile';
import { IsIn } from 'class-validator';

export class GetRecommendationsQueryDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  gameweek!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  useSimulation?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(100)
  @Max(50000)
  numSimulations?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  randomSeed?: number;

  @IsOptional()
  @IsIn(RISK_PROFILES)
  riskProfile?: 'conservative' | 'balanced' | 'aggressive';
}