#include "../../cat/low/catLowBasicTypes.h"
#include "../../fmgen/opm.h"

WASM_EXPORT
extern "C" FM::OPM* OPM_new(uint32 clk, uint32 rate);
WASM_EXPORT
extern "C" void OPM_delete(FM::OPM* opm);
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
OPM_delete(FM::OPM* opm)
{
	if(opm) {
		delete opm;
	}
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
extern "C" void OPM_initialize();
WASM_EXPORT
extern "C" void OPM_terminate();
WASM_EXPORT
extern "C" void* OPM_generate(FM::OPM* psg, uint32 sampl);

FM_SAMPLETYPE* OPM_Buffer = nullptr;

void
OPM_initialize()
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

/*
	// 合成
	opm->Mix(OPM_Buffer, sampl);
	// タイマーを進める
	opm->Count(sampl * 1000000.0 / opm->GetRate()); // us
*/
	auto dst = OPM_Buffer;
	uint32 remain = sampl;
	while(remain > 0) {
		const uint32 size = (remain > 100) ? remain : 100;
		// 合成
		opm->Mix(dst, size);
		dst += size * 2;
		// タイマーを進める
		opm->Count(size * 1000000.0 / opm->GetRate()); // us

		remain -= size;
	}
	return OPM_Buffer;
}
