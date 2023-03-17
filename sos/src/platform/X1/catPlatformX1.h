#pragma once

#include "../catPlatformBase.h"

#if ENABLE_TARGET_X1

/**
 * @brief X1
 */
class CatPlatformX1 : public CatPlatformBase {
	s32 currentTick;

	/**
	 * @brief バンクメモリ0～15
	 */
	u8 bankMemory[16*0x8000];
	/**
	 * @brief メモリ／バンクメモリ切り替え
	 * 
	 * 0x00～0x0F : バンクメモリ
	 * 0x10 : メモリ
	 */
	u8 bankMemoryIndex;

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
	 * @brief CTC
	 */
	class CatCTC* ctc;
	class CatCTC* ctc_0704;
	class CatCTC* ctc_070C;

	/**
	 * @brief PCG
	 */
	class CatPCG* pcg;

	/**
	 * @brief CTRC
	 */
	class CatCRTC* crtc;

	/**
	 * @brief 同時アクセスモードかどうか
	 */
	bool isGRAMSyncAccessMode;

	bool vBlank = false;
	static constexpr auto frameTick = (4000000 / 60);
	static constexpr auto lineTick  = frameTick / (200 + 24);
	static constexpr auto diskTick  = frameTick * 200 / (200 + 24);
	static constexpr auto vBlankTick  = frameTick - diskTick;
	u64 counter = 0;
	u64 counterNextVSync = diskTick;
	u64 counterNextVSyncEnd = diskTick + vBlankTick;
public:
	/**
	 * @brief グラフィックのVRAMのサイズ
	 * 
	 *　640x200
	 */
	static constexpr size_t GVRAM_SIZE = (640*200*4);
private:
	/**
	 * @brief グラフィックパレットを初期化する
	 */
	void initializeGraphicPalette() noexcept;

	/**
	 * @brief スクリーンのイメージを初期化する
	 */
	void initializeScreenImage() noexcept;
	/**
	 * @brief CRTCを初期化する
	 * @param[in]	width	画面の桁数
	 */
	void initializeCRTC(const s32 width) noexcept;
	/**
	 * @brief テキストをクリアする
	 * @param[in]	ch			クリアするときのキャラクターコード
	 * @param[in]	attribute	クリアするときの属性
	 */
	void clearTextAndAttribute(const u8 ch, const u8 attribute);

	/**
	 * @brief PCGのキャラクタ定義で使用するポートアドレスを取得する
	 * @return PCGのキャラクタ定義で使用するポートアドレス
	 */
	u16 queryPCGCharacterPortAddress() noexcept;

	void renderGraphic();
	void renderText();
public:
	/**
	 * @brief コンストラクタ
	 */
	CatPlatformX1();
	/**
	 * @brief デストラクタ
	 */
	virtual ~CatPlatformX1();

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

	virtual void platformWriteMemory(u8* mem, u16 address, u8 value) override {
		if(address < 0x8000) {
			if(bankMemoryIndex < 0x10) {
				// バンクメモリ 0 ～ 15
				bankMemory[0x8000 * bankMemoryIndex + address] = value;
			}
		}
		mem[address] = value;
	}
	virtual u8 platformReadMemory(u8* mem, u16 address) override {
		if(address < 0x8000) {
			if(bankMemoryIndex < 0x10) {
				// バンクメモリ 0 ～ 15
				return bankMemory[0x8000 * bankMemoryIndex + address];
			}
		}
		return mem[address];
	}

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

#endif // ENABLE_TARGET_X1
