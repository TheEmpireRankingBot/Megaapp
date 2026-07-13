import "server-only";

import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushResult = "sent" | "gone" | "failed";

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function isWebPushConfigured() {
  return getVapidConfig() !== null;
}

export async function sendPush(
  subscription: StoredPushSubscription,
  payload: PushPayload,
): Promise<PushResult> {
  const vapid = getVapidConfig();
  if (!vapid) return "failed";

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60,
        urgency: "normal",
        vapidDetails: vapid,
      },
    );
    return "sent";
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : null;
    if (statusCode === 404 || statusCode === 410) return "gone";
    console.error("Web Push delivery failed", {
      endpointHost: safeEndpointHost(subscription.endpoint),
      statusCode,
    });
    return "failed";
  }
}

function safeEndpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "invalid";
  }
}

/** Send to every browser registered for a user and prune expired endpoints. */
export async function sendPushToSubscriptions(
  userId: string,
  subscriptions: StoredPushSubscription[],
  payload: PushPayload,
) {
  const results = await Promise.all(
    subscriptions.map(async (subscription) => ({
      endpoint: subscription.endpoint,
      result: await sendPush(subscription, payload),
    })),
  );

  const gone = results
    .filter((result) => result.result === "gone")
    .map((result) => result.endpoint);
  if (gone.length > 0) {
    const db = await getDb();
    await db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, userId),
          inArray(schema.pushSubscriptions.endpoint, gone),
        ),
      );
  }

  return results.filter((result) => result.result === "sent").length;
}
