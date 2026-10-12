import type { DetailTypeField } from "@/api/fact";
import { DetailRows, DetailSection } from "./DetailLayout";

const TypeFieldsSection = ({ fields }: { fields?: DetailTypeField[] | null }) => {
  const visibleFields = (fields ?? []).filter(
    (field) =>
      field.value != null &&
      (typeof field.value !== "string" || field.value.trim() !== ""),
  );
  if (!visibleFields.length) return null;
  return (
    <DetailSection title="类型字段">
      <DetailRows
        items={visibleFields.map((field, index) => ({
          key: `${field.labe ?? field.label}-${index}`,
          label: field.labe ?? field.label ?? "—",
          value: field.value,
        }))}
      />
    </DetailSection>
  );
};

export default TypeFieldsSection;
