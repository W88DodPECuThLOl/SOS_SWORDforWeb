#include "cat8253.h"
#if ENABLE_TARGET_MZ700

namespace Intel8253 {

CatMZ8253::CatMZ8253(void* userData)
	: CatIntel8253(userData)
{
	// ・0は独立
	// ・1と2は繋がってる
	// ・2のOUTの立ち上がりで、割り込み
	counters[2] = new Counter(2, nullptr, outTriggerCallback, userData);
	counters[1] = new Counter(1, counters[2]);
	counters[0] = new Counter(0, nullptr);
	reset();
}

void
CatMZ8253::outTriggerCallback(const u8 channel, class Counter* chain, bool out, void* userData)
{
	// メモ）channel2のカウンタに仕掛けたコールバックなので、下記のはず
	// assert(channel == 2);
	// assert(chain == nullptr);
	// assert(userData != nullptr);
	if(out) {
		// 立ち上がりで割り込み要求
		((CatPlatformMZ700*)userData)->requestIRQ8253();
	}
}

void
CatMZ8253::reset()
{
	CatIntel8253::reset();

	// Gateは、0のみ有効
	// おそらく、1と2には繋がっていないので、High状態に設定。
	setGateDirect(0, false);
	setGateDirect(1, true);
	setGateDirect(2, true);

	tickSum[1] = tickSum[0] = 0;
}

void
CatMZ8253::tick(s32 tick)
{
	// ch0 : 894.88625kHz
	// ch1 :  15.7kHz
	constexpr double cpuFeq = 4000000.0;
	constexpr double ch0    = cpuFeq/(894.88625*1000.0);
	constexpr double ch1    = cpuFeq/(15.700000*1000.0);
	tickSum[0] += tick;
	tickSum[1] += tick;
	while((tickSum[0] >= ch0) || (tickSum[1] >= ch1)) {
		if(tickSum[0] >= ch0) {
			tickSum[0] -= ch0;
			counters[0]->tick(1);
		}
		if(tickSum[1] >= ch1) {
			tickSum[1] -= ch1;
			counters[1]->tick(1);
		}
	}
}

} // namespace Intel8253

#endif // ENABLE_TARGET_MZ700
