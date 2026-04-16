// ==========================================================================
// VK Video plugin
// ==========================================================================

import ui from '../ui';
import { createElement, replaceElement } from '../utils/elements';
import { triggerEvent } from '../utils/events';
import is from '../utils/is';
import sendCommand from '../utils/post-message';
import { generateId } from '../utils/strings';
import {
  assurePlaybackState,
  baseSetup,
  destroy,
  fetchTitle,
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
    // VK API doesn't provide a public JSON endpoint for video titles
    // Using video ID as fallback title
    if (videoId && !this.config.title) {
      this.config.title = `VK Video: ${videoId}`;
    }
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

    const id = generateId(player.provider);
    const oidMatch = videoParams.match(/oid=([^&]+)/);
    const idMatch = videoParams.match(/id=([^&]+)/);
    const oid = oidMatch ? oidMatch[1] : '';
    const videoId = idMatch ? idMatch[1] : '';

    const iframe = createElement('iframe');
    iframe.setAttribute('id', id);
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer');

    const embedUrl = `https://vk.ru/video_ext.php?${videoParams}&js_api=1`;
    const params = [];
    if (config.autoplay) params.push('autoplay=1');
    if (config.hd) params.push(`hd=${config.hd}`);
    if (config.startTime) params.push(`t=${config.startTime}`);

    const finalUrl = params.length ? `${embedUrl}&${params.join('&')}` : embedUrl;
    iframe.setAttribute('src', finalUrl);

    const wrapper = createElement('div', {
      'className': player.config.classNames.embedContainer,
      'data-poster': player.poster,
    });
    wrapper.appendChild(iframe);

    player.media = replaceElement(wrapper, player.media);

    player.embed = {
      iframe,
      hasPlayed: false,
      state: 'unstarted',
      currentTime: 0,
      duration: 0,
      initTimeout: setTimeout(() => {
        if (!player.embed.hasReceivedMessage) {
          player.debug.warn('VK Video: Player did not initialize within 15s');
        }
      }, 15000),
    };

    player.media.paused = true;
    player.media.currentTime = 0;
    player.media.duration = 0;
    player.media.seeking = false;
    player.media.buffered = 0;
    player.media.lastBuffered = null;

    // Setup postMessage listener
    player.embed.messageHandler = (event) => {
      if (!isOriginAllowed(event.origin, ['https://vk.com', 'https://vk.ru', 'https://userapi.com'])) {
        return;
      }

      const data = event.data;
      if (!data) {
        return;
      }

      if (!player.embed.hasReceivedMessage) {
        player.embed.hasReceivedMessage = true;
        clearTimeout(player.embed.initTimeout);
      }

      try {
        vk.handleMessage.call(player, data);
      }
      catch (err) {
        player.debug.error('VK Video: Error handling message:', err);
      }
    };

    window.addEventListener('message', player.embed.messageHandler);

    // Media controls
    player.media.play = () => {
      assurePlaybackState.call(player, true);
      sendCommand(player, { method: 'play', params: [] });
    };

    player.media.pause = () => {
      assurePlaybackState.call(player, false);
      sendCommand(player, { method: 'pause', params: [] });
    };

    player.media.stop = () => {
      player.pause();
      player.currentTime = 0;
      sendCommand(player, { method: 'stop', params: [] });
    };

    // currentTime
    Object.defineProperty(player.media, 'currentTime', {
      get() {
        return player.embed.currentTime || 0;
      },
      set(time) {
        const { media } = player;
        media.seeking = true;
        triggerEvent.call(player, media, 'seeking');
        sendCommand(player, { method: 'seek', params: [time] });
      },
    });

    // playbackRate - VK doesn't support speed control via API
    let speed = player.config.speed.selected;
    Object.defineProperty(player.media, 'playbackRate', {
      get() {
        return speed;
      },
      set(input) {
        speed = input;
        triggerEvent.call(player, player.media, 'ratechange');
      },
    });

    // volume
    let { volume } = player.config;
    Object.defineProperty(player.media, 'volume', {
      get() {
        return volume;
      },
      set(input) {
        volume = input;
        sendCommand(player, { method: 'setVolume', params: [input] });
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // muted
    let { muted } = player.config;
    Object.defineProperty(player.media, 'muted', {
      get() {
        return muted;
      },
      set(input) {
        const toggle = is.boolean(input) ? input : false;
        muted = toggle;
        sendCommand(player, { method: toggle ? 'mute' : 'unmute', params: [] });
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // currentSrc
    Object.defineProperty(player.media, 'currentSrc', {
      get() {
        return `https://vk.ru/video_ext.php?${videoParams}`;
      },
    });

    // ended
    Object.defineProperty(player.media, 'ended', {
      get() {
        return player.currentTime === player.duration && player.duration > 0;
      },
    });

    // loop
    let { loop } = player.config;
    Object.defineProperty(player.media, 'loop', {
      get() {
        return loop;
      },
      set(input) {
        loop = is.boolean(input) ? input : player.config.loop.active;
        player.config.loop.active = loop;
      },
    });

    // quality
    Object.defineProperty(player.media, 'quality', {
      get() {
        return player.embed.currentQuality || null;
      },
      set(input) {
        if (input) {
          const hdMap = { 360: 1, 480: 2, 720: 3, 1080: 4 };
          const hd = hdMap[input];
          if (hd) {
            sendCommand(player, { method: 'setQuality', params: [hd] });
          }
        }
      },
    });

    // Get title
    if (oid && videoId) {
      vk.getTitle.call(player, oid, videoId);
    }

    // Rebuild UI
    if (config.customControls) {
      setTimeout(() => ui.build.call(player), 0);
    }
  },

  handleMessage(data) {
    const player = this;
    let eventType = '';
    let eventData = {};

    if (is.string(data)) {
      eventType = data.includes(':') ? data : `vk_video:${data}`;
    }
    else if (is.object(data)) {
      if (data.event) {
        eventType = `vk_video:${data.event}`;
        eventData = data;
      }
      else if (data.type) {
        eventType = `vk_video:${data.type}`;
        eventData = data;
      }
      else {
        if (player.config.debug) {
          player.debug.log('VK Video unknown object event:', data);
        }
        return;
      }
    }
    else {
      return;
    }

    switch (eventType) {
      case 'vk_video:inited':
        player.debug.log('VK Video player inited');
        player.embed.state = 'inited';
        break;

      case 'vk_video:started':
      case 'vk_video:resumed':
        assurePlaybackState.call(player, true);
        triggerEvent.call(player, player.media, 'playing');
        player.embed.state = 'playing';
        break;

      case 'vk_video:paused':
        assurePlaybackState.call(player, false);
        player.embed.state = 'paused';
        break;

      case 'vk_video:ended':
        player.media.paused = true;
        triggerEvent.call(player, player.media, 'ended');
        player.embed.state = 'ended';
        break;

      case 'vk_video:timeupdate':
        if (is.number(eventData.time)) {
          player.embed.currentTime = eventData.time;
          if (is.number(eventData.duration) && player.media.duration !== eventData.duration) {
            player.media.duration = eventData.duration;
            triggerEvent.call(player, player.media, 'durationchange');
          }
          triggerEvent.call(player, player.media, 'timeupdate');
        }
        break;

      case 'vk_video:volumechange':
        if (is.number(eventData.volume)) {
          player.media.volume = eventData.volume;
        }
        if (is.boolean(eventData.mute)) {
          player.media.muted = eventData.mute;
        }
        triggerEvent.call(player, player.media, 'volumechange');
        break;

      case 'vk_video:qualitychange':
        if (eventData.quality) {
          const hdMap = { 1: 360, 2: 480, 3: 720, 4: 1080 };
          player.embed.currentQuality = hdMap[eventData.quality] || null;
          triggerEvent.call(player, player.media, 'qualitychange', false, { quality: player.embed.currentQuality });
        }
        break;

      case 'vk_video:error':
        player.media.error = {
          code: eventData.code || 1,
          message: eventData.message || 'VK Video playback error',
        };
        triggerEvent.call(player, player.media, 'error');
        player.embed.state = 'error';
        break;

      case 'vk_video:adStarted':
        triggerEvent.call(player, player.media, 'adsstarted');
        break;

      case 'vk_video:adCompleted':
        triggerEvent.call(player, player.media, 'adscompleted');
        break;

      default:
        if (player.config.debug) {
          player.debug.log('VK Video unknown event:', eventType, eventData);
        }
        break;
    }
  },

  destroy() {
    destroy.call(this);
  },
};

export default vk;
