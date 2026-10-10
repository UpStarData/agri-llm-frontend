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
  const type = relationTypeInfo(relation.type, catalogs.types.data);
  const arrow = type?.directed === false || relation.type === "合作" ? "↔" : "→";
  return (
    <>
      <DetailIntro id={relation.id} label="关系 ID" title={<>{relation.source?.name ?? relation.sourceId} {arrow} {type?.name ?? relation.type} {arrow} {relation.target?.name ?? relation.targetId}</>} />
      <DetailSection title="关系概览">
        <DetailRows items={[
          { key: "source", label: "起点", value: <Button className="detail-inline-link" type="link" onClick={() => pushDetail({ kind: "entity", id: relation.sourceId })}>{relation.source?.name ?? relation.sourceId}{relation.source && `（${entityCategoryName(relation.source.type, catalogs.categories.data)}）`}</Button> },
          { key: "target", label: "终点", value: <Button className="detail-inline-link" type="link" onClick={() => pushDetail({ kind: "entity", id: relation.targetId })}>{relation.target?.name ?? relation.targetId}{relation.target && `（${entityCategoryName(relation.target.type, catalogs.categories.data)}）`}</Button> },
          { key: "type", label: "关系类型", value: type?.name ?? relation.type },
        ]} />
      </DetailSection>
      {relation.basis && <DetailSection title="判断依据"><p className="detail-paragraph">{relation.basis}</p></DetailSection>}
      {relation.attributes && Object.entries(relation.attributes).some(([, value]) => value !== "") &&
        <DetailSection title="属性与数值"><DetailRows items={Object.entries(relation.attributes).filter(([, value]) => value !== "").map(([key, value]) => ({ key, label: key, value }))} /></DetailSection>}
      <DetailSection title="证据状态">
        <DetailRows items={[
          { key: "evidence", label: "状态", value: relation.evidenceStatus ? (evidenceStatusLabels[relation.evidenceStatus] ?? relation.evidenceStatus) : "—" },
          { key: "origin", label: "来源类型", value: relation.sourceType ? (relation.sourceType === "preset" ? "预置" : "事实") : "—" },
        ]} />
      </DetailSection>
      <EvidenceFacts facts={relation.evidence} factIds={relation.factIds} preset={relation.sourceType === "preset"} />
      {(relation.createdAt || relation.updatedAt) && <DetailSection title="形成过程"><DetailRows items={[
        ...(relation.createdAt ? [{ key: "created", label: "首次写入", value: formatDate(relation.createdAt) }] : []),
        ...(relation.updatedAt ? [{ key: "updated", label: "最近更新", value: formatDate(relation.updatedAt) }] : []),
      ]} /></DetailSection>}
    </>
  );
};
export default RelationDetail;
