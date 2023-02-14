REM AILZ80ASM https://github.com/AILight/AILZ80ASM
AILZ80ASM.exe --input testPause.z80 --output testPause.bin -f
AILZ80ASM.exe --input testPause.z80 --output testPause.lst -lst -f

AILZ80ASM.exe --input testWopen.z80 --output testWopen.bin -f
AILZ80ASM.exe --input testWopen.z80 --output testWopen.lst -lst -f

AILZ80ASM.exe --input testRopen.z80 --output testRopen.bin -f
AILZ80ASM.exe --input testRopen.z80 --output testRopen.lst -lst -f

AILZ80ASM.exe --input testCTC.z80 --output testCTC.bin -f
AILZ80ASM.exe --input testCTC.z80 --output testCTC.lst -lst -f

AILZ80ASM.exe --input test8255.z80 --output test8255.bin -f
AILZ80ASM.exe --input test8255.z80 --output test8255.lst -lst -f

AILZ80ASM.exe --input testASCII.z80 --output testASCII.bin -f
AILZ80ASM.exe --input testASCII.z80 --output testASCII.lst -lst -f

AILZ80ASM.exe --input testPad.z80 --output testPad.bin -f
AILZ80ASM.exe --input testPad.z80 --output testPad.lst -lst -f

AILZ80ASM.exe --input testBatErr.z80 --output testBatErr.bin -f
AILZ80ASM.exe --input testBatErr.z80 --output testBatErr.lst -lst -f

AILZ80ASM.exe --input testGetL.z80 --output testGetL.bin -f
AILZ80ASM.exe --input testGetL.z80 --output testGetL.lst -lst -f

AILZ80ASM.exe --input testGRAM.z80 --output testGRAM.bin -f
AILZ80ASM.exe --input testGRAM.z80 --output testGRAM.lst -lst -f

REM hudisk https://github.com/BouKiCHi/HuDisk
hudisk.exe -a SOS_TEST.d88 testPause.bin  --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testWopen.bin  --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testRopen.bin  --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testCTC.bin    --read 8000 --go 8000
hudisk.exe -a SOS_TEST.d88 test8255.bin   --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testPad.bin    --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testASCII.bin  --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testBatErr.bin --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testGetL.bin   --read 3000 --go 3000
hudisk.exe -a SOS_TEST.d88 testGRAM.bin   --read 3000 --go 3000

pause