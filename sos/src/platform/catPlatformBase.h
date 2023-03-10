#pragma once

#include "../cat/low/catLowBasicTypes.h"
#include "catPratformTarget.h"

/**
 * @brief 機種のベースクラス
 */
class CatPlatformBase {
public:
	/**
	 * @brief デストラクタ
	 */
	virtual ~CatPlatformBase() {}

	/**
	 * @brief 機種ごとの初期化
	 */
	virtual s32 initialize(void* config) = 0;

	/**
	 * @brief 機種ごとの終了処理
	 */
	virtual void terminate() = 0;

	virtual void resetTick() = 0;
	virtual bool adjustTick(s32& tick) = 0;
	/**
	 * @brief 機種ごとの実行処理
	 */
	virtual void tick(s32 tick) = 0;

	virtual void platformWriteMemory(u8* mem, u16 address, u8 value) = 0;
	virtual u8 platformReadMemory(u8* mem, u16 address) = 0;

	/**
	 * @brief 機種毎のOUT処理
	 * @param[in]	io		ioのメモリアドレス
	 * @param[in]	port	IOポート
	 * @param[in]	value	書き込む値
	 */
	virtual void platformOutPort(u8* io, u16 port, u8 value) = 0;

	/**
	 * @brief 機種毎のIN処理
	 * @param[in]	io		ioのメモリアドレス
	 * @param[in]	port	IOポート
	 * @return ポートの値
	 */
	virtual u8 platformInPort(u8* io, u16 port) = 0;

	/**
	 * @brief 機種毎の画面の描画処理
	 * @return 画面のイメージ
	 */
	virtual void* render() = 0;

	/**
	 * @brief 機種毎のPCGデータの書き込み
	 * @param[in]	ch		定義するPCGのキャラクタID
	 * @param[in]	data	PCGデータ
	 */
	virtual void writePCG(u32 ch, u8* data) = 0;
	/**
	 * @brief 機種毎のPCGデータの読み込み
	 * @param[in]	ch		読み込むPCGのキャラクタID
	 * @param[out]	data	PCGデータ
	 */
	virtual void readPCG(u32 ch, u8* data) = 0;
};

class CatPlatformNull : public CatPlatformBase {
public:
	/**
	 * @brief 機種ごとの初期化
	 */
	virtual s32 initialize(void* config) override { return 0; }

	/**
	 * @brief 機種ごとの終了処理
	 */
	virtual void terminate() override {}

	/**
	 * @brief 機種ごとの実行処理
	 * @param[in]	実行するクロック数
	 */
	virtual void tick(s32 tick) override {}
	virtual void resetTick() override {}
	virtual bool adjustTick(s32& tick) override { return false; }

	virtual void platformWriteMemory(u8* mem, u16 address, u8 value) override { mem[address] = value; }
	virtual u8 platformReadMemory(u8* mem, u16 address) override { return mem[address]; }
	
	/**
	 * @brief 機種毎のOUT処理
	 * @param[in]	io		ioのメモリアドレス
	 * @param[in]	port	IOポート
	 * @param[in]	value	書き込む値
	 */
	virtual void platformOutPort(u8* io, u16 port, u8 value) override {}

	/**
	 * @brief 機種毎のIN処理
	 * @param[in]	io		ioのメモリアドレス
	 * @param[in]	port	IOポート
	 * @return ポートの値
	 */
	virtual u8 platformInPort(u8* io, u16 port) override { return 0xFF; }

	/**
	 * @brief 機種毎の画面の描画処理
	 * @return 画面のイメージ
	 */
	virtual void* render() override { return nullptr; }

	/**
	 * @brief 機種毎のPCGデータの書き込み
	 * @param[in]	ch		定義するPCGのキャラクタID
	 * @param[in]	data	PCGデータ
	 */
	virtual void writePCG(u32 ch, u8* data) override {}
	/**
	 * @brief 機種毎のPCGデータの読み込み
	 * @param[in]	ch		読み込むPCGのキャラクタID
	 * @param[out]	data	PCGデータ
	 */
	virtual void readPCG(u32 ch, u8* data) override {}
};
