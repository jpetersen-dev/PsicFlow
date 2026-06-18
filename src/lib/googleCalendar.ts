import { google } from 'googleapis';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Creates a new OAuth2 client instance using environment credentials.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generates the Google OAuth2 authorization URL.
 * @param state - Opaque state string (profile_id:org_id:hmac)
 */
export function getAuthUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

/**
 * Exchanges an authorization code for OAuth2 tokens.
 */
export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Creates an authenticated Google Calendar v3 client from a stored refresh token.
 * The googleapis library automatically handles access token refresh.
 */
export function getCalendarClient(refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth: client });
}

/**
 * Gets the authenticated user's email.
 * First tries decoding the id_token (no extra API call).
 * Falls back to oauth2.userinfo.get() if id_token is unavailable.
 */
export async function getGoogleEmail(accessToken: string, idToken?: string): Promise<string> {
  // Try to extract email from id_token (JWT payload, no verification needed here)
  if (idToken) {
    try {
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
      if (payload.email) return payload.email;
    } catch {
      // Fall through to API call
    }
  }

  // Fallback: use access_token to query userinfo
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email || '';
}

/**
 * Queries Google Calendar FreeBusy API for the given calendar IDs.
 */
export async function queryFreeBusy(
  refreshToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string
): Promise<{ calendarId: string; busy: { start: string; end: string }[] }[]> {
  const calendarClient = getCalendarClient(refreshToken);

  const response = await calendarClient.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const calendars = response.data.calendars || {};
  return Object.entries(calendars).map(([calendarId, calData]) => ({
    calendarId,
    busy: (calData.busy || []).map((b) => ({
      start: b.start || '',
      end: b.end || '',
    })),
  }));
}

/**
 * Computes available time slots by subtracting busy blocks from a day range.
 * All times in "HH:mm" format. Returns available windows.
 */
export function computeAvailableSlots(
  busyBlocks: { start: string; end: string }[],
  dayStartHour: number,
  dayEndHour: number,
  dateStr: string
): { start: string; end: string; type: 'available' }[] {
  const toMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const toTimeStr = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const dayStart = dayStartHour * 60;
  const dayEnd = dayEndHour * 60;

  // Convert busy blocks to minute ranges within the day, filtering to same date
  const busyMinutes: { start: number; end: number }[] = [];
  for (const block of busyBlocks) {
    const bStart = new Date(block.start);
    const bEnd = new Date(block.end);

    // Extract time-of-day in minutes
    let startMin = bStart.getHours() * 60 + bStart.getMinutes();
    let endMin = bEnd.getHours() * 60 + bEnd.getMinutes();

    // Clamp to day range
    startMin = Math.max(startMin, dayStart);
    endMin = Math.min(endMin, dayEnd);

    if (startMin < endMin) {
      busyMinutes.push({ start: startMin, end: endMin });
    }
  }

  // Sort and merge overlapping blocks
  busyMinutes.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const block of busyMinutes) {
    if (merged.length > 0 && block.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, block.end);
    } else {
      merged.push({ ...block });
    }
  }

  // Compute available windows (gaps between busy blocks)
  const available: { start: string; end: string; type: 'available' }[] = [];
  let cursor = dayStart;

  for (const block of merged) {
    if (cursor < block.start) {
      available.push({ start: toTimeStr(cursor), end: toTimeStr(block.start), type: 'available' });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEnd) {
    available.push({ start: toTimeStr(cursor), end: toTimeStr(dayEnd), type: 'available' });
  }

  return available;
}

/**
 * Creates an HMAC-signed state string for OAuth2 CSRF protection.
 * Uses GOOGLE_CLIENT_SECRET as the signing key.
 */
export function createOAuthState(profileId: string, orgId: string): string {
  const payload = JSON.stringify({
    profileId,
    orgId,
    ts: Date.now(),
  });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const secret = process.env.GOOGLE_CLIENT_SECRET || 'fallback-secret';
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Decodes and validates the HMAC-signed OAuth state string.
 * Returns null if invalid, tampered, or expired (>10 minutes).
 */
export function parseOAuthState(state: string): { profileId: string; orgId: string } | null {
  try {
    const [payloadB64, signature] = state.split('.');
    if (!payloadB64 || !signature) return null;

    // Verify HMAC signature
    const secret = process.env.GOOGLE_CLIENT_SECRET || 'fallback-secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const { profileId, orgId, ts } = payload;

    // Validate timestamp (10 minute window)
    if (Date.now() - ts > 10 * 60 * 1000) {
      return null;
    }

    if (!profileId || !orgId) return null;
    return { profileId, orgId };
  } catch {
    return null;
  }
}

export { SCOPES };
