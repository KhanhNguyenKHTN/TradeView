import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FinanceController } from './finance.controller';
import { PrismaService } from './prisma.service';

@Module({
  imports: [],
  controllers: [AppController, FinanceController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
