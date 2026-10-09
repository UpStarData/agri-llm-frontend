import { ArrowLeftOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import FactDetail from "@/pages/Dashboard/component/FactDetail";
import EntityDetail from "@/pages/Dashboard/component/EntityDetail";
import RelationDetail from "@/pages/Dashboard/component/RelationDetail";
const DetailDrawer = () => {
  const { open, selected, stack, setOpen, back } = useDashboardStore(
    useShallow((s) => ({
      open: s.detailsOpen,
      selected: s.selection,
      stack: s.detailStack,
      setOpen: s.setDetailsOpen,
      back: s.backDetail,
    })),
  );
  if (!open || !selected) return null;
  const title = { fact: "事实详情", entity: "本体详情", relation: "关系详情" }[
    selected.kind
  ];
  return (
    <div className="fact-detail" role="region" aria-label={title}>
      <div className="layer-drawer-header">
        <span>{title}</span>
        <Space>
          {stack.length > 1 && (
            <Button
              type="text"
              shape="circle"
              icon={<ArrowLeftOutlined />}
              aria-label="返回上一详情"
              onClick={back}
            />
          )}
          <Button
            type="text"
            shape="circle"
            icon={<CloseOutlined />}
            aria-label="关闭详情"
            onClick={() => setOpen(false)}
          />
        </Space>
      </div>
      <div className="detail-content" key={`${selected.kind}:${selected.id}`}>
        {selected.kind === "fact" ? (
          <FactDetail id={selected.id} />
        ) : selected.kind === "entity" ? (
          <EntityDetail id={selected.id} />
        ) : (
          <RelationDetail id={selected.id} />
        )}
      </div>
    </div>
  );
};
export default DetailDrawer;
