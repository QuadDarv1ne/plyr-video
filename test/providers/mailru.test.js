import { describe, it, expect } from 'vitest';

// Parse Mail.ru Video ID from URL
function parseId(url) {
  if (!url) {
    return null;
  }
  const regex = /(?:my\.mail\.ru\/video\/embed\/|api\.video\.mail\.ru\/videos\/)(\d+)/i;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
}

describe('Mail.ru Provider', () => {
  describe('parseId', () => {
    it('should extract video ID from Mail.ru embed URL', () => {
      expect(parseId('https://my.mail.ru/video/embed/6353406850491756603')).toBe('6353406850491756603');
    });

    it('should extract video ID from Mail.ru API URL', () => {
      expect(parseId('https://api.video.mail.ru/videos/6353406850491756603')).toBe('6353406850491756603');
    });

    it('should return null for empty URL', () => {
      expect(parseId('')).toBeNull();
      expect(parseId(null)).toBeNull();
      expect(parseId(undefined)).toBeNull();
    });

    it('should return the input if it looks like an ID', () => {
      expect(parseId('6353406850491756603')).toBe('6353406850491756603');
    });
  });
});
