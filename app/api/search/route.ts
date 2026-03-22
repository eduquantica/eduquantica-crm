import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const studentPromise = db.student.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { id: { contains: q } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 10,
  });

  const applicationPromise = db.application.findMany({
    where: {
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { student: { firstName: { contains: q, mode: "insensitive" } } },
        { student: { lastName: { contains: q, mode: "insensitive" } } },
        { university: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      university: { select: { name: true } },
    },
    take: 10,
  });

  const leadPromise = db.lead.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 10,
  });

  const universityPromise = db.university.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, country: true },
    take: 10,
  });

  const [students, applications, leads, universities] = await Promise.all([
    studentPromise,
    applicationPromise,
    leadPromise,
    universityPromise,
  ]);

  // we build a mixed-array of result objects, typing it precisely is verbose
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  students.forEach((s) =>
    results.push({
      type: "student",
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      email: s.email,
    })
  );
  applications.forEach((a) =>
    results.push({
      type: "application",
      id: a.id,
      studentName: `${a.student.firstName} ${a.student.lastName}`,
      universityName: a.university.name,
    })
  );
  leads.forEach((l) =>
    results.push({
      type: "lead",
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      email: l.email,
    })
  );
  universities.forEach((u) =>
    results.push({
      type: "university",
      id: u.id,
      name: u.name,
      country: u.country,
    })
  );

  return NextResponse.json({ results });
}