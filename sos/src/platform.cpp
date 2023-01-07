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
u8
CatCTC::CTC::read8()
{
	if(isCounterMode()) {
		return downCounter;
	} else {
		//return downCounter / ((channelCtrolWord & PRESCALER_VALUE) ? 256 : 16);
		const auto mult = ((channelCtrolWord & PRESCALER_VALUE) ? 256 : 16);
		return (downCounter + mult - 1) / mult; // 切り上げで取得してみる
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

u8
CatCTC::read8(u8 no)
{
	return ctc[no]->read8();
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
	ctc->write8(1, 0x47);
	ctc->write8(2, 0x47);
	ctc->write8(3, 0x47);
00005B 305B 01A01F          10   LD BC,01FA0H
00005E 305E CDD130          17   CALL   CHKCTC

       30D1                     CHKCTC:
0000D1 30D1 C5              11   PUSH   BC
0000D2 30D2 110347          10   LD DE,04703H
       30D5                     INICTC1:
0000D5 30D5 0C               4   INC    C
0000D6 30D6 ED51            12   OUT    (C),D
0000D8 30D8 ED71                 DB 0EDH,071H   ;OUT (C),0  Z80未定義命令
0000DA 30DA 1D               4   DEC    E
0000DB 30DB 20F8            12   JR NZ,INICTC1
0000DD 30DD C1              10   POP    BC
                                 
0000DE 30DE 11FA07          10   LD DE,007FAH
0000E1 30E1 ED51            12   OUT    (C),D
0000E3 30E3 ED59            12   OUT    (C),E
0000E5 30E5 ED78            12   IN A,(C)
0000E7 30E7 BB               4   CP E
0000E8 30E8 C0              11   RET    NZ
0000E9 30E9 ED51            12   OUT    (C),D
0000EB 30EB ED51            12   OUT    (C),D
0000ED 30ED ED78            12   IN A,(C)
0000EF 30EF BA               4   CP D
0000F0 30F0 C0              11   RET    NZ
0000F1 30F1 0C               4   INC    C
0000F2 30F2 0C               4   INC    C
0000F3 30F3 ED436936        20   LD (_CTC),BC
0000F7 30F7 C9              10   RET
*/



/*
	// CTC0
	ctc->write8(0, 0x3);
	ctc->write8(1, 0x3);
	ctc->write8(2, 0x3);
	ctc->write8(3, 0x3);

	ctc->write8(2, 0x07);
	ctc->write8(2, 0xFA);
//	ctc->execute(12);
	ctc->read8(2);

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

u8
platformInPort(u8* io, u16 port)
{
#if IS_TARGET_X1_SERIES(TARGET)
	// VRAM
	if(0x4000 <= port) [[likely]]{
		return io[port];
	} else if((port & 0xFF00) == 0x1000) {
		// PALETTE B
		return io[0x1000];
	} else if((port & 0xFF00) == 0x1100) {
		// PALETTE R
		return io[0x1100];
	} else if((port & 0xFF00) == 0x1200) {
		// PALETTE G
		return io[0x1200];
	} else if(port == 0x1FA0) {
		// CTC0
		progressPlatformTick(getExecutedClock());
		return ctc->read8(0);
	} else if(port == 0x1FA1) {
		// CTC1
		progressPlatformTick(getExecutedClock());
		return ctc->read8(1);
	} else if(port == 0x1FA2) {
		// CTC2
		progressPlatformTick(getExecutedClock());
		return ctc->read8(2);
	} else if(port == 0x1FA3) {
		// CTC3
		progressPlatformTick(getExecutedClock());
		return ctc->read8(3);
	}

	return 0xFF;
#endif // IS_TARGET_X1_SERIES(TARGET)
}

void
platformOutPort(u8* io, u16 port, u8 value)
{
#if IS_TARGET_X1_SERIES(TARGET)
	// VRAM
	if(0x4000 <= port) [[likely]]{
		setVRAMDirty();
		io[port] = value;
	} else if((port & 0xFF00) == 0x1000) {
		// PALETTE B
		if(io[0x1000] != value) {
			setVRAMDirty();
			auto tmp = value;
			for(s32 i = 0; i < 8; ++i) { paletteB[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
			io[0x1000] = value;
		}
	} else if((port & 0xFF00) == 0x1100) {
		// PALETTE R
		if(io[0x1100] != value) {
			setVRAMDirty();
			auto tmp = value;
			for(s32 i = 0; i < 8; ++i) { paletteR[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
			io[0x1100] = value;
		}
	} else if((port & 0xFF00) == 0x1200) {
		// PALETTE G
		if(io[0x1200] != value) {
			setVRAMDirty();
			auto tmp = value;
			for(s32 i = 0; i < 8; ++i) { paletteG[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
			io[0x1200] = value;
		}
	} else if((port & 0xFF00) == 0x1B00) {
		// PSG Data write
		io[0x1B00] = value;
		const u16 reg = io[0x1C00];
		writePSG(getExecutedClock(), reg, value);
	} else if((port & 0xFF00) == 0x1C00) {
		// PSG Register address set
		io[0x1C00] = value;
	} else if(port == 0x1FA0) {
		// CTC0
		progressPlatformTick(getExecutedClock());
		ctc->write8(0, value);
	} else if(port == 0x1FA1) {
		// CTC1
		progressPlatformTick(getExecutedClock());
		ctc->write8(1, value);
	} else if(port == 0x1FA2) {
		// CTC2
		progressPlatformTick(getExecutedClock());
		ctc->write8(2, value);
	} else if(port == 0x1FA3) {
		// CTC3
		progressPlatformTick(getExecutedClock());
		ctc->write8(3, value);
	}
#endif // IS_TARGET_X1_SERIES(TARGET)
}

s32 currentTick;

void
resetPlatformTick()
{
	currentTick = 0;
}

void
progressPlatformTick(s32 targetTick)
{
	s32 diff = targetTick - currentTick;
	if(diff > 0) {
		currentTick += diff;
		if(s32 irq = ctc->execute(diff); irq >= 0) {
			// 必要ならIRQの割り込みを発生させる
			generateIRQ(irq);
		}
	}
}

// 実行するクロックを調整する
void
adjustPlatformClock(s32& clock)
{
#if IS_TARGET_X1_SERIES(TARGET)
	// CTC
	ctc->adjustClock(clock);
#endif // IS_TARGET_X1_SERIES(TARGET)
}
