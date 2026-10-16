import { Button, Empty, Spin } from "antd";
import { useEntityDetail } from "@/hooks/useRelationQueries";
import type { useRelationCatalogs } from "@/hooks/useRelationQueries";
import { useDashboardStore } from "@/store";
import { evidenceStatusLabels } from "@/utils/factFilters";
import { formatDate } from "@/utils/date";
import EvidenceFacts from "./EvidenceFacts";
import { DetailIntro, DetailRows, DetailSection } from "./DetailLayout";
import RecordMedia from "@/components/RecordMedia";
import { entityCategoryName, relationTypeInfo } from "@/utils/relationFilters";
import TypeFieldsSection from "./TypeFieldsSection";

interface IProps {
  id: string;
  catalogs: ReturnType<typeof useRelationCatalogs>;
}
const EntityDetail = ({ id, catalogs }: IProps) => {
  const detail = useEntityDetail(id);
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  const excluded = useDashboardStore((s) => s.relationFilters.excludedTypes);
  if (detail.isPending) return <Spin description="正在加载本体详情" />;
  if (detail.isError) return null;
  const entity = detail.data;
  if (!entity) return <Empty description="暂无详情" />;
  const relations = (entity.relations ?? []).filter(
    (group) => !excluded.includes(group.typeId),
  );
  const relationCount = relations.reduce(
    (count, group) => count + group.items.length,
    0,
  );
  const regionPath = entity.geo?.regionPath ?? [];
  const commodities = (entity.commodities ?? []).filter((item) =>
    item.name?.trim(),
  );
  return (
    <>
      <DetailIntro
        id={entity.entityId}
        label="本体 ID"
        title={entity.canonicalName}
      />
      <RecordMedia
        images={entity.imageArr}
        videos={entity.videoArr}
        alt="本体图片"
        variant="detail"
      />
      <DetailSection title="分类与位置">
        <DetailRows
          items={[
            {
              key: "type",
              label: "分类",
              value: entityCategoryName(
                entity.category.categoryId,
                catalogs.categories.data,
              ),
            },
            {
              key: "address",
              label: "所在地",
              value: entity.geo?.geoPoint
                ? regionPath.map(({ name }) => name).join(" › ") || "—"
                : [regionPath.map(({ name }) => name).join(" › "), "暂无位置"]
                    .filter(Boolean)
                    .join(" / "),
            },
            // ...(regionPath?.length
            //   ? [
            //       {
            //         key: "region",
            //         label: "地理范围",
            //         value: regionPath
            //           .map(({ name }) => name)
            //           .join(" › "),
            //       },
            //     ]
            //   : []),
          ]}
        />
      </DetailSection>
      {commodities.length > 0 && (
        <DetailSection title="涉及品种">
          <p className="detail-paragraph">
            {commodities.map((item) => item.name).join("、")}
          </p>
        </DetailSection>
      )}
      {entity.summary?.trim() && (
        <DetailSection title="简介">
          <p className="detail-paragraph">{entity.summary}</p>
        </DetailSection>
      )}
      <TypeFieldsSection fields={entity.typeFields} />
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
                  onClick={() =>
                    pushDetail({ kind: "relation", id: relation.relationId })
                  }
                >
                  {relation.direction === "incoming"
                    ? relation.peer.canonicalName
                    : entity.canonicalName}{" "}
                  {relationTypeInfo(group.typeId, catalogs.types.data)
                    ?.directed === false
                    ? "↔"
                    : "→"}{" "}
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
      {(entity.formation?.firstWrittenAt ||
        entity.formation?.lastUpdatedAt) && (
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

      <div className="detail-actions">
        <Button disabled onClick={() => {}}>
          基于该本体发起推演
        </Button>
      </div>
    </>
  );
};
export default EntityDetail;
