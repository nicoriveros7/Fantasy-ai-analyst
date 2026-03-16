import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    example: 'Should I captain Haaland or Salah in gameweek 2?',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question!: string;

  @ApiPropertyOptional({
    description: 'Optional existing conversation id',
    example: '12',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
