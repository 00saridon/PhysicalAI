import asyncio
import json
from collections import deque


class EventBus:
    """Simple fan-out event bus for SSE broadcasting.

    Optionally retains a bounded history of past events. When ``history_size``
    is set, a subscriber that connects mid-run is backfilled with the events it
    missed (late-join), so e.g. the Training metrics chart can render the full
    reward curve even when opened after a stage has already started.
    """

    def __init__(self, history_size: int = 0, history_events: set[str] | None = None):
        self._subscribers: list[asyncio.Queue] = []
        # `_history is None` means history is disabled (default, e.g. log bus).
        self._history: deque[dict] | None = (
            deque(maxlen=history_size) if history_size > 0 else None
        )
        # Which event types to retain. None = all. We deliberately exclude
        # control events like "done"/"error" so a late joiner isn't told the
        # stream is already finished the instant it connects.
        self._history_events = history_events
        self._seq = 0  # monotonic id stamped on retained events

    async def publish(self, event: dict) -> None:
        if self._history is not None and (
            self._history_events is None or event.get("event") in self._history_events
        ):
            # Stamp a unique SSE id so clients can dedupe replayed events after a
            # reconnect/backfill (the browser surfaces it as MessageEvent.lastEventId).
            self._seq += 1
            event["id"] = str(self._seq)
            self._history.append(event)
        for q in list(self._subscribers):
            await q.put(event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        # Backfill missed events before live ones start flowing.
        if self._history is not None:
            for event in self._history:
                q.put_nowait(event)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)

    def clear_history(self, stage: str | None = None) -> None:
        """Drop retained events. With ``stage`` set, drop only events whose
        JSON payload carries that ``stage`` (used to wipe a single stage's old
        curve when it is re-run, while keeping the other stage's history)."""
        if self._history is None:
            return
        if stage is None:
            self._history.clear()
            return
        kept = []
        for ev in self._history:
            try:
                if json.loads(ev.get("data", "{}")).get("stage") != stage:
                    kept.append(ev)
            except (ValueError, TypeError):
                kept.append(ev)
        self._history.clear()
        self._history.extend(kept)
