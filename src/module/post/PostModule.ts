import { Module } from '@nestjs/common';

import { SessionModule } from '@/module/auth/session';
import { LockModule } from '@/module/lock/LockModule';

import { PostController } from './PostController';
import { PostService } from './PostService';

@Module({
  imports: [SessionModule, LockModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
