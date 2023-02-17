#pragma once

#include "../../cat/low/catLowBasicTypes.h"

class CatPCG {
	u8 indexB;
	u8 indexG;
	u8 indexR;
	u8 indexROM;
	u8 pcg[24*256 + 24*256];
	u16 ch;
public:
	/**
	 * @brief コンストラクタ
	 */
	CatPCG();
	~CatPCG();

	/**
	 * @brief 初期化
	 * @return 処理結果
	 */
	s32 initialize();
	/**
	 * @brief 終了処理
	 */
	void terminate();

	/**
	 * @brief 担当しているアドレスかどうか
	 * @param[in]	address	アドレス
	 * @return 自分が担当するアドレスだったら true を返す
	 */
	bool checkAddress(const u16 address) noexcept;
	/**
	 * @brief 書き込み
	 * @param[in]	address	アドレス
	 * @param[in]	value	書き込む値
	 */
	void write(const u16 address, const u8 value);
	/**
	 * @brief 読み込み
	 * @param[in]	address	アドレス
	 * @return 読み込んだ値
	 */
	u8 read(const u16 address);

	void setChar(u16 value);
	u8* getData(u16 ch);
	void writeB(const u8 pattern);
	void writeG(const u8 pattern);
	void writeR(const u8 pattern);
	u8 readROM();
	u8 readB();
	u8 readG();
	u8 readR();

	void setPCG(u16 ch, u8* data);
};
