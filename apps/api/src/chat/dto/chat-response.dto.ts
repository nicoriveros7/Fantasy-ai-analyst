import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({ example: '12' })
  conversationId!: string;

  @ApiProperty({ example: 'Captain Haaland this week.' })
  answer!: string;

  @ApiProperty({ example: 0.82 })
  confidence!: number;

  @ApiProperty({
    example: ['compare_players', 'get_captain_recommendations'],
    type: [String],
  })
  usedTools!: string[];

  @ApiProperty({ type: Object })
  structuredContext!: Record<string, unknown>;
}
