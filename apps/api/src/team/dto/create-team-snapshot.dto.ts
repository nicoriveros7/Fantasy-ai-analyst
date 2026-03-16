import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateTeamSnapshotDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  gameweek!: number;

  @ApiProperty({ type: [Number], minItems: 15, maxItems: 15 })
  @IsArray()
  @ArrayMinSize(15)
  @ArrayMaxSize(15)
  @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : value))
  @IsInt({ each: true })
  squadPlayerIds!: number[];

  @ApiProperty({ example: 1.5, minimum: 0 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  budget!: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: 5 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(5)
  freeTransfers!: number;
}
