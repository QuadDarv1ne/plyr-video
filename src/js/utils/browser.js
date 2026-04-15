// ==========================================================================
// Browser sniffing
// Unfortunately, due to mixed support, UA sniffing is required
// ==========================================================================

const isIE = Boolean(window.document.documentMode);
const isEdge = /Edge/.test(navigator.userAgent);
const isWebKit = 'WebkitAppearance' in document.documentElement.style && !/Edge/.test(navigator.userAgent);
const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
// navigator.platform may be deprecated but this check is still required
const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const isIos = isIPhone || isIPadOS;

export default {
  isIE,
  isEdge,
  isWebKit,
  isIPhone,
  isIPadOS,
  isIos,
};
