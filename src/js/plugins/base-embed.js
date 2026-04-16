// ==========================================================================
// Base embed provider — shared boilerplate for postMessage-based providers
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

// Set playback state and trigger change (only on actual change)
export function assurePlaybackState(play) {
  if (play && !this.embed.hasPlayed) {
    this.embed.hasPlayed = true;
  }

  if (this.media.paused === play) {
    this.media.paused = !play;
    triggerEvent.call(this, this.media, play ? 'play' : 'pause');
  }
}

// Validate origin against an allowlist
export function isOriginAllowed(origin, allowed) {
  return Array.isArray(allowed) && allowed.includes(origin);
}

// Shared setup: add embed class, set speed options, set aspect ratio
export function baseSetup(provider) {
  const player = this;
  toggleClass(player.elements.wrapper, player.config.classNames.embed, true);
  player.options.speed = player.config.speed.options;
  setAspectRatio.call(player);
  provider.ready.call(player);
}

// Create iframe and initialize embed context
export function createEmbed(provider, options) {
  const {
    player,
    videoId,
    embedUrl,
    params = [],
    allowedOrigins,
    handleMessage,
    initTimeoutMs = 15000,
    label = 'Embed',
  } = options;

  const config = player.config[provider] || {};
  const id = generateId(player.provider);

  const iframe = createElement('iframe');
  iframe.setAttribute('id', id);
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute(
    'allow',
    'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer',
  );
  iframe.setAttribute('src', `${embedUrl}?${params.join('&')}`);

  const wrapper = createElement('div', {
    className: player.config.classNames.embedContainer,
    'data-poster': player.poster,
  });
  wrapper.appendChild(iframe);

  player.media = replaceElement(wrapper, player.media);

  player.embed = {
    iframe,
    hasPlayed: false,
    state: 'paused',
    initTimeout: setTimeout(() => {
      if (!player.embed.hasReceivedMessage) {
        player.debug.warn(`${label}: Player did not initialize within ${initTimeoutMs / 1000}s`);
      }
    }, initTimeoutMs),
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
    if (!isOriginAllowed(event.origin, allowedOrigins)) {
      return;
    }

    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!msg || !msg.type) {
      return;
    }

    if (!player.embed.hasReceivedMessage) {
      player.embed.hasReceivedMessage = true;
      clearTimeout(player.embed.initTimeout);
    }

    try {
      handleMessage.call(player, msg);
    } catch (err) {
      player.debug.error(`${label}: Error handling message:`, err);
    }
  };

  window.addEventListener('message', player.embed.messageHandler);

  return { iframe, videoId, config };
}

// Define shared media property helpers
export function defineMediaProperties(player, videoId, embedUrl) {
  // currentTime
  Object.defineProperty(player.media, 'currentTime', {
    get() {
      return player.embed.currentTime || 0;
    },
    set(time) {
      const { media } = player;
      media.seeking = true;
      triggerEvent.call(player, media, 'seeking');
      sendCommand(player, 'player:setCurrentTime', { time });
    },
  });

  // playbackRate
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

  // volume
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

  // muted
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

  // currentSrc
  Object.defineProperty(player.media, 'currentSrc', {
    get() {
      return `${embedUrl}${videoId}/`;
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
        sendCommand(player, 'player:changeQuality', { quality: String(input) });
      }
    },
  });
}

// Shared media controls
export function defineMediaControls(player) {
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
}

// Shared destroy
export function destroy() {
  const player = this;
  if (player.embed) {
    clearTimeout(player.embed.initTimeout);
    clearTimeout(player.embed.optionsTimeout);
    clearTimeout(player.embed.captionTimeout);
    if (player.embed.messageHandler) {
      window.removeEventListener('message', player.embed.messageHandler);
    }
  }
}

// Shared title fetch with timeout and proper error handling
export function fetchTitle(url, label, titleKey = 'title') {
  fetch(url, 'json', false, 8000)
    .then((data) => {
      if (is.object(data) && data[titleKey]) {
        this.config.title = data[titleKey];
        ui.setTitle.call(this);
      }
    })
    .catch((err) => {
      if (this.config.debug) {
        this.debug.warn(`${label}: Failed to fetch title:`, err.message);
      }
    });
}

// Shared poster fetch with timeout
export function fetchPoster(url, player) {
  fetch(url, 'json', false, 8000)
    .then((data) => {
      if (data && data.thumbnail_url) {
        ui.setPoster.call(player, data.thumbnail_url).catch(() => {});
      }
    })
    .catch(() => {});
}

// Shared message handler for player:changeState
export function handleChangeState(player, data) {
  if (!data || !data.state) {
    return;
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
}

// Shared message handler for player:currentTime
export function handleCurrentTime(player, data) {
  if (data && is.number(data.time)) {
    player.embed.currentTime = data.time;
    if (is.number(data.duration) && player.media.duration !== data.duration) {
      player.media.duration = data.duration;
      triggerEvent.call(player, player.media, 'durationchange');
    }
    triggerEvent.call(player, player.media, 'timeupdate');
  }
}

// Shared message handler for player:captionList
export function handleCaptionList(player, data) {
  if (data && Array.isArray(data.list)) {
    player.embed.captionTracks = data.list.map((track, index) => ({
      id: track.id || index,
      language: track.language || track.srclang || 'unknown',
      label: track.label || track.name || track.language || 'Unknown',
      kind: track.kind || 'captions',
    }));

    player.media.textTracks = player.embed.captionTracks;
    player.debug.log('Available caption tracks:', player.embed.captionTracks.length);

    if (player.embed.captionTracks.length > 0) {
      captions.setup.call(player);
    }
  }
}

// Shared message handler for player:cueChange
export function handleCueChange(player, data) {
  if (data && data.cues) {
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
}

// Shared message handler for player:playOptionsLoaded
export function handlePlayOptionsLoaded(player, data) {
  if (data) {
    if (is.number(data.duration) && !player.media.duration) {
      player.media.duration = data.duration;
      triggerEvent.call(player, player.media, 'durationchange');
    }
    if (data.title && !player.config.title) {
      player.config.title = data.title;
      ui.setTitle.call(player);
    }
  }
}

// Shared quality list handler
export function handleQualityList(player, data) {
  if (data && Array.isArray(data.list)) {
    player.embed.availableQualities = data.list.map((q) => Number(q));
    player.debug.log('Available qualities:', player.embed.availableQualities);
  }
}

// Shared current quality handler
export function handleCurrentQuality(player, data) {
  if (data) {
    const quality = Number(data.quality || data);
    if (!Number.isNaN(quality)) {
      player.embed.currentQuality = quality;
      triggerEvent.call(player, player.media, 'qualitychange', false, {
        quality,
      });
    }
  }
}

// Shared default message handler for Rutube/Yandex-like providers
export function handleDefaultMessage(msg, label) {
  const player = this;
  const { type, data } = msg;

  switch (type) {
    case 'player:ready':
      player.debug.log(`${label} player ready`);
      triggerEvent.call(player, player.media, 'timeupdate');
      break;

    case 'player:changeState':
      handleChangeState(player, data);
      break;

    case 'player:durationChange':
      if (data && is.number(data.duration)) {
        player.media.duration = data.duration;
        triggerEvent.call(player, player.media, 'durationchange');
      }
      break;

    case 'player:currentTime':
      handleCurrentTime(player, data);
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
      handleQualityList(player, data);
      break;

    case 'player:currentQuality':
      handleCurrentQuality(player, data);
      break;

    case 'player:playOptionsLoaded':
      handlePlayOptionsLoaded(player, data);
      break;

    case 'player:captionList':
      handleCaptionList(player, data);
      break;

    case 'player:cueChange':
      handleCueChange(player, data);
      break;

    case 'player:captionChange':
      player.debug.log(`${label} caption track changed`);
      break;

    case 'player:error':
      player.media.error = {
        code: (data && data.type) || 1,
        message: (data && data.message) || `${label} playback error`,
      };
      triggerEvent.call(player, player.media, 'error');
      break;

    case 'player:playComplete':
      player.media.paused = true;
      triggerEvent.call(player, player.media, 'ended');
      break;

    default:
      if (player.config.debug) {
        player.debug.log(`${label} unknown event:`, type, data);
      }
      break;
  }
}
