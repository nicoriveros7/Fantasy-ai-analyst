import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CopilotChatRequestDto } from './dto/copilot-chat-request.dto';
import { CopilotService } from './copilot.service';

@ApiTags('copilot')
@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Orchestrated FPL copilot chat over deterministic backend tools' })
  @ApiResponse({ status: 200 })
  chat(@Body() payload: CopilotChatRequestDto) {
    return this.copilotService.chat(payload);
  }
}
