// ==========================================================================
// Rutube plugin
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
  fetchPoster,
  fetchTitle,
  handleDefaultMessage,
} from './base-embed';

// Parse Rutube ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  const regex = /rutube\.ru\/(?:play\/embed\/|video\/|embed\/)([a-f0-9]+)\/?/i;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
}

const rutube = {
  setup() {
    baseSetup.call(this, rutube);
  },

  getTitle(videoId) {
    fetchTitle.call(this, `https://rutube.ru/api/video/${videoId}/`, 'Rutube');
  },

  ready() {
    const player = this;
    const config = player.config.rutube;
    let source = player.media.getAttribute('src');

    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    const videoId = parseId(source);

    if (is.empty(videoId)) {
      player.debug.error('Rutube: No valid video ID found');
      return;
    }

    const embedUrl = `https://rutube.ru/play/embed/${videoId}/`;
    const params = [];

    if (config.autoplay) {
      params.push('autoplay=true');
    }

    if (config.quality) {
      params.push(`q=${config.quality}`);
    }

    if (config.skinColor) {
      params.push(`skinColor=${config.skinColor}`);
    }

    if (config.stopTime) {
      params.push(`stopTime=${config.stopTime}`);
    }

    createEmbed(rutube, {
      player,
      videoId,
      embedUrl,
      params,
      allowedOrigins: ['https://rutube.ru', 'https://www.rutube.ru'],
      handleMessage: rutube.handleMessage,
      label: 'Rutube',
    });

    defineMediaControls(player);
    defineMediaProperties(player, videoId, embedUrl);

    // Get title
    rutube.getTitle.call(player, videoId);

    // Fetch poster if custom controls
    if (config.customControls && player.poster) {
      fetchPoster(`https://rutube.ru/api/video/${videoId}/`, player);
    }

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
    handleDefaultMessage.call(this, msg, 'Rutube');
  },

  destroy() {
    destroy.call(this);
  },
};

export default rutube;
