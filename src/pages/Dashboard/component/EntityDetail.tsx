import { Button, Descriptions, Empty, Spin } from "antd";
import {
  useEntityDetail,
  useRelationCatalogs,
} from "@/hooks/useRelationQueries";
import { useDashboardStore } from "@/store";
import { useCommodityIdToName } from "@/hooks";
import { evidenceStatusLabels } from "@/utils/factFilters";
import { formatDate } from "@/utils/date";
import EvidenceFacts from "./EvidenceFacts";
import { entityCategoryName, relationTypeInfo } from "@/utils/relationFilters";
interface IProps {
  id: string;
}
const EntityDetail = ({ id }: IProps) => {
  const detail = useEntityDetail(id);
  const commodityIdToName = useCommodityIdToName();
  const catalogs = useRelationCatalogs();
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  const excluded = useDashboardStore((s) => s.relationFilters.excludedTypes);
  if (detail.isPending) return <Spin description="正在加载本体详情" />;
  if (detail.isError) return null;
  const entity = detail.data;
  if (!entity) return <Empty description="暂无详情" />;
  const relations =
    entity.relations?.filter((r) => {
      const type = relationTypeInfo(r.type, catalogs.types.data);
      return !excluded.includes(r.type) && !excluded.includes(type?.key ?? "");
    }) ?? [];
  return (
    <>
      <div className="detail-title">{entity.name}</div>
      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: "type",
            label: "分类",
            children: entityCategoryName(entity.type, catalogs.categories.data),
          },
          {
            key: "address",
            label: "所在地",
            children: entity.position
              ? entity.address
              : [entity.address, "暂无位置"].filter(Boolean).join(" / "),
          },
          ...(entity.commodityIds?.length
            ? [
                {
                  key: "varieties",
                  label: "涉及品种",
                  children: entity.commodityIds
                    .map((item) => commodityIdToName[item] ?? item)
                    .join("、"),
                },
              ]
            : []),
          ...(entity.description
            ? [
                {
                  key: "description",
                  label: "简介",
                  children: entity.description,
                },
              ]
            : []),
          ...(entity.evidenceStatus
            ? [
                {
                  key: "evidence",
                  label: "证据状态",
                  children:
                    evidenceStatusLabels[entity.evidenceStatus] ??
                    entity.evidenceStatus,
                },
              ]
            : []),
          ...(entity.sourceType
            ? [
                {
                  key: "source",
                  label: "来源类型",
                  children: entity.sourceType === "preset" ? "预置" : "事实",
                },
              ]
            : []),
        ].filter((item) => item.children !== undefined && item.children !== "")}
      />
      <div className="detail-section-title">关系</div>
      {relations.length ? (
        [...new Set(relations.map((r) => r.type))].map((type) => (
          <div key={type}>
            <div>
              {relationTypeInfo(type, catalogs.types.data)?.name ?? type}
            </div>
            {relations
              .filter((r) => r.type === type)
              .map((r) => (
                <Button
                  key={r.id}
                  type="link"
                  onClick={() => pushDetail({ kind: "relation", id: r.id })}
                >
                  {r.source?.name ?? r.sourceId}{" "}
                  {relationTypeInfo(r.type, catalogs.types.data)?.directed ===
                    false || r.type === "合作"
                    ? "↔"
                    : "→"}{" "}
                  {r.target?.name ?? r.targetId}
                </Button>
              ))}
          </div>
        ))
      ) : (
        <span>暂无关系</span>
      )}
      <EvidenceFacts
        facts={entity.evidence}
        factIds={entity.factIds}
        preset={entity.sourceType === "preset"}
      />
      <div className="detail-section-title">本体形成过程</div>
      <Descriptions
        column={1}
        size="small"
        items={[
          ...(entity.createdAt
            ? [
                {
                  key: "created",
                  label: "首次写入",
                  children: formatDate(entity.createdAt),
                },
              ]
            : []),
          ...(entity.updatedAt
            ? [
                {
                  key: "updated",
                  label: "最近更新",
                  children: formatDate(entity.updatedAt),
                },
              ]
            : []),
        ]}
      />
      {entity.attributes && (
        <Descriptions
          column={1}
          size="small"
          items={Object.entries(entity.attributes)
            .filter(([, value]) => value !== "")
            .map(([key, value]) => ({ key, label: key, children: value }))}
        />
      )}
    </>
  );
};
export default EntityDetail;
