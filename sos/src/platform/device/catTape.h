#pragma once

#include "../../cat/low/catLowBasicTypes.h"

namespace tape {

class CatTapeImage {
	u8 ib[128];
	u8 tapeImage[(0x55F0*2+0x28*2+0x28*4 + 4) / 8 + 128*4/8 + 1024*64];

	u64 index = 0;
	u32 tapeImageSize = 0;

	/**
	 * @brief テープイメージへ書き込む
	 * @param[in]	bit	ON/OFF状態
	 */
	void writeImage(bool bit);
	/**
	 * @brief 空白の書き込み
	 * @param[in]	size	空白の数
	 */
	void writeSpace(int size);
	/**
	 * @brief 「0」の書き込み
	 * 
	 * 短いパルスを書き込む。ON x 1 -> OFF x 1
	 *
	 *      Xμs   Xμs
	 * ___|~~~~~~|_____              0
	 * 
	 *         2Xμs       2Xμs
	 * ___|~~~~~~~~~~~~|_________    1
	 */
	void writeShort();
	/**
	 * @brief 「1」の書き込み
	 * 
	 * 長いパルスを書き込む。ON x 2 -> OFF x 2
	 * 
	 *      Xμs   Xμs
	 * ___|~~~~~~|_____              0
	 * 
	 *         2Xμs       2Xμs
	 * ___|~~~~~~~~~~~~|_________    1
	 */
	void writeLong();
	/**
	 * @brief １バイトの書き込み
	 * @param[in]	value	書き込む値
	 * 
	 * 初めに長いパルスを書き込む。
	 * 続いてMSB側からビットを取得し、ビットが立っていたらLongパルス、そうでなければShortパルスを8回書き込む。
	 */
	void writeByte(u8 value);

	void writeGAP(const u32 size1, const u32 size2, const u32 size3, const bool negative);
	void writeLongGAPMZFormat();
	void writeShortGAPMZFormat();
	void writeLongGAPX1Format();
	void writeShortGAPX1Format();
	void writeData(const u8* data, const u32 dataSize, const bool duplicate);

	void createImageMZFormat(const u8* ib, const u8* data, const size_t fileSize);
	void createImageX1Format(const u8* ib, const u8* data, const size_t fileSize);

	bool createImageFromMZT(const void* imageData, const size_t imageSize);
	bool createImageFromSOS(const void* imageData, const size_t imageSize);
public:
	void createTestImage();

	/**
	 * @brief テープから読み込む
	 * 
	 * 読み込み位置は、テープイメージ開始からのビット位置。
	 * 
	 * @param[in]	position	読み込み位置(ビット単位)
	 * @return 読み込んだ値
	 */
	bool tapeRead(const u64 position);

	/**
	 * @brief テープへ書き込む
	 * 
	 * 書き込む位置は、テープイメージ開始からのビット位置。
	 * 
	 * @param[in]	position	書き込み位置(ビット単位)
	 */
	void tapeWrite(const u64 position, const bool bit);
};

struct CatTapeConfig {
	/**
	 * @brief 短いパルスの周期の半分の時間(μ秒)
	 *
	 *      Xμs   Xμs
	 * ___|~~~~~~|_____              0
	 * 
	 *         2Xμs       2Xus
	 * ___|~~~~~~~~~~~~|_________    1
	 */
	double halfShortPeriod;
};

/**
 * @brief テープデバイス
 */
class CatTape {
	u64 baseTimeStamp;
	/**
	 * @brief モーターの状態
	 */
	u8 motorState;

	CatTapeImage* tapeImage;
	CatTapeConfig tapeConfig;

	double calcElapsedTime(const u64 elapsedClock);

	/**
	 * @brief 読み込み
	 * @param[in]	elapsedTime	経過時間(μ秒)
	 */
	bool readBit(double elapsedTime);
	/**
	 * @brief 書き込み
	 * @param[in]	elapsedTime	経過時間(μ秒)
	 * @param[in]	bit			書き込む値
	 */
	void writeBit(double elapsedTime, const bool bit);
public:
	CatTape();
	~CatTape();

	void setConfig(const CatTapeConfig& tapeConfig);

	void motor(const u64 timeStamp, const bool on);
	bool getMotorState();
	void writeData(const u64 timeStamp, const bool bit);
	bool readData(const u64 timeStamp);

	void seek();
};

} // namespace tape
