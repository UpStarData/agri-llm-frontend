import { Button } from "antd";
import {
  AimOutlined,
  ApartmentOutlined,
  CompressOutlined,
  EnvironmentOutlined,
  ExpandOutlined,
  GlobalOutlined,
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useDashboardStore } from "@/store";
import FactMapTools from "./FactMapTools";
import RelationMapTools from "./RelationMapTools";
import { Tooltip } from "antd";
interface IProps {
  isGlobe: boolean;
  isGraph: boolean;
  isFullscreen: boolean;
  onViewChange: (view: "3d" | "2d" | "graph") => void;
  onToggleGlobe: () => void;
  onFullscreen: () => Promise<void>;
  onZoom: (direction: number) => void;
  onReset: () => void;
}
const MapControls = ({
  isGlobe,
  isGraph,
  isFullscreen,
  onViewChange,
  onToggleGlobe,
  onFullscreen,
  onZoom,
  onReset,
}: IProps) => {
  const mode = useDashboardStore((s) => s.mode);
  return (
    <div className="map-controls" aria-label="地图操作">
      {mode === "relation" && (
        <>
          <Tooltip title="3D 地图" placement="left">
            <Button
              type={!isGraph && isGlobe ? "primary" : "text"}
              shape="circle"
              icon={<GlobalOutlined />}
              aria-label="3D 地图"
              aria-pressed={!isGraph && isGlobe}
              onClick={() => onViewChange("3d")}
            />
          </Tooltip>
          <Tooltip title="2D 地图" placement="left">
            <Button
              type={!isGraph && !isGlobe ? "primary" : "text"}
              shape="circle"
              icon={<EnvironmentOutlined />}
              aria-label="2D 地图"
              aria-pressed={!isGraph && !isGlobe}
              onClick={() => onViewChange("2d")}
            />
          </Tooltip>
        </>
      )}
      {mode === "relation" && (
        <Tooltip title="图谱" placement="left">
          <Button
            type={isGraph ? "primary" : "text"}
            shape="circle"
            icon={<ApartmentOutlined />}
            aria-label="图谱"
            aria-pressed={isGraph}
            onClick={() => onViewChange("graph")}
          />
        </Tooltip>
      )}
      {mode === "fact" && (
        <Button
          type="text"
          shape="circle"
          icon={<GlobalOutlined />}
          aria-label={isGlobe ? "切换到平面地图" : "切换到球体地图"}
          onClick={onToggleGlobe}
        />
      )}
      <>
        <Button
          type="text"
          shape="circle"
          icon={<PlusOutlined />}
          aria-label="放大地图"
          onClick={() => onZoom(1)}
        />
        <Button
          type="text"
          shape="circle"
          icon={<MinusOutlined />}
          aria-label="缩小地图"
          onClick={() => onZoom(-1)}
        />
      </>
      <Button
        type="text"
        shape="circle"
        icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
        aria-label={isFullscreen ? "退出全屏" : "展开全屏"}
        onClick={onFullscreen}
      />
      {mode === "fact" && (
        <Button
          type="text"
          shape="circle"
          icon={<AimOutlined />}
          aria-label="重置地图视角"
          onClick={onReset}
        />
      )}
      {mode === "fact" ? <FactMapTools /> : <RelationMapTools />}
    </div>
  );
};
export default MapControls;
