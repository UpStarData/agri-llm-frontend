import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/zh-cn";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("zh-cn");
export const DISPLAY_TIMEZONE = "Asia/Shanghai";
export function dateRangeToUtc(start: string, end: string) {
  return {
    field: "eventTime" as const,
    from: dayjs.tz(start, DISPLAY_TIMEZONE).startOf("day").toISOString(),
    to: dayjs
      .tz(end, DISPLAY_TIMEZONE)
      .add(1, "day")
      .startOf("day")
      .toISOString(),
  };
}
export function formatDate(value?: string | null) {
  return value && dayjs(value).isValid()
    ? dayjs(value).tz(DISPLAY_TIMEZONE).format("YYYY-MM-DD HH:mm")
    : "—";
}
export default dayjs;
