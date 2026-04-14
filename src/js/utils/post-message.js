// ==========================================================================
// postMessage helper for embedded players
// ==========================================================================

/**
 * Send a postMessage command to an embedded player iframe
 * @param {object} player - The Plyr player instance
 * @param {string|object} typeOrParams - The command type or full params object
 * @param {object} data - Additional data (only used when typeOrParams is a string)
 * @returns {Promise<boolean>}
 */
export function sendCommand(player, typeOrParams, data = {}) {
  if (!player.embed || !player.embed.iframe) {
    return Promise.resolve(false);
  }

  let message;
  if (typeof typeOrParams === 'string') {
    message = JSON.stringify({ type: typeOrParams, data });
  }
  else if (typeof typeOrParams === 'object') {
    message = JSON.stringify(typeOrParams);
  }
  else {
    return Promise.resolve(false);
  }

  player.embed.iframe.contentWindow.postMessage(message, '*');
  return Promise.resolve(true);
}

export default sendCommand;
