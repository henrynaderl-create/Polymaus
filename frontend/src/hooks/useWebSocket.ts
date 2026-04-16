import { useEffect, useRef, useCallback } from 'react';

type MsgHandler = (data: unknown) => void;
type DisconnectHandler = () => void;

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function useWebSocket(onMessage: MsgHandler, onDisconnect?: DisconnectHandler) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  const onDisconnectRef = useRef(onDisconnect);
  onMessageRef.current = onMessage;
  onDisconnectRef.current = onDisconnect;

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      clearTimeout(reconnectTimer.current);
    };

    socket.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data));
      } catch {}
    };

    socket.onclose = () => {
      // Notify store so polling fallback activates immediately
      onDisconnectRef.current?.();
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    // Heartbeat every 25s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 25_000);

    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}
