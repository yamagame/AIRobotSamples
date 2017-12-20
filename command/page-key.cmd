#!/usr/bin/env python3
import pyautogui  # GUI操作用モジュール
import sys

args = sys.argv
chars = list(args[1])
for num in chars:
  pyautogui.press(num)

pyautogui.press('enter')
