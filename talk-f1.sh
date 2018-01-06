#!/bin/bash
echo $@
../Downloads/aquestalkpi/AquesTalkPi $@ | aplay -D plughw:0,0
