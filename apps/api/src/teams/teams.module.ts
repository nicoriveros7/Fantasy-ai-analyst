import { Module } from '@nestjs/common';
import { FixtureRunAnalyzerService } from './fixture-run-analyzer.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
	controllers: [TeamsController],
	providers: [TeamsService, FixtureRunAnalyzerService],
	exports: [FixtureRunAnalyzerService],
})
export class TeamsModule {}