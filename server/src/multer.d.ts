declare module 'multer' {
  import type { RequestHandler } from 'express';
  export default function multer(options: {
    limits: { fileSize: number; fields: number; files: number; fieldSize: number; parts: number };
  }): { single(field: string): RequestHandler };
}
