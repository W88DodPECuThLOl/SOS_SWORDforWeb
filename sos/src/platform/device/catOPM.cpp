#include "../../cat/low/catLowBasicTypes.h"
#include "../../fmgen/opm.h"

WASM_EXPORT
extern "C" FM::OPM* OPM_new (uint32 clk, uint32 rate);
WASM_EXPORT
extern "C" void OPM_SetReg(FM::OPM* opm, uint addr, uint data);
WASM_EXPORT
extern "C" void OPM_Reset(FM::OPM* opm);

FM::OPM*
OPM_new(uint32 clk, uint32 rate)
{
	FM::OPM* opm = new FM::OPM();
	opm->Init(clk, rate);
	return opm;
}

void
OPM_SetReg(FM::OPM* opm, uint addr, uint data)
{
	opm->SetReg(addr, data);
}

void
OPM_Reset(FM::OPM* opm)
{
	opm->Reset();
}

WASM_EXPORT
extern "C" void OPM_initialize(void* heapBase, size_t heapSize);
WASM_EXPORT
extern "C" void OPM_terminate();
WASM_EXPORT
extern "C" void* OPM_generate(FM::OPM* psg, uint32 sampl);

FM_SAMPLETYPE* OPM_Buffer = nullptr;

void
OPM_initialize(void* heapBase, size_t heapSize)
{
	OPM_terminate();
	OPM_Buffer = new FM_SAMPLETYPE[1024*128];
}

void
OPM_terminate()
{
	if(OPM_Buffer) {
		delete[] OPM_Buffer;
		OPM_Buffer = nullptr;
	}
}

void*
OPM_generate(FM::OPM* opm, uint32 sampl)
{
	for(int i = 0; i < sampl*2; i++) {
		OPM_Buffer[i] = 0;
	}

	opm->Mix(OPM_Buffer, sampl);
	return OPM_Buffer;
}
