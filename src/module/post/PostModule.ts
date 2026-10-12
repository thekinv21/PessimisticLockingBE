import { Module } from '@nestjs/common';

import { PostController } from './PostController';
import { PostService } from './PostService';

@Module({
  imports: [],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
