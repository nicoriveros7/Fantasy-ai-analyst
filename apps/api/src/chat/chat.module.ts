import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiClientService } from './ai-client.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatController],
  providers: [ChatService, ConversationsService, MessagesService, AiClientService],
})
export class ChatModule {}
