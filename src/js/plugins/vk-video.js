// ==========================================================================
// VK Video plugin
// ==========================================================================

import ui from '../ui';
import { createElement, replaceElement, toggleClass } from '../utils/elements';
import { triggerEvent } from '../utils/events';
import fetch from '../utils/fetch';
import is from '../utils/is';
import sendCommand from '../utils/post-message';
import { generateId } from '../utils/strings';
import { setAspectRatio } from '../utils/style';

// Parse VK Video ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  // Match various VK Video URL formats
  // https://vk.com/video-123456_789012345
  // https://vk.ru/video_ext.php?oid=-123456&id=789012345
  // oid=-123456&id=789012345&hash=abc123
  const regex = /(?:vk\.com|vk\.ru).*video.*[?&]oid=([^&]+).*?[?&]id=([^&]+)/i;
  const match = url.match(regex);
  if (match && match[1] && match[2]) {
    return `oid=${match[1]}&id=${match[2]}`;
  }

  // Try simple video ID format
  const simpleMatch = url.match(/video(-?\d+)_(\d+)/i);
  if (simpleMatch) {
    return `oid=${simpleMatch[1]}&id=${simpleMatch[2]}`;
  }

  return url;
}

// Set playback state and trigger change (only on actual change)
function assurePlaybackState(play) {
  if (play && !this.embed.hasPlayed) {
    this.embed.hasPlayed = true;
  }
  if (this.media.paused === play) {
    this.media.paused = !play;
    triggerEvent.call(this, this.media, play ? 'play' : 'pause');
  }
}

const vk = {
  setup() {
    const player = this;

    // Add embed class for responsive
    toggleClass(player.elements.wrapper, player.config.classNames.embed, true);

    // Set speed options from config
    player.options.speed = player.config.speed.options;

    // Set initial ratio
    setAspectRatio.call(player);

    // Setup ready
    vk.ready.call(player);
  },

  // Get the media title
  getTitle(oid, videoId) {
    // VK doesn't have a public metadata API like YouTube/Vimeo
    // We can try to fetch from VK oEmbed or video page
    const url = `https://vk.ru/al_video.php?act=show&al=1&video=${oid}_${videoId}`;

    fetch(url)
      .then((data) => {
        if (is.object(data) && data.title) {
          this.config.title = data.title;
          ui.setTitle.call(this);
        }
      })
      .catch(() => {
        // Silently fail - title is not critical
      });
  },

  // API Ready
  ready() {
    const player = this;
    const config = player.config.vk;

    // Get the source URL or ID
    let source = player.media.getAttribute('src');

    // Get from <div> if needed
    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    const videoParams = parseId(source);
    const id = generateId(player.provider);

    // Extract oid and videoId for title fetching
    const oidMatch = videoParams.match(/oid=([^&]+)/);
    const idMatch = videoParams.match(/id=([^&]+)/);
    const oid = oidMatch ? oidMatch[1] : '';
    const videoId = idMatch ? idMatch[1] : '';

    // Replace the <iframe> with a managed <iframe>
    const iframe = createElement('iframe');
    iframe.setAttribute('id', id);
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer');

    // Build VK Video embed URL with js_api=1 for API control
    const embedUrl = `https://vk.ru/video_ext.php?${videoParams}&js_api=1`;
    const params = [];

    // Add optional parameters
    if (config.autoplay) {
      params.push('autoplay=1');
    }
    if (config.hd) {
      params.push(`hd=${config.hd}`);
    }
    if (config.startTime) {
      params.push(`t=${config.startTime}`);
    }

    const finalUrl = params.length ? `${embedUrl}&${params.join('&')}` : embedUrl;
    iframe.setAttribute('src', finalUrl);

    // Create wrapper for poster
    const wrapper = createElement('div', {
      class: player.config.classNames.embedContainer,
      'data-poster': player.poster,
    });
    wrapper.appendChild(iframe);

    // Replace media element
    player.media = replaceElement(wrapper, player.media);

    // Store iframe reference
    player.embed = {
      iframe,
      hasPlayed: false,
      state: 'unstarted',
      currentTime: 0,
      duration: 0,
    };

    // Initialize media properties
    player.media.paused = true;
    player.media.currentTime = 0;
    player.media.duration = 0;
    player.media.seeking = false;
    player.media.buffered = 0;
    player.media.lastBuffered = null;

    // Setup postMessage listener
    player.embed.messageHandler = (event) => {
      // Validate origin
      if (!event.origin.includes('vk.com') && !event.origin.includes('vk.ru') && !event.origin.includes('userapi.com')) {
        return;
      }

      const data = event.data;
      if (!data) {
        return;
      }

      vk.handleMessage.call(player, data);
    };

    window.addEventListener('message', player.embed.messageHandler);

    // Create a faux HTML5 API using the VK Video API
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

    // Seeking
    Object.defineProperty(player.media, 'currentTime', {
      get() {
        return player.embed.currentTime || 0;
      },
      set(time) {
        const { media, paused } = player;

        // Set seeking state and trigger event
        media.seeking = true;
        triggerEvent.call(player, media, 'seeking');

        // Send seek command
        sendCommand(player, { method: 'seek', params: [time] });
      },
    });

    // Playback speed - VK doesn't support speed control via API
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

    // Volume
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

    // Muted
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

    // Source
    Object.defineProperty(player.media, 'currentSrc', {
      get() {
        return `https://vk.ru/video_ext.php?${videoParams}`;
      },
    });

    // Ended
    Object.defineProperty(player.media, 'ended', {
      get() {
        return player.currentTime === player.duration && player.duration > 0;
      },
    });

    // Loop
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

    // Quality
    Object.defineProperty(player.media, 'quality', {
      get() {
        return player.embed.currentQuality || null;
      },
      set(input) {
        if (input) {
          // VK uses hd parameter: 1=360p, 2=480p, 3=720p, 4=1080p
          const hdMap = { 360: 1, 480: 2, 720: 3, 1080: 4 };
          const hd = hdMap[input];
          if (hd) {
            sendCommand(player, {
              method: 'setQuality',
              params: [hd],
            });
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

  // Handle postMessage events from VK Video
  handleMessage(data) {
    const player = this;

    // VK Video sends events as strings or objects
    // Handle both formats
    let eventType = '';
    let eventData = {};

    if (is.string(data)) {
      // String format could be: "started", "paused", "ended", etc.
      // Normalize: if it contains a colon, use as-is; otherwise prefix
      if (data.includes(':')) {
        eventType = data;
      }
      else {
        eventType = `vk_video:${data}`;
      }
    }
    else if (is.object(data)) {
      // Object format: { event: 'started', duration: 0, time: 0 }
      if (data.event) {
        eventType = `vk_video:${data.event}`;
        eventData = data;
      }
      else if (data.type) {
        // Alternative format: { type: 'timeupdate', time: 10, duration: 60 }
        eventType = `vk_video:${data.type}`;
        eventData = data;
      }
      else {
        // Unknown object format
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
        // Player API is initialized
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

          // Also update duration if provided
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
          // VK uses hd values: 1=360p, 2=480p, 3=720p, 4=1080p
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
        // Debug unknown events
        if (player.config.debug) {
          player.debug.log('VK Video unknown event:', eventType, eventData);
        }
        break;
    }
  },

  // Cleanup
  destroy() {
    const player = this;

    if (player.embed && player.embed.messageHandler) {
      window.removeEventListener('message', player.embed.messageHandler);
    }
  },
};

export default vk;
