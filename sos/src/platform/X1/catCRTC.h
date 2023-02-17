#pragma once

#include "../../cat/low/catLowBasicTypes.h"

/**
 * CRTC
 */
class CatCRTC {
	u16 baseAddress;
public:
	enum RegisterNo {
		/**
		 * @brief 水平表示文字数
		 */
		Width = 1,
		/**
		 * @brief 垂直表示文字数
		 */
		Height = 6,

		/**
		 * @brief スタートアドレス上位
		 */
		StartAddressHigh = 12,
		/**
		 * @brief スタートアドレス下位
		 */
		StartAddressLow = 13,

		/**
		 * @brief レジスタ数
		 */
		MaxRegisterNo = 18
	};

private:
	/**
	 * @brief 読み書きするレジスタ番号
	 */
	u8 accessRegisterNo;

	/**
	 * @brief CRTCのレジスタ
	 */
	u8 registers[MaxRegisterNo] {};
public:
	/**
	 * @brief コンストラクタ
	 */
	CatCRTC(const u16 baseAddress);

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
	 * @brief 読み書きするレジスタ番号を設定する
	 * @param[in]	value	読み書きするレジスタ番号
	 */
	void setAccessRegisterNo(const u8 value) noexcept;

	/**
	 * @brief レジスタに値を書き込む
	 * @param[in]	value	書き込む値
	 */
	void writeRegister(const u8 value) noexcept;
	/**
	 * @brief レジスタに値を書き込む
	 * @param[in]	registerNo	書き込むレジスタの番号
	 * @param[in]	value		書き込む値
	 */
	void writeRegister(const u8 registerNo, const u8 value) noexcept;

	/**
	 * @brief レジスタから値を読み込む
	 * @param[in]	registerNo	読み込むレジスタの番号
	 * @return レジスタの値
	 */
	u8 readRegister(const u8 registerNo) const noexcept;
};
