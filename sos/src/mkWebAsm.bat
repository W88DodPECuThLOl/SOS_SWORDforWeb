REM CATLib
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c cat/low/catLowMemory.cpp -o ./catLowMemory.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c clang.cpp -o ./clang.o

REM S-OS
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c sos.cpp -o ./sos.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform.cpp -o ./platform.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/catPlatformFactory.cpp -o ./catPlatformFactory.o

REM X1
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/X1/catCRTC.cpp -o ./catCRTC.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/X1/catPCG.cpp -o ./catPCG.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/X1/catPlatformX1.cpp -o ./catPlatformX1.o

REM MZ700
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/MZ700/catPlatformMZ700.cpp -o ./catPlatformMZ700.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/MZ700/cat8253.cpp -o ./cat8253.o

REM device
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c emu2413/emu2149.cpp -o ./emu2149.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c fmgen/fmgen.cpp -o ./fmgen.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c fmgen/fmtimer.cpp -o ./fmtimer.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c fmgen/opm.cpp -o ./opm.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/device/catPsg.cpp -o ./catPsg.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/device/catOPM.cpp -o ./catOPM.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/device/catCtc.cpp -o ./catCtc.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/device/catIntel8253.cpp -o ./catIntel8253.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/device/catTape.cpp -o ./catTape.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform/device/catTapeImage.cpp -o ./catTapeImage.o

clang "-Wl,--no-entry" "-Wl,--export-all" "-Wl,--import-memory" -fno-builtin -nostdlib --target=wasm32 -o sos.wasm sos.o catLowMemory.o clang.o platform.o catPlatformFactory.o catCtc.o catCRTC.o catPCG.o catPlatformX1.o catPlatformMZ700.o cat8253.o catIntel8253.o catTape.o catTapeImage.o
clang "-Wl,--no-entry" "-Wl,--export-all" "-Wl,--import-memory" -fno-builtin -nostdlib --target=wasm32 -o psg.wasm catPsg.o emu2149.o catLowMemory.o clang.o fmgen.o fmtimer.o opm.o catOPM.o

copy sos.wasm ..\..\sos.wasm
copy psg.wasm ..\..\psg.wasm

rem .\tools\wasm2wat.exe main.o -o main.wat
rem ..\tools\wasm2wat.exe sos.wasm -o sos.wat
pause