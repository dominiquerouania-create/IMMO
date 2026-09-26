import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiRouterService } from './ai-router.service';
import { AiTasksService } from './ai-tasks.service';
import { AI_PROVIDERS_TOKEN } from './ai.types';
import { ClaudeCodeProvider } from './providers/claude-code.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { CopilotProvider } from './providers/copilot.provider';
import { SkyworkProvider } from './providers/skywork.provider';

/** Pour ajouter un moteur : implémenter AiProvider et l'ajouter à la liste ci-dessous. */
@Global()
@Module({
  controllers: [AiController],
  providers: [
    ClaudeProvider,
    ClaudeCodeProvider,
    SkyworkProvider,
    CopilotProvider,
    {
      provide: AI_PROVIDERS_TOKEN,
      useFactory: (...providers: unknown[]) => providers,
      inject: [ClaudeProvider, ClaudeCodeProvider, SkyworkProvider, CopilotProvider],
    },
    AiRouterService,
    AiTasksService,
  ],
  exports: [AiRouterService, AiTasksService],
})
export class AiModule {}
