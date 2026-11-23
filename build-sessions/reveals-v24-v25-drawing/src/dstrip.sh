#!/bin/sh
# usage: dstrip.sh <tag> t1 t2 ...   doors frames, two Chromes at a time
D=$(cd "$(dirname "$0")" && pwd); tag=$1; shift; mkdir -p "$D/d2"
i=0; for t in "$@"; do "$D/shot.sh" doors $t "$D/d2/${tag}_$t.png" coverCale & i=$((i+1)); if [ $((i%2)) -eq 0 ]; then wait; fi; done; wait
python3 - "$D/d2" $tag "$@" <<'PY'
import sys
from PIL import Image
d,tag=sys.argv[1],sys.argv[2]; ts=sys.argv[3:]
ims=[Image.open("%s/%s_%s.png"%(d,tag,t)).crop((0,0,300,520)) for t in ts]
o=Image.new('RGB',(306*len(ims)-6,520),(136,136,136))
for i,im in enumerate(ims): o.paste(im,(306*i,0))
o.save("%s/%s.jpg"%(d,tag),quality=86)
PY
