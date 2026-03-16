import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetFixtureRunQueryDto {
  @ApiPropertyOptional({ enum: [3, 5, 8], default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([3, 5, 8])
  next?: 3 | 5 | 8;

  @ApiPropertyOptional({ description: 'Optional baseline gameweek number', example: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(38)
  startGameweek?: number;
}
