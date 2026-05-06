#!/usr/bin/env python3
"""
Scale daemon — runs forever, emits one JSON line to stdout per weighing event.

Each weighing event is a "session": the user puts clothes on, the scale wakes up,
sends stable readings, then goes back to sleep. We wait SETTLE_SECONDS after the
last stable reading before emitting the final JSON line.

Output (one line per event, then flushes):
  {"weight_kg": 2.35, "detergent_ml": 35, "load_level": "normal", "stable": true}

Stderr: progress/debug logs (consumed by Node.js and logged as [scale/py])

Usage:
  python3 server/scale_daemon.py [BT_ADDRESS]
"""
import asyncio
import json
import sys
from etekcity_esf551_ble import ESF551Scale, WEIGHT_KEY, ScaleData, WeightUnit

DEFAULT_ADDRESS = "F8E3507D-5030-FE6E-8687-62F94171F87B"
SETTLE_SECONDS = 5.0


def calculate_detergent(weight_kg: float) -> dict:
    if weight_kg <= 2.0:
        return {"detergent_ml": 20, "load_level": "light"}
    elif weight_kg <= 4.5:
        return {"detergent_ml": 35, "load_level": "normal"}
    elif weight_kg <= 7.0:
        return {"detergent_ml": 50, "load_level": "medium"}
    elif weight_kg <= 9.0:
        return {"detergent_ml": 65, "load_level": "heavy"}
    else:
        return {"detergent_ml": 80, "load_level": "max"}


async def run_daemon(address: str):
    loop = asyncio.get_event_loop()
    last_weight: float | None = None
    settle_task: asyncio.Task | None = None

    def emit_weight(weight: float):
        data = {"weight_kg": weight, "stable": True, **calculate_detergent(weight)}
        # Single line → flush → Node.js reads it immediately
        print(json.dumps(data), flush=True)
        print(f"[scale] emitted: {weight} kg → {data['detergent_ml']} ml ({data['load_level']})",
              file=sys.stderr, flush=True)

    def on_data(data: ScaleData):
        nonlocal last_weight, settle_task
        if WEIGHT_KEY not in data.measurements:
            return

        weight = round(data.measurements[WEIGHT_KEY], 2)
        last_weight = weight

        print(f"[scale] stable reading: {weight} kg", file=sys.stderr, flush=True)

        # Cancel previous settle timer and start a fresh one
        if settle_task and not settle_task.done():
            settle_task.cancel()

        async def settle():
            await asyncio.sleep(SETTLE_SECONDS)
            if last_weight is not None:
                emit_weight(last_weight)

        settle_task = loop.create_task(settle())

    scale = ESF551Scale(address, on_data)
    scale.display_unit = WeightUnit.KG

    print(f"[scale] daemon started — address={address}", file=sys.stderr, flush=True)
    print(f"[scale] waiting for scale activity...", file=sys.stderr, flush=True)

    await scale.async_start()

    try:
        # Sleep forever — the ESF551Scale scanner runs in the background
        while True:
            await asyncio.sleep(3600)
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        try:
            await scale.async_stop()
        except Exception:
            pass
        print("[scale] daemon stopped", file=sys.stderr, flush=True)


if __name__ == "__main__":
    address = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ADDRESS
    asyncio.run(run_daemon(address))
