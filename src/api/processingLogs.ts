export type ProcessingLogConnection = "connecting" | "connected" | "reconnecting" | "closed";

export function subscribeProcessingLogs(
  onLog: (log: string) => void,
  onConnectionChange: (state: ProcessingLogConnection) => void,
) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const stream = new EventSource(`${baseUrl}/processing-logs/live`);
  const receive = (event: MessageEvent<string>) => {
    onLog(event.data);
  };
  stream.onmessage = receive;
  stream.onopen = () => onConnectionChange("connected");
  stream.onerror = () => onConnectionChange(
    stream.readyState === EventSource.CLOSED ? "closed" : "reconnecting",
  );
  return () => stream.close();
}
