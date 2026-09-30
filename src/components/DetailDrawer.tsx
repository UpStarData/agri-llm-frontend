import { CloseOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Space, Spin } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { formatDate } from "@/utils/date";
import { useFactDetail } from "@/hooks";
import type { MapData } from "@/types";

interface IProps {
  mapData?: MapData;
}

const DetailDrawer = ({ mapData }: IProps) => {
  const { open, selected, setOpen } = useDashboardStore(useShallow((s) => ({
    open: s.detailsOpen, selected: s.selection, setOpen: s.setDetailsOpen,
  })));
  const detail = useFactDetail(open && selected?.kind === "fact" ? selected.id : undefined);
  if (!open || !selected) return null;
  const fact = selected.kind === "fact" ? detail.data?.fact : undefined;
  const entity = selected.kind === "entity" ? mapData?.entities.find(({ id }) => id === selected.id) : undefined;
  const relation = selected.kind === "relation" ? mapData?.relations.find(({ id }) => id === selected.id) : undefined;
  return (
    <div className="fact-detail" role="region" aria-label={selected.kind === "fact" ? "事实详情" : "本体详情"}>
      <div className="layer-drawer-header">
        <span>{selected.kind === "fact" ? "事实详情" : "本体详情"}</span>
        <Button type="text" shape="circle" icon={<CloseOutlined />} aria-label="关闭详情" onClick={() => setOpen(false)} />
      </div>
      <div className="detail-content">
        {selected.kind === "fact" && detail.isPending ? <Spin description="正在加载事实详情" /> :
        selected.kind === "fact" && detail.isError ? null :
        fact ? <>
          <div className="detail-title">{fact.title}</div>
          <Descriptions column={1} size="small" items={[
            { key: "summary", label: "事实摘要", children: fact.summary },
            { key: "category", label: "分类", children: fact.dictLeaf?.split("|").at(-1) || "-" },
            { key: "time", label: "发生时间", children: fact.occurredAt ? formatDate(fact.occurredAt) : "-" },
            { key: "region", label: "地理范围", children: fact.geo?.regionPath?.map(({ name }) => name).join(" / ") || "-" },
            { key: "entities", label: "涉及本体", children: fact.entityCandidates?.map((entity) => entity.name).join("、") || "-" },
            { key: "evidence", label: "证据状态", children: fact.evidenceStatus || "-" },
            { key: "sources", label: "证据与来源", children: fact.evidenceCount ?? "-" },
            { key: "origin", label: "数据来源类型", children: fact.dataMode || "-" },
            { key: "id", label: "事实 ID", children: fact.factId },
          ]} />
          <div className="detail-section-title">事实形成过程</div>
          <Descriptions column={1} size="small" items={[
            { key: "created", label: "创建时间", children: formatDate(fact.createdAt) },
          ]} />
          <Space wrap style={{ marginTop: 16 }}>
            <Button disabled>在关联层查看</Button><Button disabled>基于该事实发起推演</Button>
          </Space>
        </> : entity || relation ? <>
          <div className="detail-title">{entity?.name ?? relation?.type}</div>
          <div>{entity?.description ?? relation?.description}</div>
        </> : <Empty description="暂无详情" />}
      </div>
    </div>
  );
};

export default DetailDrawer;
