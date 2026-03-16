import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: '101' })
  id!: string;

  @ApiProperty({ example: '12' })
  conversationId!: string;

  @ApiProperty({ example: 'USER' })
  role!: 'USER' | 'ASSISTANT';

  @ApiProperty({ example: 'Should I captain Haaland or Salah in gameweek 2?' })
  content!: string;

  @ApiPropertyOptional({ example: 0.82 })
  confidence!: number | null;

  @ApiPropertyOptional({
    example: ['compare_players', 'get_captain_recommendations'],
    type: [String],
  })
  usedTools!: string[] | null;

  @ApiPropertyOptional({ type: Object })
  structuredContext!: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-03-15T12:00:00.000Z' })
  createdAt!: string;
}
