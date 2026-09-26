import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { createTaskSchema, updateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from '@kairos/core';
import type { TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.tasks.list(user.id, {
      status: status ? (status.split(',') as TaskStatus[]) : undefined,
      categoryId,
      from,
      to,
      q,
      parentId: null,
    });
  }

  @Get('priorities')
  priorities(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.tasks.priorities(user.id, limit ? Number(limit) : 10);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createTaskSchema)) body: CreateTaskInput) {
    return this.tasks.create(user.id, body);
  }

  @Post('quick-add')
  async quickAdd(@CurrentUser() user: AuthUser, @Body(new ZodPipe(z.object({ text: z.string().min(1).max(500) }))) body: { text: string }) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { timeZone: true } });
    return this.tasks.quickAdd(user.id, body.text, u.timeZone);
  }

  @Post(':id/subtasks')
  subtask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(createTaskSchema)) body: CreateTaskInput) {
    return this.tasks.create(user.id, { ...body, parentId: id });
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(updateTaskSchema)) body: UpdateTaskInput) {
    return this.tasks.update(user.id, id, body);
  }

  @Post(':id/checklist/:itemId/toggle')
  toggle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.tasks.toggleChecklistItem(user.id, id, itemId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(user.id, id);
  }
}
