import { Button, Empty, Spin } from "antd";
import { useFactDetail } from "@/hooks";
import RecordMedia from "@/components/RecordMedia";
import { useDashboardStore } from "@/store";
import { formatDate } from "@/utils/date";
import type { Entity } from "@/types";
import { evidenceStatusLabels } from "@/utils/factFilters";
import { DetailIntro, DetailRows, DetailSection } from "./DetailLayout";
import TypeFieldsSection from "./TypeFieldsSection";

interface IProps {
  id: string;
}

const FactDetail = ({ id }: IProps) => {
  const detail = useFactDetail(id);
  const enterRelation = useDashboardStore((s) => s.enterRelation);
  const fact = detail.data?.fact;
  if (detail.isPending) return <Spin description="正在加载事实详情" />;
  if (detail.isError) return null;
  if (!fact) return <Empty description="暂无详情" />;
  const entities =
    detail.data?.entities?.filter(
      (item): item is Pick<Entity, "id" | "name"> =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "name" in item &&
        typeof item.name === "string",
    ) ?? [];
  const regionPath = fact.geo?.regionPath ?? [];
  return (
    <>
      <DetailIntro id={fact.factId} label="事实 ID" title={fact.title} />
      <RecordMedia
        images={fact.imageArr}
        videos={fact.videoArr}
        alt="事实图片"
        variant="detail"
      />
      <DetailSection title="事实摘要">
        <p className="detail-paragraph">{fact.summary || "暂无摘要"}</p>
      </DetailSection>
      <DetailSection title="分类与时间">
        <DetailRows
          items={[
            {
              key: "category",
              label: "分类",
              value: fact.fullCategoryName || fact.categoryName || "—",
            },
            {
              key: "time",
              label: "发生时间",
              value: fact.occurredAt ? formatDate(fact.occurredAt) : "—",
            },
            {
              key: "region",
              label: "地理范围",
              value: regionPath.map(({ name }) => name).join(" › ") || "—",
            },
          ]}
        />
      </DetailSection>
      <DetailSection
        title="涉及本体"
        hint={entities.length ? "点击进入关联层" : undefined}
      >
        {entities.length ? (
          <div className="detail-chip-list">
            {entities.map((entity) => (
              <Button
                className="detail-chip"
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
            ))}
          </div>
        ) : fact.entityCandidates?.length ? (
          <div className="detail-chip-list">
            {fact.entityCandidates.map((entity, index) => (
              <span className="detail-chip" key={`${entity.name}-${index}`}>
                {entity.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="detail-empty">暂无关联本体</p>
        )}
      </DetailSection>
      <DetailSection title="关键数值">
        {fact.keyMetrics ? (
          <p className="detail-paragraph detail-key-metrics-text">
            {fact.keyMetrics}
          </p>
        ) : (
          <p className="detail-empty">来源材料未提供可核对的数值和口径。</p>
        )}
      </DetailSection>
      <DetailSection title="显示层级与地理影响">
        <DetailRows
          items={[
            {
              key: "level",
              label: "显示层级",
              value: regionPath.at(-1)?.name || "—",
            },
            { key: "radius", label: "地理影响半径", value: "未知" },
          ]}
        />
      </DetailSection>
      <DetailSection title="证据状态">
        <DetailRows
          items={[
            {
              key: "status",
              label: "状态",
              value: fact.evidenceStatus
                ? (evidenceStatusLabels[fact.evidenceStatus] ??
                  fact.evidenceStatus)
                : "—",
            },
            // { key: "mode", label: "数据来源类型", value: fact.dataMode || "—" },
          ]}
        />
      </DetailSection>
      <TypeFieldsSection fields={fact.typeFields} />

      <DetailSection title="事实形成过程">
        <DetailRows
          items={[
            {
              key: "created",
              label: "创建时间",
              value: formatDate(fact.createdAt),
            },
          ]}
        />
      </DetailSection>
      <div className="detail-actions">
        <Button
          onClick={() =>
            enterRelation({ factId: fact.factId, factTitle: fact.title })
          }
        >
          在关联层查看
        </Button>
        <Button disabled onClick={() => {}}>
          基于该事实发起推演
        </Button>
      </div>
    </>
  );
};
export default FactDetail;
