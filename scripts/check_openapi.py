#!/usr/bin/env python3
"""Lightweight structural check for openapi.yml (no network needed).
Checks: parses, required top-level keys, every $ref resolves, operationIds unique,
every path starts with /api, every operation has a response, path params are declared.
Replace/augment with `openapi-spec-validator` or Spectral where network is available."""
import re, sys, yaml
from pathlib import Path

doc = yaml.safe_load((Path(__file__).parent.parent / "openapi.yml").read_text())
errors = []
for k in ("openapi", "info", "paths", "components"):
    if k not in doc: errors.append(f"missing {k}")

def resolve(ref):
    node = doc
    for part in ref.lstrip("#/").split("/"):
        if not isinstance(node, dict) or part not in node: return None
        node = node[part]
    return node

def walk(n):
    if isinstance(n, dict):
        if "$ref" in n and resolve(n["$ref"]) is None: errors.append(f"unresolved {n['$ref']}")
        for v in n.values(): walk(v)
    elif isinstance(n, list):
        for v in n: walk(v)
walk(doc)

ops, count = set(), 0
for path, item in doc["paths"].items():
    if not path.startswith("/api"): errors.append(f"{path}: must start with /api")
    declared = {p["name"] for p in item.get("parameters", []) if p.get("in") == "path"}
    for method, op in item.items():
        if method not in ("get", "post", "put", "delete", "patch"): continue
        count += 1
        oid = op.get("operationId")
        if not oid: errors.append(f"{method} {path}: no operationId")
        elif oid in ops: errors.append(f"duplicate operationId {oid}")
        ops.add(oid)
        if not op.get("responses"): errors.append(f"{method} {path}: no responses")
        needed = set(re.findall(r"{(\w+)}", path))
        have = declared | {p["name"] for p in op.get("parameters", []) if p.get("in") == "path"}
        if needed - have: errors.append(f"{method} {path}: undeclared path params {needed - have}")
print(f"{count} operations, {len(doc['components']['schemas'])} schemas")
if errors:
    print("FAIL"); [print(" -", e) for e in errors]; sys.exit(1)
print("OK")
