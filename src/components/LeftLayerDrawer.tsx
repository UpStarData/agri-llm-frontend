import type { ReactNode } from "react";
import LayerDrawer from "@/pages/Dashboard/component/LayerDrawer";
interface IProps {
  children: ReactNode;
}
const LeftLayerDrawer = ({ children }: IProps) => (
  <LayerDrawer side="left" title="左侧菜单">
    {children}
  </LayerDrawer>
);
export default LeftLayerDrawer;
