import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { quotaUsage } from "../db/schema.js";

// 'YYYY-MM' in UTC. Using the calendar month as the period key means the quota resets by
// simply starting a new row, with no cron job needed to zero out counters.
function currentPeriodMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getRemainingQuota(
  db: Database,
  userGoogleSub: string,
  monthlyLimit: number,
  now = new Date(),
): Promise<number> {
  const periodMonth = currentPeriodMonth(now);

  const [row] = await db
    .select({ classifiedCount: quotaUsage.classifiedCount })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.userGoogleSub, userGoogleSub), eq(quotaUsage.periodMonth, periodMonth)));

  return Math.max(0, monthlyLimit - (row?.classifiedCount ?? 0));
}

export async function consumeQuota(
  db: Database,
  userGoogleSub: string,
  amount: number,
  now = new Date(),
): Promise<void> {
  if (amount <= 0) return;
  const periodMonth = currentPeriodMonth(now);

  await db
    .insert(quotaUsage)
    .values({ userGoogleSub, periodMonth, classifiedCount: amount })
    .onConflictDoUpdate({
      target: [quotaUsage.userGoogleSub, quotaUsage.periodMonth],
      set: { classifiedCount: sql`${quotaUsage.classifiedCount} + ${amount}` },
    });
}
