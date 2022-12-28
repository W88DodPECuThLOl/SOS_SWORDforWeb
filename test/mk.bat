AILZ80ASM.exe --input testPause.z80 --output testPause.bin -f
AILZ80ASM.exe --input testPause.z80 --output testPause.lst -lst -f
REM S-OS obj header
COPY /B OBJ_HEADER.BIN + testPause.bin testPause.obj
pause