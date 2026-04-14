// ==========================================================================
// Plyr supported types and providers
// ==========================================================================

export const providers = {
  html5: 'html5',
  youtube: 'youtube',
  vimeo: 'vimeo',
  rutube: 'rutube',
  yandex: 'yandex',
  vk: 'vk',
};

export const types = {
  audio: 'audio',
  video: 'video',
};

/**
 * Get provider by URL
 * @param {string} url
 */
export function getProviderByUrl(url) {
  // YouTube
  if (/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.?be)\/.+$/.test(url)) {
    return providers.youtube;
  }

  // Vimeo
  if (/^https?:\/\/player.vimeo.com\/video\/\d{0,9}(?=\b|\/)/.test(url)) {
    return providers.vimeo;
  }

  // Rutube
  if (/rutube\.ru\/(?:play\/embed\/|video\/|embed\/)/.test(url)) {
    return providers.rutube;
  }

  // Yandex Cloud Video
  if (/video\.cloud\.yandex\.net\/player\/|cloud\.yandex\.ru.*video\//.test(url)) {
    return providers.yandex;
  }

  // VK Video
  if (/vk\.com\/video|vk\.ru\/video/.test(url)) {
    return providers.vk;
  }

  return null;
}

export default { providers, types };
