import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { ZodPipe } from '../../common/zod.pipe';
import { TasksModule } from '../tasks/tasks.module';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('importance') importance?: string) {
    return this.mail.list(user.id, importance);
  }

  @Get('digest')
  digest(@CurrentUser() user: AuthUser) {
    return this.mail.digest(user.id);
  }

  @Post('sync')
  async sync(@CurrentUser() user: AuthUser) {
    return { imported: await this.mail.ingest(user.id) };
  }

  @Post(':id/triage')
  triage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mail.triage(user.id, id);
  }

  @Post(':id/to-task')
  toTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mail.toTask(user.id, id);
  }

  @Post(':id/draft')
  draft(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ instructions: z.string().max(2000).optional() }))) body: { instructions?: string },
  ) {
    return this.mail.draft(user.id, id, body.instructions);
  }
}

@Module({ imports: [TasksModule], controllers: [MailController], providers: [MailService], exports: [MailService] })
export class MailModule {}
