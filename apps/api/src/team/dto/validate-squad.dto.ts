import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class ValidateSquadDto {
  @ApiProperty({ type: [Number], minItems: 15, maxItems: 15 })
  @IsArray()
  @ArrayMinSize(15)
  @ArrayMaxSize(15)
  @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : value))
  @IsInt({ each: true })
  players!: number[];
}
