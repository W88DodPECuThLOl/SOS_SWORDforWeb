#include "../../sos.h"
#include "catPlatformX1.h"
#include "../device/catCtc.h"
#include "../X1/catPCG.h"
#include "../X1/catCRTC.h"

void
CatPlatformX1::initializeGraphicPalette() noexcept
{
	u8* io = (u8*)getIO();
	io[0x1000] = 0xAA;
	io[0x1100] = 0xCC;
	io[0x1200] = 0xF0;
	for(s32 i = 0; i < 8; i++) {
		paletteB[i] = (i & 0x1) ? 0xFF : 0x00;
		paletteR[i] = (i & 0x2) ? 0xFF : 0x00;
		paletteG[i] = (i & 0x4) ? 0xFF : 0x00;
	}
}

void
CatPlatformX1::initializeScreenImage() noexcept
{
	for(s32 i = 0; i < CatPlatformX1::GVRAM_SIZE; ++i) {
		imageMemory[i] = 0;
	}
}

void
CatPlatformX1::initializeCRTC(const s32 width) noexcept
{
	crtc->writeRegister(CatCRTC::RegisterNo::Width,  width);
	crtc->writeRegister(CatCRTC::RegisterNo::Height, 25);
	crtc->writeRegister(CatCRTC::RegisterNo::StartAddressHigh, 0);
	crtc->writeRegister(CatCRTC::RegisterNo::StartAddressLow, 0);
}

void
CatPlatformX1::clearTextAndAttribute(const u8 ch, const u8 attribute)
{
	u8* text = (u8*)getIO() + 0x3000;
	u8* attr = (u8*)getIO() + 0x2000;
	for(int i = 0; i < 80*25; i++) {
		text[i] = ch;
		attr[i] = attribute;
	}
}

u16
CatPlatformX1::queryPCGCharacterPortAddress() noexcept
{
	const u8 CRTCWidth  = crtc->readRegister(CatCRTC::RegisterNo::Width);
	const u8 CRTCHeight = crtc->readRegister(CatCRTC::RegisterNo::Height);
	return 0x3000 | ((CRTCWidth * CRTCHeight) & 0xFFFF);
}

void
CatPlatformX1::renderGraphic()
{
	const u8 CTRCWidth = crtc->readRegister(CatCRTC::RegisterNo::Width);
	if(CTRCWidth <= 40) {
		s8* vramR;
		s8* vramG;
		s8* vramB;
		if(((u8*)getIO())[0x1FD0] & 0x08) {
			// バンク1 表示
			vramB = (s8*)getIO() + 0x14000;
			vramR = (s8*)getIO() + 0x18000;
			vramG = (s8*)getIO() + 0x1C000;
		} else {
			// バンク0 表示
			vramB = (s8*)getIO() + 0x04000;
			vramR = (s8*)getIO() + 0x08000;
			vramG = (s8*)getIO() + 0x0C000;
		}
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
		s8* vramR;
		s8* vramG;
		s8* vramB;
		if(((u8*)getIO())[0x1FD0] & 0x08) {
			// バンク1 表示
			vramB = (s8*)getIO() + 0x14000;
			vramR = (s8*)getIO() + 0x18000;
			vramG = (s8*)getIO() + 0x1C000;
		} else {
			// バンク0 表示
			vramB = (s8*)getIO() + 0x04000;
			vramR = (s8*)getIO() + 0x08000;
			vramG = (s8*)getIO() + 0x0C000;
		}
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
}

void
CatPlatformX1::renderText()
{
	// @todo

	const u8  CTRCWidth  = crtc->readRegister(CatCRTC::RegisterNo::Width);
	const u8  CTRCHeight = crtc->readRegister(CatCRTC::RegisterNo::Height);
	const u16 CTRCStart  = crtc->readRegister(CatCRTC::RegisterNo::StartAddressLow) | ((u16)crtc->readRegister(CatCRTC::RegisterNo::StartAddressHigh) << 8);
	u8* textBase = (u8*)getIO() + 0x3000; // テキストアドレス
	u8* attrBase = (u8*)getIO() + 0x2000; // アトリビュートアドレス

	const u32 size = CTRCWidth * CTRCHeight;
	s32 x = 0;
	s32 y = 0;
	for(u32 i = 0; i < size; i++) {
		u16 ch   = textBase[(CTRCStart + i) & 0x07FF];
		u8 attr = attrBase[(CTRCStart + i) & 0x07FF];
		const u8* pattern = pcg->getData((attr & 0x20) ? ch : (ch + 0x100));

		for(s32 yy = y; yy < y + 8; ++yy) {
			s8* dst = (s8*)&imageMemory[yy * 640*4 + ((CTRCWidth <= 40) ? (x * 16 * 4) : (x * 8 * 4))];
			for(u8 mask = 0x80; mask != 0; mask >>= 1) {
				u8 r = (pattern[0]  & mask) ? 0xFF : 0x00; // R
				u8 g = (pattern[8]  & mask) ? 0xFF : 0x00; // G
				u8 b = (pattern[16] & mask) ? 0xFF : 0x00; // B
				if((attr & 0x01) == 0) { b = 0x00; }
				if((attr & 0x02) == 0) { r = 0x00; }
				if((attr & 0x04) == 0) { g = 0x00; }
				if(attr & 0x08) { r ^= 0xFF; g ^= 0xFF; b ^= 0xFF; }
				if(r | g | b) {
					dst[0] = r; // R
					dst[1] = g; // G
					dst[2] = b; // B
					dst[3] = 0xFF;
					if(CTRCWidth <= 40) {
						dst[4] = r; // R
						dst[5] = g; // G
						dst[6] = b; // B
						dst[7] = 0xFF;
					}
				}
				if(CTRCWidth <= 40) {
					dst += 8;
				} else {
					dst += 4;
				}
			}
			pattern++;
		}

		x++;
		if(x >= CTRCWidth) {
			x = 0;
			y += 8;
			if(y >= 200) {
				break;
			}
		}
	}
}






CatPlatformX1::CatPlatformX1()
	: currentTick()
	, imageMemory(new u8[CatPlatformX1::GVRAM_SIZE])
	, ctc(new CatCTC())
	, pcg(new CatPCG())
	, crtc(new CatCRTC())
	, isGRAMSyncAccessMode(false) // 同時アクセスモード OFF
{
}

CatPlatformX1::~CatPlatformX1()
{
	terminate();

	if(crtc) {
		delete crtc;
		crtc = nullptr;
	}
	if(pcg) {
		delete pcg;
		pcg = nullptr;
	}
	if(ctc) {
		delete ctc;
		ctc = nullptr;
	}
	if(imageMemory) {
		delete[] imageMemory;
		imageMemory = nullptr;
	}
}

s32
CatPlatformX1::initialize(void* config)
{
	terminate();

	currentTick = 0;

	// スクリーンのイメージ初期化
	initializeScreenImage();
	// グラフィックパレット初期化
	initializeGraphicPalette();
	// CRTC初期化
	initializeCRTC(80);

	ctc->initialize();
	pcg->initialize();

	clearTextAndAttribute(0x20, 0x07);

	/*
	// PCGデバッグ
	u8* text = (u8*)getIO() + 0x3000;
	u8* attr = (u8*)getIO() + 0x2000;
	for(int i = 0; i < 256; i++) {
		text[i] = i;
		attr[i] = 0x27;
	}
	*/

	// 同時アクセスモード OFF
	isGRAMSyncAccessMode = false;
	((u8*)getIO())[0x1FD0] = 0x00;

	setVRAMDirty();

	return 0;
}

void
CatPlatformX1::terminate()
{
	if(pcg) {
		pcg->terminate();
	}
	if(ctc) {
		ctc->terminate();
	}
	if(crtc) {
		crtc->terminate();
	}
}

void
CatPlatformX1::resetTick()
{
	currentTick = 0;
}

void
CatPlatformX1::adjustTick(s32& tick)
{
	// CTC
	ctc->adjustClock(tick);

	if(tick > lineTick) {
		tick = lineTick;
	}
}

void
CatPlatformX1::tick(s32 tick)
{
	s32 diff = tick - currentTick;
	if(diff > 0) {
		currentTick += diff;
		// CTC
		if(s32 irq = ctc->execute(diff); irq >= 0) {
			// 必要ならIRQの割り込みを発生させる
			generateIRQ(irq);
		}

		// 
		counter += diff;
		// VSYNC
		vBlank = false;
		if(counterNextVSync <= counter) {
			if(counter <= counterNextVSyncEnd) {
				vBlank = true;
			} else {
				counterNextVSync    = counter + diskTick;
				counterNextVSyncEnd = counterNextVSync + vBlankTick;
			}
		}
	}
}


void
CatPlatformX1::platformOutPort(u8* io, u16 port, u8 value)
{
	if(isGRAMSyncAccessMode) {
		// 同時アクセスモード
		if(((u8*)getIO())[0x1FD0] & 0x10) {
			io +=  0x1'0000; // バンク1 アクセス
		}
		if(port < 0x4000) [[likely]] {
			if(io[port + 0x4000] != value) { setVRAMDirty(); io[port + 0x4000] = value; } // B
			if(io[port + 0x8000] != value) { setVRAMDirty(); io[port + 0x8000] = value; } // R
			if(io[port + 0xC000] != value) { setVRAMDirty(); io[port + 0xC000] = value; } // G
		} else if(port < 0x8000) {
			// 0x4000～0x7FFF RG
			port -= 0x4000;
			if(io[port + 0x8000] != value) { setVRAMDirty(); io[port + 0x8000] = value; } // R
			if(io[port + 0xC000] != value) { setVRAMDirty(); io[port + 0xC000] = value; } // G
		} else if(port < 0xC000) {
			// 0x8000～0xBFFF BG
			port -= 0x8000;
			if(io[port + 0x4000] != value) { setVRAMDirty(); io[port + 0x4000] = value; } // B
			if(io[port + 0xC000] != value) { setVRAMDirty(); io[port + 0xC000] = value; } // G
		} else {
			// 0xC000～0xFFFF BR
			port -= 0xC000;
			if(io[port + 0x4000] != value) { setVRAMDirty(); io[port + 0x4000] = value; } // B
			if(io[port + 0x8000] != value) { setVRAMDirty(); io[port + 0x8000] = value; } // R
		}
		return;
	}


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
		if(0x3000 <= port) {
			const u16 characterPortAddress = queryPCGCharacterPortAddress(); // PCGのキャラ定義に使われているポートアドレス
			if(port == characterPortAddress) {
				pcg->setChar(value); // PCGで設定するキャラクタ
			}
		}
	} else if(0x4000 <= port) [[likely]]{
		// VRAM
		if(((u8*)getIO())[0x1FD0] & 0x10) {
			io +=  0x1'0000; // バンク1 アクセス
		}
		if(io[port] != value) {
			setVRAMDirty();
			io[port] = value;
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
		// CTRC 読み書きのレジスタを設定する
		crtc->setAccessRegisterNo(value);
	} else if(port == 0x1801) {
		// CTRC レジスタに書き込む
		crtc->writeRegister(value);
	} else if((port & 0xFF0F) == 0x1A02) {
		// 8255 C
		if((io[0x1A02] & 0x20) && ((value & 0x20) == 0)) {
			// 立ち下げ - 同時アクセスモード
			isGRAMSyncAccessMode = true;
		}
		io[0x1A02] = value;
	} else if((port & 0xFF0F) == 0x1A03) {
		// 
		if(value & 0x80) {
			// bit
			const u8 bitNo = (value >> 1) & 0x7;
			if(value & 1) {
				// set
				platformOutPort(io, 0x1A02, io[0x1A02] | (1 << bitNo));
			} else {
				// reset
				platformOutPort(io, 0x1A02, io[0x1A02] & ~(1 << bitNo));
			}
		}
		io[0x1A03] = value;
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
		tick(getExecutedClock());
		ctc->write8(0, value);
	} else if(port == 0x1FA1) {
		// CTC1
		tick(getExecutedClock());
		ctc->write8(1, value);
	} else if(port == 0x1FA2) {
		// CTC2
		tick(getExecutedClock());
		ctc->write8(2, value);
	} else if(port == 0x1FA3) {
		// CTC3
		tick(getExecutedClock());
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
	} else if(port == 0x1FD0) {
		if((io[0x1FD0] & 0x9B) != (value & 0x9B)) {
			setVRAMDirty();
		}
		io[0x1FD0] = value;
	}
}

u8
CatPlatformX1::platformInPort(u8* io, u16 port)
{
	if(isGRAMSyncAccessMode) {
		// 同時アクセスモードの解除
		isGRAMSyncAccessMode = false;
		// return 0;
	}

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
		tick(getExecutedClock());
		return ctc->read8(0);
	} else if(port == 0x1FA1) {
		// CTC1
		tick(getExecutedClock());
		return ctc->read8(1);
	} else if(port == 0x1FA2) {
		// CTC2
		tick(getExecutedClock());
		return ctc->read8(2);
	} else if(port == 0x1FA3) {
		// CTC3
		tick(getExecutedClock());
		return ctc->read8(3);
	} else if((port & 0xFF0F) == 0x1A01) {
		// 8255 B
#if false
		const auto tick = getExecutedClock();
		this->tick(tick);
		constexpr auto v = (4000000 / 60) * 24 / (200+24); // @todo VSYNC期間のタイミング
		bool vsync = tick > (4000000 / 60 - v);
		return (vsync ? 0x00 : 0x80);
#else
		return (vBlank ? 0x00 : 0x80);
#endif
	} else if((port & 0xFF0F) == 0x1A02) {
		// 8255 C
		return io[0x1A02];
	} else if((port & 0xFF0F) == 0x1A03) {
		return io[0x1A03];
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
	} else if((port & 0xFF00) == 0x1400) {
		// CHAR ROM Read
		return pcg->readROM();
	} else if((port & 0xFF00) == 0x1500) {
		// PCG B
		return pcg->readB();
	} else if((port & 0xFF00) == 0x1600) {
		// PCG R
		return pcg->readR();
	} else if((port & 0xFF00) == 0x1700) {
		// PCG G
		return pcg->readG();
	} else if(port == 0x1FD0) {
		return io[0x1FD0];
	}
	return 0xFF;
}

void*
CatPlatformX1::render()
{
	renderGraphic();
	renderText();
	return (void*)imageMemory;
}

void
CatPlatformX1::writePCG(u16 ch, u8* data)
{
	// PCG
	pcg->setPCG(ch, data);
}

void
CatPlatformX1::readPCG(u16 ch, u8* data)
{
	// @todo
}
