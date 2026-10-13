import { useEffect, useRef } from "react";

export interface RealtimeEvent {
  event_type: string;
  data: any;
}

export function useRealtimeEvents(
  organizationId: string | undefined,
  onEvent: (type: string, data: any) => void
) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!organizationId) return;

    const url = "/api/realtime";
    
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      console.log(`Connecting to SSE stream at ${url}...`);
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log("SSE stream connection opened.");
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream connection error:", err);
        if (eventSource) {
          eventSource.close();
        }
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 5000);
      };

      const handleGenericEvent = (type: string, event: MessageEvent) => {
        try {
          if (event.data === "keep-alive") return;
          const payload = JSON.parse(event.data);
          // Verify tenant isolation boundary
          if (payload && payload.organizationId === organizationId) {
            onEventRef.current(type, payload);
          } else {
            console.log(`Event filtered out (tenant isolation): expected ${organizationId}, got ${payload?.organizationId}`);
          }
        } catch (error) {
          console.error(`Failed to parse SSE event data for ${type}:`, error);
        }
      };

      eventSource.addEventListener("threat", (e) => handleGenericEvent("threat", e));
      eventSource.addEventListener("incident", (e) => handleGenericEvent("incident", e));
      eventSource.addEventListener("security_log", (e) => handleGenericEvent("security_log", e));
      eventSource.addEventListener("compliance", (e) => handleGenericEvent("compliance", e));
    }

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [organizationId]);
}
