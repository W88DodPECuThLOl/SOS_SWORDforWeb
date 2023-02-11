#pragma once

#include "../catPlatformBase.h"

/**
 * @brief X1
 */
class CatPlatformX1 : public CatPlatformBase {
	s32 currentTick;

	/**
	 * @brief VRAMのイメージ
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

	/**
	 * @brief PCG
	 */
	class CatPCG* pcg;

	/**
	 * @brief CTRC
	 */
	class CatCRTC* crtc;
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
	virtual void adjustTick(s32& tick) override;
	/**
	 * @brief 機種ごとの実行処理
	 * @param[in]	実行するクロック数
	 */
	virtual void tick(s32 tick) override;

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
	virtual void writePCG(u16 ch, u8* data) override;
	/**
	 * @brief 機種毎のPCGデータの読み込み
	 * @param[in]	ch		読み込むPCGのキャラクタID
	 * @param[out]	data	PCGデータ
	 */
	virtual void readPCG(u16 ch, u8* data) override;
};
