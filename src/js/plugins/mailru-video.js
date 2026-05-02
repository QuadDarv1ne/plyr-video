// ==========================================================================
// Mail.ru Video plugin
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
  isOriginAllowed,
} from './base-embed';

// Parse Mail.ru Video ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  const embedRegex = /(?:my\.mail\.ru\/video\/embed\/|api\.video\.mail\.ru\/videos\/embed\/)([^?]+)/i;
  const embedMatch = url.match(embedRegex);

  if (embedMatch) {
    return embedMatch[1];
  }

  const oldRegex = /my\.mail\.ru\/mail\/([^/]+)\/_myvideo\/(\d+)/i;
  const oldMatch = url.match(oldRegex);

  if (oldMatch) {
    return `mail/${oldMatch[1]}/_myvideo/${oldMatch[2]}`;
  }

  return url;
}

const mailru = {
  setup() {
    baseSetup.call(this, mailru);
  },

  getTitle() {
    // Mail.ru doesn't have a public API for video metadata
    // Title is fetched from the embed page as fallback
    const player = this;
    if (player.config.debug) {
      player.debug.log('Mail.ru Video: getTitle not implemented - API unavailable');
    }
  },

  ready() {
    const player = this;
    const config = player.config.mailru;
    let source = player.media.getAttribute('src');

    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    const videoId = parseId(source);

    if (is.empty(videoId)) {
      player.debug.error('Mail.ru Video: No valid video ID found');
      return;
    }

    const id = generateId(player.provider);
    let embedUrl;

    if (videoId.includes('mail/') || videoId.includes('bk/') || videoId.includes('inbox/') || videoId.includes('list.ru/')) {
      embedUrl = `https://api.video.mail.ru/videos/embed/${videoId}`;
    }
    else {
      embedUrl = `https://my.mail.ru/video/embed/${videoId}`;
    }

    const params = [];

    if (config.autoplay) {
      params.push('autoplay=1');
    }

    params.push('wmode=opaque');

    const iframe = createElement('iframe');
    iframe.setAttribute('id', id);
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer');
    iframe.setAttribute('src', `${embedUrl}?${params.join('&')}`);

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
          player.debug.warn('Mail.ru Video: Player did not initialize within 15s');
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
      if (!isOriginAllowed(event.origin, ['https://my.mail.ru', 'https://api.video.mail.ru', 'https://video.mail.ru'])) {
        return;
      }

      // Clear init timeout on first message
      if (player.embed.initTimeout) {
        clearTimeout(player.embed.initTimeout);
        player.embed.initTimeout = null;
      }

      let msg;

      try {
        msg = JSON.parse(event.data);
      }
      catch {
        if (is.string(event.data)) {
          try {
            mailru.handleStringEvent.call(player, event.data);
          }
          catch (err) {
            player.debug.error('Mail.ru Video: Error handling string event:', err);
          }
        }

        return;
      }

      if (!msg || !msg.type) {
        return;
      }

      try {
        mailru.handleMessage.call(player, msg);
      }
      catch (err) {
        player.debug.error('Mail.ru Video: Error handling message:', err);
      }
    };

    window.addEventListener('message', player.embed.messageHandler);

    // Media controls
    player.media.play = () => {
      assurePlaybackState.call(player, true);
      sendCommand(player, 'play');
    };

    player.media.pause = () => {
      assurePlaybackState.call(player, false);
      sendCommand(player, 'pause');
    };

    player.media.stop = () => {
      player.pause();
      player.currentTime = 0;
      sendCommand(player, 'stop');
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
        sendCommand(player, 'seek', { time });
      },
    });

    // playbackRate - not supported
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
        sendCommand(player, 'setVolume', { volume: input });
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
        sendCommand(player, toggle ? 'mute' : 'unmute');
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // currentSrc
    Object.defineProperty(player.media, 'currentSrc', {
      get() {
        return embedUrl;
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

    // quality - not exposed via API
    Object.defineProperty(player.media, 'quality', {
      get() {
        return player.embed.currentQuality || null;
      },
      set(input) {
        if (input) {
          player.embed.currentQuality = input;
          triggerEvent.call(player, player.media, 'qualitychange', false, { quality: input });
        }
      },
    });

    // Rebuild UI
    if (config.customControls) {
      setTimeout(() => ui.build.call(player), 0);
    }
  },

  handleStringEvent(data) {
    const player = this;

    if (/\b(?:play|started)\b/i.test(data)) {
      assurePlaybackState.call(player, true);
      triggerEvent.call(player, player.media, 'playing');
    }
    else if (/\b(?:pause|paused)\b/i.test(data)) {
      assurePlaybackState.call(player, false);
    }
    else if (/\b(?:end|complete|finished)\b/i.test(data)) {
      player.media.paused = true;
      triggerEvent.call(player, player.media, 'ended');
    }
  },

  handleMessage(msg) {
    const player = this;
    const { type, data } = msg;

    switch (type) {
      case 'ready':
      case 'player:ready':
        player.debug.log('Mail.ru Video player ready');
        player.embed.state = 'ready';
        triggerEvent.call(player, player.media, 'timeupdate');
        break;

      case 'playing':
      case 'player:playing':
        assurePlaybackState.call(player, true);
        triggerEvent.call(player, player.media, 'playing');
        player.embed.state = 'playing';
        break;

      case 'pause':
      case 'player:pause':
        assurePlaybackState.call(player, false);
        player.embed.state = 'paused';
        break;

      case 'ended':
      case 'player:ended':
      case 'complete':
        player.media.paused = true;
        triggerEvent.call(player, player.media, 'ended');
        player.embed.state = 'ended';
        break;

      case 'timeupdate':
      case 'player:timeupdate':
        if (data && is.number(data.time)) {
          player.embed.currentTime = data.time;

          if (is.number(data.duration) && player.media.duration !== data.duration) {
            player.media.duration = data.duration;
            triggerEvent.call(player, player.media, 'durationchange');
          }

          triggerEvent.call(player, player.media, 'timeupdate');
        }

        break;

      case 'durationchange':
      case 'player:durationChange':
        if (data && is.number(data.duration)) {
          player.media.duration = data.duration;
          triggerEvent.call(player, player.media, 'durationchange');
        }

        break;

      case 'volumechange':
      case 'player:volumeChange':
        if (data && is.number(data.volume)) {
          player.media.volume = data.volume;
        }

        triggerEvent.call(player, player.media, 'volumechange');
        break;

      case 'error':
      case 'player:error':
        player.media.error = {
          code: (data && data.code) ? data.code : 1,
          message: (data && data.message) || 'Mail.ru Video playback error',
        };

        triggerEvent.call(player, player.media, 'error');
        player.embed.state = 'error';
        break;

      default:
        if (player.config.debug) {
          player.debug.log('Mail.ru Video unknown event:', type, data);
        }

        break;
    }
  },

  destroy() {
    destroy.call(this);
  },
};

export default mailru;
