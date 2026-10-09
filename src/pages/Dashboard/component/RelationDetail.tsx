import { Button, Descriptions, Empty, Spin } from "antd";
import {
  useRelationCatalogs,
  useRelationDetail,
} from "@/hooks/useRelationQueries";
import { useDashboardStore } from "@/store";
import { evidenceStatusLabels } from "@/utils/factFilters";
import { formatDate } from "@/utils/date";
import EvidenceFacts from "./EvidenceFacts";
import { entityCategoryName, relationTypeInfo } from "@/utils/relationFilters";
interface IProps {
  id: string;
}
const RelationDetail = ({ id }: IProps) => {
  const detail = useRelationDetail(id);
  const catalogs = useRelationCatalogs();
  const pushDetail = useDashboardStore((s) => s.pushDetail);
  if (detail.isPending) return <Spin description="正在加载关系详情" />;
  if (detail.isError) return null;
  const relation = detail.data;
  if (!relation) return <Empty description="暂无详情" />;
  const type = relationTypeInfo(relation.type, catalogs.types.data);
  const arrow =
    type?.directed === false || relation.type === "合作" ? "↔" : "→";
  return (
    <>
      <div className="detail-title">
        {relation.source?.name ?? relation.sourceId} {arrow}{" "}
        {type?.name ?? relation.type} {arrow}{" "}
        {relation.target?.name ?? relation.targetId}
      </div>
      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: "source",
            label: "起点",
            children: (
              <Button
                type="link"
                onClick={() =>
                  pushDetail({ kind: "entity", id: relation.sourceId })
                }
              >
                {relation.source?.name ?? relation.sourceId}
                {relation.source &&
                  `（${entityCategoryName(relation.source.type, catalogs.categories.data)}）`}
              </Button>
            ),
          },
          {
            key: "target",
            label: "终点",
            children: (
              <Button
                type="link"
                onClick={() =>
                  pushDetail({ kind: "entity", id: relation.targetId })
                }
              >
                {relation.target?.name ?? relation.targetId}
                {relation.target &&
                  `（${entityCategoryName(relation.target.type, catalogs.categories.data)}）`}
              </Button>
            ),
          },
          {
            key: "type",
            label: "关系类型",
            children: type?.name ?? relation.type,
          },
          ...(relation.evidenceStatus
            ? [
                {
                  key: "evidence",
                  label: "证据状态",
                  children:
                    evidenceStatusLabels[relation.evidenceStatus] ??
                    relation.evidenceStatus,
                },
              ]
            : []),
          ...(relation.basis
            ? [{ key: "basis", label: "判断依据", children: relation.basis }]
            : []),
          ...(relation.sourceType
            ? [
                {
                  key: "origin",
                  label: "来源类型",
                  children: relation.sourceType === "preset" ? "预置" : "事实",
                },
              ]
            : []),
        ]}
      />
      <EvidenceFacts
        facts={relation.evidence}
        factIds={relation.factIds}
        preset={relation.sourceType === "preset"}
      />
      <div className="detail-section-title">形成过程</div>
      <Descriptions
        column={1}
        size="small"
        items={[
          ...(relation.createdAt
            ? [
                {
                  key: "created",
                  label: "首次写入",
                  children: formatDate(relation.createdAt),
                },
              ]
            : []),
          ...(relation.updatedAt
            ? [
                {
                  key: "updated",
                  label: "最近更新",
                  children: formatDate(relation.updatedAt),
                },
              ]
            : []),
        ]}
      />
      {relation.attributes && (
        <Descriptions
          column={1}
          size="small"
          items={Object.entries(relation.attributes)
            .filter(([, value]) => value !== "")
            .map(([key, value]) => ({ key, label: key, children: value }))}
        />
      )}
    </>
  );
};
export default RelationDetail;
