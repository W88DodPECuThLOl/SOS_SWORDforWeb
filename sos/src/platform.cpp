#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"
#include "sos.h"
#include "platform.h"
#include "ctc.h"

CatCTC::CTC::CTC(s32 channel, CatCTC::CTC* chain)
	: state(State::IDLE)
	, writeState(WriteState::NORMAL)
	, channelCtrolWord(0)
	, timeControlRegister(0)
	, downCounter(0)
	, channel(channel)
	, chain(chain)
{
}

void
CatCTC::CTC::writeTimeConstant(const u8 value)
{
	writeState = WriteState::NORMAL;
	timeControlRegister = value;

	if(state != State::EXECUTE) {
		if((channelCtrolWord & (TIME_CONSTANT | RESET)) == (TIME_CONSTANT | RESET)) {
			downCounter = calcDownCounter();
			state = State::EXECUTE; // ダウンカウント設定されたので実行開始
		}
		if((channelCtrolWord & (MODE | TIMER_TRIGGER)) == 0) {
			// タイマモードで、かつ、AUTOMATIC TRIGGERなら、書き込まれたら実行開始
			downCounter = calcDownCounter();
			state = State::EXECUTE;
		}
	}
}

void
CatCTC::CTC::writeNormal(const u8 value)
{
	if((value & CONTROL_OR_VECTOR) == 0) {
		// 割り込みベクタ設定
		vector = value;
		return;
	}
	channelCtrolWord = value;
	if(channelCtrolWord & TIME_CONSTANT) {
		writeState = WriteState::TIME_CONSTANT;
	}
	if(channelCtrolWord & RESET) {
		state = State::IDLE;
	}
}

void
CatCTC::CTC::write8(u8 value)
{
	switch(writeState) {
		case WriteState::NORMAL:
			writeNormal(value);
			return;
		case WriteState::TIME_CONSTANT:
			writeTimeConstant(value);
			return;
	}
}

void
CatCTC::CTC::hardReset()
{
	state = State::IDLE;
	writeState = WriteState::NORMAL;
	channelCtrolWord = 0;
	timeControlRegister = 0;
	downCounter = 0;
	vector = 0;
}

void
CatCTC::CTC::adjustClock(s32& clock)
{
	switch(state) {
		case State::IDLE:
			return;
		case State::EXECUTE:
			if(isTimerMode()) {
				// タイマモード
				if(downCounter >= 0) {
					clock = (clock < downCounter) ? clock : downCounter;
				}
			}
			return;
	}
}

s32
CatCTC::CTC::addPuls(s32 clock)
{
	s32 iniVector = -1;
	switch(state) {
		case State::IDLE:
			if((channelCtrolWord & (MODE | TIMER_TRIGGER)) == TIMER_TRIGGER) {
				// タイマモードで、かつ、PULS STARTなら実行開始
				downCounter = calcDownCounter();
				state = State::EXECUTE;
			}
			break;
		case State::EXECUTE:
			downCounter -= clock;
			while(downCounter <= 0) {
				// 次のカウンタをセット
				downCounter += calcDownCounter();
				if(chain) {
					if(auto tmp = chain->addPuls(1); tmp >= 0 && iniVector < 0) {
						iniVector = tmp;
					}
				}
				if((iniVector < 0) && (channelCtrolWord & INTERRUPT)) {
					iniVector = vector + channel * 2; // 割り込み発生
				}
			}
			break;
	}
	return iniVector;
}

s32
CatCTC::CTC::execute(s32 clock)
{
	if(isCounterMode()) {
		// カウンタモード
		if(channel == 1 || channel == 2) {
			clock = (clock + 1) / 2; // 2MHzなので半分にする
		} else {
			// channel 0は、Vccに繋がってるので、カウントしない
			// channel 3は、channel 0のTRGが入力
			return -1;
		}
	}

	s32 iniVector = -1;
	switch(state) {
		case State::IDLE:
			break;
		case State::EXECUTE:
			downCounter -= clock;
			while(downCounter <= 0) {
				// 次のカウンタをセット
				downCounter += calcDownCounter();
				if(chain) {
					// 繋がっているのがあれば、TRGを発生させる
					if(auto tmp = chain->addPuls(1); tmp >= 0 && iniVector < 0) {
						iniVector = tmp;
					}
				}
				if((iniVector < 0) && (channelCtrolWord & INTERRUPT)) {
					iniVector = vector + channel * 2; // 割り込み発生
				}
			}
			break;
	}
	return iniVector;
}

CatCTC::CatCTC()
{
	ctc[3] = new CTC(3);
	ctc[2] = new CTC(2);
	ctc[1] = new CTC(1);
	ctc[0] = new CTC(0, ctc[3]);
}
CatCTC::~CatCTC()
{
	for(s32 i = 0; i < 4; ++i) {
		if(ctc[i]) {
			delete ctc[i];
			ctc[i] = nullptr;
		}
	}
}

void
CatCTC::write8(u8 no, u8 value)
{
	ctc[no]->write8(value);
}

void
CatCTC::adjustClock(s32& clock)
{
	for(s32 i = 0; i < 4; ++i) {
		ctc[i]->adjustClock(clock);
	}
}

s32
CatCTC::execute(s32 clock)
{
	s32 iniVector = -1;
	for(s32 i = 0; i < 4; ++i) {
		if(auto tmp = ctc[i]->execute(clock); tmp >= 0 && iniVector < 0) {
			iniVector = tmp;
		}
	}
	return iniVector;
}

#if IS_TARGET_X1_SERIES(TARGET)
/**
 * @brief VRAMのイメージ
 */
u8* imageMemory = nullptr;

/**
 * @brief パレット
 */
u8 paletteR[8];
u8 paletteG[8];
u8 paletteB[8];

CatCTC* ctc = nullptr;
#endif // IS_TARGET_X1_SERIES(TARGET)

void
initPlatform()
{
#if IS_TARGET_X1_SERIES(TARGET)
	// VRAMのイメージ化に使用するメモリ
	delete[] imageMemory;
	imageMemory = new u8[640*200*4];

	// パレット
	for(s32 i = 0; i < 8; i++) {
		paletteB[i] = (i & 0x1) ? 0xFF : 0x00;
		paletteR[i] = (i & 0x2) ? 0xFF : 0x00;
		paletteG[i] = (i & 0x4) ? 0xFF : 0x00;
	}

	// CTC
	delete ctc;
	ctc = new CatCTC();

/*
	// CTC0
	ctc->write8(0, 0x3);
	ctc->write8(1, 0x3);
	ctc->write8(2, 0x3);
	ctc->write8(3, 0x3);

	ctc->write8(0, 0x3);
	ctc->write8(0, 0x27);
	ctc->write8(0, 125);
	ctc->write8(0, 0x58);

	ctc->write8(3, 0xC7);
	ctc->write8(3, 125);
*/

#endif // IS_TARGET_X1_SERIES(TARGET)
}

void*
getPlatformVRAMImage()
{
#if IS_TARGET_X1_SERIES(TARGET)
	s8* vramR = (s8*)getIO() + 0x8000;
	s8* vramG = (s8*)getIO() + 0xC000;
	s8* vramB = (s8*)getIO() + 0x4000;
	for(s32 yy = 0; yy < 8; ++yy) {
		s8* dst = (s8*)&imageMemory[yy * 640*4];
		for(s32 y = 0; y < 25; ++y) {
			// 1ライン
			for(s32 x = 0; x < 80; ++x) {
				u8 R = *vramR++;
				u8 G = *vramG++;
				u8 B = *vramB++;
				for(s32 i = 0; i < 8; ++i) {
					u8 index  = B >> 7;  B <<= 1;
					index |= R >> 7 << 1;  R <<= 1;
					index |= G >> 7 << 2;  G <<= 1;
					*dst++ = paletteR[index];
					*dst++ = paletteG[index];
					*dst++ = paletteB[index];
					*dst++ = 0xFF;
				}
			}
			dst += 7 * 640 * 4; // 次の行へ(+8)
		}
		vramR += 0x30;
		vramG += 0x30;
		vramB += 0x30;
	}
	return (void*)imageMemory;
#else // IS_TARGET_X1_SERIES(TARGET)
	return nullptr;
#endif
}

u16
platformOutPort(u16 port, u8 value)
{
#if IS_TARGET_X1_SERIES(TARGET)
	// VRAM
	if(0x4000 <= port) [[likely]]{
		setVRAMDirty();
	} else if((port & 0xFF00) == 0x1000) {
		// PALETTE B
		port = 0x1000;
		if(((s8*)getIO())[port] != value) {
			setVRAMDirty();
			auto tmp = value;
			for(s32 i = 0; i < 8; ++i) { paletteB[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
		}
	} else if((port & 0xFF00) == 0x1100) {
		// PALETTE R
		port = 0x1100;
		if(((s8*)getIO())[port] != value) {
			setVRAMDirty();
			auto tmp = value;
			for(s32 i = 0; i < 8; ++i) { paletteR[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
		}
	} else if((port & 0xFF00) == 0x1200) {
		// PALETTE G
		port = 0x1200;
		if(((s8*)getIO())[port] != value) {
			setVRAMDirty();
			auto tmp = value;
			for(s32 i = 0; i < 8; ++i) { paletteG[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
		}
	} else if((port & 0xFF00) == 0x1B00) {
		// PSG Data write
		const u16 reg = ((s8*)getIO())[0x1C00];
		writePSG(getExecutedClock(), reg, value);
		port = 0x1B00;
	} else if((port & 0xFF00) == 0x1C00) {
		// PSG Register address set
		port = 0x1C00;
	} else if(port == 0x1FA0) {
		// CTC0
		ctc->write8(0, value);
	} else if(port == 0x1FA1) {
		// CTC1
		ctc->write8(1, value);
	} else if(port == 0x1FA2) {
		// CTC2
		ctc->write8(2, value);
	} else if(port == 0x1FA3) {
		// CTC3
		ctc->write8(3, value);
	} else if(port == 0x070C) {
		// 改造FM音源ボードのCTC
		// @todo
		port = 0xFFFF;
	} else if(port == 0x0704) {
		// ノーマルFM音源ボードのCTC
		// @todo
		port = 0xFFFF;
	}
	return port;
}

// 実行するクロックを調整する
void
adjustPlatformClock(s32& clock)
{
	// CTC
	ctc->adjustClock(clock);
}

// プラットフォーム側を実行
s32
execPlatform(s32 clock)
{
	// CTC
	auto intVector = ctc->execute(clock);
	return intVector;
}
