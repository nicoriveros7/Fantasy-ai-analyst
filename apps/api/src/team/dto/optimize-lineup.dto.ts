import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class OptimizeLineupDto {
  @ApiProperty({ type: [Number], minItems: 15, maxItems: 15 })
  @IsArray()
  @ArrayMinSize(15)
  @ArrayMaxSize(15)
  @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : value))
  @IsInt({ each: true })
  squadPlayerIds!: number[];

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  gameweek?: number;
}
