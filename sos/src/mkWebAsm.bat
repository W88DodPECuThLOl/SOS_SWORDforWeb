clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c sos.cpp -o ./sos.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c cat/low/catLowMemory.cpp -o ./catLowMemory.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c clang.cpp -o ./clang.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c platform.cpp -o ./platform.o

clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c emu2413/emu2149.cpp -o ./emu2149.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c psg.cpp -o ./psg.o

clang "-Wl,--no-entry" "-Wl,--export-all" "-Wl,--import-memory" -fno-builtin -nostdlib --target=wasm32 -o sos.wasm sos.o catLowMemory.o clang.o platform.o
clang "-Wl,--no-entry" "-Wl,--export-all" "-Wl,--import-memory" -fno-builtin -nostdlib --target=wasm32 -o psg.wasm psg.o emu2149.o catLowMemory.o clang.o
copy sos.wasm ..\..\sos.wasm
copy psg.wasm ..\..\psg.wasm

rem .\tools\wasm2wat.exe main.o -o main.wat
rem ..\tools\wasm2wat.exe sos.wasm -o sos.wat
pause