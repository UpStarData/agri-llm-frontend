import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError, notifyRequestError } from "./api/request";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.notifyOnError) notifyRequestError(error.message || "接口请求失败");
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status && error.status < 500) &&
        count < 1,
    },
    mutations: { retry: false },
  },
});
