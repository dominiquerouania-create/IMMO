import { Module } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({ imports: [SchedulerModule], controllers: [TasksController], providers: [TasksService], exports: [TasksService] })
export class TasksModule {}
