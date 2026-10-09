import { Button, Space } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
const RelationContextBar = () => {
  const { context, refresh, exit } = useDashboardStore(
    useShallow((s) => ({
      context: s.relationContext,
      refresh: s.refreshRelationContext,
      exit: s.exitRelationContext,
    })),
  );
  if (!context) return null;
  return (
    <div className="relation-context-bar">
      <Space wrap>
        <span>
          上下文：
          {context.factTitle ??
            context.factId ??
            context.rootEntityName ??
            context.rootEntityId}
        </span>
        <Button type="link" onClick={refresh}>
          刷新
        </Button>
        <Button type="link" onClick={exit}>
          退出上下文
        </Button>
      </Space>
    </div>
  );
};
export default RelationContextBar;
