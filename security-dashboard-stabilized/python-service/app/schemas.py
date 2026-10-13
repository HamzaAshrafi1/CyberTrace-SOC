from datetime import datetime
from ipaddress import ip_address
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class IngestRequest(BaseModel):
    source: str = Field(min_length=1, max_length=200)
    ip: str
    message: str = Field(min_length=1, max_length=65536)
    apiKey: Optional[str] = Field(default=None, max_length=512)
    eventId: Optional[str] = Field(default=None, min_length=1, max_length=200)
    eventTime: Optional[datetime] = None
    isSimulated: bool = False

    @field_validator("ip")
    @classmethod
    def valid_ip(cls, value):
        ip_address(value)
        return value

    @field_validator("eventTime")
    @classmethod
    def aware_time(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("eventTime must include a timezone")
        return value

class IngestResponse(BaseModel):
    detected: bool
    attack_type: Optional[str] = None
    severity: Optional[str] = None
    incident_created: bool
    trace_id: Optional[str] = None
    event_id: Optional[str] = None
    duplicate: bool = False
