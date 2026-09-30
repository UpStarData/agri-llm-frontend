import axios from "axios";
import type { AxiosRequestConfig } from "axios";

export type RequestConfig = AxiosRequestConfig & {
  errorPresentation?: "global" | "local";
};

export const apiEnabled = import.meta.env.VITE_ENABLE_API === "true";

export class ApiError extends Error {
  status?: number;
  requestId?: string;
  constructor(message: string, status?: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

let showRequestError: ((content: string) => void) | undefined;

export const notifyRequestError = (content: string) => {
  showRequestError?.(content);
};

export const setRequestErrorHandler = (handler?: (content: string) => void) => {
  showRequestError = handler;
};

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15_000,
  headers: { Accept: "application/json" },
});
client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    let apiError: ApiError;
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseData = error.response?.data as { message?: unknown; msg?: unknown } | undefined;
      const serverMessage = [responseData?.message, responseData?.msg].find(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      );
      const fallbackMessage =
        error.code === "ECONNABORTED"
          ? "请求超时，请稍后重试"
          : status
            ? `接口请求失败（${status}）`
            : "网络连接失败，请检查服务地址";
      apiError = new ApiError(
        serverMessage ?? fallbackMessage,
        status,
        error.response?.headers["x-request-id"],
      );
    } else {
      apiError = new ApiError("请求失败");
    }
    const presentation = axios.isAxiosError(error)
      ? (error.config as RequestConfig | undefined)?.errorPresentation
      : undefined;
    if (presentation !== "local") {
      notifyRequestError(apiError.message);
    }
    return Promise.reject(apiError);
  },
);

export const request = async <T>(config: RequestConfig): Promise<T> => {
  const { data } = await client.request<T>(config);
  return data;
};
