#include "../../sos.h"
#include "catPlatformMZ700.h"
#if ENABLE_TARGET_MZ700
#include "../X1/catPCG.h"
#include "cat8253.h"

WASM_IMPORT("log", "logHex04")
extern "C" void jslogHex04(int operandNumber);
WASM_IMPORT("log", "logHex02")
extern "C" void jslogHex02(int operandNumber);

/**
 * @brief 水平ブランクと垂直ブランクの管理
 */
class VHBlank {
	// https://twitter.com/kanegonMZ/status/1621668318796222464/photo/1
	// 320dot   + 136dot   = 456dot
	// 160clock +  68clock = 228clock

	/**
	 * @brief 水平ラインの表示期間のクロック数
	 */
	static constexpr s64 HDISPLAY_CLOCK = 160;

	/**
	 * @brief Hブランク期間のクロック数
	 */
	static constexpr s64 HBLANK_CLOCK = 68;

	/**
	 * @brief 1ラインあたりのクロック数
	 */
	static constexpr s64 LINE_PER_CLOCK = HDISPLAY_CLOCK + HBLANK_CLOCK;

	/**
	 * @brief Vブランクのライン数
	 */
	static constexpr s64 VBLANK_LINE_COUNT = 62;

	/**
	 * @brief １画面の表示ライン数
	 */
	static constexpr s64 DISPLAY_LINE_COUNT = 200;

	/**
	 * @brief １画面のライン数
	 */
	static constexpr s64 LINE_COUNT = DISPLAY_LINE_COUNT + VBLANK_LINE_COUNT;

	/**
	 * @breif 表示期間のクロック数
	 */
	static constexpr s64 FRAME_DISPLAY_CLOCK = LINE_PER_CLOCK * DISPLAY_LINE_COUNT;

	/**
	 * @breif 1フレームあたりのクロック数
	 */
	static constexpr s64 FRAME_CLOCK = LINE_PER_CLOCK * LINE_COUNT;

	/**
	 * @brief 内部カウンタ
	 */
	s64 counter;

	/**
	 * @brief ライン処理用のコールバック関数
	 */
	void(*callback)(s32, void* userData);
	/**
	 * @brief ライン処理用のコールバック関数呼び出し時のユーザ引数
	 */
	void* userData;

	/**
	 * @brief ちっちゃいほうを返す
	 */
	inline s64 min(s64 a, s64 b) { return (a < b) ? a : b; }

	/**
	 * @brief ラインの処理
	 * @param[in]	line	処理するライン
	 */
	void execLine(s64 line) noexcept
	{
		if(callback) [[likely]] {
			callback(line, userData);
		}
	}
public:
	/**
	 * @brief コンストラクタ
	 */
	VHBlank()
		: counter(0)
		, callback()
		, userData()
	{
	}

	/**
	 * @brief リセット
	 */
	void reset() {
		counter = 0;
		callback = nullptr;
		userData = nullptr;
	}

	/**
	 * @brief
	 */
	void adjustTick(s32& tick)
	{
		const auto lineClock = counter % LINE_PER_CLOCK;
		if(lineClock < HDISPLAY_CLOCK) {
			tick = min(tick, HDISPLAY_CLOCK - lineClock);
		} else {
			tick = min(tick, LINE_PER_CLOCK - lineClock);
		}
		if(counter < FRAME_DISPLAY_CLOCK) {
			tick = min(tick, FRAME_DISPLAY_CLOCK - counter);
		} else if(counter < FRAME_CLOCK) {
			tick = min(tick, FRAME_CLOCK - counter);
		}
	}

	/**
	 * @brief
	 */
	void tick(s32 tick)
	{
		const auto lineClock = counter % LINE_PER_CLOCK;
		if(lineClock < HDISPLAY_CLOCK) {
			// 描画中
			auto line = counter / LINE_PER_CLOCK;
			execLine(line); // @todo HBlankに入ったら描画するようにすると、軽くなるはず
		} else {
			// HBlank中
		}
		counter += tick;
		while(counter >= FRAME_CLOCK) {
			counter -= FRAME_CLOCK;
		}
	}

	/**
	 * @brief ライン処理用のコールバック関数を登録する
	 * @param[in]	callback	ライン処理用のコールバック関数
	 * @param[in]	userData	ライン処理用のコールバック関数呼び出し時に渡されるユーザ引数
	 */
	void setLineCallback(void(*callback)(s32, void*), void* userData)
	{
		this->userData = userData;
		this->callback = callback;
	}

	/**
	 * @brief HBlank期間中かどうか
	 * @return HBlank期間中なら true を返す
	 */
	bool isHBlank() const noexcept
	{
		const auto lineClock = counter % LINE_PER_CLOCK;
		return lineClock >= HDISPLAY_CLOCK;
	}

	/**
	 * @brief VBlank期間中かどうか
	 * @return VBlank期間中なら true を返す
	 */
	bool isVBlank() const noexcept { return counter >= FRAME_DISPLAY_CLOCK; }
};

/**
 * @brief カーソルの点滅の管理
 */
class CursorTimer {
	/**
	 * @brief 点滅の間隔（単位はクロック）
	 */
	static constexpr s32 CURSOR_BLINK_COUNT = 4000000 * 2;

	/**
	 * @brief 内部カウンタ（単位はクロック）
	 */
	s32 counter;
public:
	/**
	 * @brief コンストラクタ
	 */
	CursorTimer()
		: counter(0)
	{
	}

	/**
	 * @brief リセット
	 */
	void reset() {
		counter = 0;
	}

	/**
	 * @brief
	 */
	void adjustTick(s32& tick)
	{
	}

	/**
	 * @brief
	 */
	void tick(s32 tick)
	{
		counter += tick;
		while(counter >= CURSOR_BLINK_COUNT) {
			counter -= CURSOR_BLINK_COUNT;
		}
	}

	/**
	 * @brief カーソル表示状態を取得する
	 * @return カーソル表示状態
	 */
	bool isActive() const noexcept { return counter < (CURSOR_BLINK_COUNT / 2); }
};










void
CatPlatformMZ700::initializePalette() noexcept
{
	for(s32 i = 0; i < 8; i++) {
		paletteB[i] = (i & 0x1) ? 0xFF : 0x00;
		paletteR[i] = (i & 0x2) ? 0xFF : 0x00;
		paletteG[i] = (i & 0x4) ? 0xFF : 0x00;
	}
}

void
CatPlatformMZ700::initializeScreenImage() noexcept
{
	for(s32 i = 0; i < CatPlatformMZ700::GVRAM_SIZE; ++i) {
		imageMemory[i] = 0;
	}
}

void
CatPlatformMZ700::initializeTextRAM()
{
	for(s32 i = 0; i < 0x10000; ++i) {
		tvram[i] = 0;
	}

	// 表示関連の初期化
	for(int i = 0; i < 1024; i++) {
		//tvram[0xD000 + i] = 0x00;
		//tvram[0xD400 + i] = 0x00;
		tvram[0xD800 + i] = 0x70; // 0x70にしとかないと表示されない……
		//tvram[0xDC00 + i] = 0x00;
	}

	// @todo あってる？？
	tvram[0xE002] = 0x08; // M_ON
}


void
CatPlatformMZ700::drawLineBG(u32 x, u32 line, const u8 bgColor) noexcept
{
	const u8 bg_r = paletteR[bgColor];
	const u8 bg_g = paletteG[bgColor];
	const u8 bg_b = paletteB[bgColor];
	u8* dst = &imageMemory[line * 640*4 + x * 16 * 4];
	for(u8 i = 0; i < 8; ++i) {
		dst[0] = bg_r; // R
		dst[1] = bg_g; // G
		dst[2] = bg_b; // B
		dst[3] = 0xFF;
		dst[4] = bg_r; // R
		dst[5] = bg_g; // G
		dst[6] = bg_b; // B
		dst[7] = 0xFF;
		dst += 8;
	}
}

void
CatPlatformMZ700::drawLineROMCG(s32 x, s32 y, s32 ch, const u8 fgColor) noexcept
{
	// CG ROM 0x000～0x1FF
	const u8* pattern = pcg->getData(ch) + (y & 7); // キャラクタデータ取得
	const u8 fg_r = paletteR[fgColor];
	const u8 fg_g = paletteG[fgColor];
	const u8 fg_b = paletteB[fgColor];
	u8* dst = &imageMemory[y * 640*4 + x * 16 * 4];
	for(u8 mask = 0x80; mask != 0; mask >>= 1) {
		const bool bit = (*pattern & mask) != 0;
		if(bit) [[unlikely]] {
			dst[0] = fg_r; // R
			dst[1] = fg_g; // G
			dst[2] = fg_b; // B
			//dst[3] = 0xFF;
			dst[4] = fg_r; // R
			dst[5] = fg_g; // G
			dst[6] = fg_b; // B
			//dst[7] = 0xFF;
		}
		dst += 8;
	}
}

void
CatPlatformMZ700::drawLinePCG(s32 x, s32 y, u16 pcgn) noexcept
{
	// PCG 0x200～
	const u8* pattern = pcg->getData(pcgn + 0x200) + (y & 7); // PCGデータ取得
	u8* dst = &imageMemory[y * 640*4 + x * 16 * 4];
	for(u8 mask = 0x80; mask != 0; mask >>= 1) {
		u8 bit = (pattern[0]  & mask) ? 0x2 : 0; // R
		bit |= (pattern[8]  & mask) ? 0x4 : 0; // G
		bit |= (pattern[16] & mask) ? 0x1 : 0; // B
		if(bit) {
			dst[0] = paletteR[bit]; // R
			dst[1] = paletteG[bit]; // G
			dst[2] = paletteB[bit]; // B
			//dst[3] = 0xFF;
			dst[4] = dst[0]; // R
			dst[5] = dst[1]; // G
			dst[6] = dst[2]; // B
			//dst[7] = 0xFF;
		}
		dst += 8;
	}
}

void
CatPlatformMZ700::renderLineText(s32 line, void* userData)
{
	((CatPlatformMZ700*)userData)->renderLineText(line);
}

void
CatPlatformMZ700::renderLineText(s32 line) noexcept
{
	if(line < 0 || line >= 200) [[unlikely]] {
		return; // 範囲外
	}

	const u32 y = line / 8;
	constexpr u32 CTRCWidth = 40;
	for(u32 x = 0; x < CTRCWidth; x++) {
		u16 ch = tvram[0xD000 + y * 40 + x]; // CG ROMのキャラクタ番号 0x000～0x1FF
		const u8 attr = tvram[0xD800 + y * 40 + x];
		if(attr & 0x80) {
			ch |= 0x100; // セット１に
		}
		u16 pcgn = tvram[0xD400 + y * 40 + x]; // PCG番号
		pcgn |= (u16)(tvram[0xDC00 + y * 40 + x] & 0xC0) << 2;
		const bool pcge = (tvram[0xDC00 + y * 40 + x] & 0x08) != 0; // PCG有効かどうか

		// BG
		const u8 bgColor = attr & 7; // 背景色
		drawLineBG(x, line, bgColor);
		// PCG
		if(pcgdisp && !priority && pcge) { drawLinePCG(x, line, pcgn); }
		// ROM CG
		const u8 fgColor = (attr >> 4) & 7; // CG ROMの文字色
		drawLineROMCG(x, line, ch, fgColor);
		// PCG
		if(pcgdisp && priority && pcge) { drawLinePCG(x, line, pcgn); }
	}
}

CatPlatformMZ700::CatPlatformMZ700()
	: bank0(0)
	, bank1(0)
	, bankPCG(0)
	, bankSwitchPCG(false)
	, waitHBlank(false)
	, writeBufferAddress(false)
	, writeBufferValue(0)
	, isTextVRAMDirty(false)
	, pcgdisp(false) // PCG表示
	, priority(false) // 優先順位
	, imageMemory(new u8[CatPlatformMZ700::GVRAM_SIZE])
	, pcg(new CatPCG())
	, vhBlank(new VHBlank())
	, cursorTimer(new CursorTimer())
	, timer8253(new Intel8253::Cat8253(this))
	, tape(new CatTape())
	, tempo(0)
	, currentTick(0)
	, counter(0)
{
}

CatPlatformMZ700::~CatPlatformMZ700()
{
	terminate();

	if(tape) [[likely]] {
		delete tape;
		tape = nullptr;
	}
	if(timer8253) [[likely]] {
		delete timer8253;
		timer8253 = nullptr;
	}
	if(cursorTimer) [[likely]] {
		delete cursorTimer;
		cursorTimer = nullptr;
	}
	if(vhBlank) [[likely]] {
		delete vhBlank;
		vhBlank = nullptr;
	}
	if(pcg) [[likely]] {
		delete pcg;
		pcg = nullptr;
	}
	if(imageMemory) [[likely]] {
		delete[] imageMemory;
		imageMemory = nullptr;
	}
}

s32
CatPlatformMZ700::initialize(void* config)
{
	terminate();

	// スクリーンのイメージ初期化
	initializeScreenImage();
	// パレット初期化
	initializePalette();
	// テキストRAMを初期化
	initializeTextRAM();
	// 描画必要に設定
	setVRAMDirty();
	// PCG初期化
	pcg->initialize();

	// VBlankとHBlankの管理を初期化
	vhBlank->reset();
	vhBlank->setLineCallback(&CatPlatformMZ700::renderLineText, this);

	// カーソル点滅管理の初期化
	cursorTimer->reset();

	// 8253タイマの初期化
	timer8253->reset();
	return 0;
}

void
CatPlatformMZ700::terminate()
{
	bank0 = 0;
	bank1 = 0;
	bankPCG = 0;
	bankSwitchPCG = false;
	waitHBlank = false;
	writeBufferAddress = false;
	writeBufferValue = 0;
	isTextVRAMDirty = false;
	pcgdisp = false;
	priority = false;
	tempo = 0;
	currentTick = 0;
	counter = 0;
}

void
CatPlatformMZ700::resetTick()
{
	currentTick = 0;
}

bool
CatPlatformMZ700::adjustTick(s32& tick)
{
	vhBlank->adjustTick(tick);
	cursorTimer->adjustTick(tick);
	timer8253->adjustTick(tick);

	if(tick > 64) { tick = 64; } // @todo 不要かも？

	// HBlank待ちのCPUストール
	// true を返すと CPUの更新処理がされない
	return waitHBlank;
}

void
CatPlatformMZ700::tick(s32 tick)
{
	s32 diff = tick - currentTick;

	// VBlankとHBlank進める
	vhBlank->tick(diff);
	// HBlankまでストールさせる
	if(vhBlank->isHBlank()) {
		waitHBlank = false;
		// 保留していた書き込みを、ここで書き込む
		if(writeBufferAddress) {
			tvram[writeBufferAddress] = writeBufferValue;
			writeBufferAddress = 0;
		}
		setVRAMDirty();
	}

	// カーソル点滅
	cursorTimer->tick(diff);

	// 8253のタイマー
	timer8253->tick(diff);

	if(diff > 0) [[likely]] {
		currentTick += diff;
		counter += diff;
	}
}

void
CatPlatformMZ700::platformOutPort(u8* io, u16 port, u8 value)
{
	switch(port & 0xFF) {
		case 0xE0: bank0 = 0; break; // 0000～0FFF : RAM
		case 0xE1: bank1 = 0; break; // D000～FFFF : RAM
		case 0xE2: bank0 = 1; break; // 0000～0FFF : IPL ROM
		case 0xE3: bank1 = 1; break; // D000～FFFF : VRAM・IO・ROM
		case 0xE4:
			// 0000～0FFF : IPL ROM
			// D000～FFFF : VRAM・IO・ROM
			bank0 = 1;
			bank1 = 1;
			bankSwitchPCG = false; // PCGバンク閉じる
			break;
		case 0xE5: // PCGバンク切り替え
			bankPCG = value & 0x03;
			bankSwitchPCG = true;
			break;
		case 0xE6: bankSwitchPCG = false; break; // PCGバンクを閉じる
		case 0xF0: // テキスト/PCG プライオリティ
			pcgdisp  = (value & 0x01) != 0; // PCG表示
			priority = (value & 0x02) != 0; // 優先順位
			break;
		case 0xF1: // パレット
			{
				const u8 paletteNo = (value >> 4) & 0x7;
				const u8 color     =  value       & 0x7;
				paletteB[paletteNo] = (color & 0x1) ? 0xFF : 0;
				paletteR[paletteNo] = (color & 0x2) ? 0xFF : 0;
				paletteG[paletteNo] = (color & 0x4) ? 0xFF : 0;
				setVRAMDirty();
			}
			break;
	}
}

u8
CatPlatformMZ700::platformInPort(u8* io, u16 port)
{
//	jslogHex02(port);
	return 0;
}

void
CatPlatformMZ700::platformWriteMemoryVRAM_IO_ROM(u8* mem, u16 address, u8 value)
{
	// VRAM・IO・ROM
	if(address <= 0xD7FF) {
		// TEXT VRAM
		if(!vhBlank->isHBlank()) {
			// HBlankまでストールする
			requestBreak();
			waitHBlank = true;
			writeBufferAddress = address; // HBlankになったら書き込む
			writeBufferValue   = value;
			return;
		}
		if(tvram[address] != value) {
			tvram[address] = value;
			setVRAMDirty();
		}
	} else if(address <= 0xDFFF) {
		// ATTRIBUTE VRAM
		if(!vhBlank->isHBlank()) {
			// HBlankまでストールする
			requestBreak();
			writeBufferAddress = address;
			writeBufferValue   = value;
			waitHBlank = true;
			return;
		}
		if(tvram[address] != value) {
			tvram[address] = value;
			setVRAMDirty();
		}
	} else {
		// I/O @todo
		switch(address) {
			case 0xE000: // 8255 ポートA
				tvram[address] = value;
				// 556RST
				if((value & 0x80) == 0) [[unlikely]] { cursorTimer->reset(); }
				return;
			case 0xE001: // 8255 ポートB
				return;
			case 0xE002: // 8255 ポートC
				{
jslogHex04(0xE002);
jslogHex02(tvram[address]);
jslogHex02(value);
					u8 M_ON     = tvram[address] & 0x08;
					u8 INTMSK   = tvram[address] & 0x04;
					u8 WDATA    = tvram[address] & 0x02;
					u8 SOUNDMSK = tvram[address] & 0x01;
					// M ON
					if((M_ON == 0) && ((value & 0x08) != 0)) {
						// @todo モーターONとOFF
						//       よくわからないので、MOTORの状態を反転するようにしてみる
						tape->motor(!tape->getMotorState());
					}
					// INTMSK
					// WDATA
					tape->writeData(WDATA != 0);
					// SOUNDMSK
					tvram[address] = (value & 0x0F);
				}
				return;
			case 0xE003: // 8255 コントロール
				if((value & 0x80) == 0) [[likely]] {
					const u8 bitNo = (value >> 1) & 0x7;
					if(value & 1) {
						// set
						platformWriteMemoryVRAM_IO_ROM(mem, 0xE002, tvram[0xE002] | (1 << bitNo));
					} else {
						// reset
						platformWriteMemoryVRAM_IO_ROM(mem, 0xE002, tvram[0xE002] & ~(1 << bitNo));
					}
				}
				return;
			case 0xE004:
				timer8253->write(0, value);
				return;
			case 0xE005:
				timer8253->write(1, value);
				return;
			case 0xE006:
				timer8253->write(2, value);
				return;
			case 0xE007:
				timer8253->write(3, value);
				return;
			case 0xE008:
				timer8253->setGate(0, (value & 1) != 0);
				return;
		}
	}
}

void
CatPlatformMZ700::platformWriteMemoryPCG(u8* mem, u16 address, u8 value)
{
	if(bankPCG == 0x00) {
		// ROM
		address &= 0x0FFF;
		u32 pcgNo = address / 8;
		u32 index = address & 7;
		u8* patten = pcg->getData(pcgNo); // ROM CG定義は0x000～0x1FFの約束
		patten[     index] = value;
		patten[8 +  index] = value;
		patten[16 + index] = value;
		return;
	} else {
		address -= 0xD000;
		address &= 0x1FFF;

		u32 pcgNo = (address / 8) + 0x200; // PCG定義は0x200～の約束
		u32 index = address & 7;
		u8* patten = pcg->getData(pcgNo);
		switch(bankPCG) {
			case 0x01: // B
				// D000～D007 : PCG #0
				// D008～D00F : PCG #1
				// ...
				// ...
				if(patten[16 + index] != value) {
					patten[16 + index] = value;
					setVRAMDirty();
				}
				break;
			case 0x02: // R
				if(patten[index] != value) {
					patten[index] = value;
					setVRAMDirty();
				}
				break;
			case 0x03: // G
				if(patten[8 + index] != value) {
					patten[8 + index] = value;
					setVRAMDirty();
				}
				break;
		}
	}
}

u8
CatPlatformMZ700::platformReadMemoryPCG(u8* mem, u16 address)
{
	if(bankPCG == 0x00) {
		// ROM
		address &= 0x0FFF;
		u32 pcgNo = address / 8;
		u32 index = address & 7;
		u8* patten = pcg->getData(pcgNo); // ROM CG定義は0x000～0x1FFの約束
		return patten[index];
	} else {
		address -= 0xD000;
		address &= 0x1FFF;
		u32 pcgNo = (address / 8) + 0x200; // PCG定義は0x200～の約束
		u32 index = address & 7;
		u8* patten = pcg->getData(pcgNo);
		switch(bankPCG) {
			case 0x01: // B
				// D000～D007 : PCG #0
				// D008～D00F : PCG #1
				// ...
				// ...
				return patten[16 + index];
			case 0x02: // R
				return patten[index];
			case 0x03: // G
				return patten[8 + index];
		}
	}
	return 0xFF;
}

void
CatPlatformMZ700::platformWriteMemory(u8* mem, u16 address, u8 value)
{
	if(0x0000 <= address && address <= 0x0FFF) {
		if(bank0 != 0) {
			tvram[address] = value; // IPL_ROM
			return;
		}
	} else if(0xD000 <= address && address <= 0xFFFF) {
		// バンクアクセス
		// ・PCGのアクセスが強い
		if(bankSwitchPCG) {
			// PCG
			platformWriteMemoryPCG(mem, address, value);
			return;
		} else if(bank1 != 0) {
			// VRAMなど
			platformWriteMemoryVRAM_IO_ROM(mem, address, value);
			return;
		}
	}
	mem[address] = value;
}

u8
CatPlatformMZ700::platformReadMemoryVRAM_IO_ROM(u8* mem, u16 address)
{
	// VRAM・IO・ROM
	if(address <= 0xD7FF) {
		// TEXT VRAM
		return tvram[address];
	} else if(address <= 0xDFFF) {
		// ATTRIBUTE VRAM
		return tvram[address];
	} else {
		// I/O
		switch(address) {
			case 0xE000: // 8255 ポートA
				return tvram[address];
			case 0xE001: // 8255 ポートB
				{
					// キーボードマトリクスのデータ入力
					u8 strobe = tvram[0xE000] & 0xF; // 0～9
					if(strobe > 9) { strobe = 9; }
					u8* scan = (u8*)scanKey();
					return scan[strobe];
				}
			case 0xE002: // 8255 ポートC
				{
					const u8 VBLK    = vhBlank->isVBlank()     ? 0x00 : 0x80; // VBlank
					const u8 _556OUT = cursorTimer->isActive() ? 0x40 : 0x00; // カーソル点滅用のタイマ
					const u8 RDATA   = tape->readData()        ? 0x20 : 0x00; // テープからの読み込みデータ
					const u8 MOTOR   = tape->getMotorState()   ? 0x10 : 0x00; // テープのモータの状態
					return VBLK | _556OUT | RDATA | MOTOR | 0x0F;
				}
			case 0xE003: // 
				return 0xFF;
			case 0xE004:
				return timer8253->read(0);
			case 0xE005:
				return timer8253->read(1);
			case 0xE006:
				return timer8253->read(2);
			case 0xE007:
				return timer8253->read(3);
			case 0xE008:
				{
					tempo ^= 1; // @todo よくわからないので適当に

					u8 HBLK = vhBlank->isHBlank() ? 0x00 : 0x80;
					return 0x7E | HBLK | (tempo & 1);
				}
		}
		return 0x7E;
	}
}

u8
CatPlatformMZ700::platformReadMemory(u8* mem, u16 address)
{
	if(0x0000 <= address && address <= 0x0FFF) {
		if(bank0 != 0) {
			return tvram[address]; // IPL_ROM
		}
	} else if(0xD000 <= address && address <= 0xFFFF) {
		// バンクアクセス
		// ・PCGのアクセスが強い
		if(bankSwitchPCG) {
			// PCG
			return platformReadMemoryPCG(mem, address);
		} else if(bank1 != 0) {
			// VRAMなど
			return platformReadMemoryVRAM_IO_ROM(mem, address);
		}
	}
	return mem[address];
}

void*
CatPlatformMZ700::render()
{
//	renderText();
	return (void*)imageMemory;
}

void
CatPlatformMZ700::writePCG(u32 ch, u8* data)
{
	// PCG
//	pcg->setPCG(ch, data);
}

void
CatPlatformMZ700::readPCG(u32 ch, u8* data)
{
}

void
CatPlatformMZ700::requestIRQ8253()
{
	// 8255 ポートC INTMSK
	if(tvram[0xE002] & 0x04) {
		generateIRQ(0);
	}
}
















CatTape::CatTape()
	: motorState(0)
	, counter(0)
	, counterHigh(0)
	, counterLow(0)
	, position(0)
{
}

void
CatTape::motor(bool on)
{
//	jslogHex02(on ? 0x88 : 0x44);
	motorState = on ? 1 : 0;
	counterHigh = 0;
	counterLow = 0;
	position = 0;
	ib[0] = 0x01;

	ib[1] = 0x41;
	ib[2] = 0x42;
	ib[3] = 0x43;
	ib[4] = 0x10;
	ib[5] = 0x20;
	ib[6] = 0x30;
	ib[7] = 0x40;
	ib[8] = 0x50;
	ib[9] = 0x60;
	ib[10] = 0x70;
	ib[11] = 0x80;
	ib[12] = 0x90;
	ib[13] = 0x05;
	ib[14] = 0x05;
	ib[15] = 0x05;
	ib[16] = 0x05;
	ib[17] = 0x0D;

	ib[18] = 0x00;
	ib[19] = 0x12;

	ib[20] = 0x00;
	ib[21] = 0x12;

	ib[22] = 0x00;
	ib[23] = 0x12;
}

bool
CatTape::getMotorState()
{
	return motorState ? true : false;
}

void
CatTape::writeData(bool bit)
{
	if(motorState != 0) {
//		jslogHex02(bit ? 0xFF : 0x00);
	}
}

bool
CatTape::readData()
{
	if(motorState != 0) {
		// 立ち上がりの検出の後に1ビット読み込んでるみたいなので、これで行ける？
		if(counterHigh == 0) {
			counterHigh++;
			return false;
		}
		if(counterHigh == 1) {
			counterHigh++;
			return true;
		}
		counterHigh = 0;
		return getNextBit();
	}
	return false;
}

void
CatTape::seek()
{
}

bool
CatTape::getNextBit()
{
	// GAP
	position++;
	if(position <= 22000) {
		return false;
	}
	if(position <= 22000 + 40) {
		return true;
	}
	if(position <= 22000 + 40 + 40) {
		return false;
	}
	if(position <= 22000 + 40 + 40 + 1) {
		return true;
	}

	// IB 128byte
	if(position <= 22000 + 40 + 40 + 1 + 128*8) {
		//
		auto p = position - (22000 + 40 + 40 + 1);
		u8 bit = p & 0x07;
		return (ib[p >> 8] & (1<<bit)) != 0;
	}
	// CheckSum 2バイト
	if(position <= 22000 + 40 + 40 + 1 + 128*8 + 2*8) {
		//
		return false;
	}
	if(position <= 22000 + 40 + 40 + 1 + 128*8 + 2*8 + 1) {
		//
		return true;
	}
	if(position <= 22000 + 40 + 40 + 1 + 128*8 + 2*8 + 1 + 256) {
		//
		return false;
	}
	if(position <= 22000 + 40 + 40 + 1 + 128*8 + 2*8 + 1 + 256+ 128*8) {
		//
		return false;
	}
	if(position <= 22000 + 40 + 40 + 1 + 128*8 + 2*8 + 1 + 256+ 128*8 + 2*8) {
		//
		return false;
	}
	if(position <= 22000 + 40 + 40 + 1 + 128*8 + 2*8 + 1 + 256+ 128*8 + 2*8+1) {
		//
		return true;
	}



	return false;
}

#endif // ENABLE_TARGET_MZ700
