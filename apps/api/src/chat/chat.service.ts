import { BadRequestException, Injectable } from '@nestjs/common';
import { AiClientService } from './ai-client.service';
import { ConversationsService } from './conversations.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { MessagesService } from './messages.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly aiClient: AiClientService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  async ask(payload: ChatRequestDto): Promise<ChatResponseDto> {
    const conversationId = await this.resolveConversationId(payload.conversationId);

    await this.messagesService.createUserMessage(conversationId, payload.question);

    const aiResponse = await this.aiClient.ask(payload.question);

    await this.messagesService.createAssistantMessage(
      conversationId,
      aiResponse.answer,
      aiResponse.confidence,
      aiResponse.usedTools,
      aiResponse.structuredContext,
    );

    await this.conversationsService.updateLegacySnapshot(
      conversationId,
      payload.question,
      aiResponse.answer,
      {
        confidence: aiResponse.confidence,
        usedTools: aiResponse.usedTools,
        structuredContext: aiResponse.structuredContext,
      },
    );

    return {
      conversationId: String(conversationId),
      answer: aiResponse.answer,
      confidence: aiResponse.confidence,
      usedTools: aiResponse.usedTools,
      structuredContext: aiResponse.structuredContext,
    };
  }

  private async resolveConversationId(rawConversationId?: string): Promise<number> {
    if (!rawConversationId) {
      const created = await this.conversationsService.createConversation();
      return created.id;
    }

    const conversationId = Number(rawConversationId);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      throw new BadRequestException('conversationId must be a positive integer string');
    }

    await this.conversationsService.ensureExists(conversationId);
    return conversationId;
  }
}
