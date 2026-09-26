import { Body, Controller, Get, Module, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { ZodPipe } from '../../common/zod.pipe';
import { DriveModule } from '../drive/drive.service';
import { DocumentsService, type GenerateInput } from './documents.service';

const generateSchema = z.object({
  type: z.enum(['PDF', 'DOCX', 'REPORT', 'MINUTES', 'LETTER', 'QUOTE', 'INVOICE', 'CHECKLIST', 'SUMMARY', 'OTHER']),
  format: z.enum(['pdf', 'docx']),
  title: z.string().min(1).max(200),
  categoryId: z.string().optional(),
  brief: z.string().max(20_000).optional(),
  data: z
    .object({
      number: z.string().optional(),
      companyKey: z.string().optional(),
      client: z.object({ name: z.string(), address: z.string().optional() }).optional(),
      lines: z.array(z.object({ label: z.string(), quantity: z.number(), unit: z.string().optional(), unitPrice: z.number(), vatRate: z.number().min(0).max(1).optional() })).optional(),
      items: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .optional(),
  saveToDrive: z.boolean().optional(),
});

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.docs.list(user.id);
  }

  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query('q') q: string) {
    return this.docs.search(user.id, q ?? '');
  }

  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(generateSchema)) body: GenerateInput) {
    return this.docs.generate(user.id, body);
  }

  @Get(':id/download')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { doc, buffer, mime } = await this.docs.file(user.id, id);
    res.set({ 'Content-Type': mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${doc.title}.${doc.format}`)}` });
    return new StreamableFile(buffer);
  }
}

@Module({ imports: [DriveModule], controllers: [DocumentsController], providers: [DocumentsService], exports: [DocumentsService] })
export class DocumentsModule {}
