#pragma once

#include "../catPlatformBase.h"

#if ENABLE_TARGET_MZ700

namespace Intel8253 {
class Cat8253;
} // namespace Intel8253

/**
 * @brief テープデバイス
 */
class CatTape {
	u8 motorState;
	u64 counter;
	u8 counterHigh;
	u8 counterLow;
	u64 position;
	u8 ib[128];

	bool getNextBit();
public:
	CatTape();

	void motor(bool on);
	bool getMotorState();
	void writeData(bool bit);
	bool readData();

	void seek();
};

/**
 * @brief MZ700
 */
class CatPlatformMZ700 : public CatPlatformBase {
	/**
	 * @brief 0x0000～0x0FFFのバンク切り替え
	 */
	s32 bank0;
	/**
	 * @brief 0xD000～0xFFFFのバンク切り替え
	 */
	s32 bank1;
	/**
	 * @brief PCG/CG ROMのバンク
	 */
	u8 bankPCG = 0;
	/**
	 * @brief PCG/CG ROMのバンクが有効かどうか
	 */
	bool bankSwitchPCG = false;

	/**
	 * @brief BIOS、テキストVRAM、IOなど
	 * 
	 * 0x0000～0x0FFF : BIOS
	 * 0xD000～0xFFFF : テキストVRAM、IOなど
	 */
	u8 tvram[0x10000] = {};

	/**
	 * @brief テキストVRAMに書き込まれた時のHBlank待ち用フラグ
	 * 
	 * ・trueの時、HBlankになるまでCPUをストールさせる
	 * ・書き込み処理を遅延させる為に、書き込まれたアドレスと値を覚えておいて、HBlankになったら反映させている
	 */
	bool waitHBlank = false;
	/**
	 * @brief HBlankに入ったときに、書き込むアドレス
	 */
	u16 writeBufferAddress = 0;
	/**
	 * @brief HBlankに入ったときに、書き込む値
	 */
	u8 writeBufferValue = 0;

	/**
	 * @brief
	 */
	bool isTextVRAMDirty;

	/**
	 * @brief PCG表示するかしないか
	 * false : PCGを表示しない
	 * true  : PCGを表示する
	 */
	bool pcgdisp;
	/**
	 * @brief テキスト/PCG プライオリティ
	 * 
	 * false : テキスト文字色＞PCG＞テキスト背景色
	 * true  : PCG＞テキスト
	 */
	bool priority; // 優先順位

	/**
	 * @brief グラフィックVRAMのイメージ
	 */
	u8* imageMemory;

	/**
	 * @brief グラフィックパレット
	 */
	u8 paletteR[8];
	u8 paletteG[8];
	u8 paletteB[8];

	/**
	 * @brief PCG
	 */
	class CatPCG* pcg;

	/**
	 * @brief VBlankとHBlankの管理
	 */
	class VHBlank* vhBlank;

	/**
	 * @brief カーソル点滅管理
	 */
	class CursorTimer* cursorTimer;

	/**
	 * @brief 8253のタイマーIC
	 */
	Intel8253::Cat8253* timer8253;

	CatTape* tape;

	u8 tempo; // テンポタイマー入力 @todo ?

	s32 currentTick;
	u64 counter = 0;
public:
	/**
	 * @brief グラフィックのVRAMのサイズ
	 * 
	 *　640x200
	 */
	static constexpr size_t GVRAM_SIZE = (640*200*4);
private:

	/**
	 * @brief パレットを初期化する
	 */
	void initializePalette() noexcept;

	/**
	 * @brief スクリーンのイメージを初期化する
	 */
	void initializeScreenImage() noexcept;

	/**
	 * @brief テキストRAMを初期化する
	 */
	void initializeTextRAM();
	void drawLineBG(u32 x, u32 line, const u8 bgColor) noexcept;
	void drawLineROMCG(s32 x, s32 y, s32 ch, const u8 fgColor) noexcept;
	void drawLinePCG(s32 x, s32 y, u16 pcgn) noexcept;
	static void renderLineText(s32 line, void*);
	void renderLineText(s32 line) noexcept;

	void platformWriteMemoryVRAM_IO_ROM(u8* mem, u16 address, u8 value);
	void platformWriteMemoryPCG(u8* mem, u16 address, u8 value);
	u8 platformReadMemoryVRAM_IO_ROM(u8* mem, u16 address);
	u8 platformReadMemoryPCG(u8* mem, u16 address);

public:
	/**
	 * @brief 8253からの割り込み要請
	 */
	void requestIRQ8253();
public:
	/**
	 * @brief コンストラクタ
	 */
	CatPlatformMZ700();
	/**
	 * @brief デストラクタ
	 */
	virtual ~CatPlatformMZ700();

	/**
	 * @brief 機種ごとの初期化
	 */
	virtual s32 initialize(void* config) override;

	/**
	 * @brief 機種ごとの終了処理
	 */
	virtual void terminate() override;

	virtual void resetTick() override;
	virtual bool adjustTick(s32& tick) override;
	/**
	 * @brief 機種ごとの実行処理
	 * @param[in]	実行するクロック数
	 */
	virtual void tick(s32 tick) override;

	virtual void platformWriteMemory(u8* mem, u16 address, u8 value) override;
	virtual u8 platformReadMemory(u8* mem, u16 address) override;

	/**
	 * @brief 機種毎のOUT処理
	 * @param[in]	io		ioのメモリアドレス
	 * @param[in]	port	IOポート
	 * @param[in]	value	書き込む値
	 */
	virtual void platformOutPort(u8* io, u16 port, u8 value) override;

	/**
	 * @brief 機種毎のIN処理
	 * @param[in]	io		ioのメモリアドレス
	 * @param[in]	port	IOポート
	 * @return ポートの値
	 */
	virtual u8 platformInPort(u8* io, u16 port) override;

	/**
	 * @brief 機種毎の画面の描画処理
	 * @return 画面のイメージ
	 */
	virtual void* render() override;

	/**
	 * @brief 機種毎のPCGデータの書き込み
	 * @param[in]	ch		定義するPCGのキャラクタID
	 * @param[in]	data	PCGデータ
	 */
	virtual void writePCG(u32 ch, u8* data) override;
	/**
	 * @brief 機種毎のPCGデータの読み込み
	 * @param[in]	ch		読み込むPCGのキャラクタID
	 * @param[out]	data	PCGデータ
	 */
	virtual void readPCG(u32 ch, u8* data) override;
};

#endif // ENABLE_TARGET_MZ700
