import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { GetConversationMessagesQueryDto } from './dto/get-conversation-messages-query.dto';
import { GetConversationsQueryDto } from './dto/get-conversations-query.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { PaginatedConversationsResponseDto } from './dto/paginated-conversations-response.dto';
import { PaginatedMessagesResponseDto } from './dto/paginated-messages-response.dto';
import { ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';

@ApiTags('chat')
@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Ask a fantasy question and persist conversation messages' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  ask(@Body() payload: ChatRequestDto): Promise<ChatResponseDto> {
    return this.chatService.ask(payload);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List recent conversations (paginated)' })
  @ApiResponse({ status: 200, type: PaginatedConversationsResponseDto })
  listConversations(@Query() query: GetConversationsQueryDto): Promise<PaginatedConversationsResponseDto> {
    return this.conversationsService.listRecent(query.page, query.limit);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get one conversation by id' })
  @ApiResponse({ status: 200, type: ConversationResponseDto })
  getConversation(@Param('id', ParseIntPipe) id: number): Promise<ConversationResponseDto> {
    return this.conversationsService.getById(id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation (paginated)' })
  @ApiResponse({ status: 200, type: PaginatedMessagesResponseDto })
  async getConversationMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetConversationMessagesQueryDto,
  ): Promise<PaginatedMessagesResponseDto> {
    await this.conversationsService.ensureExists(id);
    return this.messagesService.listByConversation(id, query.page, query.limit);
  }
}
