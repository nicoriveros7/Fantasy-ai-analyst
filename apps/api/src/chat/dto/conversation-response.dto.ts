import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiPropertyOptional({ example: 'user-1' })
  userId!: string | null;

  @ApiProperty({ example: '2026-03-15T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 4 })
  messageCount!: number;
}
