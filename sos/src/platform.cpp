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

class CatPCG {
	u8 indexB;
	u8 indexG;
	u8 indexR;
	u8 pcg[24*256];
	u16 ch = 0;
public:
	CatPCG()
		: indexB(0)
		, indexG(0)
		, indexR(0)
		, ch(0)
	{
		for(int i = 0; i < 24*256; ++i) {
			pcg[i] = (i & 1) ? 0x55 : 0xAA;
		}
	}

	void setChar(u16 value)
	{
		ch = value & 0xFF;
		indexB = 0;
		indexG = 0;
		indexR = 0;
	}
	u8* getData(u16 ch)
	{
		return &pcg[ch * 24];
	}

	void writeB(const u8 pattern)
	{
		pcg[ch * 24 + 16 + (indexB & 0x7)] = pattern;
		indexB++;
	}
	void writeG(const u8 pattern)
	{
		pcg[ch * 24 + 8 + (indexG & 0x7)] = pattern;
		indexG++;
	}
	void writeR(const u8 pattern)
	{
		pcg[ch * 24 + (indexR & 0x7)] = pattern;
		indexR++;
	}
};


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
CatPCG* pcg = nullptr;

u8 textWidth = 80;
#endif // IS_TARGET_X1_SERIES(TARGET)

void
initPlatform()
{
#if IS_TARGET_X1_SERIES(TARGET)
	// VRAMのイメージ化に使用するメモリ
	delete[] imageMemory;
	imageMemory = new u8[640*200*4];
	setVRAMDirty();

	// パレット
	for(s32 i = 0; i < 8; i++) {
		paletteB[i] = (i & 0x1) ? 0xFF : 0x00;
		paletteR[i] = (i & 0x2) ? 0xFF : 0x00;
		paletteG[i] = (i & 0x4) ? 0xFF : 0x00;
	}

	// CTC
	delete ctc;
	ctc = new CatCTC();
	// PCG
	delete pcg;
	pcg = new CatPCG();

	/* PCGデバッグ
	u8* text = (u8*)getIO() + 0x3000;
	u8* attr = (u8*)getIO() + 0x2000;
	for(int i = 0; i < 256; i++) {
		text[i] = i;
		attr[i] = 0x27;
	}*/
#endif // IS_TARGET_X1_SERIES(TARGET)
}

void*
getPlatformVRAMImage()
{
#if IS_TARGET_X1_SERIES(TARGET)
	int width = textWidth;

	if(width <= 40) {
		// @todo
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
	} else {
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
	}

	// PCG
	if(width <= 40) {
		// 80
		u8* text = (u8*)getIO() + 0x3000;
		u8* attr = (u8*)getIO() + 0x2000;
		for(int i = 0; i < 40 * 25; i++) {
			if(attr[i] & 0x20) {
				u16 ch = text[i];
				s32 y = (i / 40) * 8;
				s32 x = (i % 40) * 16;
				// PCG
				const u8* pattern = pcg->getData(ch);
				for(s32 yy = y; yy < y + 8; ++yy) {
					s8* dst = (s8*)&imageMemory[yy * 640*4 + x * 4];
					for(u8 mask = 0x80; mask != 0; mask >>= 1) {
						u8 r = (pattern[0]  & mask) ? 0xFF : 0x00; // R
						u8 g = (pattern[8]  & mask) ? 0xFF : 0x00; // G
						u8 b = (pattern[16] & mask) ? 0xFF : 0x00; // B
						if(r | g | b) {
							dst[0] = r; // R
							dst[1] = g; // G
							dst[2] = b; // B
							dst[3] = 0xFF;
							dst[4] = r; // R
							dst[5] = g; // G
							dst[6] = b; // B
							dst[7] = 0xFF;
						}
						dst += 8;
					}
					pattern++;
				}
			}
		}
	} else {
		// 80
		u8* text = (u8*)getIO() + 0x3000;
		u8* attr = (u8*)getIO() + 0x2000;
		for(int i = 0; i < 80 * 25; i++) {
			if(attr[i] & 0x20) {
				u16 ch = text[i];
				s32 y = (i / 80) * 8;
				s32 x = (i % 80) * 8;
				// PCG
				const u8* pattern = pcg->getData(ch);
				for(s32 yy = y; yy < y + 8; ++yy) {
					s8* dst = (s8*)&imageMemory[yy * 640*4 + x * 4];
					for(u8 mask = 0x80; mask != 0; mask >>= 1) {
						u8 r = (pattern[0]  & mask) ? 0xFF : 0x00; // R
						u8 g = (pattern[8]  & mask) ? 0xFF : 0x00; // G
						u8 b = (pattern[16] & mask) ? 0xFF : 0x00; // B
						if(r | g | b) {
							dst[0] = r; // R
							dst[1] = g; // G
							dst[2] = b; // B
							dst[3] = 0xFF;
						}
						dst += 4;
					}
					pattern++;
				}
			}
		}
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
	if(0x2000 <= port && port <= 0x3FFF) {
		// TEXT ATTR
		// TEXT
		if(0x2800 <= port && port <= 0x2FFF) {
			port -= 0x800; // 0x2800～0x2FFF => 0x2000～0x27FF
		}
		return io[port];
	} else if(0x4000 <= port) [[likely]]{
		// VRAM
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
	} else if((port & 0xFF0F) == 0x1A01) {
		// 8255 B
		const auto tick = getExecutedClock();
		progressPlatformTick(tick);
		constexpr auto v = (4000000 / 60) * 24 / (200+24); // @todo VSYNC期間のタイミング
		bool vsync = tick > (4000000 / 60 - v);
		return (vsync ? 0x00 : 0x80);
	} else if((port & 0xFF00) == 0x1B00) {
		// PSG Data Read
		if(io[0x1C00] == 14) {
			// ジョイスティック1
			return readGamePad(0);
		} else if(io[0x1C00] == 15) {
			// ジョイスティック2
			return readGamePad(1);
		}
	} else if((port & 0xFF00) == 0x1C00) {
		// PSG Register address set
		return io[0x1C00];
	}
#endif // IS_TARGET_X1_SERIES(TARGET)
	return 0xFF;
}

void
platformOutPort(u8* io, u16 port, u8 value)
{
#if IS_TARGET_X1_SERIES(TARGET)

	if(0x2000 <= port && port <= 0x3FFF) {
		// TEXT ATTR
		// TEXT
		if(0x2800 <= port && port <= 0x2FFF) {
			port -= 0x800; // 0x2800～0x2FFF => 0x2000～0x27FF
		}
		if(io[port] != value) {
			setVRAMDirty();
			io[port] = value;
		}

		// PCGのキャラ
		if(textWidth <= 40) {
			if(port == 0x33E8) {
				// 40桁表示時
				pcg->setChar(value);
			}
		} else {
			if(port == 0x37D0) {
				// 80桁表示時
				pcg->setChar(value);
			}
		}
	} else if(0x4000 <= port) [[likely]]{
		// VRAM
		if(io[port] != value) {
			setVRAMDirty();
		}
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
	} else if(port == 0x1800) {
		// CTRC AR
		io[0x1800] = value;
	} else if(port == 0x1801) {
		if(io[0x1800] == 1) {
			// CTRC R1 桁数
			textWidth = value;
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
	} else if((port & 0xFF00) == 0x1500) {
		// PCG B
		pcg->writeB(value);
	} else if((port & 0xFF00) == 0x1600) {
		// PCG R
		pcg->writeR(value);
	} else if((port & 0xFF00) == 0x1700) {
		// PCG G
		pcg->writeG(value);
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
#if IS_TARGET_X1_SERIES(TARGET)
	s32 diff = targetTick - currentTick;
	if(diff > 0) {
		currentTick += diff;
		// CTC
		if(s32 irq = ctc->execute(diff); irq >= 0) {
			// 必要ならIRQの割り込みを発生させる
			generateIRQ(irq);
		}
	}
#endif // IS_TARGET_X1_SERIES(TARGET)
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
