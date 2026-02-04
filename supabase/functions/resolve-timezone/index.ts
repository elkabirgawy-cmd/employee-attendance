import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TimezoneRequest {
  latitude: number;
  longitude: number;
  deviceTimezone?: string;
}

interface TimezoneResponse {
  timezone: string;
  utcOffset: number;
  dstActive: boolean;
  abbreviation: string;
  fromCache: boolean;
  mismatchDetected?: boolean;
  mismatchDifferenceMinutes?: number;
}

const TIMEZONEDB_API_KEY = "VKNK0P6R2ZXN";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { latitude, longitude, deviceTimezone }: TimezoneRequest = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const roundedLat = Math.round(latitude * 100) / 100;
    const roundedLng = Math.round(longitude * 100) / 100;

    const { data: cached } = await supabase
      .from("timezone_resolution_cache")
      .select("*")
      .eq("latitude", roundedLat)
      .eq("longitude", roundedLng)
      .maybeSingle();

    if (cached && cached.cached_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) {
      await supabase
        .from("timezone_resolution_cache")
        .update({
          last_used_at: new Date().toISOString(),
          use_count: cached.use_count + 1,
        })
        .eq("id", cached.id);

      const response: TimezoneResponse = {
        timezone: cached.timezone,
        utcOffset: cached.utc_offset,
        dstActive: cached.dst_active,
        abbreviation: cached.timezone.split("/").pop() || cached.timezone,
        fromCache: true,
      };

      if (deviceTimezone && deviceTimezone !== cached.timezone) {
        response.mismatchDetected = true;
        response.mismatchDifferenceMinutes = Math.abs(cached.utc_offset);
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `http://api.timezonedb.com/v2.1/get-time-zone?key=${TIMEZONEDB_API_KEY}&format=json&by=position&lat=${latitude}&lng=${longitude}`;

    const apiResponse = await fetch(apiUrl);
    const data = await apiResponse.json();

    if (data.status === "FAILED") {
      return new Response(
        JSON.stringify({ error: data.message || "Failed to resolve timezone" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const timezone = data.zoneName;
    const utcOffset = data.gmtOffset / 60;
    const dstActive = data.dst === "1";

    await supabase
      .from("timezone_resolution_cache")
      .upsert({
        latitude: roundedLat,
        longitude: roundedLng,
        timezone,
        utc_offset: utcOffset,
        dst_active: dstActive,
        cached_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        use_count: 1,
      }, {
        onConflict: "latitude,longitude",
      });

    const response: TimezoneResponse = {
      timezone,
      utcOffset,
      dstActive,
      abbreviation: data.abbreviation || timezone.split("/").pop() || timezone,
      fromCache: false,
    };

    if (deviceTimezone && deviceTimezone !== timezone) {
      response.mismatchDetected = true;

      const deviceDate = new Date().toLocaleString("en-US", { timeZone: deviceTimezone });
      const resolvedDate = new Date().toLocaleString("en-US", { timeZone: timezone });
      const deviceTime = new Date(deviceDate).getTime();
      const resolvedTime = new Date(resolvedDate).getTime();
      response.mismatchDifferenceMinutes = Math.abs(Math.round((deviceTime - resolvedTime) / 60000));
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Timezone resolution error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
