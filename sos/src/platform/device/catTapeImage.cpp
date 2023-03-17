#include "catTape.h"

namespace tape {

namespace {

inline u32
fromBDC(u32 ch)
{
	if('0' <= ch && ch <= '9') {
		return ch - '0';
	} else if('a' <= ch && ch <= 'f') {
		return ch - 'a';
	} else if('A' <= ch && ch <= 'F') {
		return ch - 'A';
	} else {
		return 0;
	}
}

/**
 * @brief ヘッダ付きのMZFファイルかどうか
 */
inline bool
isMZFHeader(const u8* data)
{
	// ヘッダ付きのMZFファイル
	// https://web.archive.org/web/20190328121927/http://www.geocities.co.jp/SiliconValley-Sunnyvale/2521/mztapeall.html#mzt
	/*
	 * MZ シリーズエミュレータ用テープイメージファイル「MZF」のファイル形式についての情報です。
	 * ・シグネチャ
	 * 0000h ～ 0003h 6Dh 7Ah 32h 30h "mz20"
	 * 0004h 00h
	 * 0005h 02h
	 * 0006h 00h
	 * 0007h 00h
	 */
	return data[0] == 0x6D && data[1] == 0x7A && data[2] == 0x32 && data[3] == 0x30 // mz20
		&& data[4] == 0x00 && data[5] == 0x02 && data[6] == 0x00 && data[7] == 0x00;
}

} // namespace

void
CatTapeImage::writeImage(bool bit)
{
	if(bit) {
		tapeImage[index >> 3] |= 0x80 >> (index & 7);
	} else {
		tapeImage[index >> 3] &= ~(0x80 >> (index & 7));
	}
	index++;
	tapeImageSize = (index + 7) >> 3;
}

void
CatTapeImage::writeShort()
{
	writeImage(true);
	writeImage(false);
}

void
CatTapeImage::writeLong()
{
	writeImage(true);
	writeImage(true);
	writeImage(false);
	writeImage(false);
}

void
CatTapeImage::writeSpace(int size)
{
	for(int i = 0; i < size; i++) {
		writeImage(false);
	}
}

void
CatTapeImage::writeByte(u8 value)
{
	// スタートビット
	writeLong();
	// データ8ビット MSBから
	for(int i = 0; i < 8; i++) {
		if(value & 0x80) {
			writeLong();
		} else {
			writeShort();
		}
		value <<= 1;
	}
}

void
CatTapeImage::writeGAP(const u32 size1, const u32 size2, const u32 size3, const bool negative)
{
	if(negative) {
		// X1
		for(u32 i = 0; i < size1; i++) { writeLong(); }
		for(u32 i = 0; i < size2; i++) { writeShort(); }
		for(u32 i = 0; i < size3; i++) { writeLong(); }
	} else {
		// MZ
		for(u32 i = 0; i < size1; i++) { writeShort(); }
		for(u32 i = 0; i < size2; i++) { writeLong(); }
		for(u32 i = 0; i < size3; i++) { writeShort(); }
	}
	writeLong();
}

void
CatTapeImage::writeLongGAPMZFormat()
{
	writeGAP(0x55F0, 0x28, 0x28, false);
}

void
CatTapeImage::writeShortGAPMZFormat()
{
	writeGAP(0x2AF8, 0x14, 0x14, false);
}

void
CatTapeImage::writeLongGAPX1Format()
{
	writeGAP(1000, 0x28, 0x28, true);
}

void
CatTapeImage::writeShortGAPX1Format()
{
	writeGAP(3000, 0x14, 0x14, true);
}

void
CatTapeImage::writeData(const u8* data, const u32 dataSize, const bool duplicate)
{
	for(u32 j = 0; j < (duplicate ? 2 : 1); j++) {
		// データ書き込み
		u16 sum = 0;
		for(u32 i = 0; i < dataSize; i++) {
			writeByte(data[i]);
			for(u32 k = 0; k < 8; k++) {
				if(data[i] & (1 << k)) {
					sum++;
				}
			}
		}
		// checkSum
		writeByte(sum >> 8); // 上位８ビットが先
		writeByte(sum);
		// ストップビット
		writeLong();

		// MZフォーマット
		// ・１回目の後に0を256回書き込む
		if(duplicate && (j == 0)) {
			for(u32 i = 0; i < 256; i++) {
				writeShort();
			}
		}
	}
}

void
CatTapeImage::createImageMZFormat(const u8* ib, const u8* data, const size_t fileSize)
{
	for(s32 i = 0; i < 128; i++) {
		this->ib[i] = ib[i]; 
	}

	index = 0;

	// IB
	writeLongGAPMZFormat();
	writeData(ib, 128, true);

	// データ
	writeShortGAPMZFormat();
	writeData(data, fileSize, true);
}

void
CatTapeImage::createImageX1Format(const u8* ib, const u8* data, const size_t fileSize)
{
	for(s32 i = 0; i < 128; i++) {
		this->ib[i] = ib[i]; 
	}

	index = 0;

	// IB
	writeLongGAPX1Format();
	writeData(ib, 32, false);

	// データ
	writeShortGAPX1Format();
	writeData(data, fileSize, false);
}

bool
CatTapeImage::createImageFromMZT(const void* imageData, const size_t imageSize)
{
	const u8* src = (const u8*)imageData;
	size_t offset = 0;

	while(offset + 0x80 < imageSize) {
		bool checkSum = false;
		if(isMZFHeader(src)) [[unlikely]] {
			// ヘッダ付きのMZFファイル
			offset += 8; // ヘッダ部分を飛ばす
			checkSum = true; // チェックサム付き
		}

		const u8* ib   = src + offset;
		const u8* data = src + offset + (checkSum ? 0x82 : 0x80); // ヘッダ部分に２バイトチェックサムがついてるので +0x82
		const u16 fileSize = (u16)ib[0x12] | (u16)ib[0x13] << 8;
		offset += fileSize + (checkSum ? 0x84 : 0x80); // 終わりにも２バイトチェックサムがついてるので +0x84
		if(offset <= imageSize) {
			createImageMZFormat(ib, data, fileSize);
		} else {
			return false; // ファイルサイズが足りない
		}
	}
	return true;
}

bool
CatTapeImage::createImageFromSOS(const void* imageData, const size_t imageSize)
{
	const u8* src = (const u8*)imageData;

	if(imageSize < 18 || src[0] != 0x5F || src[1] != 0x53 || src[2] != 0x4F || src[3] != 0x53 || src[4] != 0x20 || src[7] != 0x20 || src[12] != 0x20 || src[17] != 0x0A) {
		return false;
	}

	const u8 attribute    = (fromBDC(src[5]) <<  4) | fromBDC(src[6]);
	const u16 loadAddress = (fromBDC(src[8]) << 12) | (fromBDC(src[9]) << 8) | (fromBDC(src[10]) << 4) | fromBDC(src[11]);
	const u16 execAddress = (fromBDC(src[13]) << 12) | (fromBDC(src[14]) << 8) | (fromBDC(src[15]) << 4) | fromBDC(src[16]);
	const u16 filesize    = imageSize - 0x18;
	for(s32 i = 0; i < 128; i++) { this->ib[i] = 0; }
	ib[0x00] = attribute;
	ib[0x12] = filesize;
	ib[0x13] = filesize >> 8;
	ib[0x14] = loadAddress;
	ib[0x15] = loadAddress >> 8;
	ib[0x16] = execAddress;
	ib[0x17] = execAddress >> 8;
	createImageMZFormat(ib, src + 18, filesize);

	return true;
}

void
CatTapeImage::createTestImage()
{
/*
・ヘッダ (128 バイト + チェックサム 2 バイト)
0008h モード (01h バイナリ, 05h S-BASIC, C8h CMU-800 データファイル)
0009h ～ 0019h ファイル名 (0Dh で終わり / 0011h = 0Dh?)
001Ah ～ 001Bh ファイルサイズ
001Ch ～ 001Dh 読み込むアドレス
001Eh ～ 001Fh 実行するアドレス
0020h ～ 0087h 予約
0088h ～ 0089h ヘッダのチェックサム (0008h ～ 0087h)
*/
	ib[0] = 0x01;

	ib[1] = 'A';
	ib[2] = 'B';
	ib[3] = 0x0D;
	ib[4] = 0x20;
	ib[5] = 0x20;
	ib[6] = 0x20;
	ib[7] = 0x20;
	ib[8] = 0x02;
	ib[9] = 0x20;
	ib[10] = 0x20;
	ib[11] = 0x20;
	ib[12] = 0x20;
	ib[13] = 0x20;
	ib[14] = 0x20;
	ib[15] = 0x20;
	ib[16] = 0x20;
	ib[17] = 0x20;
	// file size
	ib[18] = 0x04;
	ib[19] = 0x00;
	// load address
	ib[20] = 0x00;
	ib[21] = 0x12;
	// exec address
	ib[22] = 0x00;
	ib[23] = 0x00;



	index = 0;

	writeLongGAPMZFormat();
	// IB
	writeData(ib, 128, true);

	// データ
	writeShortGAPMZFormat();
	u8 data[4] = {0x22, 0x33, 0x55, 0x77};
	writeData(data, 4, true);

	writeSpace(0x80); // test
}

bool
CatTapeImage::tapeRead(const u64 position)
{
	u64 offset = position >> 3;
	u8  bitNo  = position & 7;

	if(offset < tapeImageSize) {
		return (tapeImage[offset] & (0x80 >> bitNo)) != 0;
	} else {
		return false;
	}
}

void
CatTapeImage::tapeWrite(const u64 position, const bool bit)
{
	u64 offset = position >> 3;
	u8  bitNo  = position & 7;

	// @todo
}


} // namespace tape
