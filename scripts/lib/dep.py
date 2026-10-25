#!/usr/bin/env python3
"""Tiny helper to read and write deployments/<network>.json (never edit that file by hand).

  dep.py FILE set a.b.c VALUE     (VALUE parsed as JSON if possible, else string)
  dep.py FILE get a.b.c
"""
import json
import os
import sys

path, cmd, key = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(path)) if os.path.exists(path) else {}
parts = key.split(".")
if cmd == "get":
    cur = data
    for p in parts:
        cur = cur[p]
    print(cur if isinstance(cur, str) else json.dumps(cur))
else:
    raw = sys.argv[4]
    try:
        val = json.loads(raw)
    except ValueError:
        val = raw
    cur = data
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = val
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
