export const IMAGE_OUTPUT_FORMAT = 'webp' as const;
export const IMAGE_OUTPUT_MIME = 'image/webp' as const;
export const IMAGE_OUTPUT_EXTENSION = '.webp' as const;

export interface ImagePresetConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  skipReencodeUnder: number;
}

export const IMAGE_PRESETS = {
  avatar: { maxWidth: 512, maxHeight: 512, quality: 82, skipReencodeUnder: 120 * 1024 },
  logo: { maxWidth: 800, maxHeight: 800, quality: 86, skipReencodeUnder: 150 * 1024 },
  staff: { maxWidth: 900, maxHeight: 1200, quality: 82, skipReencodeUnder: 200 * 1024 },
  cover: { maxWidth: 1920, maxHeight: 1080, quality: 80, skipReencodeUnder: 250 * 1024 },
  gallery: { maxWidth: 1600, maxHeight: 1600, quality: 78, skipReencodeUnder: 250 * 1024 },
  default: { maxWidth: 1920, maxHeight: 1920, quality: 80, skipReencodeUnder: 250 * 1024 },
} as const satisfies Record<string, ImagePresetConfig>;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export const PREFIX_PRESET_MAP: Record<string, ImagePreset> = {
  avatars: 'avatar',
  partners: 'logo',
  staff: 'staff',
  news: 'cover',
  formations: 'cover',
  projects: 'cover',
  images: 'default',
};

export function resolvePresetFromPrefix(prefix?: string): ImagePreset {
  if (!prefix) return 'default';
  const normalized = prefix.split('/').find(Boolean)?.toLowerCase() ?? '';
  return PREFIX_PRESET_MAP[normalized] ?? 'default';
}
