import asyncio
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

router = APIRouter()


async def _generate(queue: asyncio.Queue, request: Request):
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield event
                if event.get("event") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": ""}
    finally:
        pass


@router.get("/api/logs/stream")
async def logs_stream(request: Request):
    runner = request.app.state.runner
    queue = runner.log_bus.subscribe()

    async def cleanup_gen():
        try:
            async for ev in _generate(queue, request):
                yield ev
        finally:
            runner.log_bus.unsubscribe(queue)

    return EventSourceResponse(cleanup_gen())


@router.get("/api/metrics/stream")
async def metrics_stream(request: Request):
    runner = request.app.state.runner
    queue = runner.metric_bus.subscribe()

    async def cleanup_gen():
        try:
            async for ev in _generate(queue, request):
                yield ev
        finally:
            runner.metric_bus.unsubscribe(queue)

    return EventSourceResponse(cleanup_gen())
