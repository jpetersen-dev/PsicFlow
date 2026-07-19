import { supabase } from './supabaseClient';
import crypto from 'crypto';

export class WebhookService {
  /**
   * Triggers outgoing webhooks for a specific event and organization.
   * @param event The name of the event (e.g. 'appointment.booked')
   * @param organizationId The organization UUID
   * @param data The payload data containing resource information
   */
  static async trigger(event: string, organizationId: string, data: any): Promise<void> {
    try {
      if (!organizationId) {
        console.warn('[WebhookService] organizationId is missing');
        return;
      }

      // Query active webhooks using RPC get_active_webhooks
      const { data: subscriptions, error } = await supabase.rpc('get_active_webhooks', {
        p_organization_id: organizationId,
        p_event: event
      });

      if (error) {
        console.error('[WebhookService] Error fetching active webhooks via RPC:', error);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        return;
      }

      const timestamp = new Date().toISOString();
      const payload = {
        event,
        timestamp,
        data
      };

      const payloadString = JSON.stringify(payload);

      // Execute POST requests asynchronously in the background
      for (const sub of subscriptions) {
        const { url, secret } = sub;
        if (!url) continue;

        this.sendWebhook(url, payloadString, secret).catch((err) => {
          console.error(`[WebhookService] Failed to dispatch webhook to ${url}:`, err);
        });
      }
    } catch (err) {
      console.error('[WebhookService] Unexpected error in trigger:', err);
    }
  }

  /**
   * Helper method to send a HTTP POST request to a webhook URL.
   */
  private static async sendWebhook(url: string, payloadString: string, secret?: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PsicFlow-Webhook-Dispatcher/1.0',
    };

    if (secret) {
      // Generate HMAC-SHA256 signature
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
      headers['x-psicflow-signature'] = signature;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[WebhookService] Received status ${response.status} from ${url}`);
      } else {
        console.log(`[WebhookService] Successfully dispatched webhook to ${url}`);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}
