#!/usr/bin/env python3
"""Create labels and issues from docs/backlog.md with the GitHub CLI.
  python scripts/seed_issues.py            dry run (prints what would happen, verifies nothing remote)
  python scripts/seed_issues.py --apply    verifies `gh` auth + repo, creates labels and issues
Run against a fresh repo so issue numbers match the Depends fields. Skips titles that already exist."""
import json, re, subprocess, sys
from pathlib import Path

APPLY = "--apply" in sys.argv
text = (Path(__file__).parent.parent / "docs" / "backlog.md").read_text()
blocks = re.split(r"^## (\d+)\. ", text, flags=re.M)[1:]
tasks = []
for i in range(0, len(blocks), 2):
    num, body = int(blocks[i]), blocks[i + 1]
    title, _, rest = body.partition("\n")
    f = {k: (re.search(rf"^{k}: (.*)$", rest, re.M) or [None, None])[1] for k in ("Labels", "Goal", "Description", "Accept", "Depends")}
    for k in ("Labels", "Goal", "Description", "Accept"):
        if not f[k]: sys.exit(f"Issue {num}: missing {k}")
    tasks.append(dict(num=num, title=f"{num:02d}. {re.sub(r' \[in repo[^\]]*\]', '', title).strip()}", **f))

COLORS = {"mvp": "0E8A16", "post-mvp": "BFD4F2", "user-test-bug": "D93F0B", "priority-high": "B60205",
          "frontend": "1D76DB", "backend": "5319E7", "database": "FBCA04", "testing": "C2E0C6", "documentation": "0075CA"}
DOD = ["Acceptance criteria verified by qa-engineer.md against the running code", "Relevant automated tests pass",
       "Documentation updated", "Work committed with the issue number in the message"]

def body(t):
    ac = "\n".join(f"- [ ] {a.strip()}" for a in t["Accept"].split(";") if a.strip())
    deps = ""
    if t["Depends"]:
        deps = "\n\n## Dependencies\n" + ", ".join(f"#{n.strip()}" for n in t["Depends"].split(","))
    return (f"## Goal\n{t['Goal']}\n\n## Description\n{t['Description']}\n\n## Acceptance criteria\n{ac}{deps}\n\n"
            "## Definition of done\n" + "\n".join(f"- [ ] {d}" for d in DOD))

def gh(*args, check=True):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and r.returncode: sys.exit(f"gh {' '.join(args[:2])} failed: {r.stderr.strip()}")
    return r

if APPLY:
    gh("auth", "status")
    print("Repo:", json.loads(gh("repo", "view", "--json", "nameWithOwner").stdout)["nameWithOwner"])
    for l, c in COLORS.items(): gh("label", "create", l, "--color", c, "--force")
    existing = {i["title"] for i in json.loads(gh("issue", "list", "--state", "all", "--limit", "500", "--json", "title").stdout)}
else:
    existing = set()

created = 0
for t in tasks:
    if t["title"] in existing: continue
    labels = ",".join(x.strip() for x in t["Labels"].split(","))
    if APPLY:
        print(gh("issue", "create", "--title", t["title"], "--body", body(t), "--label", labels).stdout.strip())
    else:
        print(f"DRY  {t['title']}  [{labels}]")
    created += 1
mvp = sum("mvp" in t["Labels"].split(", ") and "post-mvp" not in t["Labels"] for t in tasks)
print(f"{len(tasks)} issues parsed ({mvp} mvp, {len(tasks) - mvp} post-mvp); {'created' if APPLY else 'would create'} {created}")
