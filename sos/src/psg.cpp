#include "cat/low/catLowBasicTypes.h"
#include "emu2413/emu2149.h"
#ifdef BUILD_WASM
void setupHeap(void* heapBase, size_t heapSize);
#endif // BUILD_WASM

WASM_EXPORT
extern "C" void PSG_setQuality(PSG * psg, uint8_t q);
WASM_EXPORT
extern "C" void PSG_setClock(PSG *psg, uint32_t clk);
WASM_EXPORT
extern "C" void PSG_setClockDivider(PSG *psg, uint8_t enable);
WASM_EXPORT
extern "C" void PSG_setRate (PSG * psg, uint32_t rate);
WASM_EXPORT
extern "C" PSG *PSG_new (uint32_t clk, uint32_t rate);
WASM_EXPORT
extern "C" void PSG_reset (PSG *);
WASM_EXPORT
extern "C" void PSG_delete (PSG *);
WASM_EXPORT
extern "C" void PSG_writeReg (PSG *, uint32_t reg, uint32_t val);
WASM_EXPORT
extern "C" void PSG_writeIO (PSG * psg, uint32_t adr, uint32_t val);
WASM_EXPORT
extern "C" uint8_t PSG_readReg (PSG * psg, uint32_t reg);
WASM_EXPORT
extern "C" uint8_t PSG_readIO (PSG * psg);
WASM_EXPORT
extern "C" int16_t PSG_calc (PSG *);
WASM_EXPORT
extern "C" void PSG_setVolumeMode (PSG * psg, int type);
WASM_EXPORT
extern "C" uint32_t PSG_setMask (PSG *, uint32_t mask);
WASM_EXPORT
extern "C" uint32_t PSG_toggleMask (PSG *, uint32_t mask);



WASM_EXPORT
extern "C" void PSG_initialize(void* heapBase, size_t heapSize);
WASM_EXPORT
extern "C" void PSG_terminate();
WASM_EXPORT
extern "C" void* PSG_generate(PSG* psg, uint32_t sampl);


void setupHeap(void* heapBase, size_t heapSize);

float* PSG_Buffer = nullptr;

void
PSG_initialize(void* heapBase, size_t heapSize)
{
#ifdef BUILD_WASM
	setupHeap(heapBase, heapSize);
#endif
	PSG_terminate();
	PSG_Buffer = new float[1024*64];
}

void
PSG_terminate()
{
	if(PSG_Buffer) {
		delete[] PSG_Buffer;
		PSG_Buffer = nullptr;
	}
}

void*
PSG_generate(PSG* psg, uint32_t sampl)
{
	for(uint32_t i = 0; i < sampl; i++) {
		PSG_Buffer[i] = PSG_calc(psg) * (1.0f / 32768.0f);
	}
	return PSG_Buffer;
}
