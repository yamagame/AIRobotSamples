#!/bin/bash
echo $@
../Downloads/aquestalkpi/AquesTalkPi -v f2 $@ | aplay -D plughw:0,0
