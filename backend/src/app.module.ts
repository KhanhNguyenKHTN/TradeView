import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FinanceController } from './finance.controller';
import { PrismaService } from './prisma.service';
import { TaskReminderService } from './task-reminder.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppController, FinanceController],
  providers: [AppService, PrismaService, TaskReminderService],
})
export class AppModule {}
