import { Injectable, Module } from '@nestjs/common';
import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { PrismaService } from '../../common/prisma.service';
import { GoogleClientService } from '../google/google-client.service';

const ROOT_FOLDER = 'Kairos';

/**
 * Google Drive : arborescence Kairos/<Catégorie>/<Année>/<Type>,
 * classement automatique, archivage et recherche plein texte.
 * Portée `drive.file` : Kairos ne voit que les fichiers qu'il a créés.
 */
@Injectable()
export class DriveService {
  constructor(
    private readonly google: GoogleClientService,
    private readonly prisma: PrismaService,
  ) {}

  get configured() {
    return this.google.configured;
  }

  private async drive(userId: string) {
    return google.drive({ version: 'v3', auth: await this.google.forUser(userId) });
  }

  private async ensureFolder(userId: string, name: string, parentId?: string): Promise<string> {
    const drive = await this.drive(userId);
    const q = [`mimeType='application/vnd.google-apps.folder'`, `name='${name.replace(/'/g, "\\'")}'`, 'trashed=false', parentId ? `'${parentId}' in parents` : `'root' in parents`].join(' and ');
    const { data } = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
    if (data.files?.[0]?.id) return data.files[0].id;
    const { data: created } = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined },
      fields: 'id',
    });
    return created.id!;
  }

  /** Chemin de classement : Kairos / Catégorie / Année / Type. */
  async folderFor(userId: string, categoryName: string, type: string): Promise<string> {
    const root = await this.ensureFolder(userId, ROOT_FOLDER);
    const cat = await this.ensureFolder(userId, categoryName, root);
    const year = await this.ensureFolder(userId, String(new Date().getFullYear()), cat);
    return this.ensureFolder(userId, type, year);
  }

  async upload(userId: string, file: { name: string; mimeType: string; content: Buffer; folderId: string; description?: string }) {
    const drive = await this.drive(userId);
    const { data } = await drive.files.create({
      requestBody: { name: file.name, parents: [file.folderId], description: file.description },
      media: { mimeType: file.mimeType, body: Readable.from(file.content) },
      fields: 'id, webViewLink',
    });
    await this.prisma.automationLog.create({ data: { userId, type: 'FILE_CLASSIFIED', summary: `« ${file.name} » classé dans Drive` } });
    return { id: data.id!, url: data.webViewLink ?? null };
  }

  async search(userId: string, query: string) {
    const drive = await this.drive(userId);
    const { data } = await drive.files.list({
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
      pageSize: 20,
    });
    return data.files ?? [];
  }
}

@Module({ providers: [DriveService], exports: [DriveService] })
export class DriveModule {}
