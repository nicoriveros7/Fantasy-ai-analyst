import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessageResponseDto } from './dto/message-response.dto';
import { PaginatedMessagesResponseDto } from './dto/paginated-messages-response.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private get messageModel(): any {
    return (this.prisma as any).message;
  }

  async createUserMessage(conversationId: number, content: string): Promise<void> {
    await this.messageModel.create({
      data: {
        conversationId,
        role: 'USER',
        content,
      },
    });
  }

  async createAssistantMessage(
    conversationId: number,
    content: string,
    confidence: number,
    usedTools: string[],
    structuredContext: Record<string, unknown>,
  ): Promise<void> {
    await this.messageModel.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content,
        confidence,
        usedTools,
        structuredContext: structuredContext as Prisma.InputJsonValue,
      },
    });
  }

  async listByConversation(
    conversationId: number,
    page?: number,
    limit?: number,
  ): Promise<PaginatedMessagesResponseDto> {
    const safePage = page ?? 1;
    const safeLimit = limit ?? 20;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.messageModel.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: safeLimit,
      }),
      this.messageModel.count({ where: { conversationId } }),
    ]);

    const normalizedItems: MessageResponseDto[] = items.map((item: any) => ({
      id: String(item.id),
      conversationId: String(item.conversationId),
      role: item.role,
      content: item.content,
      confidence: item.confidence,
      usedTools: Array.isArray(item.usedTools) ? item.usedTools.map(String) : null,
      structuredContext:
        item.structuredContext && typeof item.structuredContext === 'object'
          ? (item.structuredContext as Record<string, unknown>)
          : null,
      createdAt: item.createdAt.toISOString(),
    }));

    return {
      items: normalizedItems,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }
}
