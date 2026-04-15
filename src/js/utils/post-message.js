// ==========================================================================
// postMessage helper for embedded players
// ==========================================================================

/**
 * Send a postMessage command to an embedded player iframe
 * @param {object} player - The Plyr player instance
 * @param {string|object} typeOrParams - The command type or full params object
 * @param {object} data - Additional data (only used when typeOrParams is a string)
 * @param {string} targetOrigin - Target origin for postMessage (default: '*')
 * @returns {Promise<boolean>} - Whether the message was sent successfully
 */
export function sendCommand(player, typeOrParams, data = {}, targetOrigin = '*') {
  if (!player.embed || !player.embed.iframe) {
    return Promise.resolve(false);
  }

  const { iframe } = player.embed;

  // Check if iframe is still in DOM and accessible
  if (!iframe.contentWindow) {
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

  try {
    iframe.contentWindow.postMessage(message, targetOrigin);
    return Promise.resolve(true);
  }
  catch {
    // iframe may have been removed or cross-origin restriction
    return Promise.resolve(false);
  }
}

export default sendCommand;
