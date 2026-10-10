import { Button, Empty, Spin } from "antd";
import { useEntityDetail, useRelationCatalogs } from "@/hooks/useRelationQueries";
import { useDashboardStore } from "@/store";
import { commodityNameById, evidenceStatusLabels } from "@/utils/factFilters";
import { useCommodities } from "@/hooks";
import { formatDate } from "@/utils/date";
import EvidenceFacts from "./EvidenceFacts";
import { DetailIntro, DetailRows, DetailSection } from "./DetailLayout";
import { entityCategoryName, relationTypeInfo } from "@/utils/relationFilters";

interface IProps { id: string }
const EntityDetail = ({ id }: IProps) => {
  const detail = useEntityDetail(id);
  const catalogs = useRelationCatalogs();
  const commodities = useCommodities();
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  const excluded = useDashboardStore((s) => s.relationFilters.excludedTypes);
  if (detail.isPending) return <Spin description="正在加载本体详情" />;
  if (detail.isError) return null;
  const entity = detail.data;
  if (!entity) return <Empty description="暂无详情" />;
  const relations = entity.relations?.filter((r) => {
    const type = relationTypeInfo(r.type, catalogs.types.data);
    return !excluded.includes(r.type) && !excluded.includes(type?.key ?? "");
  }) ?? [];
  return (
    <>
      <DetailIntro id={entity.id} label="本体 ID" title={entity.name} />
      {entity.description && <DetailSection title="本体简介"><p className="detail-paragraph">{entity.description}</p></DetailSection>}
      <DetailSection title="分类与位置">
        <DetailRows items={[
          { key: "type", label: "分类", value: entityCategoryName(entity.type, catalogs.categories.data) },
          { key: "address", label: "所在地", value: entity.position ? (entity.address || "—") : [entity.address, "暂无位置"].filter(Boolean).join(" / ") },
          ...(entity.regionPath?.length ? [{ key: "region", label: "地理范围", value: entity.regionPath.map(({ name }) => name).join(" › ") }] : []),
          ...(entity.commodityIds?.length ? [{ key: "varieties", label: "涉及品种", value: entity.commodityIds.map((item) => commodityNameById(item, commodities.data)).join("、") }] : []),
        ]} />
      </DetailSection>
      {entity.attributes && Object.entries(entity.attributes).some(([, value]) => value !== "") &&
        <DetailSection title="属性与数值"><DetailRows items={Object.entries(entity.attributes).filter(([, value]) => value !== "").map(([key, value]) => ({ key, label: key, value }))} /></DetailSection>}
      <DetailSection title="证据状态">
        <DetailRows items={[
          { key: "evidence", label: "状态", value: entity.evidenceStatus ? (evidenceStatusLabels[entity.evidenceStatus] ?? entity.evidenceStatus) : "—" },
          { key: "source", label: "来源类型", value: entity.sourceType ? (entity.sourceType === "preset" ? "预置" : "事实") : "—" },
        ]} />
      </DetailSection>
      <DetailSection title="关系" hint={`${relations.length} 条`}>
        {relations.length ? [...new Set(relations.map((r) => r.type))].map((type) => (
          <div className="detail-relation-group" key={type}>
            <div className="detail-relation-type">{relationTypeInfo(type, catalogs.types.data)?.name ?? type}</div>
            {relations.filter((r) => r.type === type).map((r) => (
              <Button className="detail-relation-link" key={r.id} type="link" onClick={() => pushDetail({ kind: "relation", id: r.id })}>
                {r.source?.name ?? r.sourceId} {relationTypeInfo(r.type, catalogs.types.data)?.directed === false || r.type === "合作" ? "↔" : "→"} {r.target?.name ?? r.targetId}
              </Button>
            ))}
          </div>
        )) : <p className="detail-empty">暂无关系</p>}
      </DetailSection>
      <EvidenceFacts facts={entity.evidence} factIds={entity.factIds} preset={entity.sourceType === "preset"} />
      {(entity.createdAt || entity.updatedAt) && <DetailSection title="本体形成过程"><DetailRows items={[
        ...(entity.createdAt ? [{ key: "created", label: "首次写入", value: formatDate(entity.createdAt) }] : []),
        ...(entity.updatedAt ? [{ key: "updated", label: "最近更新", value: formatDate(entity.updatedAt) }] : []),
      ]} /></DetailSection>}
    </>
  );
};
export default EntityDetail;
