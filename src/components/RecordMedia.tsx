interface IProps {
  images?: string[] | null;
  videos?: string[] | null;
  /** 图片替代文本，按卡片/详情所属图层区分。 */
  alt: string;
  /** card：列表卡片；detail：详情面板，缩略图与播放器更大。 */
  variant?: "card" | "detail";
}

/** 媒体区：图片缩略图在上、视频在下；样式见 pages/Dashboard/index.less 的 .record-media / .detail-media。 */
const RecordMedia = ({ images, videos, alt, variant = "card" }: IProps) => {
  const prefix = variant === "detail" ? "detail-media" : "record-media";
  return (
    <>
      {images?.length ? (
        <div className={prefix}>
          {images.map((src) => (
            <img
              key={src}
              className={`${prefix}-item`}
              src={src}
              alt={alt}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
      {videos?.length ? (
        <div className={prefix}>
          {videos.map((src) => (
            <video
              key={src}
              className={`${prefix}-video`}
              src={src}
              controls
              playsInline
              preload="metadata"
              // 播放控制不触发整卡选中。
              onClick={(event) => event.stopPropagation()}
            />
          ))}
        </div>
      ) : null}
    </>
  );
};
export default RecordMedia;
