import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

export interface RecordAutoScrollOptions {
  scope: string;
  busy: boolean;
  /** 当前展示的是上一组筛选条件的占位数据，真实结果尚未到达。 */
  pending?: boolean;
  hasNextPage: boolean;
  hasRecords: boolean;
  loadMore: () => Promise<unknown>;
  refresh: () => Promise<unknown>;
}

/** 自动分页与刷新串行执行，整轮浏览结束后才重取第一页。 */
export function useRecordAutoScroll(
  contentRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  options?: RecordAutoScrollOptions,
) {
  const latest = useRef({ enabled, options });
  useLayoutEffect(() => { latest.current = { enabled, options }; });
  const scope = options?.scope;
  const pending = Boolean(options?.pending);
  // 占位数据期间不动滚动位置，等新卡片真正替换旧卡片时再一起回到顶部，
  // 否则旧内容会先跳一次、稍后又被整批换掉，看起来就是抖一下。
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!pending && element) element.scrollTop = 0;
  }, [pending, scope, contentRef]);
  useEffect(() => {
    const element = contentRef.current;
    if (!element || scope === undefined) return;
    let stopped = false;
    let running = false;
    let hovered = false;
    let pauseUntil = 0;
    let bottomSince = 0;
    let lastRefresh = Date.now();
    const enter = () => { hovered = true; };
    const leave = () => { hovered = false; pauseUntil = Date.now() + 2000; };
    const activity = () => { pauseUntil = Date.now() + 5000; };
    element.addEventListener("mouseenter", enter);
    element.addEventListener("mouseleave", leave);
    element.addEventListener("wheel", activity, { passive: true });
    element.addEventListener("touchstart", activity, { passive: true });
    element.addEventListener("keydown", activity);
    const tick = async () => {
      const { enabled, options: state } = latest.current;
      if (stopped || !enabled || !state || state.busy || running || hovered ||
          document.hidden || !navigator.onLine || Date.now() < pauseUntil ||
          element.contains(document.activeElement)) {
        bottomSince = 0;
        return;
      }
      const maxScroll = element.scrollHeight - element.clientHeight;
      const nearBottom = element.scrollTop >= maxScroll - 80;
      if (nearBottom && state.hasNextPage) {
        running = true;
        try { await state.loadMore(); }
        catch { pauseUntil = Date.now() + 5000; }
        finally {
          // 请求失败或返回空页时同样留出重试间隔，避免每帧请求。
          pauseUntil = Math.max(pauseUntil, Date.now() + 2000);
          running = false;
        }
        bottomSince = 0;
        return;
      }
      if (element.scrollTop < maxScroll - 1) {
        element.scrollTop += 1;
        bottomSince = 0;
        return;
      }
      if (!bottomSince) bottomSince = Date.now();
      // 无滚动内容时按 30 秒刷新；长列表在末尾停留 2 秒后开始下一轮。
      const due = maxScroll > 1 && state.hasRecords
        ? Date.now() - bottomSince >= 2000
        : Date.now() - lastRefresh >= 30_000;
      if (!due) return;
      running = true;
      element.scrollTop = 0;
      try { await state.refresh(); }
      catch { pauseUntil = Date.now() + 5000; }
      finally {
        if (!stopped) element.scrollTop = 0;
        lastRefresh = Date.now();
        bottomSince = 0;
        running = false;
      }
    };
    const timer = setInterval(() => void tick(), 50);
    return () => {
      stopped = true;
      clearInterval(timer);
      element.removeEventListener("mouseenter", enter);
      element.removeEventListener("mouseleave", leave);
      element.removeEventListener("wheel", activity);
      element.removeEventListener("touchstart", activity);
      element.removeEventListener("keydown", activity);
    };
  }, [contentRef, scope]);
}
