import { Button, Descriptions, Empty, Spin } from "antd";
import { useFactDetail } from "@/hooks";
import { useDashboardStore } from "@/store";
import { formatDate } from "@/utils/date";
import type { Entity } from "@/types";
import { evidenceStatusLabels } from "@/utils/factFilters";
interface IProps {
  id: string;
}
const FactDetail = ({ id }: IProps) => {
  const detail = useFactDetail(id);
  const mode = useDashboardStore((s) => s.mode);
  const enterRelation = useDashboardStore((s) => s.enterRelation);
  const fact = detail.data?.fact;
  if (detail.isPending) return <Spin description="正在加载事实详情" />;
  if (detail.isError) return null;
  if (!fact) return <Empty description="暂无详情" />;
  const entities =
    detail.data?.entities.filter(
      (item): item is Pick<Entity, "id" | "name"> =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "name" in item &&
        typeof item.name === "string",
    ) ?? [];
  return (
    <>
      <div className="detail-title">{fact.title}</div>
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: "summary", label: "事实摘要", children: fact.summary },
          {
            key: "category",
            label: "分类",
            children: fact.categoryName || "-",
          },
          {
            key: "time",
            label: "发生时间",
            children: fact.occurredAt ? formatDate(fact.occurredAt) : "-",
          },
          {
            key: "region",
            label: "地理范围",
            children:
              fact.geo?.regionPath?.map(({ name }) => name).join(" / ") || "-",
          },
          {
            key: "entities",
            label: "涉及本体",
            children:
              mode === "fact" && entities.length
                ? entities.map((entity) => (
                    <Button
                      type="link"
                      key={entity.id}
                      onClick={() =>
                        enterRelation({
                          rootEntityId: entity.id,
                          rootEntityName: entity.name,
                        })
                      }
                    >
                      {entity.name}
                    </Button>
                  ))
                : fact.entityCandidates
                    ?.map((entity) => entity.name)
                    .join("、") || "-",
          },
          {
            key: "evidence",
            label: "证据状态",
            children: fact.evidenceStatus
              ? (evidenceStatusLabels[fact.evidenceStatus] ?? fact.evidenceStatus)
              : "-",
          },
          {
            key: "sources",
            label: "证据与来源",
            children: fact.evidenceCount ?? "-",
          },
          {
            key: "origin",
            label: "数据来源类型",
            children: fact.dataMode || "-",
          },
          { key: "id", label: "事实 ID", children: fact.factId },
        ]}
      />
      <div className="detail-section-title">事实形成过程</div>
      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: "created",
            label: "创建时间",
            children: formatDate(fact.createdAt),
          },
        ]}
      />
      {mode === "fact" && (
        <Button
          type="link"
          onClick={() =>
            enterRelation({ factId: fact.factId, factTitle: fact.title })
          }
        >
          在关联层查看
        </Button>
      )}
    </>
  );
};
export default FactDetail;
