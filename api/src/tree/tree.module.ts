import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TreeController } from './tree.controller';
import { TreeService } from './tree.service';

@Module({
  imports: [AuthModule],
  controllers: [TreeController],
  providers: [TreeService],
  exports: [TreeService],
})
export class TreeModule {}
