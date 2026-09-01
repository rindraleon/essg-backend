export interface DetectedFileType {
  mimetype: string;
  extension: string;
  inlineViewable: boolean;
}

const PDF: DetectedFileType = {
  mimetype: 'application/pdf',
  extension: 'pdf',
  inlineViewable: true,
};

const TYPES: Array<{ test: (buffer: Buffer) => boolean; type: DetectedFileType }> = [
  {
    test: (b) => b.length >= 4 && b.subarray(0, 4).toString('latin1') === '%PDF',
    type: PDF,
  },
  {
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    type: { mimetype: 'image/jpeg', extension: 'jpg', inlineViewable: true },
  },
  {
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    type: { mimetype: 'image/png', extension: 'png', inlineViewable: true },
  },
  {
    test: (b) => b.length >= 6 && b.subarray(0, 3).toString('latin1') === 'GIF',
    type: { mimetype: 'image/gif', extension: 'gif', inlineViewable: true },
  },
  {
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
    type: { mimetype: 'image/webp', extension: 'webp', inlineViewable: true },
  },
  {
    test: (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
    type: {
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      inlineViewable: false,
    },
  },
  {
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    type: { mimetype: 'application/msword', extension: 'doc', inlineViewable: false },
  },
];

export function detectFileType(buffer: Buffer, fallbackMimetype?: string): DetectedFileType {
  for (const { test, type } of TYPES) {
    if (test(buffer)) return type;
  }

  if (fallbackMimetype) {
    const known = TYPES.find((entry) => entry.type.mimetype === fallbackMimetype);
    if (known) return known.type;
  }

  return {
    mimetype: 'application/octet-stream',
    extension: 'bin',
    inlineViewable: false,
  };
}

export function withDetectedExtension(filename: string, extension: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '');
  return `${base}.${extension}`;
}
