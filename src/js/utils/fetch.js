// ==========================================================================
// Fetch wrapper
// Using XHR to avoid issues with older browsers
// ==========================================================================

export default function fetch(url, responseType = 'text', withCredentials = false, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const request = new XMLHttpRequest();

      // Check for CORS support
      if (!('withCredentials' in request)) {
        reject(new Error('CORS not supported'));
        return;
      }

      // Set to true if needed for CORS
      if (withCredentials) {
        request.withCredentials = true;
      }

      request.addEventListener('load', () => {
        if (request.status >= 400) {
          reject(new Error(`HTTP ${request.status}`));
          return;
        }
        if (responseType === 'text') {
          try {
            resolve(JSON.parse(request.responseText));
          }
          catch {
            resolve(request.responseText);
          }
        }
        else {
          resolve(request.response);
        }
      });

      request.addEventListener('error', () => {
        reject(new Error('Network request failed'));
      });

      request.addEventListener('timeout', () => {
        reject(new Error('Request timed out'));
      });

      request.timeout = timeout;

      request.open('GET', url, true);
      request.responseType = responseType;
      request.send();
    }
    catch (error) {
      reject(error);
    }
  });
}
