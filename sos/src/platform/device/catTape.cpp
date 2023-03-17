#include "catTape.h"

namespace tape {

CatTape::CatTape()
	: baseTimeStamp(0)
	, motorState(0)
	, tapeImage(new CatTapeImage())
{
	tapeConfig.halfShortPeriod = 125;

	// for debug
	tapeImage->createTestImage();
}

CatTape::~CatTape()
{
	if(tapeImage) {
		delete tapeImage;
		tapeImage = nullptr;
	}
}

void
CatTape::setConfig(const CatTapeConfig& tapeConfig)
{
	this->tapeConfig = tapeConfig;
}

bool
CatTape::readBit(double position)
{
	// データ開始位置までの時間
	const double startOffset = 0.5 * 1000.0*1000.0; // 0.5秒
	if(position < startOffset) { return false; }
	position -= startOffset;

	// Xμ秒単位にする
	//
	//      Xμs   Xμs
	// ___|~~~~~~|_____              0
	// 
	//         2Xμs       2Xus
	// ___|~~~~~~~~~~~~|_________    1
	const u64 imagePosition = position / tapeConfig.halfShortPeriod;
	return tapeImage->tapeRead(imagePosition);
}

void
CatTape::writeBit(double position, const bool bit)
{
	const u64 imagePosition = position / tapeConfig.halfShortPeriod;
	return tapeImage->tapeWrite(imagePosition, bit);
}

void
CatTape::motor(const u64 timeStamp, const bool on)
{
	if(motorState == 0 && on) {
		// モータがonになった時をベースにしてみる
		baseTimeStamp = timeStamp;
	}
	motorState = on ? 1 : 0;
}

bool
CatTape::getMotorState()
{
	return motorState ? true : false;
}

double
CatTape::calcElapsedTime(const u64 elapsedClock)
{
	constexpr u64 CPU_FREQUENCY = 3579545;
	const double elapsed = elapsedClock * 1000.0 * 1000.0 / (double)CPU_FREQUENCY; // [μs]
	return elapsed;
}

void
CatTape::writeData(const u64 timeStamp, const bool bit)
{
	if(motorState != 0) {
		// 経過時間を計算して、その位置へ書き込む
		const double elapsedTime = calcElapsedTime(timeStamp - baseTimeStamp);
		writeBit(elapsedTime, bit);
	}
}

bool
CatTape::readData(const u64 timeStamp)
{
	if(motorState != 0) {
		// 経過時間を計算して、その位置から取得する
		const double elapsedTime = calcElapsedTime(timeStamp - baseTimeStamp);
		return readBit(elapsedTime);
	}
	return false;
}

void
CatTape::seek()
{
}

} // namespace tape
