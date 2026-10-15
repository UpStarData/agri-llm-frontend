import type { ReactNode } from "react";
import { Switch } from "antd";
import { useDashboardStore } from "@/store";
import LayerDrawer from "@/pages/Dashboard/component/LayerDrawer";
interface IProps {
  children: ReactNode;
}
const LeftLayerDrawer = ({ children }: IProps) => {
  const visible = useDashboardStore((s) => s.mapControlsVisible);
  const setVisible = useDashboardStore((s) => s.setMapControlsVisible);
  return (
    <LayerDrawer side="left" title="左侧菜单">
      {children}
      <div className="menu-section">
        <div className="drawer-control-header menu-section-title">
          <span>地图快捷键</span>
          <Switch size="small" aria-label="地图快捷键" checked={visible} onChange={setVisible} />
        </div>
      </div>
    </LayerDrawer>
  );
};
export default LeftLayerDrawer;
