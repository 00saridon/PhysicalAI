"""Structured metric channel between pipeline subprocesses and the dashboard API.

A pipeline stage runs as a subprocess (`python run.py rl`) whose only link back
to the API server is stdout. Trainers therefore emit machine-readable metric
records on stdout, each prefixed with a sentinel, alongside their human-readable
log lines. The API's subprocess drainer recognises the sentinel and parses the
JSON into an SSE `metric` event.

This decouples metrics from the human log format: the `[RL] Step N | rew=X`
text can change freely without breaking the charts, because the numbers travel
in the structured record, not in the prose.
"""
import json
import sys

# Unlikely-to-collide prefix that marks a line as a structured metric record.
METRIC_PREFIX = "@@METRIC@@ "


def emit_metric(**fields) -> None:
    """Write one structured metric record to stdout for the drainer to parse.

    Typical fields: stage ("il"|"rl"), step (int), and rew_mean/loss (float).
    """
    sys.stdout.write(METRIC_PREFIX + json.dumps(fields) + "\n")
    sys.stdout.flush()


def parse_metric(line: str) -> dict | None:
    """Return the metric dict if `line` is a structured metric record, else None."""
    if not line.startswith(METRIC_PREFIX):
        return None
    try:
        payload = json.loads(line[len(METRIC_PREFIX):])
    except (ValueError, TypeError):
        return None
    return payload if isinstance(payload, dict) else None
