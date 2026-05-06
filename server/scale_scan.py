#!/usr/bin/env python3
"""
Scan for Etekcity ESF-551 BLE scale and print its address.
Usage: python3 server/scale_scan.py
"""
import asyncio
import json
import sys
from bleak import BleakScanner


async def scan(timeout: float = 15.0):
    print(f"Scanning for BLE devices for {timeout}s...", file=sys.stderr)
    devices = await BleakScanner.discover(timeout=timeout, return_adv=True)

    etekcity_candidates = []
    all_devices = []

    for addr, (device, adv) in devices.items():
        name = device.name or adv.local_name or ""
        entry = {"address": addr, "name": name, "rssi": adv.rssi}
        all_devices.append(entry)
        # Etekcity ESF-551 typically advertises as "QN-Scale" or contains "EF" / "ESF"
        if any(kw in name.upper() for kw in ["QN", "ESF", "ETEKCITY", "EF-", "SCALE"]):
            etekcity_candidates.append(entry)

    result = {
        "candidates": etekcity_candidates,
        "all_count": len(all_devices),
        "all_devices": sorted(all_devices, key=lambda d: d["rssi"] or -999, reverse=True),
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(scan())
