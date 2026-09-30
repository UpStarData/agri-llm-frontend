import type { ApiFact } from "@/api/fact";

const provinceSuffixes: Record<string, string> = {
  "11": "BJ", "12": "TJ", "13": "HE", "14": "SX", "15": "NM",
  "21": "LN", "22": "JL", "23": "HL", "31": "SH", "32": "JS",
  "33": "ZJ", "34": "AH", "35": "FJ", "36": "JX", "37": "SD",
  "41": "HA", "42": "HB", "43": "HN", "44": "GD", "45": "GX",
  "46": "HI", "50": "CQ", "51": "SC", "52": "GZ", "53": "YN",
  "54": "XZ", "61": "SN", "62": "GS", "63": "QH", "64": "NX",
  "65": "XJ", "71": "TW", "81": "HK", "82": "MO",
};

export const varietyCommodityIds: Record<string, string> = {
  "榴莲": "e:cmd:durian",
  "樱桃": "e:cmd:cherry",
  "辣椒": "e:cmd:chili",
};

export const provinceApiCode = (provinceId: string) => {
  const suffix = provinceSuffixes[provinceId.slice(0, 2)];
  return suffix ? `CN-${suffix}` : undefined;
};

export const matchesFactFilters = (
  fact: ApiFact,
  countryId: string,
  provinceId: string,
) => {
  const path = fact.geo?.regionPath ?? [];
  if (countryId === "CN" && !path.some((part) => part.code === "CHN" || part.code === "CN")) return false;
  if (provinceId) {
    const code = provinceApiCode(provinceId);
    if (!code || !path.some((part) => part.code === code)) return false;
  }
  return true;
};
