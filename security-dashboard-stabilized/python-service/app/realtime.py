import json
import asyncio
import logging
from typing import Set
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger("aegis-realtime")

from app.event_bus import EventPublisher

from pydantic import BaseModel

class PublishEventRequest(BaseModel):
    event_type: str
    data: dict

event_publisher = EventPublisher()
router = APIRouter()

@router.post("/publish")
async def publish_realtime_event(payload: PublishEventRequest):
    await event_publisher.publish(payload.event_type, payload.data)
    return {"status": "published"}

@router.get("/events")
async def stream_events(request: Request):
    queue = event_publisher.subscribe(request.state.service_context["tenant"])
    
    async def event_generator():
        try:
            # Send initial connection success event
            yield "event: connection\ndata: {\"status\": \"connected\"}\n\n"
            
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"event: {event['event_type']}\ndata: {json.dumps(event['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: keep-alive\n\n"
        except Exception as e:
            logger.error(f"Error in realtime event stream generator: {str(e)}")
        finally:
            event_publisher.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
