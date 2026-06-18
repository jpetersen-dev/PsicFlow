import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  exchangeCodeForTokens,
  getGoogleEmail,
  getCalendarClient,
  parseOAuthState,
  SCOPES,
} from '../../../lib/googleCalendar';

/**
 * GET /api/google/callback
 * Google redirects here after user consent.
 * Exchanges the code for tokens, stores connection, fetches calendar list, and redirects.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error: oauthError } = req.query;

  // Handle user denying access
  if (oauthError) {
    return res.redirect('/perfil?google=denied');
  }

  if (!code || !state) {
    return res.redirect('/perfil?google=error&reason=missing_params');
  }

  try {
    // 1. Validate and decode state
    const stateData = parseOAuthState(state as string);
    if (!stateData) {
      return res.redirect('/perfil?google=error&reason=invalid_state');
    }

    const { profileId, orgId } = stateData;

    // 2. Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code as string);
    if (!tokens.access_token || !tokens.refresh_token) {
      return res.redirect('/perfil?google=error&reason=no_tokens');
    }

    // 3. Get the Google user's email
    const googleEmail = await getGoogleEmail(tokens.access_token);

    // 4. Create a service-level Supabase client to store tokens
    // (The user might not have a session cookie on this redirect)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { 'x-tenant-id': orgId },
      },
    });

    // 5. Upsert the Google Calendar connection
    const { data: connection, error: upsertError } = await supabase
      .from('google_calendar_connections')
      .upsert(
        {
          profile_id: profileId,
          organization_id: orgId,
          google_email: googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          scopes: SCOPES,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,organization_id' }
      )
      .select('id')
      .single();

    if (upsertError || !connection) {
      console.error('Error upserting google connection:', upsertError);
      return res.redirect('/perfil?google=error&reason=db_error');
    }

    // 6. Fetch the user's Google Calendar list
    const calendarClient = getCalendarClient(tokens.refresh_token);
    const calendarList = await calendarClient.calendarList.list();

    const calendars = calendarList.data.items || [];

    // 7. Delete old selections and insert fresh ones
    await supabase
      .from('google_calendar_selections')
      .delete()
      .eq('connection_id', connection.id);

    if (calendars.length > 0) {
      const selections = calendars
        .filter((cal) => cal.id && cal.summary)
        .map((cal) => ({
          connection_id: connection.id,
          calendar_id: cal.id!,
          calendar_name: cal.summary || cal.id || 'Sin nombre',
          calendar_color: cal.backgroundColor || null,
          is_active: cal.primary === true, // Only primary calendar active by default
        }));

      const { error: insertError } = await supabase
        .from('google_calendar_selections')
        .insert(selections);

      if (insertError) {
        console.error('Error inserting calendar selections:', insertError);
      }
    }

    // 8. Redirect to profile with success message
    return res.redirect('/perfil?google=connected');
  } catch (err: any) {
    console.error('Error in Google OAuth callback:', err);
    return res.redirect('/perfil?google=error&reason=exchange_failed');
  }
}
