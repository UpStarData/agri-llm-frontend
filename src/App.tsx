import { useEffect, type CSSProperties } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { QueryClientProvider } from "@tanstack/react-query";
import { ecologyCssVariables } from "./utils/ecologyTheme";
import Dashboard from "./pages/Dashboard";
import { queryClient } from "./queryClient";
import { useDashboardStore } from "./store";
import { getAntdTheme } from "./styles/antdTheme";
import { setRequestErrorHandler } from "./api/request";

const RequestErrorMessages = () => {
  const { message } = AntApp.useApp();

  useEffect(() => {
    setRequestErrorHandler((content) => {
      void message.error({ content, key: content });
    });
    return () => setRequestErrorHandler();
  }, [message]);

  return null;
};

const App = () => {
  const colorTheme = useDashboardStore((s) => s.colorTheme);
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={getAntdTheme(colorTheme)}>
        <AntApp className={`theme-${colorTheme}`} style={colorTheme === "light" ? ecologyCssVariables as CSSProperties : undefined}>
          <RequestErrorMessages />
          <Dashboard />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App
