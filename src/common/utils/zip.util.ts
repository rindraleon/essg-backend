import archiver from 'archiver';

export interface ZipEntry {
  name: string;
  data: Buffer;
}

const ZIP_COMPRESSION_LEVEL = 6;

export function createZipBuffer(entries: readonly ZipEntry[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: ZIP_COMPRESSION_LEVEL } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') reject(error);
    });
    archive.on('error', reject);

    for (const entry of entries) {
      archive.append(entry.data, { name: entry.name });
    }
    archive.finalize().catch(reject);
  });
}
