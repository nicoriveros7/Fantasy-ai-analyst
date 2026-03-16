import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SyncIngestionDto {
  @ApiPropertyOptional({ enum: ['seed', 'fpl'], default: 'seed' })
  @IsOptional()
  @IsIn(['seed', 'fpl'])
  source?: 'seed' | 'fpl';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includePlayerHistory?: boolean;

  @ApiPropertyOptional({ enum: ['top', 'all'], default: 'top' })
  @IsOptional()
  @IsIn(['top', 'all'])
  playerHistoryMode?: 'top' | 'all';

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  playerHistoryLimit?: number;
}
