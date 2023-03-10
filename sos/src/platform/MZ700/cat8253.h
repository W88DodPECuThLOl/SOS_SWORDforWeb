#include "../../sos.h"
#include "catPlatformMZ700.h"
#if ENABLE_TARGET_MZ700

namespace Intel8253 {

class Counter {
	/**
	 * @brief チャンネル
	 */
	u8 channel;

	/**
	 * @brief チェインしているチャンネル
	 */
	Counter* chain;

	void* userData;

	/**
	 * @brief 制御レジスタ
	 */
	class ControlWord* controlWord;

	/**
	 * @brief カウンタ
	 */
	u16 counter;

	/**
	 * @brief カウントダウンしているカウンタ
	 */
	u16 currentCounter;
	/**
	 * @brief カウンタが動作中かどうか
	 */
	bool active;
	/**
	 * @brief ゲート
	 */
	bool gate;

	/**
	 * @brief 読み込みレジスタ制御
	 */
	bool counterAccess;

	/**
	 * ラッチデータの残り数
	 */
	s32 latchDataCount;
	/**
	 * ラッチデータ
	 */
	u32 latchData;

	/**
	 * @brief 出力 
	 */
	bool out;

	bool isCounterSet;


	u16 readCounter() const noexcept { return counter; }
	void writeCounter(const u16 counter) noexcept { this->counter = counter; }

	u16 readCurrentCounter() const noexcept { return (u16)currentCounter; }

	bool isActive() const noexcept { return active; }
	void activate() noexcept { active = true; }
	void deactive() noexcept { active = false; }

	bool getGate() const noexcept { return gate; }
	bool isGateLow() const noexcept { return !getGate(); }

	void writeControlWord0() noexcept;
	void tick0() noexcept;
	void writeCounter0(const u16 counter, const bool finished) noexcept;
	void setGate0(const bool isGate) noexcept;

	void writeControlWord1() noexcept;
	void tick1() noexcept;
	void adjustTick1(s32& tick) noexcept;
	void writeCounter1(const u16 counter, const bool finished) noexcept;
	void setGate1(const bool isGate) noexcept;

	void writeControlWord2() noexcept;
	void tick2() noexcept;
	void adjustTick2(s32& tick) noexcept;
	void writeCounter2(const u16 counter, const bool finished) noexcept;
	void setGate2(const bool isGate) noexcept;

	void writeControlWord3() noexcept;
	void tick3() noexcept;
	void adjustTick3(s32& tick) noexcept;
	void writeCounter3(const u16 counter, const bool finished) noexcept;
	void setGate3(const bool isGate) noexcept;

	void writeControlWord4() noexcept;
	void tick4() noexcept;
	void adjustTick4(s32& tick) noexcept;
	void writeCounter4(const u16 counter, const bool finished) noexcept;
	void setGate4(const bool isGate) noexcept;

	void writeControlWord5() noexcept;
	void tick5() noexcept;
	void adjustTick5(s32& tick) noexcept;
	void writeCounter5(const u16 counter, const bool finished) noexcept;
	void setGate5(const bool isGate) noexcept;


	// 出力
	void setOut(bool out) { this->out = out; }
	void setOutLow() { setOut(false); }
	void setOutHigh();

	// ラッチ
	bool isExistLatchData() const noexcept;
	void clearLatchData() noexcept;
	void setLatchData(const u32 currentCounter) noexcept;
	u8 getLatchData() noexcept;
public:
	/**
	 * @brief コンストラクタ
	 */
	Counter(u8 channel, Counter* chain, void* userData);
	/**
	 * @brief デストラクタ
	 */
	~Counter();

	/**
	 * @brief リセット
	 */
	void reset() noexcept;

	void setGate(bool isGate);
	void setGateDirect(bool isGate) noexcept;

	void writeControlWord(const u8 value) noexcept;
	void writeCounter(const u8 value) noexcept;
	u8 readCounter() noexcept;

	void tick(s32 tick);
	void adjustTick(s32& tick);
};

/**
 * @brief Intel8253
 * 
 * https://web.archive.org/web/20120304001058/http://www.sharpmz.org/download/8253.pdf
 * https://en.wikipedia.org/wiki/Intel_8253
 */
class Cat8253 {
	/**
	 * @brief ユーザデータ
	 */
	void* userData;
	/**
	 * @brief カウンタ
	 */
	class Counter* counters[3];
	s32 tickSum[3];
	void setGateDirect(const u8 address, bool isGate);
public:
	/**
	 * @brief コンストラクタ
	 */
	Cat8253(void* userData);

	/**
	 * @brief デストラクタ
	 */
	~Cat8253();

	/**
	 * @brief リセット
	 */
	void reset();

	/**
	 * @brief
	 */
	void adjustTick(s32& tick);

	/**
	 * @brief
	 */
	void tick(s32 tick);

	void setGate(const u8 address, bool isGate);
	void write(const u32 address, const u8 value) noexcept;
	u8 read(const u32 address) noexcept;
};

} // namespace Intel8253

#endif // ENABLE_TARGET_MZ700
