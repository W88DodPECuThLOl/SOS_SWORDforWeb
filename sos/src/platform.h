#pragma once

#include "cat/low/catLowBasicTypes.h"

/**
 * @brief 機種ごとの初期化
 * @param[in] platformID	機種の識別子
 */
void initPlatform(s32 platformID);

/**
 * @brief VRAM表示用のデータを取得する
 * @return VRAM表示用のデータ
 */
void* getPlatformVRAMImage();

/**
 * @brief 機種毎のOUT処理
 * @param[in]	io		ioのメモリアドレス
 * @param[in]	port	IOポート
 * @param[in]	value	書き込む値
 */
void platformOutPort(u8* io, u16 port, u8 value);
/**
 * @brief 機種毎のIN処理
 * @param[in]	io		ioのメモリアドレス
 * @param[in]	port	IOポート
 * @return ポートの値
 */
u8 platformInPort(u8* io, u16 port);

void platformWriteMemory(u8* mem, u16 address, u8 value);
u8 platformReadMemory(u8* mem, u16 address);

/**
 * @brief プラットフォーム側のチックをリセットする
 */
void resetPlatformTick();
/**
 * @brief プラットフォーム側を実行する
 * @param[in]	targetTick	ターゲットチック
 */
void progressPlatformTick(s32 targetTick);
/**
 * @brief CPU側の実行するクロックを調整する
 * @param[in,out]	clock	クロック
 */
bool adjustPlatformClock(s32& clock);

WASM_EXPORT
extern "C" void writePlatformPCG(u32 ch, u8* data);
WASM_EXPORT
extern "C" void readPlatformPCG(u32 ch, u8* data);
