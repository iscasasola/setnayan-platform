#!/bin/sh
# usage: shot.sh <reveal> <t> <out.png> [cover] [mode] [w]   (gives up after 150 s)
D=$(cd "$(dirname "$0")" && pwd)
perl -e 'alarm 150; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --enable-unsafe-swiftshader --use-angle=swiftshader --allow-file-access-from-files --window-size=500,540 --virtual-time-budget=20000 --screenshot="$3" "file://$D/test.html?r=$1&t=$2&c=${4:-cover1}&m=${5:-tap}${6:+&w=$6}" 2>/dev/null
