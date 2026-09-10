#!/usr/bin/env python3
"""Launch run.sh detached in its own session so it outlives the shell that started it.
usage: detach.py <runner-stdout-file> -- <env KEY=VAL ...> run.sh args..."""
import os, subprocess, sys
out = sys.argv[1]; assert sys.argv[2] == '--'
env = dict(os.environ); env.pop('SETNAYAN_PROBE_TOP', None)
args = sys.argv[3:]
while args and '=' in args[0] and not args[0].startswith('/'):
    k, v = args.pop(0).split('=', 1); env[k] = v
p = subprocess.Popen(args, env=env, start_new_session=True,
                     stdout=open(out, 'ab'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
print(f"detached pid={p.pid} pgid={os.getpgid(p.pid)}")
