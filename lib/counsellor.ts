import { db } from "./db";

/**
 * Return the next counsellor in the round-robin queue and advance the pointer.
 * If no counsellors exist this returns null. The state is persisted in the
 * CounsellorRoundRobin table so that multiple processes share the same cycle.
 */
export async function getNextCounsellor(): Promise<{ id: string; email: string | null; name: string | null } | null> {
  // fetch all active counsellors ordered by creation time (stable order)
  const counsellors = await db.user.findMany({
    where: { isActive: true, role: { name: "COUNSELLOR" } },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (counsellors.length === 0) return null;

  // read or create the singleton row
  const record = await db.counsellorRoundRobin.findFirst();
  let nextIndex = 0;
  if (record && record.lastAssignedCounsellorId) {
    const idx = counsellors.findIndex((c) => c.id === record!.lastAssignedCounsellorId);
    if (idx >= 0) {
      nextIndex = (idx + 1) % counsellors.length;
    }
  }

  const next = counsellors[nextIndex];

  if (record) {
    await db.counsellorRoundRobin.update({
      where: { id: record.id },
      data: { lastAssignedCounsellorId: next.id },
    });
  } else {
    await db.counsellorRoundRobin.create({
      data: { lastAssignedCounsellorId: next.id },
    });
  }

  return next;
}
