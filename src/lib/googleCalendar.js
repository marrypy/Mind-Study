/**
 * Google Calendar integration: load GSI, get OAuth token, fetch primary calendar
 * events for the current week, and format as a string for the study plan context.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      if (typeof window.google !== 'undefined' && window.google.accounts) {
        resolve();
        return;
      }
      const check = setInterval(() => {
        if (typeof window.google !== 'undefined' && window.google.accounts) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.head.appendChild(script);
  });
}

/**
 * Ensure Google Identity Services is loaded and return when google.accounts is ready.
 */
export function ensureGoogleLoaded() {
  return loadScript(GSI_SRC).then(() => {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      window.onGoogleLibraryLoad = resolve;
    });
  });
}

/**
 * Request an OAuth2 access token for Calendar (read-only). Opens the Google sign-in flow.
 * @param {string} clientId - OAuth 2.0 Client ID (from Google Cloud Console)
 * @returns {Promise<string>} - Access token
 */
export function requestCalendarAccessToken(clientId) {
  if (!clientId || !clientId.trim()) {
    return Promise.reject(new Error('Google Client ID is not configured.'));
  }
  return ensureGoogleLoaded().then(() => {
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: CALENDAR_SCOPE,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error || 'Access denied'));
            return;
          }
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received'));
          }
        },
      });
      client.requestAccessToken();
    });
  });
}

/**
 * Get start and end of current week (Monday 00:00 to Sunday 23:59:59) in local time, as ISO strings.
 */
function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    timeMin: monday.toISOString(),
    timeMax: sunday.toISOString(),
  };
}

/**
 * Fetch events from the user's primary calendar for the current week.
 * @param {string} accessToken - OAuth2 access token
 * @param {string} [apiKey] - Optional API key for Calendar API (quota)
 * @returns {Promise<Array<{ summary: string, start: string, end: string, day: string }>>}
 */
export function fetchWeekEvents(accessToken, apiKey) {
  const { timeMin, timeMax } = getWeekBounds();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  if (apiKey && apiKey.trim()) {
    params.set('key', apiKey.trim());
  }
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((body) => {
          const msg = body?.error?.message || res.statusText || 'Calendar request failed';
          throw new Error(msg);
        });
      }
      return res.json();
    })
    .then((data) => (data.items || []).filter((e) => e.start && (e.start.dateTime || e.start.date)));
}

/**
 * Format calendar events into the same style as manual "week plans" (e.g. "Mon 9:00–10:00 Meeting").
 * @param {Array<{ summary?: string, start?: { dateTime?: string, date?: string }, end?: { dateTime?: string, date?: string } }>} events
 * @returns {string}
 */
export function formatEventsAsWeekPlans(events) {
  const lines = events.map((event) => {
    const summary = (event.summary || 'Event').trim();
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    if (!start) return summary;
    const startDate = new Date(start);
    const dayName = DAY_NAMES[startDate.getDay()];
    if (event.start?.date && !event.start?.dateTime) {
      return `${dayName} (all day): ${summary}`;
    }
    const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    let timeStr = startTime;
    if (end) {
      const endDate = new Date(end);
      const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeStr = `${startTime}–${endTime}`;
    }
    return `${dayName} ${timeStr}: ${summary}`;
  });
  return lines.join('\n');
}

/**
 * Full flow: request token, fetch events, return formatted string for weekPlans.
 * @param {string} clientId - OAuth 2.0 Client ID
 * @param {string} [apiKey] - Optional Calendar API key
 * @returns {Promise<string>}
 */
export function importWeekFromGoogleCalendar(clientId, apiKey) {
  return requestCalendarAccessToken(clientId).then((token) =>
    fetchWeekEvents(token, apiKey).then(formatEventsAsWeekPlans)
  );
}
