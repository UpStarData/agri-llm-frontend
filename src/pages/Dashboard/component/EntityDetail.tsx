import { Button, Empty, Spin } from "antd";
import { useEntityDetail } from "@/hooks/useRelationQueries";
import type { useRelationCatalogs } from "@/hooks/useRelationQueries";
import { useDashboardStore } from "@/store";
import { commodityNameById, evidenceStatusLabels } from "@/utils/factFilters";
import { useCommodities } from "@/hooks";
import { formatDate } from "@/utils/date";
import EvidenceFacts from "./EvidenceFacts";
import { DetailIntro, DetailRows, DetailSection } from "./DetailLayout";
import { entityCategoryName, relationTypeInfo } from "@/utils/relationFilters";

interface IProps {
  id: string;
  catalogs: ReturnType<typeof useRelationCatalogs>;
}
const EntityDetail = ({ id, catalogs }: IProps) => {
  const detail = useEntityDetail(id);
  const commodities = useCommodities();
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  const excluded = useDashboardStore((s) => s.relationFilters.excludedTypes);
  if (detail.isPending) return <Spin description="正在加载本体详情" />;
  if (detail.isError) return null;
  const entity = detail.data;
  if (!entity) return <Empty description="暂无详情" />;
  const relations = (entity.relations ?? []).filter(
    (group) => !excluded.includes(group.typeId),
  );
  const relationCount = relations.reduce((count, group) => count + group.items.length, 0);
  const typeFields = (entity.typeFields ?? []).filter(
    (field) => field.value !== null && field.value !== "",
  );
  const regionPath = entity.geo?.regionPath ?? [];
  return (
    <>
      <DetailIntro id={entity.entityId} label="本体 ID" title={entity.canonicalName} />
      {entity.summary && (
        <DetailSection title="本体简介">
          <p className="detail-paragraph">{entity.summary}</p>
        </DetailSection>
      )}
      <DetailSection title="分类与位置">
        <DetailRows
          items={[
            {
              key: "type",
              label: "分类",
              value: entityCategoryName(entity.category.categoryId, catalogs.categories.data),
            },
            {
              key: "address",
              label: "所在地",
              value: entity.geo?.geoPoint
                ? regionPath.map(({ name }) => name).join(" › ") || "—"
                : [regionPath.map(({ name }) => name).join(" › "), "暂无位置"]
                    .filter(Boolean).join(" / "),
            },
            ...(regionPath?.length
              ? [
                  {
                    key: "region",
                    label: "地理范围",
                    value: regionPath
                      .map(({ name }) => name)
                      .join(" › "),
                  },
                ]
              : []),
            ...(entity.commodityIds?.length
              ? [
                  {
                    key: "varieties",
                    label: "涉及品种",
                    value: entity.commodityIds
                      .map((item) => commodityNameById(item, commodities.data))
                      .join("、"),
                  },
                ]
              : []),
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
              value: entity.evidenceStatus
                ? (evidenceStatusLabels[entity.evidenceStatus] ??
                  entity.evidenceStatus)
                : "—",
            },
            {
              key: "source",
              label: "来源类型",
              value: entity.sourceType
                ? entity.sourceType === "preset"
                  ? "预置"
                  : "事实"
                : "—",
            },
          ]}
        />
      </DetailSection>
      <DetailSection title="关系" hint={`${relationCount} 条`}>
        {relationCount ? (
          relations.map((group) => (
            <div className="detail-relation-group" key={group.typeId}>
              <div className="detail-relation-type">{group.name}</div>
              {group.items.map((relation) => (
                <Button
                  className="detail-relation-link"
                  key={relation.relationId}
                  type="link"
                  onClick={() => pushDetail({ kind: "relation", id: relation.relationId })}
                >
                  {relation.direction === "incoming"
                    ? relation.peer.canonicalName
                    : entity.canonicalName}{" "}
                  {relationTypeInfo(group.typeId, catalogs.types.data)?.directed === false
                    ? "↔" : "→"}{" "}
                  {relation.direction === "incoming"
                    ? entity.canonicalName
                    : relation.peer.canonicalName}
                </Button>
              ))}
            </div>
          ))
        ) : (
          <p className="detail-empty">暂无关系</p>
        )}
      </DetailSection>
      <EvidenceFacts
        facts={entity.supportFacts}
        preset={entity.sourceType === "preset"}
      />
      {(entity.formation?.firstWrittenAt || entity.formation?.lastUpdatedAt) && (
        <DetailSection title="本体形成过程">
          <DetailRows
            items={[
              ...(entity.formation?.firstWrittenAt
                ? [
                    {
                      key: "created",
                      label: "首次写入",
                      value: formatDate(entity.formation?.firstWrittenAt),
                    },
                  ]
                : []),
              ...(entity.formation?.lastUpdatedAt
                ? [
                    {
                      key: "updated",
                      label: "最近更新",
                      value: formatDate(entity.formation?.lastUpdatedAt),
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
export default EntityDetail;
