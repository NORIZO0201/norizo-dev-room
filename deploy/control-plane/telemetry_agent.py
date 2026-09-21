#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os, subprocess, time, urllib.request
from pathlib import Path

NODE_ID=os.environ.get("NORIZO_NODE_ID","conoha-01")
ENDPOINT=os.environ.get("NORIZO_CONTROL_ENDPOINT","https://vlelayhbebvwlvzfehgt.supabase.co/functions/v1/dev-room-control")
TOKEN_FILE=Path(os.environ.get("NORIZO_NODE_TOKEN_FILE","/etc/norizo/node-token"))
HEALTH_URL=os.environ.get("NORIZO_HEALTH_URL","http://127.0.0.1:8787/status")
INTERVAL=max(15,int(os.environ.get("NORIZO_AGENT_INTERVAL","30")))
ALLOWED_UNITS={"norizo-health.service","omnw-discovery.service","omnw-recognition.service","omnw-master.service","omnw-m0-m5.service"}
ALLOWED_REPOS={"norizo-dev-room","oh-my-nihon-wine","local-engine","sayaka-kitchen"}
ROOT=Path("/opt/norizo")

def post(path,payload,token=None):
    data=json.dumps(payload).encode()
    headers={"content-type":"application/json","user-agent":"norizo-control-agent/1.0"}
    if token: headers["authorization"]="Bearer "+token
    req=urllib.request.Request(ENDPOINT+path,data=data,headers=headers,method="POST")
    with urllib.request.urlopen(req,timeout=15) as r:
        return json.loads(r.read().decode() or "{}")

def ensure_token():
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    TOKEN_FILE.parent.mkdir(parents=True,exist_ok=True)
    data=post("/bootstrap",{"node_id":NODE_ID})
    token=data["token"]
    tmp=TOKEN_FILE.with_suffix(".tmp")
    tmp.write_text(token+"\n")
    os.chmod(tmp,0o600)
    os.replace(tmp,TOKEN_FILE)
    return token

def health():
    try:
        with urllib.request.urlopen(HEALTH_URL,timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"ok":False,"health_error":str(e)}

def run(cmd,timeout=120):
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout,check=False)
    return {"code":p.returncode,"stdout":p.stdout[-4000:],"stderr":p.stderr[-4000:]}

def command(c):
    name=c.get("command"); args=c.get("args") or {}
    if name in {"start_unit","restart_unit","stop_unit"}:
        unit=str(args.get("unit",""))
        if unit not in ALLOWED_UNITS: raise ValueError("unit_not_allowed")
        verb={"start_unit":"start","restart_unit":"restart","stop_unit":"stop"}[name]
        return run(["systemctl",verb,unit])
    if name=="git_ff_pull":
        repo=str(args.get("repo",""))
        if repo not in ALLOWED_REPOS: raise ValueError("repo_not_allowed")
        path=ROOT/repo
        branch=str(args.get("branch","main"))
        if branch not in {"main","dev-room-p0-p5"}: raise ValueError("branch_not_allowed")
        s=run(["git","-C",str(path),"status","--porcelain"],30)
        if s["code"]!=0 or s["stdout"].strip(): return {"code":75,"stderr":"repo_dirty_or_unreadable"}
        a=run(["git","-C",str(path),"fetch","origin",branch],60)
        if a["code"]!=0:return a
        return run(["git","-C",str(path),"merge","--ff-only",f"origin/{branch}"],60)
    if name=="health_snapshot":
        return {"code":0,"health":health()}
    raise ValueError("command_not_allowed")

def main():
    token=ensure_token()
    while True:
        payload=health()
        try:
            reply=post("/telemetry",{"node_id":NODE_ID,"status":"online" if payload.get("ok") else "degraded","agent_version":"1.0","payload":payload},token)
            for c in reply.get("commands",[]):
                try:
                    result=command(c); ok=(result.get("code",1)==0)
                except Exception as e:
                    result={"code":1,"stderr":str(e)}; ok=False
                post("/command-result",{"node_id":NODE_ID,"command_id":c["id"],"status":"done" if ok else "failed","result":result},token)
        except Exception:
            pass
        time.sleep(INTERVAL)

if __name__=="__main__":
    main()
