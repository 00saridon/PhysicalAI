import asyncio


class EventBus:
    """Simple fan-out event bus for SSE broadcasting."""

    def __init__(self):
        self._subscribers: list[asyncio.Queue] = []

    async def publish(self, event: dict) -> None:
        for q in list(self._subscribers):
            await q.put(event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)
