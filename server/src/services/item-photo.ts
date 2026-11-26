import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, RequestHandler } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';
import { HttpError } from '../utils/http-error.ts';

export const uploadDir = fileURLToPath(new URL('../../uploads/', import.meta.url));
const maxBytes = 5 * 1024 * 1024;
const receive = multer({ limits: { files: 1, fields: 8, parts: 10, fileSize: maxBytes + 1, fieldSize: 16384 } }).single('photo');

export const receivePhoto: RequestHandler = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next(new HttpError(415, 'Use multipart form data.'));
  receive(req, res, error => {
    if (!error) return next();
    next(error.code === 'LIMIT_FILE_SIZE' ? new HttpError(413, 'Photo must be 5 MB or smaller.') : new HttpError(400, 'Invalid multipart form.'));
  });
};

export async function savePhoto(request: Request & { file?: { buffer: Buffer } }) {
  if (!request.file) return null;
  const { buffer } = request.file;
  if (buffer.length > maxBytes) throw new HttpError(413, 'Photo must be 5 MB or smaller.');
  const type = await fileTypeFromBuffer(buffer).catch(() => undefined);
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
    throw new HttpError(415, 'Choose a JPEG, PNG or WebP photo.');
  }
  const filename = randomUUID() + '.' + type.ext;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), buffer, { flag: 'wx' });
  return '/uploads/' + filename;
}

export async function removePhoto(path: string | null) {
  if (path) await rm(join(uploadDir, basename(path)), { force: true });
}
