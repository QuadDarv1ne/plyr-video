// ==========================================================================
// Mail.ru Video plugin
// ==========================================================================

import ui from '../ui';
import { createElement, replaceElement, toggleClass } from '../utils/elements';
import { triggerEvent } from '../utils/events';
import is from '../utils/is';
import sendCommand from '../utils/post-message';
import { generateId } from '../utils/strings';
import { setAspectRatio } from '../utils/style';

// Parse Mail.ru Video ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  // Match various Mail.ru Video URL formats
  // https://my.mail.ru/video/embed/1234567890123456789
  // https://api.video.mail.ru/videos/embed/mail/user/_myvideo/123
  // https://my.mail.ru/mail/user/_myvideo/123.html
  const embedRegex = /(?:my\.mail\.ru\/video\/embed\/|api\.video\.mail\.ru\/videos\/embed\/)([^?]+)/i;
  const embedMatch = url.match(embedRegex);
  if (embedMatch) {
    return embedMatch[1];
  }

  // Try the old format: my.mail.ru/mail/user/_myvideo/123.html
  const oldRegex = /my\.mail\.ru\/mail\/([^/]+)\/_myvideo\/(\d+)/i;
  const oldMatch = url.match(oldRegex);
  if (oldMatch) {
    return `mail/${oldMatch[1]}/_myvideo/${oldMatch[2]}`;
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

const mailru = {
  setup() {
    const player = this;

    // Add embed class for responsive
    toggleClass(player.elements.wrapper, player.config.classNames.embed, true);

    // Set speed options from config
    player.options.speed = player.config.speed.options;

    // Set initial ratio
    setAspectRatio.call(player);

    // Setup ready
    mailru.ready.call(player);
  },

  // Get the media title
  getTitle(_videoId) {
    // Mail.ru doesn't have a public metadata API
    // Title should be set manually if needed
  },

  // API Ready
  ready() {
    const player = this;
    const config = player.config.mailru;

    // Get the source URL or ID
    let source = player.media.getAttribute('src');

    // Get from <div> if needed
    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    // Parse and validate video ID
    const videoId = parseId(source);
    if (is.empty(videoId)) {
      player.debug.error('Mail.ru Video: No valid video ID found');
      return;
    }

    const id = generateId(player.provider);

    // Replace the <iframe> with a managed <iframe>
    const iframe = createElement('iframe');
    iframe.setAttribute('id', id);
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer');

    // Build Mail.ru Video embed URL
    // Use api.video.mail.ru for the embed
    let embedUrl;
    if (videoId.includes('mail/') || videoId.includes('bk/') || videoId.includes('inbox/') || videoId.includes('list.ru/')) {
      // Full path format
      embedUrl = `https://api.video.mail.ru/videos/embed/${videoId}`;
    }
    else {
      // Numeric ID format
      embedUrl = `https://my.mail.ru/video/embed/${videoId}`;
    }

    const params = [];

    // Add optional parameters
    if (config.autoplay) {
      params.push('autoplay=1');
    }

    // Always set wmode=opaque for proper overlay handling
    params.push('wmode=opaque');

    iframe.setAttribute('src', `${embedUrl}?${params.join('&')}`);

    // Create wrapper for poster
    const wrapper = createElement('div', {
      className: player.config.classNames.embedContainer,
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
    // Note: Mail.ru doesn't document a postMessage API, so we listen but don't expect events
    player.embed.messageHandler = (event) => {
      // Validate origin
      const allowedOrigins = ['https://my.mail.ru', 'https://api.video.mail.ru', 'https://video.mail.ru'];
      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      let msg;
      try {
        msg = JSON.parse(event.data);
      }
      catch {
        // Mail.ru might send string events
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

    // Create a faux HTML5 API using standard controls
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
        sendCommand(player, 'seek', { time });
      },
    });

    // Playback speed - not supported by Mail.ru
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
        sendCommand(player, 'setVolume', { volume: input });
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
        sendCommand(player, toggle ? 'mute' : 'unmute');
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // Source
    Object.defineProperty(player.media, 'currentSrc', {
      get() {
        return embedUrl;
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

    // Quality - not exposed via API
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

  // Handle string events from Mail.ru (undocumented)
  handleStringEvent(data) {
    const player = this;

    // Use word-boundary regex to avoid false positives (e.g. "play" matching "display")
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

  // Handle postMessage events from Mail.ru
  handleMessage(msg) {
    const player = this;
    const { type, data } = msg;

    switch (type) {
      case 'ready':
      case 'player:ready':
        // Player is ready
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
          code: data && data.code ? data.code : 1,
          message: (data && data.message) || 'Mail.ru Video playback error',
        };
        triggerEvent.call(player, player.media, 'error');
        player.embed.state = 'error';
        break;

      default:
        // Debug unknown events
        if (player.config.debug) {
          player.debug.log('Mail.ru Video unknown event:', type, data);
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

export default mailru;
