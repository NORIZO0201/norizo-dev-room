#!/usr/bin/env python3
from __future__ import annotations
import json, os, subprocess, time
from pathlib import Path

REPO=os.environ.get("NORIZO_GITHUB_REPO","NORIZO0201/norizo-dev-room")
BRANCH=os.environ.get("NORIZO_SHARED_BRANCH","dev-room-p0-p5")
POLL=max(30,int(os.environ.get("NORIZO_ORCH_POLL_SECONDS","60")))
ROOT=Path(os.environ.get("NORIZO_ROOT","/opt/norizo"))
DEVROOM=ROOT/"norizo-dev-room"
STATE=ROOT/"system"/"orchestrator"
STATE.mkdir(parents=True,exist_ok=True)
LAST_FILE=STATE/"last_issue.json"

def run(cmd, cwd=None, timeout=1800):
    p=subprocess.run(cmd,cwd=cwd,capture_output=True,text=True,timeout=timeout,check=False)
    return p.returncode,p.stdout,p.stderr

def gh_json(args):
    code,out,err=run(["gh",*args],cwd=DEVROOM,timeout=60)
    if code!=0: raise RuntimeError(err.strip() or out.strip())
    return json.loads(out or "null")

def ensure_branch():
    code,out,err=run(["git","status","--porcelain"],cwd=DEVROOM,timeout=30)
    if code!=0 or out.strip(): return False
    run(["git","fetch","origin",BRANCH],cwd=DEVROOM,timeout=60)
    code,_,_=run(["git","checkout",BRANCH],cwd=DEVROOM,timeout=60)
    if code!=0:
        code,_,_=run(["git","checkout","-B",BRANCH,"origin/"+BRANCH],cwd=DEVROOM,timeout=60)
    if code!=0: return False
    code,_,_=run(["git","merge","--ff-only","origin/"+BRANCH],cwd=DEVROOM,timeout=60)
    return code==0

def claude_available():
    return subprocess.run(["bash","-lc","command -v claude >/dev/null 2>&1"]).returncode==0

def load_tasks():
    return gh_json(["issue","list","--repo",REPO,"--state","open","--label","ai:claude","--json","number,title,body,updatedAt"])

def already_done(issue):
    if not LAST_FILE.exists(): return False
    try:
        d=json.loads(LAST_FILE.read_text())
        return d.get("number")==issue["number"] and d.get("updatedAt")==issue["updatedAt"]
    except Exception:
        return False

def mark(issue):
    LAST_FILE.write_text(json.dumps({"number":issue["number"],"updatedAt":issue["updatedAt"]}))

def comment(number, body):
    run(["gh","issue","comment",str(number),"--repo",REPO,"--body",body],cwd=DEVROOM,timeout=60)

def invoke(issue):
    prompt = (
        "You are the autonomous Claude Code worker for NORIZO DEV ROOM.\n"
        f"Repository: {REPO}\nBranch: {BRANCH}\n"
        "Read CLAUDE.md, docs/AI_HANDOFF.md, docs/CONOHA_DEV_BASELINE.md, and docs/P0_P5_RUNBOOK.md first.\n"
        f"Then execute GitHub Issue #{issue['number']} titled: {issue['title']}\n\n"
        "Issue body:\n" + (issue.get("body") or "") + "\n\n"
        "Rules:\n"
        f"- Work only on {BRANCH}.\n"
        "- Do not ask NORIZO to relay messages.\n"
        "- Do not touch Production.\n"
        "- Do not create/replace SSH keys.\n"
        "- Do not expose secrets.\n"
        "- This runner is on ConoHa; local VPS operations are allowed only when the issue requires them.\n"
        f"- Commit and push safe completed changes to {BRANCH}.\n"
        "- Update the issue with concrete evidence or exact blocker.\n"
    )
    code,out,err=run(["claude","-p",prompt],cwd=DEVROOM,timeout=3600)
    return code,out[-12000:],err[-12000:]

def main():
    while True:
        try:
            if ensure_branch():
                tasks=load_tasks()
                if tasks:
                    issue=tasks[0]
                    if not already_done(issue):
                        if not claude_available():
                            comment(issue["number"],"Autonomous runner blocked: claude CLI is not installed/authenticated on ConoHa. No NORIZO relay is requested; this remains a VPS bootstrap blocker.")
                            mark(issue)
                        else:
                            comment(issue["number"],"Autonomous VPS runner picked up this task.")
                            code,out,err=invoke(issue)
                            summary=(out if code==0 else err) or "No output"
                            comment(issue["number"],"Autonomous VPS runner finished with exit %s.\n\n%s" % (code, summary[-6000:]))
                            mark(issue)
        except Exception:
            pass
        time.sleep(POLL)

if __name__=="__main__":
    main()
