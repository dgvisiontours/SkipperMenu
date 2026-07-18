import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:kontakt@skipper.pl";
const APP_URL = Deno.env.get("APP_URL") || "/";
const REMINDER_FUNCTION_SECRET = Deno.env.get("REMINDER_FUNCTION_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (request) => {
  if (request.headers.get("authorization") !== `Bearer ${REMINDER_FUNCTION_SECRET}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_order_reminder_push_targets");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const targets = data?.targets || [];
  const targetDate = data?.target_date;
  const results = await Promise.allSettled(targets.map(async (target: any) => {
    const subscription = {
      endpoint: target.endpoint,
      keys: target.keys,
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: "Paszowóz: brakuje zamówienia",
        body: `${target.boat_name}: nie złożono jeszcze zamówienia na wydanie ${targetDate}.`,
        url: APP_URL,
      }));
      return { endpoint: target.endpoint, sent: true };
    } catch (sendError: any) {
      if (sendError?.statusCode === 404 || sendError?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", target.endpoint);
      }
      return { endpoint: target.endpoint, sent: false, error: sendError?.message || String(sendError) };
    }
  }));

  return Response.json({
    ok: true,
    target_date: targetDate,
    target_count: targets.length,
    sent_count: results.filter((item) => item.status === "fulfilled" && item.value.sent).length,
    results,
  });
});
