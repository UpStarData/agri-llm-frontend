import { ArrowLeftOutlined, CloseOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import type { Selection } from "@/types";
import FactDetail from "@/pages/Dashboard/component/FactDetail";
import EntityDetail from "@/pages/Dashboard/component/EntityDetail";
import RelationDetail from "@/pages/Dashboard/component/RelationDetail";
import type { useRelationCatalogs } from "@/hooks/useRelationQueries";

interface IProps {
  catalogs: ReturnType<typeof useRelationCatalogs>;
}

const detailTitles: Record<Selection["kind"], string> = {
  fact: "事实详情",
  entity: "本体详情",
  relation: "关系详情",
};

const DetailDrawer = ({ catalogs }: IProps) => {
  const { open, stack, setOpen, back } = useDashboardStore(
    useShallow((s) => ({
      open: s.detailsOpen,
      stack: s.detailStack,
      setOpen: s.setDetailsOpen,
      back: s.backDetail,
    })),
  );
  if (!open || !stack.length) return null;
  return (
    <div className={`detail-stack${stack.length > 1 ? " is-split" : ""}`}>
      {stack.map((item, index) => (
        <div
          className="fact-detail"
          // 第一个详情沿用原来的位置贴右侧，钻取详情排在它左边。
          key={`${item.kind}:${item.id}`}
          role="region"
          aria-label={detailTitles[item.kind]}
        >
          <div className="layer-drawer-header">
            <span>{detailTitles[item.kind]}</span>
            <div className="detail-header-actions">
              {index === 0 && stack.length > 1 && (
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  aria-label="返回上一详情"
                  onClick={back}
                />
              )}
              <Button
                type="text"
                icon={<CloseOutlined />}
                aria-label={index === 0 ? "关闭详情" : "关闭当前详情"}
                onClick={index === 0 ? () => setOpen(false) : back}
              />
            </div>
          </div>
          <div className="detail-content">
            {item.kind === "fact" ? (
              <FactDetail id={item.id} />
            ) : item.kind === "entity" ? (
              <EntityDetail id={item.id} catalogs={catalogs} />
            ) : (
              <RelationDetail id={item.id} catalogs={catalogs} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
export default DetailDrawer;
