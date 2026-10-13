import asyncio
import logging
logger = logging.getLogger("aegis-realtime")

class EventPublisher:
    def __init__(self):
        self.listeners = {}

    def subscribe(self, tenant: str) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=256)
        self.listeners[queue] = tenant
        logger.info(f"New client subscribed to realtime events. Total listeners: {len(self.listeners)}")
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.listeners.pop(queue, None)
        logger.info(f"Client unsubscribed from realtime events. Total listeners: {len(self.listeners)}")

    async def publish(self, event_type: str, data: dict):
        payload = {"event_type": event_type, "data": data}
        logger.info(f"Publishing event '{event_type}' to {len(self.listeners)} listeners.")
        for queue, tenant in list(self.listeners.items()):
            if data.get("organizationId") != tenant:
                continue
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning("Slow SSE subscriber queue full; event dropped. Refresh stored events.")
            except Exception as e:
                logger.error(f"Failed to push event to listener queue: {str(e)}")

