import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SuggestTransfersDto {
  @ApiProperty({ type: [Number], minItems: 15, maxItems: 15 })
  @IsArray()
  @ArrayMinSize(15)
  @ArrayMaxSize(15)
  @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : value))
  @IsInt({ each: true })
  squadPlayerIds!: number[];

  @ApiProperty({ example: 1.5, description: 'Available budget in million units' })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  budget!: number;

  @ApiProperty({ example: 1 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(5)
  freeTransfers!: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  gameweek?: number;

  @ApiPropertyOptional({ enum: [1, 3, 5], default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(5)
  horizon?: 1 | 3 | 5;
}
