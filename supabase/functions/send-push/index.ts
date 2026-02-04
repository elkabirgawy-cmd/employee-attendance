import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushRequest {
  company_id: string;
  platform?: 'android' | 'ios' | 'web';
  userId?: string;
  userIds?: string[];
  branchId?: string;
  role?: 'admin' | 'employee';
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
  imageUrl?: string;
}

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const payload = {
    iss: serviceAccount.client_email,
    scope: SCOPES.join(' '),
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');

  const encoder = new TextEncoder();
  const data = encoder.encode(unsignedToken);

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.substring(pemHeader.length, privateKey.length - pemFooter.length).replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    data
  );

  const signatureArray = new Uint8Array(signature);
  const encodedSignature = btoa(String.fromCharCode(...signatureArray))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${encodedSignature}`;

  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function sendFCMMessage(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, any>,
  priority: 'normal' | 'high',
  imageUrl?: string
): Promise<any> {
  const message: any = {
    token,
    notification: {
      title,
      body,
    },
    data: {
      ...data,
    },
    android: {
      priority: priority === 'high' ? 'high' : 'normal',
      notification: {
        sound: 'default',
        priority: priority === 'high' ? 'high' : 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    webpush: {
      notification: {
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        requireInteraction: priority === 'high',
      },
    },
  };

  if (imageUrl) {
    message.notification.image = imageUrl;
    message.android.notification.image = imageUrl;
    message.apns.payload.aps['mutable-content'] = 1;
    message.apns.fcm_options = {
      image: imageUrl,
    };
    message.webpush.notification.image = imageUrl;
  }

  Object.keys(data).forEach(key => {
    message.data[key] = String(data[key]);
  });

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const response = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await response.json(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: PushRequest = await req.json();
    const {
      company_id,
      platform,
      userId,
      userIds,
      branchId,
      role,
      title,
      body,
      type,
      data = {},
      priority = 'normal',
      imageUrl
    } = payload;

    if (!company_id) {
      throw new Error('company_id is required');
    }

    console.log(`[send-push] company_id: ${company_id}, platform: ${platform || 'all'}, userId: ${userId}, branchId: ${branchId}, role: ${role}`);

    let targetUsers: any[] = [];

    if (userId) {
      targetUsers = [{ user_id: userId, role: role || 'employee' }];
    } else if (userIds && userIds.length > 0) {
      targetUsers = userIds.map(id => ({ user_id: id, role: role || 'employee' }));
    } else if (branchId) {
      const { data: employees, error } = await supabaseClient
        .from('employees')
        .select('id')
        .eq('branch_id', branchId)
        .eq('company_id', company_id)
        .eq('is_active', true);

      if (error) throw error;

      targetUsers = (employees || []).map(emp => ({ user_id: emp.id, role: 'employee' }));
    } else if (role) {
      let query = supabaseClient
        .from('push_devices')
        .select('user_id')
        .eq('company_id', company_id)
        .eq('enabled', true);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data: devices, error } = await query;

      if (error) throw error;

      const uniqueUsers = new Map();
      (devices || []).forEach(d => {
        if (!uniqueUsers.has(d.user_id)) {
          uniqueUsers.set(d.user_id, { user_id: d.user_id, role: role });
        }
      });
      targetUsers = Array.from(uniqueUsers.values());
    } else {
      throw new Error('Either userId, userIds, branchId, or role must be provided');
    }

    // Check if we should do a dry-run (query devices but don't send)
    let allDevicesQuery = supabaseClient
      .from('push_devices')
      .select('token, platform')
      .eq('company_id', company_id)
      .eq('enabled', true);

    if (platform) {
      allDevicesQuery = allDevicesQuery.eq('platform', platform);
    }

    const { data: allDevices, error: devicesError } = await allDevicesQuery;

    if (devicesError) {
      console.error('Error querying devices:', devicesError);
    }

    const devicesFound = allDevices?.length || 0;
    const isDryRun = !allDevices || allDevices.length === 0 ||
                     allDevices.every(d => d.token.startsWith('DUMMY_TOKEN_'));

    console.log(`[send-push] Devices found: ${devicesFound}, isDryRun: ${isDryRun}`);

    if (isDryRun) {
      const platforms = allDevices ? [...new Set(allDevices.map(d => d.platform))] : [];

      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'dry_run',
          devicesFound,
          company_id,
          platforms,
          message: `Dry-run: Found ${devicesFound} device(s) in database for company ${company_id}`,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (!serviceAccountJson) {
      console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured, only saving notifications');

      for (const target of targetUsers) {
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: target.user_id,
            role: target.role,
            type,
            title,
            body,
            data,
            priority,
            read: false,
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Notifications saved but FCM not configured',
          count: targetUsers.length,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    const results = [];

    for (const target of targetUsers) {
      let query = supabaseClient
        .from('push_devices')
        .select('*')
        .eq('company_id', company_id)
        .eq('user_id', target.user_id)
        .eq('enabled', true);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data: tokens, error: tokenError } = await query;

      if (tokenError || !tokens || tokens.length === 0) {
        console.log(`No tokens found for user ${target.user_id} in company ${company_id}`);
        continue;
      }

      console.log(`[send-push] Found ${tokens.length} device(s) for user ${target.user_id}`);

      const notificationResult = await supabaseClient
        .from('notifications')
        .insert({
          user_id: target.user_id,
          role: target.role,
          type,
          title,
          body,
          data,
          priority,
          read: false,
        })
        .select()
        .single();

      if (notificationResult.error) {
        console.error('Error saving notification:', notificationResult.error);
      }

      const notificationData = {
        ...data,
        type,
        notificationId: notificationResult.data?.id || '',
      };

      for (const tokenData of tokens) {
        try {
          const fcmResult = await sendFCMMessage(
            accessToken,
            serviceAccount.project_id,
            tokenData.token,
            title,
            body,
            notificationData,
            priority,
            imageUrl
          );

          if (fcmResult.ok) {
            results.push({
              userId: target.user_id,
              platform: tokenData.platform,
              status: 'sent',
              messageId: fcmResult.data.name,
            });
          } else if (
            fcmResult.data.error?.code === 'NOT_FOUND' ||
            fcmResult.data.error?.code === 'INVALID_ARGUMENT' ||
            fcmResult.data.error?.details?.some((d: any) =>
              d['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' &&
              (d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT')
            )
          ) {
            await supabaseClient
              .from('push_devices')
              .delete()
              .eq('id', tokenData.id);

            console.log(`[send-push] Removed invalid token for user ${target.user_id}, device ${tokenData.device_id}`);

            results.push({
              userId: target.user_id,
              platform: tokenData.platform,
              status: 'invalid_token_removed',
            });
          } else {
            results.push({
              userId: target.user_id,
              platform: tokenData.platform,
              status: 'failed',
              error: fcmResult.data.error?.message || 'Unknown error',
            });
          }
        } catch (fcmError) {
          console.error('FCM error:', fcmError);
          results.push({
            userId: target.user_id,
            platform: tokenData.platform,
            status: 'error',
            error: fcmError.message,
          });
        }
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;

    console.log(`[send-push] Results: sent=${sentCount}, failed=${results.filter(r => r.status === 'failed' || r.status === 'error').length}, tokens_found=${results.length}`);

    if (sentCount === 0 && results.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: 'NO_ENABLED_DEVICES',
          company_id,
          platform: platform || 'all',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: sentCount,
        platform: platform || 'all',
        company_id,
        results,
        totalTokens: results.length,
        failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
        invalidRemoved: results.filter(r => r.status === 'invalid_token_removed').length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in send-push function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
