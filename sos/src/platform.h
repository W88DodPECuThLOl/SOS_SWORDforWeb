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
 * @param[in]	port	IOポート
 * @param[in]	value	書き込む値
 * @return IOポート
 */
u16 platformOutPort(u16 port, u8 value);

// 実行するクロックを調整する
void adjustPlatformClock(s32& clock);

/**
 * @brief プラットフォーム側を実行
 * @param[in,out]	実行するクロック数
 * @return 割り込みベクタ
 * @retval 0以上ならIRQ割り込み要求
 */
s32 execPlatform(s32 clock);
