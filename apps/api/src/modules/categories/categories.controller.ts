import { Body, Controller, Delete, Get, Module, Param, Patch, Post, BadRequestException } from '@nestjs/common';
import { categorySchema } from '@kairos/core';
import type { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';

type CategoryInput = z.infer<typeof categorySchema>;

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.category.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { position: 'asc' } });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(categorySchema)) body: CategoryInput) {
    const position = await this.prisma.category.count({ where: { userId: user.id } });
    return this.prisma.category.create({ data: { ...body, userId: user.id, slug: slugify(body.name), position } });
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(categorySchema.partial())) body: Partial<CategoryInput>) {
    return this.prisma.category.update({ where: { id, userId: user.id }, data: body });
  }

  /** Les catégories système sont archivables mais jamais supprimées. */
  @Delete(':id')
  async archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const open = await this.prisma.task.count({ where: { categoryId: id, userId: user.id, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } } });
    if (open) throw new BadRequestException(`${open} tâche(s) ouverte(s) dans cette catégorie`);
    return this.prisma.category.update({ where: { id, userId: user.id }, data: { archivedAt: new Date() } });
  }
}

@Module({ controllers: [CategoriesController] })
export class CategoriesModule {}
