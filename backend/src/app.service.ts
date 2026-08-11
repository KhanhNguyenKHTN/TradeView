import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getAppInfo() {
    return {
      name: 'TradeView API',
      version: '1.0.0',
      description: 'API quản lý tài chính cá nhân cho vàng, tiết kiệm, chứng khoán và coin',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}