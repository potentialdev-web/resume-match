import { ResumeData } from "@/lib/types";

interface ResumeRendererProps {
  resume: ResumeData;
  template?: "modern" | "swiss";
}

export function ResumeRenderer({ resume, template = "modern" }: ResumeRendererProps) {
  const { personalInfo: info, summary, workExperience, education, personalProjects, additional } = resume;

  return (
    <div
      className="resume-print bg-white text-gray-900 font-sans"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "15mm 18mm",
        fontSize: "9.5pt",
        lineHeight: "1.4",
        fontFamily: "'Arial', 'Helvetica', sans-serif",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: "6mm" }}>
        <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
          {info.name}
        </h1>
        {info.title && (
          <p style={{ fontSize: "11pt", color: "#4b5563", margin: "1mm 0 2mm" }}>
            {info.title}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "8pt", color: "#6b7280", marginTop: "2mm" }}>
          {info.email && <span>{info.email}</span>}
          {info.phone && <span>· {info.phone}</span>}
          {info.location && <span>· {info.location}</span>}
          {info.linkedin && <span>· {info.linkedin}</span>}
          {info.github && <span>· {info.github}</span>}
          {info.website && <span>· {info.website}</span>}
        </div>
      </header>

      <hr style={{ borderTop: "1.5px solid #e5e7eb", margin: "3mm 0" }} />

      {/* Summary */}
      {summary && (
        <Section title="Summary">
          <p style={{ margin: 0, color: "#374151" }}>{summary}</p>
        </Section>
      )}

      {/* Work Experience */}
      {workExperience.length > 0 && (
        <Section title="Experience">
          {workExperience.map((exp, i) => (
            <div key={exp.id || i} style={{ marginBottom: i < workExperience.length - 1 ? "4mm" : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: "10pt", color: "#111827" }}>{exp.title}</strong>
                  <span style={{ color: "#6b7280", marginLeft: "6px" }}>· {exp.company}</span>
                  {exp.location && (
                    <span style={{ color: "#9ca3af", marginLeft: "4px" }}>· {exp.location}</span>
                  )}
                </div>
                <span style={{ fontSize: "8pt", color: "#9ca3af", whiteSpace: "nowrap", marginLeft: "8px" }}>
                  {exp.years}
                </span>
              </div>
              {exp.description.length > 0 && (
                <ul style={{ margin: "2mm 0 0 4mm", padding: 0, listStyle: "disc" }}>
                  {exp.description.map((bullet, bi) => (
                    <li key={bi} style={{ color: "#374151", marginBottom: "0.5mm" }}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Section title="Education">
          {education.map((edu, i) => (
            <div key={edu.id || i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "2mm" }}>
              <div>
                <strong style={{ fontSize: "10pt", color: "#111827" }}>{edu.degree}</strong>
                <span style={{ color: "#6b7280", marginLeft: "6px" }}>· {edu.institution}</span>
                {edu.description && (
                  <p style={{ color: "#6b7280", fontSize: "8pt", margin: "1mm 0 0" }}>
                    {edu.description}
                  </p>
                )}
              </div>
              <span style={{ fontSize: "8pt", color: "#9ca3af", whiteSpace: "nowrap", marginLeft: "8px" }}>
                {edu.years}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Skills */}
      {additional.technicalSkills.length > 0 && (
        <Section title="Skills">
          <p style={{ margin: 0, color: "#374151" }}>
            {additional.technicalSkills.join(" · ")}
          </p>
        </Section>
      )}

      {/* Projects */}
      {personalProjects.length > 0 && (
        <Section title="Projects">
          {personalProjects.map((proj, i) => (
            <div key={proj.id || i} style={{ marginBottom: i < personalProjects.length - 1 ? "3mm" : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "10pt", color: "#111827" }}>{proj.name}</strong>
                <span style={{ fontSize: "8pt", color: "#9ca3af" }}>{proj.years}</span>
              </div>
              {proj.role && <p style={{ color: "#6b7280", margin: "0.5mm 0", fontSize: "8pt" }}>{proj.role}</p>}
              {proj.description.length > 0 && (
                <ul style={{ margin: "1mm 0 0 4mm", padding: 0, listStyle: "disc" }}>
                  {proj.description.map((bullet, bi) => (
                    <li key={bi} style={{ color: "#374151", marginBottom: "0.5mm" }}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Languages */}
      {additional.languages.length > 0 && (
        <Section title="Languages">
          <p style={{ margin: 0, color: "#374151" }}>{additional.languages.join(" · ")}</p>
        </Section>
      )}

      {/* Certifications */}
      {additional.certificationsTraining.length > 0 && (
        <Section title="Certifications">
          <p style={{ margin: 0, color: "#374151" }}>
            {additional.certificationsTraining.join(" · ")}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "4mm" }}>
      <h2
        style={{
          fontSize: "9pt",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#374151",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "1mm",
          marginBottom: "2mm",
          margin: "0 0 2mm",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
