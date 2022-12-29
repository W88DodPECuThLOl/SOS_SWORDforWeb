REM AILZ80ASM https://github.com/AILight/AILZ80ASM
AILZ80ASM.exe --input testPause.z80 --output testPause.bin -f
AILZ80ASM.exe --input testPause.z80 --output testPause.lst -lst -f

AILZ80ASM.exe --input testWopen.z80 --output testWopen.bin -f
AILZ80ASM.exe --input testWopen.z80 --output testWopen.lst -lst -f

REM hudisk https://github.com/BouKiCHi/HuDisk
hudisk.exe -a SOS_TEST.d88 testPause.bin --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testWopen.bin --read 3000 --go 3000

pause
