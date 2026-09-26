import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/auth.guard';
import { CryptoModule } from './common/crypto.service';
import { PrismaModule } from './common/prisma.service';
import { validateEnv } from './config/env';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.controller';
import { AssistantModule } from './modules/assistant/assistant.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.controller';
import { DashboardModule } from './modules/dashboard/dashboard.controller';
import { DocumentsModule } from './modules/documents/documents.controller';
import { GoogleModule } from './modules/google/google-client.service';
import { HealthModule } from './modules/health/health.controller';
import { MailModule } from './modules/mail/mail.controller';
import { NotificationsModule } from './modules/notifications/notifications.controller';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { SyncModule } from './modules/sync/sync.controller';
import { TasksModule } from './modules/tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnv }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { issuer: 'kairos' }, verifyOptions: { issuer: 'kairos' } }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    GoogleModule,
    AiModule,
    AuthModule,
    CategoriesModule,
    TasksModule,
    SchedulerModule,
    MailModule,
    NotificationsModule,
    DocumentsModule,
    AssistantModule,
    AnalyticsModule,
    DashboardModule,
    SyncModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
