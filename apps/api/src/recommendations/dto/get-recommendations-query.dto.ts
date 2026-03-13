import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

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
}