"""Pydantic v2 request and validation contracts for Daak v2 FastAPI endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DemoLoginRequest(BaseModel):
    role: Literal["citizen", "police", "admin"]


class SOSCreateRequest(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    area_name: str | None = Field(default=None, max_length=120)
    battery_level: int | None = Field(default=None, ge=0, le=100)
    note: str | None = Field(default=None, max_length=400)
    idempotency_key: str | None = Field(default=None, max_length=120)


class SOSDispatchRequest(BaseModel):
    status: Literal["claimed", "responding", "resolved", "false_alarm"]
    assigned_unit: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=400)


class SafeWalkCreateRequest(BaseModel):
    destination_name: str = Field(..., min_length=2, max_length=160)
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    destination_lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    destination_lng: float | None = Field(default=None, ge=-180.0, le=180.0)
    eta_minutes: int = Field(default=20, ge=1, le=240)


class SafeWalkCheckinRequest(BaseModel):
    action: Literal["complete", "extend", "cancel"]
    extend_minutes: int = Field(default=10, ge=1, le=60)
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lng: float | None = Field(default=None, ge=-180.0, le=180.0)


class ReportCreateRequest(BaseModel):
    category: Literal[
        "snatching",
        "theft",
        "assault",
        "harassment",
        "fraud",
        "vandalism",
        "suspicious_activity",
        "traffic_hazard",
        "other",
    ]
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    title: str = Field(..., min_length=3, max_length=140)
    description: str = Field(..., min_length=3, max_length=2000)
    area_name: str = Field(..., min_length=2, max_length=120)
    address_text: str | None = Field(default=None, max_length=240)
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    is_anonymous_public: bool = False
    media_urls: list[str] = Field(default_factory=list)


class CorroborateRequest(BaseModel):
    user_lat: float = Field(..., ge=-90.0, le=90.0)
    user_lng: float = Field(..., ge=-180.0, le=180.0)
    note: str | None = Field(default=None, max_length=300)


class ReportTipCreateRequest(BaseModel):
    body: str = Field(..., min_length=2, max_length=600)
    is_anonymous_public: bool = False


class ModerateReportRequest(BaseModel):
    status: Literal["pending", "verified", "investigating", "resolved", "rejected"] | None = None
    flag_status: Literal["none", "flagged", "cleared", "confirmed_false"] | None = None
    moderation_note: str | None = Field(default=None, max_length=500)


class AIChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lng: float | None = Field(default=None, ge=-180.0, le=180.0)


class ShiftHandoverCreateRequest(BaseModel):
    shift_label: str = Field(..., min_length=3, max_length=120)
    summary: str = Field(..., min_length=5, max_length=1000)
    open_sos_ids: list[str] = Field(default_factory=list)
    priority_areas: list[str] = Field(default_factory=list)


class CriminalCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=140)
    aliases: list[str] = Field(default_factory=list)
    crime_categories: list[str] = Field(default_factory=list)
    risk_level: Literal["low", "medium", "high", "critical"] = "medium"
    last_known_area: str = Field(..., min_length=2, max_length=120)
    status: Literal["wanted", "in_custody", "archived"] = "wanted"
    details: str = Field(default="", max_length=1000)


class CriminalUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=140)
    risk_level: Literal["low", "medium", "high", "critical"] | None = None
    last_known_area: str | None = Field(default=None, min_length=2, max_length=120)
    status: Literal["wanted", "in_custody", "archived"] | None = None
    details: str | None = Field(default=None, max_length=1000)
