#!/usr/bin/env python3
"""
Read weight from Etekcity ESF-551 BLE scale and calculate liquid detergent dose.

Outputs JSON to stdout (all logs go to stderr):
  {"weight_kg": 2.35, "stable": true, "detergent_ml": 35, "load_level": "normal"}

How it works:
  - Starts a BLE scanner that waits for the scale to advertise (it only does when active).
  - The library parser only fires the callback on STABLE readings (payload[19]==1).
  - Once a stable reading arrives, we wait an extra SETTLE_SECONDS for a new stable
    reading in case the user adds more clothes. The last stable reading wins.
  - If no reading arrives within timeout_seconds, we exit with an error.

Usage:
  python3 server/scale_reader.py [BT_ADDRESS] [timeout_seconds]

Default address: F8E3507D-5030-FE6E-8687-62F94171F87B (scanned ESF-551)
Note: Place the clothes on the scale at any point during the timeout window.
"""
import asyncio
import json
import sys
from etekcity_esf551_ble import ESF551Scale, WEIGHT_KEY, ScaleData, WeightUnit

DEFAULT_ADDRESS = "F8E3507D-5030-FE6E-8687-62F94171F87B"

# After the first stable reading, wait this many more seconds for an updated reading
# (e.g. user adds more clothes to the pile on the scale).
SETTLE_SECONDS = 5.0


def calculate_detergent(weight_kg: float) -> dict:
    """
    Returns recommended liquid detergent dose (ml) for concentrated detergent
    in a Samsung front-load washer (11 kg capacity).

    Based on standard concentrated liquid detergent dosing guidelines:
    - Light  (<= 2 kg):  20 ml
    - Normal (2–4.5 kg): 35 ml
    - Medium (4.5–7 kg): 50 ml
    - Heavy  (7–9 kg):   65 ml
    - Max    (> 9 kg):   80 ml
    """
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


async def read_weight(address: str, timeout: float = 60.0):
    """
    Scan for the scale and capture the last stable weight within `timeout` seconds.

    The scanner runs continuously until either:
    - `timeout` seconds have elapsed with no reading → error
    - A stable reading arrives, and no new stable reading arrives within
      SETTLE_SECONDS → success (uses last reading)
    """
    result = {"weight_kg": None, "stable": False, "detergent_ml": None, "load_level": None, "error": None}

    first_reading = asyncio.Event()
    settle_task: asyncio.Task | None = None
    loop = asyncio.get_event_loop()

    def on_data(data: ScaleData):
        nonlocal settle_task
        if WEIGHT_KEY not in data.measurements:
            return

        weight = round(data.measurements[WEIGHT_KEY], 2)
        result["weight_kg"] = weight
        result["stable"] = True
        result.update(calculate_detergent(weight))

        print(
            f"  Stable reading: {weight} kg → {result['detergent_ml']} ml "
            f"({result['load_level']}) — waiting {SETTLE_SECONDS}s for more...",
            file=sys.stderr,
        )

        # Signal that we have at least one reading
        if not first_reading.is_set():
            first_reading.set()

        # Cancel any previous settle timer and start a fresh one
        if settle_task and not settle_task.done():
            settle_task.cancel()
        settle_task = loop.create_task(_settle_timer())

    settle_done = asyncio.Event()

    async def _settle_timer():
        await asyncio.sleep(SETTLE_SECONDS)
        settle_done.set()

    scale = ESF551Scale(address, on_data)
    scale.display_unit = WeightUnit.KG

    print(
        f"Scanner started — place clothes on scale within {int(timeout)}s...",
        file=sys.stderr,
    )

    try:
        await scale.async_start()

        # Wait for the overall timeout, but stop early once settled
        deadline = asyncio.ensure_future(asyncio.sleep(timeout))
        wait_first = asyncio.ensure_future(first_reading.wait())
        done_set, _ = await asyncio.wait(
            [deadline, wait_first], return_when=asyncio.FIRST_COMPLETED
        )

        if not first_reading.is_set():
            result["error"] = (
                f"Timeout after {int(timeout)}s — no stable reading received. "
                "Make sure the scale is turned on and within range."
            )
        else:
            # We have a reading — wait for settle or remaining timeout
            remaining = timeout - SETTLE_SECONDS  # already consumed some time
            try:
                await asyncio.wait_for(settle_done.wait(), timeout=SETTLE_SECONDS + 2)
            except asyncio.TimeoutError:
                pass  # use whatever reading we have

            deadline.cancel()
            wait_first.cancel()

    except Exception as e:
        result["error"] = str(e)
        print(f"Error: {e}", file=sys.stderr)
    finally:
        try:
            await scale.async_stop()
        except Exception:
            pass

    if result["weight_kg"] is not None:
        print(
            f"Final: {result['weight_kg']} kg → {result['detergent_ml']} ml "
            f"detergent ({result['load_level']})",
            file=sys.stderr,
        )
    elif result["error"]:
        print(result["error"], file=sys.stderr)

    print(json.dumps(result))
    return result


if __name__ == "__main__":
    address = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ADDRESS
    timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 60.0
    asyncio.run(read_weight(address, timeout))
