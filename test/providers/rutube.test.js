import { describe, it, expect } from 'vitest';

// Parse Rutube ID from URL
function parseId(url) {
  if (!url) {
    return null;
  }
  const regex = /rutube\.ru\/(?:play\/embed\/|video\/|embed\/)([a-f0-9]+)\/?/i;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
}

describe('Rutube Provider', () => {
  describe('parseId', () => {
    it('should extract video ID from Rutube URL', () => {
      expect(parseId('https://rutube.ru/video/91d051245c0cf5703957fe07f7b11b98/')).toBe('91d051245c0cf5703957fe07f7b11b98');
    });

    it('should extract video ID from Rutube embed URL', () => {
      expect(parseId('https://rutube.ru/play/embed/91d051245c0cf5703957fe07f7b11b98')).toBe('91d051245c0cf5703957fe07f7b11b98');
    });

    it('should extract video ID from Rutube embed URL with trailing slash', () => {
      expect(parseId('https://rutube.ru/play/embed/91d051245c0cf5703957fe07f7b11b98/')).toBe('91d051245c0cf5703957fe07f7b11b98');
    });

    it('should return null for empty URL', () => {
      expect(parseId('')).toBeNull();
      expect(parseId(null)).toBeNull();
      expect(parseId(undefined)).toBeNull();
    });

    it('should return the input if it looks like an ID', () => {
      expect(parseId('91d051245c0cf5703957fe07f7b11b98')).toBe('91d051245c0cf5703957fe07f7b11b98');
    });
  });
});
