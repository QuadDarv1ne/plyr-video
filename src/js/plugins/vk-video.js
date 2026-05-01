// ==========================================================================
// VK Video plugin
// ==========================================================================
import ui from '../ui';
import { triggerEvent } from '../utils/events';
import is from '../utils/is';
import sendCommand from '../utils/post-message';
import {
  assurePlaybackState,
  baseSetup,
  createEmbed,
  defineMediaControls,
  defineMediaProperties,
  destroy,
  fetchTitle,
  handleCurrentQuality,
  handleCurrentTime,
  handleChangeState,
  isOriginAllowed,
} from './base-embed';

// Parse VK Video ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  // Match: vk.com/video-123_456 or vk.ru/video?oid=-123&id=456
  const oidMatch = url.match(/[?&]oid=([^&]+)/i);
  const idMatch2 = url.match(/[?&]id=([^&]+)/i);

  if (oidMatch && idMatch2) {
    return `oid=${oidMatch[1]}&id=${idMatch2[1]}`;
  }

  // Try simple video ID format: video-123_456
  const idMatch = url.match(/video(-?\d+)_(\d+)/i);

  if (idMatch) {
    return `oid=${idMatch[1]}&id=${idMatch[2]}`;
  }

  return url;
}

const vk = {
  setup() {
    baseSetup.call(this, vk);
  },

  getTitle(oid, videoId) {
    fetchTitle.call(this, `https://vk.ru/al_video.php?act=show&al=1&video=${oid}_${videoId}`, 'VK Video');
  },

  ready() {
    const player = this;
    const config = player.config.vk;
    let source = player.media.getAttribute('src');

    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    const videoParams = parseId(source);

    if (is.empty(videoParams)) {
      player.debug.error('VK Video: No valid video ID found');
      return;
    }

    const oidMatch = videoParams.match(/oid=([^&]+)/);
    const idMatch = videoParams.match(/id=([^&]+)/);
    const oid = oidMatch ? oidMatch[1] : '';
    const videoId = idMatch ? idMatch[1] : '';

    const embedUrl = `https://vk.ru/video_ext.php?${videoParams}&js_api=1`;
    const params = [];

    if (config.autoplay) {
      params.push('autoplay=1');
    }

    if (config.hd) {
      params.push(`hd=${config.hd}`);
    }

    if (config.startTime) {
      params.push(`t=${config.startTime}`);
    }

    if (params.length) {
      params.push('js_api=1');
    } else {
      params.push('js_api=1');
    }

    createEmbed(vk, {
      player,
      videoId,
      embedUrl,
      params,
      allowedOrigins: ['https://vk.com', 'https://vk.ru', 'https://userapi.com'],
      handleMessage: vk.handleMessage,
      label: 'VK Video',
      initTimeoutMs: 15000,
    });

    defineMediaControls(player);
    defineMediaProperties(player, videoId, embedUrl);

    // Get title
    if (oid && videoId) {
      vk.getTitle.call(player, oid, videoId);
    }

    // Rebuild UI
    if (config.customControls) {
      setTimeout(() => ui.build.call(player), 0);
    }
  },

  handleMessage(msg) {
    const player = this;
    const { type, data } = msg;

    // Map VK's event format to unified format
    let eventType = type;
    let eventData = data;

    // VK sends events as strings or objects with 'event' property
    if (is.string(msg)) {
      eventType = msg.includes(':') ? msg : `vk_video:${msg}`;
      eventData = {};
    } else if (is.object(msg)) {
      if (msg.event) {
        eventType = `vk_video:${msg.event}`;
        eventData = msg;
      } else if (msg.type) {
        eventType = `vk_video:${msg.type}`;
        eventData = msg;
      } else {
        if (player.config.debug) {
          player.debug.log('VK Video unknown object event:', msg);
        }

        return;
      }
    } else {
      return;
    }

    // Map VK events to unified format
    const mappedMsg = {
      type: eventType.replace('vk_video:', 'player:'),
      data: eventData,
    };

    switch (mappedMsg.type) {
      case 'player:inited':
        player.debug.log('VK Video player inited');
        player.embed.state = 'inited';
        break;

      case 'player:started':
      case 'player:resumed':
        assurePlaybackState.call(player, true);
        triggerEvent.call(player, player.media, 'playing');
        player.embed.state = 'playing';
        break;

      case 'player:paused':
        assurePlaybackState.call(player, false);
        player.embed.state = 'paused';
        break;

      case 'player:ended':
        player.media.paused = true;
        triggerEvent.call(player, player.media, 'ended');
        player.embed.state = 'ended';
        break;

      case 'player:timeupdate':
        if (is.number(eventData.time)) {
          player.embed.currentTime = eventData.time;

          if (is.number(eventData.duration) && player.media.duration !== eventData.duration) {
            player.media.duration = eventData.duration;
            triggerEvent.call(player, player.media, 'durationchange');
          }

          triggerEvent.call(player, player.media, 'timeupdate');
        }

        break;

      case 'player:volumechange':
        if (is.number(eventData.volume)) {
          player.media.volume = eventData.volume;
        }

        if (is.boolean(eventData.mute)) {
          player.media.muted = eventData.mute;
        }

        triggerEvent.call(player, player.media, 'volumechange');
        break;

      case 'player:qualitychange':
        if (eventData.quality) {
          const hdMap = { 1: 360, 2: 480, 3: 720, 4: 1080 };
          player.embed.currentQuality = hdMap[eventData.quality] || null;
          triggerEvent.call(player, player.media, 'qualitychange', false, {
            quality: player.embed.currentQuality,
          });
        }

        break;

      case 'player:error':
        player.media.error = {
          code: eventData.code || 1,
          message: eventData.message || 'VK Video playback error',
        };

        triggerEvent.call(player, player.media, 'error');
        player.embed.state = 'error';
        break;

      case 'player:adStarted':
        triggerEvent.call(player, player.media, 'adsstarted');
        break;

      case 'player:adCompleted':
        triggerEvent.call(player, player.media, 'adscompleted');
        break;

      default:
        if (player.config.debug) {
          player.debug.log('VK Video unknown event:', mappedMsg.type, eventData);
        }

        break;
    }
  },

  destroy() {
    destroy.call(this);
  },
};

export default vk;
