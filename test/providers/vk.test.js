import { describe, it, expect } from 'vitest';

// Parse VK Video ID from URL
function parseId(url) {
  if (!url) {
    return null;
  }
  const regex = /(?:vk\.com|vk\.ru)\/video(-?\d+)_\d+/i;
  const match = url.match(regex);
  return match && match[0] ? match[0].split('/').pop().replace('video', '') : url;
}

describe('VK Provider', () => {
  describe('parseId', () => {
    it('should extract video ID from VK URL', () => {
      expect(parseId('https://vk.com/video-40602947_456239058')).toBe('-40602947_456239058');
    });

    it('should extract video ID from VK.ru URL', () => {
      expect(parseId('https://vk.ru/video-40602947_456239058')).toBe('-40602947_456239058');
    });

    it('should return null for empty URL', () => {
      expect(parseId('')).toBeNull();
      expect(parseId(null)).toBeNull();
      expect(parseId(undefined)).toBeNull();
    });

    it('should return the input if it looks like an ID', () => {
      expect(parseId('-40602947_456239058')).toBe('-40602947_456239058');
    });
  });
});
