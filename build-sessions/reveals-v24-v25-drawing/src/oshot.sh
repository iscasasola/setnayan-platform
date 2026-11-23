#!/bin/sh
# usage: oshot.sh <reveal> <t> <out.png> <opts e.g. logo:small,hem:lace> [x y]
D=$(cd "$(dirname "$0")" && pwd)
perl -e 'alarm 150; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --enable-unsafe-swiftshader --use-angle=swiftshader --allow-file-access-from-files --window-size=500,540 --virtual-time-budget=20000 --screenshot="$3" "file://$D/test.html?r=$1&t=$2&c=coverCale&o=$4${5:+&x=$5&y=$6}" 2>/dev/null
