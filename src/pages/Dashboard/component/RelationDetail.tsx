import { Button, Empty, Spin } from "antd";
import { useRelationDetail } from "@/hooks/useRelationQueries";
import type { useRelationCatalogs } from "@/hooks/useRelationQueries";
import { useDashboardStore } from "@/store";
import { evidenceStatusLabels } from "@/utils/factFilters";
import { formatDate } from "@/utils/date";
import EvidenceFacts from "./EvidenceFacts";
import { DetailIntro, DetailRows, DetailSection } from "./DetailLayout";
import { entityCategoryName, relationTypeInfo } from "@/utils/relationFilters";

interface IProps {
  id: string;
  catalogs: ReturnType<typeof useRelationCatalogs>;
}
const RelationDetail = ({ id, catalogs }: IProps) => {
  const detail = useRelationDetail(id);
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  if (detail.isPending) return <Spin description="正在加载关系详情" />;
  if (detail.isError) return null;
  const relation = detail.data;
  if (!relation) return <Empty description="暂无详情" />;
  const { source, target, typeId } = relation.overview;
  const type = relationTypeInfo(typeId, catalogs.types.data);
  const typeFields = (relation.typeFields ?? []).filter(
    (field) => field.value !== null && field.value !== "",
  );
  const arrow =
    (relation.directed ?? type?.directed) === false ? "↔" : "→";
  return (
    <>
      <DetailIntro
        id={relation.relationId}
        label="关系 ID"
        title={
          <>
            {source.canonicalName} {arrow}{" "}
            {type?.name ?? typeId} {arrow}{" "}
            {target.canonicalName}
          </>
        }
      />
      <DetailSection title="关系概览">
        <DetailRows
          items={[
            {
              key: "source",
              label: "起点",
              value: (
                <Button
                  className="detail-inline-link"
                  type="link"
                  onClick={() =>
                    pushDetail({ kind: "entity", id: source.entityId })
                  }
                >
                  {source.canonicalName}
                  {`（${entityCategoryName(source.categoryId, catalogs.categories.data)}）`}
                </Button>
              ),
            },
            {
              key: "target",
              label: "终点",
              value: (
                <Button
                  className="detail-inline-link"
                  type="link"
                  onClick={() =>
                    pushDetail({ kind: "entity", id: target.entityId })
                  }
                >
                  {target.canonicalName}
                  {`（${entityCategoryName(target.categoryId, catalogs.categories.data)}）`}
                </Button>
              ),
            },
            {
              key: "type",
              label: "关系类型",
              value: type?.name ?? typeId,
            },
          ]}
        />
      </DetailSection>
      {typeFields.length > 0 && (
        <DetailSection title="属性与数值">
          <DetailRows
            items={typeFields.map((field, index) => ({
              key: `${field.label}-${index}`,
              label: field.label,
              value: field.value,
            }))}
          />
        </DetailSection>
      )}
      <DetailSection title="证据状态">
        <DetailRows
          items={[
            {
              key: "evidence",
              label: "状态",
              value: relation.evidenceStatus
                ? (evidenceStatusLabels[relation.evidenceStatus] ??
                  relation.evidenceStatus)
                : "—",
            },
            {
              key: "origin",
              label: "来源类型",
              value: relation.sourceType
                ? relation.sourceType === "preset"
                  ? "预置"
                  : "事实"
                : "—",
            },
          ]}
        />
      </DetailSection>
      <EvidenceFacts
        facts={relation.supportFacts?.map((fact) => ({
          factId: fact.factId,
          title: fact.title,
          excerpt: fact.basis ?? undefined,
        }))}
        preset={relation.sourceType === "preset"}
      />
      {(relation.formation?.firstWrittenAt || relation.formation?.lastUpdatedAt) && (
        <DetailSection title="形成过程">
          <DetailRows
            items={[
              ...(relation.formation?.firstWrittenAt
                ? [
                    {
                      key: "created",
                      label: "首次写入",
                      value: formatDate(relation.formation?.firstWrittenAt),
                    },
                  ]
                : []),
              ...(relation.formation?.lastUpdatedAt
                ? [
                    {
                      key: "updated",
                      label: "最近更新",
                      value: formatDate(relation.formation?.lastUpdatedAt),
                    },
                  ]
                : []),
            ]}
          />
        </DetailSection>
      )}
    </>
  );
};
export default RelationDetail;
