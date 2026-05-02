// ==========================================================================
// Yandex Cloud Video plugin
// ==========================================================================
import ui from '../ui';
import is from '../utils/is';
import sendCommand from '../utils/post-message';
import {
  baseSetup,
  createEmbed,
  defineMediaControls,
  defineMediaProperties,
  destroy,
  fetchTitle,
  handleDefaultMessage,
} from './base-embed';

// Parse Yandex Cloud Video ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  const regex = /(?:video\.cloud\.yandex\.net\/player\/|cloud\.yandex\.ru.*video\/)([a-f0-9-]+)/i;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
}

const yandex = {
  setup() {
    baseSetup.call(this, yandex);
  },

  getTitle(videoId) {
    fetchTitle.call(this, `https://video.cloud.yandex.net/api/v1/videos/${videoId}`, 'Yandex Cloud Video', 'name');
  },

  ready() {
    const player = this;
    const config = player.config.yandex;
    let source = player.media.getAttribute('src');

    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    const videoId = parseId(source);

    if (is.empty(videoId)) {
      player.debug.error('Yandex Cloud Video: No valid video ID found');
      return;
    }

    const embedUrl = `https://video.cloud.yandex.net/player/${videoId}`;
    const params = [];

    if (config.autoplay) {
      params.push('autoplay=true');
    }

    if (config.muted) {
      params.push('muted=true');
    }

    if (config.loop) {
      params.push('loop=true');
    }

    createEmbed(yandex, {
      player,
      videoId,
      embedUrl,
      params,
      allowedOrigins: ['https://video.cloud.yandex.net', 'https://cloud.yandex.ru'],
      handleMessage: yandex.handleMessage,
      label: 'Yandex Cloud Video',
    });

    defineMediaControls(player);
    defineMediaProperties(player, videoId, embedUrl);

    // Get title
    yandex.getTitle.call(player, videoId);

    // Request available qualities and captions
    player.embed.optionsTimeout = setTimeout(
      () => sendCommand(player, 'frame:checkOptions'),
      1000,
    );
    player.embed.captionTimeout = setTimeout(
      () => sendCommand(player, 'player:getCaptions'),
      1500,
    );

    // Rebuild UI
    if (config.customControls) {
      setTimeout(() => ui.build.call(player), 0);
    }
  },

  handleMessage(msg) {
    handleDefaultMessage.call(this, msg, 'Yandex Cloud Video');
  },

  destroy() {
    destroy.call(this);
  },
};

export default yandex;
