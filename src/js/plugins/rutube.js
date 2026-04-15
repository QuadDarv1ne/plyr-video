// ==========================================================================
// Rutube plugin
// ==========================================================================

import captions from '../captions';
import ui from '../ui';
import { createElement, replaceElement, toggleClass } from '../utils/elements';
import { triggerEvent } from '../utils/events';
import fetch from '../utils/fetch';
import is from '../utils/is';
import sendCommand from '../utils/post-message';
import { generateId } from '../utils/strings';
import { setAspectRatio } from '../utils/style';

// Parse Rutube ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  const regex = /rutube\.ru\/(?:play\/embed\/|video\/|embed\/)([a-f0-9]+)\/?/i;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
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

const rutube = {
  setup() {
    const player = this;

    // Add embed class for responsive
    toggleClass(player.elements.wrapper, player.config.classNames.embed, true);

    // Set speed options from config
    player.options.speed = player.config.speed.options;

    // Set initial ratio
    setAspectRatio.call(player);

    // Setup ready
    rutube.ready.call(player);
  },

  // Get the media title
  getTitle(videoId) {
    // Rutube doesn't have a public oEmbed API like YouTube/Vimeo
    // We try to fetch metadata from rutube.ru/api/video/{videoId}
    const url = `https://rutube.ru/api/video/${videoId}/`;

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
    const config = player.config.rutube;

    // Get the source URL or ID
    let source = player.media.getAttribute('src');

    // Get from <div> if needed
    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    // Parse and validate video ID
    const videoId = parseId(source);
    if (is.empty(videoId)) {
      player.debug.error('Rutube: No valid video ID found');
      return;
    }

    const id = generateId(player.provider);

    // Replace the <iframe> with a managed <iframe>
    const iframe = createElement('iframe');
    iframe.setAttribute('id', id);
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer');

    // Build Rutube embed URL
    const embedUrl = `https://rutube.ru/play/embed/${videoId}/`;
    const params = [];

    // Add optional parameters
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

    iframe.setAttribute('src', `${embedUrl}?${params.join('&')}`);

    // Create wrapper for poster
    const wrapper = createElement('div', {
      className: player.config.classNames.embedContainer,
      'data-poster': player.poster,
    });
    wrapper.appendChild(iframe);

    // Replace media element
    player.media = replaceElement(wrapper, player.media);

    // Set poster if custom controls
    if (config.customControls && player.poster) {
      // Try to load poster from Rutube
      const posterUrl = `https://rutube.ru/api/video/${videoId}/`;
      fetch(posterUrl)
        .then((data) => {
          if (data && data.thumbnail_url) {
            ui.setPoster.call(player, data.thumbnail_url).catch(() => {});
          }
        })
        .catch(() => {});
    }

    // Store iframe reference
    player.embed = {
      iframe,
      hasPlayed: false,
      state: 'paused',
      initTimeout: setTimeout(() => {
        if (!player.embed.hasReceivedMessage) {
          player.debug.warn('Rutube: Player did not initialize within 15s');
        }
      }, 15000),
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
      const allowedOrigins = ['https://rutube.ru', 'https://www.rutube.ru'];
      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      let msg;
      try {
        msg = JSON.parse(event.data);
      }
      catch {
        return;
      }

      if (!msg || !msg.type) {
        return;
      }

      // Clear init timeout on first message
      if (!player.embed.hasReceivedMessage) {
        player.embed.hasReceivedMessage = true;
        clearTimeout(player.embed.initTimeout);
      }

      try {
        rutube.handleMessage.call(player, msg);
      }
      catch (err) {
        player.debug.error('Rutube: Error handling message:', err);
      }
    };

    window.addEventListener('message', player.embed.messageHandler);

    // Create a faux HTML5 API using the Rutube API
    player.media.play = () => {
      assurePlaybackState.call(player, true);
      sendCommand(player, 'player:play');
    };

    player.media.pause = () => {
      assurePlaybackState.call(player, false);
      sendCommand(player, 'player:pause');
    };

    player.media.stop = () => {
      player.pause();
      player.currentTime = 0;
      sendCommand(player, 'player:stop');
    };

    // Seeking
    Object.defineProperty(player.media, 'currentTime', {
      get() {
        return player.embed.currentTime || 0;
      },
      set(time) {
        const { media } = player;

        // Set seeking state and trigger event
        media.seeking = true;
        triggerEvent.call(player, media, 'seeking');

        // Send seek command
        sendCommand(player, 'player:setCurrentTime', { time });
      },
    });

    // Playback speed
    let speed = player.config.speed.selected;
    Object.defineProperty(player.media, 'playbackRate', {
      get() {
        return speed;
      },
      set(input) {
        sendCommand(player, 'player:setPlaybackSpeed', { speed: input });
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
        sendCommand(player, 'player:setVolume', { volume: input });
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
        sendCommand(player, toggle ? 'player:mute' : 'player:unMute');
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // Source
    Object.defineProperty(player.media, 'currentSrc', {
      get() {
        return `https://rutube.ru/play/embed/${videoId}/`;
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
          sendCommand(player, 'player:changeQuality', { quality: String(input) });
        }
      },
    });

    // Get title
    rutube.getTitle.call(player, videoId);

    // Request available qualities
    setTimeout(() => {
      sendCommand(player, 'frame:checkOptions');
    }, 1000);

    // Request available caption tracks
    setTimeout(() => {
      sendCommand(player, 'player:getCaptions');
    }, 1500);

    // Rebuild UI
    if (config.customControls) {
      setTimeout(() => ui.build.call(player), 0);
    }
  },

  // Handle postMessage events from Rutube
  handleMessage(msg) {
    const player = this;
    const { type, data } = msg;

    switch (type) {
      case 'player:ready':
        // Player is ready
        player.debug.log('Rutube player ready');
        triggerEvent.call(player, player.media, 'timeupdate');
        break;

      case 'player:changeState':
        // State changes: playing, pause, seeking, seeked, buffering, completed
        if (!data || !data.state) {
          break;
        }

        switch (data.state) {
          case 'playing':
            assurePlaybackState.call(player, true);
            triggerEvent.call(player, player.media, 'playing');
            break;

          case 'pause':
            assurePlaybackState.call(player, false);
            break;

          case 'seeking':
            player.media.seeking = true;
            triggerEvent.call(player, player.media, 'seeking');
            break;

          case 'seeked':
            player.media.seeking = false;
            triggerEvent.call(player, player.media, 'seeked');
            break;

          case 'buffering':
            triggerEvent.call(player, player.media, 'waiting');
            break;

          case 'completed':
            player.media.paused = true;
            triggerEvent.call(player, player.media, 'ended');
            break;

          default:
            break;
        }
        break;

      case 'player:durationChange':
        if (data && is.number(data.duration)) {
          player.media.duration = data.duration;
          triggerEvent.call(player, player.media, 'durationchange');
        }
        break;

      case 'player:currentTime':
        if (data && is.number(data.time)) {
          player.embed.currentTime = data.time;

          // Also update duration if provided
          if (is.number(data.duration) && player.media.duration !== data.duration) {
            player.media.duration = data.duration;
            triggerEvent.call(player, player.media, 'durationchange');
          }

          triggerEvent.call(player, player.media, 'timeupdate');
        }
        break;

      case 'player:volumeChange':
        if (data && is.number(data.volume)) {
          player.media.volume = data.volume;
          triggerEvent.call(player, player.media, 'volumechange');
        }
        break;

      case 'player:playbackSpeedChanged':
        if (data && is.number(data.speed)) {
          player.media.playbackRate = data.speed;
          triggerEvent.call(player, player.media, 'ratechange');
        }
        break;

      case 'player:qualityList':
        if (data && Array.isArray(data.list)) {
          // Store available qualities
          player.embed.availableQualities = data.list.map(q => Number(q));
          player.debug.log('Available qualities:', player.embed.availableQualities);
        }
        break;

      case 'player:currentQuality':
        if (data) {
          const quality = Number(data.quality || data);
          if (!Number.isNaN(quality)) {
            player.embed.currentQuality = quality;
            triggerEvent.call(player, player.media, 'qualitychange', false, { quality });
          }
        }
        break;

      case 'player:playOptionsLoaded':
        if (data) {
          // Get duration from metadata if not already set
          if (is.number(data.duration) && !player.media.duration) {
            player.media.duration = data.duration;
            triggerEvent.call(player, player.media, 'durationchange');
          }

          // Get title if not already set
          if (data.title && !player.config.title) {
            player.config.title = data.title;
            ui.setTitle.call(player);
          }
        }
        break;

      case 'player:captionList':
        if (data && Array.isArray(data.list)) {
          // Store available caption tracks
          player.embed.captionTracks = data.list.map((track, index) => ({
            id: track.id || index,
            language: track.language || track.srclang || 'unknown',
            label: track.label || track.name || track.language || 'Unknown',
            kind: track.kind || 'captions',
          }));

          // Create faux textTracks array for Plyr captions
          player.media.textTracks = player.embed.captionTracks;

          player.debug.log('Available caption tracks:', player.embed.captionTracks.length);

          // Setup captions with available tracks
          if (player.embed.captionTracks.length > 0) {
            captions.setup.call(player);
          }
        }
        break;

      case 'player:cueChange':
        if (data && data.cues) {
          // Strip HTML from cues and update caption display
          const strippedCues = data.cues.map((cue) => {
            if (is.string(cue)) {
              return cue.replace(/<[^>]*>/g, '');
            }
            if (cue.text) {
              return cue.text.replace(/<[^>]*>/g, '');
            }
            return cue;
          });
          captions.updateCues.call(player, strippedCues);
        }
        break;

      case 'player:captionChange':
        player.debug.log('Rutube caption track changed');
        break;

      case 'player:error':
        player.media.error = {
          code: data && data.type ? data.type : 1,
          message: (data && data.message) || 'Rutube playback error',
        };
        triggerEvent.call(player, player.media, 'error');
        break;

      case 'player:playComplete':
        player.media.paused = true;
        triggerEvent.call(player, player.media, 'ended');
        break;

      default:
        // Debug unknown events
        if (player.config.debug) {
          player.debug.log('Rutube unknown event:', type, data);
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

export default rutube;
