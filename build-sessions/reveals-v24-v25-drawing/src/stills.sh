#!/bin/sh
# 12-second reveals. Two renders at a time at most (three GL Chromes at once deadlocked before).
D=$(cd "$(dirname "$0")" && pwd)
one() { r=$1; c=$2; shift 2; n=0; for t in "$@"; do n=$((n+1)); "$D/shot.sh" $r $t "$D/st/${r}_$n.png" $c; done; }
hold() { r=$1; c=$2; "$D/shot.sh" $r 1.2 "$D/st/${r}_h1.png" $c hold; "$D/shot.sh" $r 1.2 "$D/st/${r}_h2.png" $c hold 0.35; "$D/shot.sh" $r 1.2 "$D/st/${r}_h3.png" $c hold 2.6; }
veil() { n=0; for t in 0 4.5 7 11; do n=$((n+1)); "$D/shotx.sh" veil $t "$D/st/veil_$n.png" cover3 -0.45 -0.35; done; }
veil & one curtains cover1 0 4.5 7 10 & wait
one envelope cover2 0 4.5 7.5 10 & one gatefold cover3 0 4.5 6.5 8.5 & wait
one gift cover4 0 3.5 7 10 & one fabric cover6 0 5 7.5 10 & wait
one smoke cover5 0 4 6 9 & one doors cover2 0 5.5 7.5 9.5 & wait
one petals cover5 0 4 6.5 9.5 & one fireworks cover4 0 4.5 7 10 & wait
one scratch cover4 0 2 8 13 & hold veil cover3 & wait
hold curtains cover1 & hold fabric cover6 & wait
echo STILLS-DONE
