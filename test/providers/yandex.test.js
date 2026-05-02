import { describe, it, expect } from 'vitest';

// Parse Yandex Cloud Video ID from URL
function parseId(url) {
  if (!url) {
    return null;
  }
  const regex = /(?:video\.cloud\.yandex\.net\/player\/|cloud\.yandex\.ru.*video\/)([a-f0-9-]+)/i;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
}

describe('Yandex Provider', () => {
  describe('parseId', () => {
    it('should extract video ID from Yandex Cloud Video URL', () => {
      expect(parseId('https://video.cloud.yandex.net/player/7c10a15d-1e87-4d6e-a0e7-8f0f5e5c5e5d')).toBe('7c10a15d-1e87-4d6e-a0e7-8f0f5e5c5e5d');
    });

    it('should extract video ID from Yandex Cloud Video URL with cloud.yandex.ru', () => {
      expect(parseId('https://cloud.yandex.ru/video/7c10a15d-1e87-4d6e-a0e7-8f0f5e5c5e5d')).toBe('7c10a15d-1e87-4d6e-a0e7-8f0f5e5c5e5d');
    });

    it('should return null for empty URL', () => {
      expect(parseId('')).toBeNull();
      expect(parseId(null)).toBeNull();
      expect(parseId(undefined)).toBeNull();
    });

    it('should return the input if it looks like an ID', () => {
      expect(parseId('7c10a15d-1e87-4d6e-a0e7-8f0f5e5c5e5d')).toBe('7c10a15d-1e87-4d6e-a0e7-8f0f5e5c5e5d');
    });
  });
});
