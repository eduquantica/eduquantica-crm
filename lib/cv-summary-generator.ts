import { db } from "@/lib/db";

function compactText(value: string | null | undefined): string {
  return (value || "").trim();
}

export async function generateProfileSummary(cvProfileId: string): Promise<string> {
  const profile = await db.cvProfile.findUnique({
    where: { id: cvProfileId },
    include: {
      education: { orderBy: { orderIndex: "asc" } },
      workExperience: { orderBy: { orderIndex: "asc" } },
      skills: { orderBy: { orderIndex: "asc" } },
      languages: { orderBy: { orderIndex: "asc" } },
      student: {
        select: {
          applications: {
            orderBy: { createdAt: "desc" },
            take: 3,
            include: {
              course: { select: { name: true, fieldOfStudy: true } },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    throw new Error("CV profile not found");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "A motivated and detail-oriented candidate with strong academic foundations and a clear commitment to professional growth. Demonstrates practical strengths in communication, teamwork, and problem solving while building relevant domain knowledge. Brings a proactive mindset, adaptability, and a results-focused attitude to each opportunity. Seeking to contribute effectively in a role aligned with long-term career ambitions.";
  }

  const careerGoal = profile.student?.applications?.[0]?.course?.fieldOfStudy
    || profile.student?.applications?.[0]?.course?.name
    || "their chosen field";

  const payload = {
    fullName: compactText(profile.fullName),
    nationality: compactText(profile.nationality),
    education: profile.education.map((row) => ({
      institution: row.institution,
      qualification: row.qualification,
      fieldOfStudy: row.fieldOfStudy,
      grade: row.grade,
      period: `${row.startDate || ""} - ${row.endDate || (row.isCurrently ? "Present" : "")}`.trim(),
    })),
    workExperience: profile.workExperience.map((row) => ({
      jobTitle: row.jobTitle,
      employer: row.employer,
      responsibilities: row.responsibilities,
      achievements: row.achievements,
    })),
    skills: profile.skills.map((row) => ({
      name: row.skillName,
      proficiency: row.proficiency,
      category: row.category,
    })),
    languages: profile.languages.map((row) => ({
      language: row.language,
      proficiency: row.proficiency,
    })),
    careerGoal,
  };

  const systemPrompt = `You are a professional CV writer. Write a concise 3-4 sentence profile summary for the top of a CV. The summary should:\n- Highlight the person's strongest qualifications\n- Mention their field of study or expertise\n- Show their career ambition\n- Sound professional and confident\n- Be written in third person\n- Be between 60 and 80 words\n\nReturn only the profile summary text.\nNo headings, no bullet points, just the paragraph.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 220,
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate a CV profile summary using this JSON data:\n${JSON.stringify(payload)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate profile summary");
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((part) => part.type === "text")?.text?.trim();
  if (!text) {
    throw new Error("Empty summary generated");
  }

  return text;
}
