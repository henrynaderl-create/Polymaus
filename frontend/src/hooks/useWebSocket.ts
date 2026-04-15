import { useEffect, useRef, useCallback } from 'react';

type MsgHandler = (data: unknown) => void;

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function useWebSocket(onMessage: MsgHandler) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data));
      } catch {}
    };

    socket.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 30_000);

    socket.onopen = () => {
      clearTimeout(reconnectTimer.current);
    };

    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { connected: ws.current?.readyState === WebSocket.OPEN };
}
