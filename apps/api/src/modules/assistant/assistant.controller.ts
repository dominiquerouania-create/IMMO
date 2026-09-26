import { Body, Controller, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { ZodPipe } from '../../common/zod.pipe';
import { MailModule } from '../mail/mail.controller';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { TasksModule } from '../tasks/tasks.module';
import { AssistantService } from './assistant.service';

const commandSchema = z.object({ text: z.string().min(1).max(2000), emailId: z.string().optional() });

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('command')
  command(@CurrentUser() user: AuthUser, @Body(new ZodPipe(commandSchema)) body: z.infer<typeof commandSchema>) {
    return this.assistant.handle(user.id, body.text, { emailId: body.emailId });
  }
}

@Module({ imports: [TasksModule, SchedulerModule, MailModule], controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
