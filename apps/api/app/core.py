"""Core infrastructure utilities: structured redacted logging, rate limiting, and TTL caching."""

from __future__ import annotations

import json
import math
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

_SENSITIVE_KEY_PARTS = ("SECRET", "TOKEN", "PASSWORD", "API_KEY", "APIKEY", "AUTHORIZATION", "SERVICE_ROLE")
_TOKEN_PATTERN = re.compile(
    r"(Bearer\s+)[A-Za-z0-9._\-]+|(sb_(?:secret|publishable)_[A-Za-z0-9._\-]+)|(sk-[A-Za-z0-9._\-]+)|(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)",
    re.IGNORECASE,
)


def redact_sensitive_data(value: Any) -> Any:
    """Recursively redact secret keys and token patterns from log payloads."""
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            upper = str(key).upper()
            if any(part in upper for part in _SENSITIVE_KEY_PARTS):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = redact_sensitive_data(item)
        return sanitized
    if isinstance(value, list):
        return [redact_sensitive_data(item) for item in value]
    if isinstance(value, str):
        return _TOKEN_PATTERN.sub(lambda m: f"{m.group(1) or ''}[REDACTED]", value)
    return value


def emit_json_log(event: str, request_id: str, payload: dict[str, Any]) -> str:
    """Serialize a structured JSON log line with redacted secrets."""
    return json.dumps(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "event": event,
            "payload": redact_sensitive_data(payload),
        },
        ensure_ascii=False,
    )


class SlidingWindowRateLimiter:
    """In-memory sliding-window rate limiter keyed by user or IP."""

    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        now: float | None = None,
    ) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        current = time.monotonic() if now is None else now
        cutoff = current - window_seconds
        bucket = self._buckets[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if not bucket:
            self._buckets.pop(key, None)
            bucket = self._buckets[key]
        if len(bucket) >= max_requests:
            retry_after = max(1, math.ceil(bucket[0] + window_seconds - current))
            return False, retry_after
        bucket.append(current)
        # Prune other stale empty keys periodically to prevent unbounded growth
        if len(self._buckets) > 1000:
            stale_keys = [k for k, q in self._buckets.items() if not q or q[-1] <= cutoff]
            for stale_key in stale_keys:
                self._buckets.pop(stale_key, None)
        return True, 0

    def reset(self) -> None:
        """Clear all tracked rate-limit buckets (used in tests)."""
        self._buckets.clear()


class TTLCache:
    """Bounded TTL cache with prefix invalidation for spatial aggregates."""

    def __init__(self, ttl_seconds: int = 30, max_entries: int = 512) -> None:
        self._ttl_seconds = ttl_seconds
        self._max_entries = max(1, max_entries)
        self._entries: dict[str, tuple[float, Any]] = {}

    def get(self, key: str, now: float | None = None) -> Any | None:
        """Return cached value if fresh, otherwise None."""
        current = time.monotonic() if now is None else now
        entry = self._entries.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if current >= expires_at:
            self._entries.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, now: float | None = None) -> None:
        """Store value with configured TTL while enforcing max_entries bound."""
        current = time.monotonic() if now is None else now
        if len(self._entries) >= self._max_entries and key not in self._entries:
            expired = [k for k, (exp, _) in self._entries.items() if current >= exp]
            for k in expired:
                self._entries.pop(k, None)
            while len(self._entries) >= self._max_entries:
                oldest = next(iter(self._entries))
                self._entries.pop(oldest, None)
        self._entries[key] = (current + self._ttl_seconds, value)

    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all cache entries whose keys start with prefix."""
        keys = [key for key in self._entries if key.startswith(prefix)]
        for key in keys:
            self._entries.pop(key, None)

    def clear(self) -> None:
        """Drop all cached entries."""
        self._entries.clear()
