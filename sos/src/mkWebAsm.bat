clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c main.cpp -o ./main.o
clang -DBUILD_WASM=32 -std=c++20 -O3 -fno-builtin --target=wasm32 -c cat/low/catLowMemory.cpp -o ./catLowMemory.o
clang "-Wl,--no-entry" "-Wl,--export-all" "-Wl,--import-memory" -fno-builtin -nostdlib --target=wasm32 -o sos.wasm *.o
copy sos.wasm ..\..\sos.wasm
rem .\tools\wasm2wat.exe main.o -o main.wat
rem ..\tools\wasm2wat.exe sos.wasm -o sos.wat
pause