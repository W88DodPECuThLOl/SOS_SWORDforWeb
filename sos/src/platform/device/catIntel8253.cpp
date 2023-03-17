#include "catIntel8253.h"
namespace Intel8253 {

namespace {

inline u16
toBinary(const u16 value)
{
	// @todo 変換に失敗したときは、どうなるのだろう？
	if(value > 9) { return 9; }
	return value;
}

inline u16
toDecimal(const u16 value)
{
	// @todo 変換に失敗したときは、どうなるのだろう？
	if(value >= 10000) {
		return 0x9999;
	} else {
		return (value % 10)
			| (((value / 10) % 10) << 4)
			| (((value / 100) % 10) << 8)
			| (((value / 1000) % 10) << 12);
	}
}

} // namespace

/**
 * @brief 制御レジスタ
 */
struct ControlWord {
	/**
	 * @brief フォーマット(0～3)
	 * 
	 * カウンタの読み書きの挙動
	 * 
	 * Read/Load
	 * Count value Reading/Loading format setting
	 * 
	 *   0: Latch counter value. Next read of counter will read snapshot of value.
	 *   1: Read/Write low byte of counter value only
	 *   2: Read/Write high byte of counter value only
	 *   3: 2×Read/2xWrite low byte then high byte of counter value
	 */
	u8 format;

	/**
	 * @brief カウントの仕方
	 * 
	 * Mode
	 * Operation waveform mode setting
	 * 
	 *   0  : Interrupt on Terminal Count
	 *   1  : Hardware Retriggerable One-Shot
	 *   2,6: Rate Generator
	 *   3,7: Square Wave
	 *   4  : Software Triggered Strobe
	 *   5  : Hardware Triggered Strobe (Retriggerable)
	 */
	u8 mode;
	/**
	 * @brief カウンタがBCDかどうか
	 * falseならカウンタは0～65535、trueなら0000～9999のBCDになる
	 * 
	 * BCD
	 * Operation count mode setting
	 *   0 : Binary Count (16-bit Binary)
	 *   1 : BCD Count (4-decade Binary Coded Decimal)
	 */
	bool bcd;

	/**
	 * @brief コンストラクタ
	 */
	ControlWord()
		: format(0)
		, mode(0)
		, bcd(false)
	{
	}

	/**
	 * @brief 制御レジスタを設定する
	 * @param[in]	value	制御レジスタ
	 */
	void set(const u8 value) noexcept
	{
		// Read/Load
		//  Count value Reading/Loading format setting
		format = (value >> 4) & 0x03;

		// Mode
		//  Operation waveform mode setting
		mode = (value >> 1) & 0x07;
		// modeの6と7は、3ビット目みてないので、mode2とmode3にする
		if(mode == 6 || mode == 7) [[unlikely]] { mode &= 3; }

		// BCD
		//  Operation count mode setting
		bcd = (value & 1) != 0;
	}

	/**
	 * @brief フォーマットを取得する
	 * @return フォーマット
	 */
	u8 getFormat() const noexcept { return format; }

	/**
	 * @brief モードを取得する
	 * @return モード(0～5)
	 */
	u8 getMode() const noexcept { return mode; }

	/**
	 * @brief カウンタがBCDかどうか
	 * @return BCDかどうか
	 *			trueならBCD
	 */
	bool isBCD() const noexcept { return bcd; }

	/**
	 * @brief リセットする
	 */
	void reset() noexcept { set(0); }
};

// ===================================================================================================
// ===================================================================================================
/*
Mode 0 (terminal count)

The counter output is set to “L” level by the mode setting. If the count value is then written
in the counter with the gate input at “H” level (that is, upon completion of writing the MSB
when there are two bytes), the clock input counting is started. When the terminal count is
reached, the output is switched to “H” level and is maintained in this status until the control
word and count value are set again.
Counting is interrupted if the gate input is switched to “L” level, and restarted when switched
back to “H” level.
When Count Values are written during counting, the operation is as follows:

1-byte Read/Load. ............ When the new count value is written, counting is stopped
                               immediately, and then restarted at the new count value by the next
                               clock.
2-byte Read/Load ............. When byte 1 (LSB) of the new count value is written, counting is
                               stopped immediately. Counting is restarted at the new count
                               value when byte 2 (MSB) is written.
*/

void
Counter::writeControlWord0() noexcept
{
	// The counter output is set to “L” level by the mode setting.
	deactive();
	setOutLow();
	isCounterSet = false;
}
void
Counter::writeCounter0(const u16 counter, const bool finished) noexcept
{
	// The OUT pin is set low after the Control Word is written,
	// and counting starts one clock cycle after the COUNT is programmed.
	if(finished) {
		activate();
		setOutLow();
		currentCounter = counter;
		isCounterSet = true;
	} else {
		// ２バイトの書き込み時は、
		// ・１バイト目の書き込みで、直ぐに停止する
		// ・２バイト目の書き込みで、カウントをスタート
		deactive();
		setOutLow();
	}
}
void
Counter::tick0() noexcept
{
	if(!isActive()) { return; }
	if(isGateLow()) { return; }
	// OUT remains low until the counter reaches 0,
	// at which point OUT will be set high until the counter is reloaded or the Control Word is written.
	// The counter wraps around to 0xFFFF internally and continues counting, but the OUT pin never changes again.
	currentCounter--;
	if(currentCounter == 0) {
		// 出力をHIGHに設定
		setOutHigh();
		currentCounter = counter;
	}
}
void
Counter::setGate0(const bool isGate) noexcept
{
	gate = isGate;
}

// ===================================================================================================
// ===================================================================================================

/*
Mode 1 (programmable one-shot)

The counter output is switched to “H” level by the mode setting.
Note that in this mode, counting is not started if only the count value is written.
Since counting has to be started in this mode by using the leading edge of the gate input as a trigger,
the counter output is switched to “L” level by the next clock after the gate input trigger.
This “L” level status is maintained during the set count value,
and is switched back to “H” level when the terminal count is reached.
Once counting has been started, there is no interruption until the terminal count is reached,
even if the gate input is switched to “L” level in the meantime. And although counting
continues even if a new count value is written during the counting, counting is started at the
new count value if another trigger is applied by the gate input.
*/

void
Counter::writeControlWord1() noexcept
{
	// The counter output is switched to “H” level by the mode setting.
	deactive();
	setOutHigh();
	isCounterSet = false;
}
void
Counter::writeCounter1(const u16 counter, const bool finished) noexcept
{
	// Note that in this mode, counting is not started if only the count value is written.
	if(!finished) {
		return;
	}
	isCounterSet = true;
}
void
Counter::tick1() noexcept
{
	if(!isActive()) { return; }
	// メモ）
	// ・GateがLowになっても止まらない
	// ・新しい値が設定されても止まらない
	// ・新しく設定された値は、次のカウント開始で適用される
	currentCounter--;
	if(currentCounter == 0) {
		// カウント終わったのでHighに
		setOutHigh();
		// 無効
		deactive();
	} else {
		// カウント中はずっとLow
		setOutLow();
	}
}
void
Counter::adjustTick1(s32& tick) noexcept
{
	if(!isActive()) { return; }
	if(isGateLow()) { return; }
	// 動作中
	if(tick > currentCounter) {
		tick = currentCounter;
	}
}
void
Counter::setGate1(const bool isGate) noexcept
{
	// 動作中は無視する
	if(!isActive()) {
		if(isCounterSet) {
			// Gateの立ち上がりでカウント開始
			if(isGateLow() && isGate) {
				activate();
				currentCounter = counter;
				// メモ）出力は、カウントされたときにLowになるので、ここでは設定しない
			}
		}
	}
	gate = isGate;
}

// ===================================================================================================
// ===================================================================================================
/*
Mode 2 (rate generator)

The counter output is switched to “H” level by the mode setting. When the gate input is at
“H” level, counting is started by the next clock after the count value has been written. And
if the gate input is at “L” level, counting is started by using the rising edge of the gate input
as a trigger after the count value has been set.
An “L” level output pulse appears at the counter output during a single clock duration once
every n clock inputs where n is the set count value. If a new count value is written during
while counting is in progress, counting is started at the new count value following output of
the pulse currently being counted. And if the gate input is switched to “L” level during
counting, the counter output is forced to switch to “H” level, the counting being restarted by
the rising edge of the gate input.
*/

void
Counter::writeControlWord2() noexcept
{
	// The counter output is switched to “H” level by the mode setting.
	deactive();
	setOutHigh();

	isCounterSet = false;
}
void
Counter::writeCounter2(const u16 counter, const bool finished) noexcept
{
	// When the gate input is at“H” level, counting is started by the next clock after the count value has been written.
	// And if the gate input is at “L” level, counting is started by using the rising edge of the gate input
	// as a trigger after the count value has been set.
	if(!finished) {
		return;
	}
	isCounterSet = true;
	if(getGate()) {
		currentCounter = counter;
		activate();
	}
}
void
Counter::tick2() noexcept
{
	if(!isActive()) { return; }
	if(isGateLow()) {
		// if the gate input is switched to “L” level during counting,
		// the counter output is forced to switch to “H” level, the counting being restarted by
		// the rising edge of the gate input.

		// GATEがLowになったら強制的にHighにして終了
		setOutHigh();
		deactive();
	} else {
		currentCounter--;
		if(currentCounter == 1) {
			setOutLow();
		} else if(currentCounter == 0) {
			setOutHigh();
			currentCounter = counter;
		}
	}
}
void
Counter::adjustTick2(s32& tick) noexcept
{
	if(!isActive()) { return; }
	if(isGateLow()) { return; }
	// 動作中
	if(tick > currentCounter) {
		tick = currentCounter;
	}
}
void
Counter::setGate2(const bool isGate) noexcept
{
	if(isCounterSet) {
		if(isGateLow() && isGate) {
			currentCounter = counter;
			activate();
		}
	}
	gate = isGate;
}

// ===================================================================================================
// ===================================================================================================
/*
Mode 3 (square waveform rate generator)

The counter output is switched to “H” level by the mode setting. Counting is started in the
same way as described for mode 2 above.
The repeated square wave output appearing at the counter output contains half the number
of counts as the set count value. If the set count value (n) is an odd number, the repeated square
wave output consists of only (n+1)/2 clock inputs at “H” level and (n-1)/2 clock inputs at “L”
level.
If a new count value is written during counting, the new count value is reflected immediately
after the change (“H” to “L” or “L” to “H”) in the next counter output to be executed. The
counting operation at the gate input is done the same as in mode 2.
*/

void
Counter::writeControlWord3() noexcept
{
	// The counter output is switched to “H” level by the mode setting. 
	deactive();
	setOutHigh();

	isCounterSet = false;
}
void
Counter::writeCounter3(const u16 counter, const bool finished) noexcept
{
	// Counting is started in the same way as described for mode 2 above.
	writeCounter2(counter, finished);
}
void
Counter::tick3() noexcept
{
	if(!isActive()) { return; }
	if(isGateLow()) {
		// The counting operation at the gate input is done the same as in mode 2.
		// GATEがLowになったら
		// 強制的にHighにして終了
		setOutHigh();
		deactive();
	} else {
		currentCounter--;
		if(counter & 1) {
			if(currentCounter < ((counter+1) / 2)) {
				setOutHigh();
			} else {
				setOutLow();
			}
		} else {
			if(currentCounter < (counter / 2)) {
				setOutHigh();
			} else {
				setOutLow();
			}
		}
		if(currentCounter == 0) {
			currentCounter = counter;
		}
	}
}
void
Counter::adjustTick3(s32& tick) noexcept
{
	if(!isActive()) { return; }
	if(isGateLow()) { return; }
	// 動作中
	if(tick > currentCounter) { // @todo クロックの変換
		tick = currentCounter;
	}
}
void
Counter::setGate3(bool isGate) noexcept
{
	// Counting is started in the same way as described for mode 2 above.
	setGate2(isGate);
}

// ===================================================================================================
// ===================================================================================================
/*
Mode 4 (software trigger strobe)
The counter output is switched to “H” level by the mode setting.
Counting is started in the same way as described for mode 0.
A single “L” pulse equivalent to one clock width is generated at the counter output when the terminal count is reached.
This mode differs from 2 in that the “L” level output appears one clock earlier in mode 2, and
that pulses are not repeated in mode 4.

Counting is stopped when the gate input is switched to “L” level,
and restarted from the set count value when switched back to “H” level.
*/
void
Counter::writeControlWord4() noexcept
{
	// The counter output is switched to “H” level by the mode setting.
	deactive();
	setOutHigh();

	isCounterSet = false;
}
void
Counter::tick4() noexcept
{
	if(!isActive()) {
		setOutHigh();
		return;
	}
	if(isGateLow()) {
		// setOutLow(); @todo 停止するだけなので、Lowにはしない……あってる？
		deactive();
		return;
	}
	currentCounter--;
	if(currentCounter == 0) {
		setOutLow(); // 1クロック分Lowにする
		deactive(); // メモ）ここで非アクティブになって、次のtickでHighになるので、１クロック分Lowになるなるなる

		// 繰り返さない
		// pulses are not repeated in mode 4.
	}
}
void
Counter::adjustTick4(s32& tick) noexcept
{
}
void
Counter::writeCounter4(const u16 counter, const bool finished) noexcept
{
	if(finished) {
		activate();
		currentCounter = counter;
		isCounterSet = true;
	} else {
		// ２バイトの書き込み時は、
		// ・１バイト目の書き込みで、直ぐに停止する
		// ・２バイト目の書き込みで、カウントをスタート
		deactive();
		setOutHigh();
	}
}
void
Counter::setGate4(const bool isGate) noexcept
{
	if(isGateLow() && isGate) {
		if(isCounterSet) {
			currentCounter = counter;
			activate();
		}
	}
	gate = isGate;
}

// ===================================================================================================
// ===================================================================================================
/*
Mode 5 (hardware trigger strobe)

The counter output is switched to “H” level by the mode setting. Counting is started, and the
gate input used, in the same way as in mode 1.
The counter output is identical to the mode 4 output.
*/

void
Counter::writeControlWord5() noexcept
{
	// The counter output is switched to “H” level by the mode setting.
	deactive();
	setOutHigh();

	isCounterSet = false;
}
void
Counter::tick5() noexcept
{
	if(!isActive()) {
		setOutHigh();
		return;
	}
	currentCounter--;
	if(currentCounter == 0) {
		setOutLow(); // 1クロック分Lowにする
		deactive(); // メモ）ここで非アクティブになって、次のtickでHighになるので、１クロック分Lowになるなるなる
	}
}
void
Counter::adjustTick5(s32& tick) noexcept
{
}
void
Counter::writeCounter5(const u16 counter, const bool finished) noexcept
{
	writeCounter1(counter, finished);
}
void
Counter::setGate5(const bool isGate) noexcept
{
	setGate1(isGate);
}
























Counter::Counter(u8 channel, Counter* chain, OUT_TRIGGER_CALLBACK callbackOutTrigger, void* userData)
	: channel(channel)
	, chain(chain)
	, userData(userData)
	, callbackOutTrigger(callbackOutTrigger)
	, controlWord(new ControlWord())
	, counter(0)
	, currentCounter(0)
	, active(false)
	, gate(false)
	, counterAccess(false)
	, latchDataCount(0)
	, latchData(0)
	, out(false)
	, isCounterSet(false)
{
}

Counter::~Counter()
{
	if(controlWord) {
		delete controlWord;
		controlWord = nullptr;
	}
}

/**
 * @brief リセット
 */
void
Counter::reset() noexcept
{
	controlWord->reset();
	counter = 0;
	currentCounter = 0;
	active = false;
	gate = false;
	counterAccess = false;
	latchDataCount = 0;
	latchData = 0;
	out = false;
	isCounterSet = false;
}

void
Counter::setGateDirect(bool isGate) noexcept
{
	gate = isGate;
}

void
Counter::setGate(bool isGate)
{
	switch(controlWord->getMode()) {
		case 0: setGate0(isGate); break;
		case 1: setGate1(isGate); break;
		case 2: setGate2(isGate); break;
		case 3: setGate3(isGate); break;
		case 4: setGate4(isGate); break;
		case 5: setGate5(isGate); break;
	}
}

void
Counter::tick(s32 tick)
{
	switch(controlWord->getMode()) {
		case 0: tick0(); break;
		case 1: tick1(); break;
		case 2: tick2(); break;
		case 3: tick3(); break;
		case 4: tick4(); break;
		case 5: tick5(); break;
	}
}

void
Counter::adjustTick(s32& tick)
{
	switch(controlWord->getMode()) {
		case 0: break;
		case 1: adjustTick1(tick); break;
		case 2: adjustTick2(tick); break;
		case 3: adjustTick3(tick); break;
		case 4: adjustTick4(tick); break;
		case 5: adjustTick5(tick); break;
	}
}

void
Counter::writeControlWord(const u8 value) noexcept
{
	controlWord->set(value);
	counter = 0;
	if(controlWord->getFormat() == 0) {
		// Counter latching
		setLatchData(currentCounter);
	} else {
		// Direct reading
		clearLatchData();
	}
	counterAccess = true;

	switch(controlWord->getMode()) {
		case 0: writeControlWord0(); break;
		case 1: writeControlWord1(); break;
		case 2: writeControlWord2(); break;
		case 3: writeControlWord3(); break;
		case 4: writeControlWord4(); break;
		case 5: writeControlWord5(); break;
	}
}

bool
Counter::isExistLatchData() const noexcept
{
	return latchDataCount > 0;
}

void
Counter::clearLatchData() noexcept
{
	latchDataCount = 0;
	latchData = 0;
}

void
Counter::setLatchData(const u32 currentCounter) noexcept
{
	latchDataCount = 2;
	latchData = currentCounter;
}

u8
Counter::getLatchData() noexcept
{
	if(latchDataCount == 2) {
		latchDataCount = 1;
		return latchData & 0xFF;
	} else if(latchDataCount == 1) {
		latchDataCount = 0;
		return (latchData >> 8) & 0xFF;
	} else {
		return 0x00;
	}
}

void
Counter::setOut(bool out)
{
	if(this->out != out) {
		// 立ち上がりなら繋がっているチックを進める
		if(chain && out) {
			chain->tick(1);
		}
		// 必要ならコールバックを呼び出す
		if(callbackOutTrigger) {
			callbackOutTrigger(channel, chain, out, userData);
		}
	}
	this->out = out;
}

void
Counter::setOutLow()
{
	setOut(false);
}

void
Counter::setOutHigh()
{
	setOut(true);
}

void
Counter::writeCounter(const u8 value) noexcept
{
	bool finish = true;
	switch(controlWord->getFormat()) {
		case 0: // Latch counter value. Next read of counter will read snapshot of value.
			return;
		case 1: // Read/Write low byte of counter value only
			if(controlWord->isBCD()) [[unlikely]] {
				// BCD
				counter = toBinary((value & 0x00F0) >> 4) * 10 + toBinary((value & 0x000F));
			} else {
				counter = value;
			}
			break;
		case 2: // Read/Write high byte of counter value only
			if(controlWord->isBCD()) [[unlikely]] {
				// BCD
				counter = toBinary((value & 0x00F0) >> 4) * 1000 + toBinary((value & 0x000F)) * 100;
			} else {
				counter = (u16)value << 8;
			}
			break;
		case 3: // 2×Read/2xWrite low byte then high byte of counter value
			counterAccess = !counterAccess;
			if(!counterAccess) {
				if(controlWord->isBCD()) [[unlikely]] {
					// BCD
					counter = toBinary((value & 0x00F0) >> 4) * 10 + toBinary((value & 0x000F));
				} else {
					counter = value;
				}
				finish = false;
			} else {
				if(controlWord->isBCD()) [[unlikely]] {
					// BCD
					counter |= toBinary((value & 0x00F0) >> 4) * 1000 + toBinary((value & 0x000F)) * 100;
				} else {
					counter |= (u16)value << 8;
				}
			}
			break;
	}

	switch(controlWord->getMode()) {
		case 0: writeCounter0(counter, finish); break;
		case 1: writeCounter1(counter, finish); break;
		case 2: writeCounter2(counter, finish); break;
		case 3: writeCounter3(counter, finish); break;
		case 4: writeCounter4(counter, finish); break;
		case 5: writeCounter5(counter, finish); break;
	}
}

u8
Counter::readCounter() noexcept
{
	if(isExistLatchData()) {
		// Counter latching
		return getLatchData(); // ラッチしているデータがあったら取得する
	} else {
		// Direct reading
		switch(controlWord->getFormat()) {
			case 0: // Latch counter value. Next read of counter will read snapshot of value.
				return 0xFF;
			case 1: // Read/Write low byte of counter value only
				if(controlWord->isBCD()) [[unlikely]] {
					// BCD
					return toDecimal(currentCounter) & 0xFF;
				} else {
					return currentCounter & 0xFF;
				}
			case 2: // Read/Write high byte of counter value only
				if(controlWord->isBCD()) [[unlikely]] {
					// BCD
					return toDecimal(currentCounter) >> 8;
				} else {
					return (u32)currentCounter >> 8;
				}
			case 3: // 2×Read/2xWrite low byte then high byte of counter value
				counterAccess = !counterAccess;
				if(controlWord->isBCD()) [[unlikely]] {
					// BCD
					if(!counterAccess) {
						return toDecimal(currentCounter) & 0xFF;
					} else {
						return toDecimal(currentCounter) >> 8;
					}
				} else {
					if(!counterAccess) {
						return currentCounter & 0xFF;
					} else {
						return (u32)currentCounter >> 8;
					}
				}
		}
		return 0xFF;
	}
}
























CatIntel8253::CatIntel8253(void* userData)
	: userData(userData)
{
	reset();
}

CatIntel8253::~CatIntel8253()
{
	reset();
	for(auto& counter : counters) {
		delete counter;
		counter = nullptr;
	}
}

void
CatIntel8253::reset()
{
	for(auto counter : counters) { counter->reset(); }
}

void
CatIntel8253::adjustTick(s32& tick)
{
}

void
CatIntel8253::tick(s32 tick)
{
	for(auto counter : counters) { counter->tick(1); }
}

void
CatIntel8253::setGate(const u8 address, bool isGate)
{
	counters[address]->setGate(isGate);
}

void
CatIntel8253::setGateDirect(const u8 address, bool isGate)
{
	counters[address]->setGateDirect(isGate);
}

void
CatIntel8253::write(const u32 address, const u8 value) noexcept
{
	if(address < 3) {
		counters[address]->writeCounter(value);
	} else {
		const u32 addr = value >> 6;
		if(addr < 3) {
			counters[addr]->writeControlWord(value);
		}
	}
}

u8
CatIntel8253::read(const u32 address) noexcept
{
	if(address < 3) {
		return counters[address]->readCounter();
	} else {
		return 0x7E;
	}
}

} // namespace Intel8253
