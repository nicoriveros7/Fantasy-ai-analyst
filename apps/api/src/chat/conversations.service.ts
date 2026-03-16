import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { PaginatedConversationsResponseDto } from './dto/paginated-conversations-response.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get messageModel(): any {
    return (this.prisma as any).message;
  }

  async createConversation(): Promise<{ id: number }> {
    return this.prisma.conversation.create({
      data: {
        message: '',
        answer: '',
      },
      select: {
        id: true,
      },
    });
  }

  async ensureExists(conversationId: number): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
  }

  async getById(conversationId: number): Promise<ConversationResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const messageCount = await this.messageModel.count({
      where: { conversationId },
    });

    return {
      id: String(conversation.id),
      userId: conversation.userId,
      createdAt: conversation.createdAt.toISOString(),
      messageCount,
    };
  }

  async listRecent(page?: number, limit?: number): Promise<PaginatedConversationsResponseDto> {
    const safePage = page ?? 1;
    const safeLimit = limit ?? 20;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        skip,
        take: safeLimit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.conversation.count(),
    ]);

    const messageCountByConversation = await Promise.all(
      items.map(async (conversation) => {
        const count = await this.messageModel.count({
          where: { conversationId: conversation.id },
        });
        return [conversation.id, count] as const;
      }),
    );

    const countMap = new Map<number, number>(messageCountByConversation);

    return {
      items: items.map((conversation) => ({
        id: String(conversation.id),
        userId: conversation.userId,
        createdAt: conversation.createdAt.toISOString(),
        messageCount: countMap.get(conversation.id) ?? 0,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async updateLegacySnapshot(
    conversationId: number,
    message: string,
    answer: string,
    answerJson: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        message,
        answer,
        answerJson: answerJson as Prisma.InputJsonValue,
      },
    });
  }
}
