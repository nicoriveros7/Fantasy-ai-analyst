import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const POSITION_VALUES = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type PlayerPosition = (typeof POSITION_VALUES)[number];

export class GetPlayersQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  teamId?: number;

  @IsOptional()
  @IsIn(POSITION_VALUES)
  position?: PlayerPosition;

  @IsOptional()
  @IsString()
  q?: string;
}