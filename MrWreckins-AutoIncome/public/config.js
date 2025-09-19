// Runtime-configurable endpoints for split hosting
// Set these to your backend URL when hosting the frontend separately (e.g., IONOS Web Hosting Plus)
// Example:
//   window.API_BASE_URL = 'https://api.yourdomain.com';
//   window.WS_BASE_URL = 'wss://api.yourdomain.com';

window.API_BASE_URL = window.API_BASE_URL || '';
window.WS_BASE_URL = window.WS_BASE_URL || '';
