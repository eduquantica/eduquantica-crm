import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

type CvPdfProps = {
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
      country?: string | null;
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontSize: 10,
    color: "#0F172A",
  },
  name: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1B2A4A",
  },
  title: {
    fontSize: 11,
    marginTop: 4,
  },
  contact: {
    marginTop: 5,
    fontSize: 9,
    color: "#334155",
  },
  divider: {
    marginTop: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#F5A623",
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 10,
    color: "#1B2A4A",
    letterSpacing: 1,
    fontWeight: 700,
  },
  sectionUnderline: {
    marginTop: 2,
    width: 52,
    borderBottomWidth: 1.5,
    borderBottomColor: "#F5A623",
  },
  p: {
    marginTop: 4,
    lineHeight: 1.45,
  },
  row: {
    marginTop: 5,
  },
  rowTitle: {
    fontWeight: 700,
  },
  muted: {
    color: "#475569",
  },
  chips: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  chip: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 8,
  },
  refs: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  refCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    padding: 5,
  },
  pageNumber: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "#64748B",
  },
});

function lines(value?: string | null): string[] {
  return (value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function CvPdfDocument({ cv }: CvPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{cv.fullName || "Your Name"}</Text>
        <Text style={styles.title}>{cv.professionalTitle || "Professional Title"}</Text>
        <Text style={styles.contact}>
          {cv.email || "email@example.com"}
          {cv.phone ? ` | ${cv.phone}` : ""}
          {cv.city || cv.country ? ` | ${[cv.city, cv.country].filter(Boolean).join(", ")}` : ""}
        </Text>
        {(cv.linkedinUrl || cv.portfolioUrl) && (
          <Text style={styles.contact}>
            {cv.linkedinUrl ? `LinkedIn: ${cv.linkedinUrl}` : ""}
            {cv.linkedinUrl && cv.portfolioUrl ? " | " : ""}
            {cv.portfolioUrl ? `Portfolio: ${cv.portfolioUrl}` : ""}
          </Text>
        )}
        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFILE</Text>
          <View style={styles.sectionUnderline} />
          <Text style={styles.p}>{cv.profileSummary || "Profile summary will appear here."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EDUCATION</Text>
          <View style={styles.sectionUnderline} />
          {cv.education.map((row, index) => (
            <View key={`${row.institution}-${index}`} style={styles.row}>
              <Text style={styles.rowTitle}>{row.institution} - {row.qualification}</Text>
              {!!row.fieldOfStudy && <Text>{row.fieldOfStudy}</Text>}
              {!!row.grade && <Text>Grade: {row.grade}</Text>}
              <Text style={styles.muted}>{row.startDate || ""} - {row.isCurrently ? "Present" : row.endDate || ""}</Text>
              {!!row.country && <Text style={styles.muted}>{row.country}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WORK EXPERIENCE</Text>
          <View style={styles.sectionUnderline} />
          {cv.workExperience.map((row, index) => (
            <View key={`${row.employer}-${index}`} style={styles.row}>
              <Text style={styles.rowTitle}>{row.jobTitle} - {row.employer}</Text>
              <Text style={styles.muted}>{row.location || ""} {row.location ? "|" : ""} {row.startDate || ""} - {row.isCurrently ? "Present" : row.endDate || ""}</Text>
              {lines(row.responsibilities).map((line) => (
                <Text key={line}>- {line}</Text>
              ))}
              {lines(row.achievements).map((line) => (
                <Text key={`a-${line}`}>- {line}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SKILLS</Text>
          <View style={styles.sectionUnderline} />
          <View style={styles.chips}>
            {cv.skills.map((row, index) => (
              <Text key={`${row.skillName}-${index}`} style={styles.chip}>
                {row.skillName}{row.proficiency ? ` (${row.proficiency})` : ""}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LANGUAGES</Text>
          <View style={styles.sectionUnderline} />
          {cv.languages.map((row, index) => (
            <Text key={`${row.language}-${index}`} style={styles.p}>{row.language}: {row.proficiency}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
          <View style={styles.sectionUnderline} />
          {cv.achievements.map((row, index) => (
            <Text key={`${row.title}-${index}`} style={styles.p}>{row.title}{row.date ? ` (${row.date})` : ""}{row.description ? ` - ${row.description}` : ""}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REFERENCES</Text>
          <View style={styles.sectionUnderline} />
          {!cv.showReferences ? (
            <Text style={styles.p}>Available on Request</Text>
          ) : (
            <View style={styles.refs}>
              {cv.references.map((row, index) => (
                <View key={`${row.refereeName}-${index}`} style={styles.refCard}>
                  <Text style={styles.rowTitle}>{row.refereeName}</Text>
                  {!!row.jobTitle && <Text>{row.jobTitle}</Text>}
                  {!!row.organisation && <Text>{row.organisation}</Text>}
                  {!!row.email && <Text>{row.email}</Text>}
                  {!!row.phone && <Text>{row.phone}</Text>}
                  {!!row.relationship && <Text>{row.relationship}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
