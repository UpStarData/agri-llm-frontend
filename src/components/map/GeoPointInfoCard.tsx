import { Button, Card, Descriptions } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { _GlobeViewport as GlobeViewport, WebMercatorViewport } from "@deck.gl/core";
import type { Viewport } from "@deck.gl/core";
import type { GeoPoint, GeoPointKind } from "@/api/fact";

const categoryLabels: Record<GeoPointKind, string> = {
  region: "农作物主要产区",
  port: "港口",
  airport: "机场",
  market: "农贸市场",
  risk: "地缘风险区",
};

interface IProps {
  point: GeoPoint;
  viewport: Viewport;
  onClose: () => void;
}

const GeoPointInfoCard = ({ point, viewport, onClose }: IProps) => {
  const position = [...point.geoPoint];
  if (viewport instanceof GlobeViewport) {
    const radians = Math.PI / 180;
    const latitude = point.geoPoint[1] * radians;
    const center = viewport.latitude * radians;
    // 球体背面的图标不可见时，卡片也不展示。
    if (Math.sin(latitude) * Math.sin(center) + Math.cos(latitude) * Math.cos(center) *
      Math.cos((position[0] - viewport.longitude) * radians) <= 0) return null;
  } else if (viewport instanceof WebMercatorViewport) {
    // 平面世界重复显示时，跟随当前视野中的经度副本。
    position[0] += 360 * Math.round((viewport.longitude - position[0]) / 360);
  }
  const [x, y] = viewport.project(position);
  if (x < 0 || x > viewport.width || y < 0 || y > viewport.height) return null;
  const width = Math.min(340, viewport.width - 16);
  return (
    <Card
      size="small"
      role="dialog"
      aria-label="叠加图层简要信息"
      title="简要信息"
      extra={<Button type="link" icon={<CloseOutlined />} aria-label="关闭简要信息" onClick={onClose} />}
      style={{
        position: "absolute",
        left: Math.max(width / 2 + 8, Math.min(viewport.width - width / 2 - 8, x)),
        top: y - 18,
        transform: "translate(-50%, -100%)",
        width,
        pointerEvents: "auto",
      }}
      styles={{ body: { maxHeight: 260, overflowY: "auto", overflowWrap: "anywhere" } }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <Descriptions column={1} size="small" items={[
        { key: "name", label: "名称", children: point.name },
        { key: "category", label: "分类", children: categoryLabels[point.kind] },
        { key: "description", label: "简介", children: point.description || "暂无简介" },
      ]} />
    </Card>
  );
};

export default GeoPointInfoCard;
