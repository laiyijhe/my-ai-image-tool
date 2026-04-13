import type { LegalSection } from "@/lib/legal/types";

export function LegalDocumentBody({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((s, i) => (
        <section key={s.heading + String(i)}>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {s.heading}
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted">
            {s.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
