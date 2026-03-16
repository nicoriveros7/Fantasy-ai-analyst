import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { SyncIngestionDto } from './dto/sync-ingestion.dto';

@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get('preview')
  @ApiOperation({ summary: 'Preview selected data provider counts' })
  preview() {
    return this.ingestionService.getBootstrapPreview();
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger ingestion sync (seed/fpl)' })
  @ApiResponse({ status: 200, description: 'Sync summary' })
  sync(@Body() payload: SyncIngestionDto) {
    return this.ingestionService.sync(payload);
  }
}
