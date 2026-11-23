#!/bin/sh
# usage: clip.sh <reveal> <opts> <out.png> [t tap-at] [w wait-after] [n frames] [e ticks-apart]   one browser, gives up after 280 s
D=$(cd "$(dirname "$0")" && pwd)
perl -e 'alarm 280; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --enable-unsafe-swiftshader --use-angle=swiftshader --allow-file-access-from-files --window-size=1800,2080 --virtual-time-budget=60000 --screenshot="$3" "file://$D/clip.html?r=$1&o=$2&t=${4:-0}&w=${5:-0}&n=${6:-24}&e=${7:-7}" 2>/dev/null
