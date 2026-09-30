import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { ApiError, request, setRequestErrorHandler } from "../src/api/request";
import { queryClient } from "../src/queryClient";

afterEach(() => setRequestErrorHandler());

describe("统一请求错误处理", () => {
  it("接口失败时使用服务端错误文案提示并保留请求信息", async () => {
    const showError = vi.fn();
    setRequestErrorHandler(showError);

    await expect(
      request({
        url: "/test",
        adapter: async (config) => {
          throw new AxiosError("Bad Request", "ERR_BAD_REQUEST", config, undefined, {
            data: { message: "参数不正确" },
            status: 400,
            statusText: "Bad Request",
            headers: new AxiosHeaders({ "x-request-id": "request-1" }),
            config,
          });
        },
      }),
    ).rejects.toMatchObject<ApiError>({
      message: "参数不正确",
      status: 400,
      requestId: "request-1",
    });
    expect(showError).toHaveBeenCalledExactlyOnceWith("参数不正确");
  });

  it("局部处理的接口失败时交给调用方展示错误", async () => {
    const showError = vi.fn();
    setRequestErrorHandler(showError);

    await expect(request({
      url: "/test",
      errorPresentation: "local",
      adapter: async (config) => {
        throw new AxiosError("Server Error", "ERR_BAD_RESPONSE", config, undefined, {
          data: { message: "概览加载失败" },
          status: 500,
          statusText: "Server Error",
          headers: new AxiosHeaders(),
          config,
        });
      },
    })).rejects.toMatchObject<ApiError>({ message: "概览加载失败", status: 500 });
    expect(showError).not.toHaveBeenCalled();
  });

  it("查询和响应解析失败后统一触发 message 处理器", async () => {
    const showError = vi.fn();
    setRequestErrorHandler(showError);
    await expect(queryClient.fetchQuery({
      queryKey: ["test", "query-error-message"],
      queryFn: () => Promise.reject(new Error("分类树格式不正确")),
      meta: { notifyOnError: true },
      retry: false,
    })).rejects.toThrow("分类树格式不正确");
    expect(showError).toHaveBeenCalledExactlyOnceWith("分类树格式不正确");
    queryClient.removeQueries({ queryKey: ["test", "query-error-message"] });
  });
});
