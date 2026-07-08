import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      name: 'Family Media API',
      version: '0.0.1',
      health: '/health',
    };
  }
}
