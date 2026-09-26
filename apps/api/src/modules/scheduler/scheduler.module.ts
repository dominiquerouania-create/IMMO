import { Module } from '@nestjs/common';
import { CalendarService } from '../calendar/calendar.service';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

/** Planification + calendrier (même module : dépendance mutuelle pull ⇄ replan). */
@Module({
  controllers: [SchedulerController],
  providers: [SchedulerService, CalendarService],
  exports: [SchedulerService, CalendarService],
})
export class SchedulerModule {}
