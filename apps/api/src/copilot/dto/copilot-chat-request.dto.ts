import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CopilotChatRequestDto {
  @ApiProperty({ example: 'Should I roll this week or use my transfer?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  snapshotId!: number;

  @ApiProperty({ enum: [3, 5], example: 3 })
  @Type(() => Number)
  @IsInt()
  @IsIn([3, 5])
  horizon!: 3 | 5;

  @ApiProperty({ enum: ['conservative', 'balanced', 'aggressive'], example: 'balanced' })
  @IsIn(['conservative', 'balanced', 'aggressive'])
  riskProfile!: 'conservative' | 'balanced' | 'aggressive';

  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  useSimulation!: boolean;
}
