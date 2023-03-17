#include "../../sos.h"
#include "catPlatformMZ700.h"
#if ENABLE_TARGET_MZ700
#include "../device/catIntel8253.h"

namespace Intel8253 {

class CatMZ8253 : public CatIntel8253 {
	s32 tickSum[3];
	static void outTriggerCallback(const u8 channel, class Counter* chain, bool out, void* userData);
public:
	/**
	 * @brief コンストラクタ
	 */
	CatMZ8253(void* userData);

	/**
	 * @brief カウンタを進める
	 * @param[in]	tick	進める値
	 * @note	進める値は無視される。常に１つ進める。
	 */
	virtual void tick(s32 tick) override;

	/**
	 * @brief リセット
	 */
	virtual void reset() override;
};

} // namespace Intel8253

#endif // ENABLE_TARGET_MZ700
