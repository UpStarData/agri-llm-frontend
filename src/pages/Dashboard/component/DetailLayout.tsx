import type { ReactNode } from "react";

export const DetailSection = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) => (
  <section className="detail-section">
    <div className="detail-section-heading">
      <h3>{title}</h3>
      {hint && <span>{hint}</span>}
    </div>
    {children}
  </section>
);

export const DetailRows = ({
  items,
}: {
  items: { key: string; label: string; value: ReactNode }[];
}) => (
  <dl className="detail-rows">
    {items.map(({ key, label, value }) => (
      <div className="detail-row" key={key}>
        <dt>{label}</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    ))}
  </dl>
);

export const DetailIntro = ({
  id,
  title,
  summary,
  label = "ID",
}: {
  id: string;
  title: ReactNode;
  summary?: string;
  label?: string;
}) => (
  <div className="detail-intro">
    <div className="detail-id">{label}：{id}</div>
    <h2 className="detail-title">{title}</h2>
    {summary && (
      <DetailSection title="简介">
        <p className="detail-paragraph">{summary}</p>
      </DetailSection>
    )}
  </div>
);
