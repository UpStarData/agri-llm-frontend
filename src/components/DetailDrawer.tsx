import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import FactDetail from "@/pages/Dashboard/component/FactDetail";
import EntityDetail from "@/pages/Dashboard/component/EntityDetail";
import RelationDetail from "@/pages/Dashboard/component/RelationDetail";
import type { useRelationCatalogs } from "@/hooks/useRelationQueries";

interface IProps {
  catalogs: ReturnType<typeof useRelationCatalogs>;
}

const DetailDrawer = ({ catalogs }: IProps) => {
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
        <Button
          className="detail-back"
          icon={<ArrowLeftOutlined />}
          aria-label={stack.length > 1 ? "返回上一详情" : "关闭详情"}
          onClick={stack.length > 1 ? back : () => setOpen(false)}
        >返回</Button>
      </div>
      <div className="detail-content" key={`${selected.kind}:${selected.id}`}>
        {selected.kind === "fact" ? (
          <FactDetail id={selected.id} />
        ) : selected.kind === "entity" ? (
          <EntityDetail id={selected.id} catalogs={catalogs} />
        ) : (
          <RelationDetail id={selected.id} catalogs={catalogs} />
        )}
      </div>
    </div>
  );
};
export default DetailDrawer;
