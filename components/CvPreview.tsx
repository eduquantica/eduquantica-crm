"use client";

type CvPreviewProps = {
  cv: {
    fullName?: string | null;
    professionalTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    linkedinUrl?: string | null;
    portfolioUrl?: string | null;
    profileSummary?: string | null;
    showReferences?: boolean;
    education: Array<{
      institution: string;
      qualification: string;
      fieldOfStudy?: string | null;
      grade?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      isCurrently?: boolean;
      description?: string | null;
      country?: string | null;
      autoImported?: boolean;
    }>;
    workExperience: Array<{
      jobTitle: string;
      employer: string;
      location?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      isCurrently?: boolean;
      responsibilities?: string | null;
      achievements?: string | null;
    }>;
    skills: Array<{
      skillName: string;
      proficiency?: string | null;
      category?: string | null;
    }>;
    languages: Array<{
      language: string;
      proficiency: string;
    }>;
    achievements: Array<{
      title: string;
      description?: string | null;
      date?: string | null;
    }>;
    references: Array<{
      refereeName: string;
      jobTitle?: string | null;
      organisation?: string | null;
      email?: string | null;
      phone?: string | null;
      relationship?: string | null;
    }>;
  };
};

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-bold tracking-[0.18em] text-[#1B2A4A]">{label}</h3>
      <div className="mt-1 h-[2px] w-16 bg-[#F5A623]" />
    </div>
  );
}

function splitLines(value?: string | null) {
  return (value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function CvPreview({ cv }: CvPreviewProps) {
  const groupedSkills = cv.skills.reduce<Record<string, string[]>>((acc, row) => {
    const category = row.category?.trim() || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(row.proficiency ? `${row.skillName} (${row.proficiency})` : row.skillName);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="text-3xl font-bold text-[#1B2A4A]">{cv.fullName || "Your Name"}</h2>
        <p className="mt-1 text-sm font-medium text-slate-700">{cv.professionalTitle || "Professional Title"}</p>
        <p className="mt-2 text-xs text-slate-600">
          {cv.email || "email@example.com"}
          {cv.phone ? ` | ${cv.phone}` : ""}
          {cv.city || cv.country ? ` | ${[cv.city, cv.country].filter(Boolean).join(", ")}` : ""}
        </p>
        {(cv.linkedinUrl || cv.portfolioUrl) && (
          <p className="mt-1 text-xs text-slate-600">
            {cv.linkedinUrl ? `LinkedIn: ${cv.linkedinUrl}` : ""}
            {cv.linkedinUrl && cv.portfolioUrl ? " | " : ""}
            {cv.portfolioUrl ? `Portfolio: ${cv.portfolioUrl}` : ""}
          </p>
        )}
        <div className="mt-3 h-[2px] w-full bg-[#F5A623]" />
      </header>

      <SectionHeading label="PROFILE" />
      <p className="mt-2 text-sm leading-6 text-slate-700">{cv.profileSummary || "Profile summary will appear here."}</p>

      <SectionHeading label="EDUCATION" />
      <div className="mt-2 space-y-3">
        {cv.education.length ? cv.education.map((row, index) => (
          <div key={`${row.institution}-${index}`} className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{row.institution} - {row.qualification}</p>
            {row.fieldOfStudy ? <p>{row.fieldOfStudy}</p> : null}
            {row.grade ? <p>Grade: {row.grade}</p> : null}
            <p>{row.startDate || ""} - {row.isCurrently ? "Present" : row.endDate || ""}</p>
            {row.country ? <p>{row.country}</p> : null}
            {row.autoImported ? <p className="text-xs text-amber-700">Auto-imported from OCR</p> : null}
          </div>
        )) : <p className="text-sm text-slate-500">No education added yet.</p>}
      </div>

      <SectionHeading label="WORK EXPERIENCE" />
      <div className="mt-2 space-y-3">
        {cv.workExperience.length ? cv.workExperience.map((row, index) => (
          <div key={`${row.employer}-${index}`} className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{row.jobTitle} - {row.employer}</p>
            <p>{row.location || ""} {row.location ? "|" : ""} {row.startDate || ""} - {row.isCurrently ? "Present" : row.endDate || ""}</p>
            {splitLines(row.responsibilities).length ? (
              <ul className="list-disc pl-5">
                {splitLines(row.responsibilities).map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
            {splitLines(row.achievements).length ? (
              <ul className="list-disc pl-5 text-[#1B2A4A]">
                {splitLines(row.achievements).map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
          </div>
        )) : <p className="text-sm text-slate-500">No work experience added yet.</p>}
      </div>

      <SectionHeading label="SKILLS" />
      <div className="mt-2 space-y-2">
        {Object.keys(groupedSkills).length ? Object.entries(groupedSkills).map(([category, items]) => (
          <div key={category}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {items.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{skill}</span>
              ))}
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">No skills added yet.</p>}
      </div>

      <SectionHeading label="LANGUAGES" />
      <div className="mt-2 space-y-1 text-sm text-slate-700">
        {cv.languages.length ? cv.languages.map((row, index) => (
          <p key={`${row.language}-${index}`}>{row.language}: {row.proficiency}</p>
        )) : <p className="text-slate-500">No languages added yet.</p>}
      </div>

      <SectionHeading label="ACHIEVEMENTS" />
      <div className="mt-2 space-y-2 text-sm text-slate-700">
        {cv.achievements.length ? cv.achievements.map((row, index) => (
          <p key={`${row.title}-${index}`}><span className="font-semibold">{row.title}</span>{row.date ? ` (${row.date})` : ""}{row.description ? ` - ${row.description}` : ""}</p>
        )) : <p className="text-slate-500">No achievements added yet.</p>}
      </div>

      <SectionHeading label="REFERENCES" />
      {!cv.showReferences ? (
        <p className="mt-2 text-sm text-slate-700">Available on Request</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
          {cv.references.length ? cv.references.map((row, index) => (
            <div key={`${row.refereeName}-${index}`} className="rounded-lg border border-slate-100 p-2">
              <p className="font-semibold">{row.refereeName}</p>
              <p>{row.jobTitle || ""} {row.organisation ? `- ${row.organisation}` : ""}</p>
              {row.email ? <p>{row.email}</p> : null}
              {row.phone ? <p>{row.phone}</p> : null}
              {row.relationship ? <p>{row.relationship}</p> : null}
            </div>
          )) : <p className="text-slate-500">No references added yet.</p>}
        </div>
      )}
    </div>
  );
}
