#pragma once

#include "cat/low/catLowBasicTypes.h"

/**
 * @brief 機種ごとの初期化
 */
void initPlatform();

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
void adjustPlatformClock(s32& clock);
