#include "catCtc.h"

CatCTC::CTC::CTC(s32 channel, CatCTC::CTC* chain)
	: state(State::IDLE)
	, writeState(WriteState::NORMAL)
	, channelCtrolWord(0)
	, timeControlRegister(0)
	, downCounter(0)
	, channel(channel)
	, chain(chain)
{
}

s32
CatCTC::CTC::initialize()
{
	state = State::IDLE;
	writeState = WriteState::NORMAL;
	channelCtrolWord = 0;
	timeControlRegister = 0;
	downCounter = 0;

	return 0;
}

void
CatCTC::CTC::terminate()
{
}

void
CatCTC::CTC::writeTimeConstant(const u8 value)
{
	writeState = WriteState::NORMAL;
	timeControlRegister = value;

	if(state != State::EXECUTE) {
		if((channelCtrolWord & (TIME_CONSTANT | RESET)) == (TIME_CONSTANT | RESET)) {
			downCounter = calcDownCounter();
			state = State::EXECUTE; // ダウンカウント設定されたので実行開始
		}
		if((channelCtrolWord & (MODE | TIMER_TRIGGER)) == 0) {
			// タイマモードで、かつ、AUTOMATIC TRIGGERなら、書き込まれたら実行開始
			downCounter = calcDownCounter();
			state = State::EXECUTE;
		}
	}
}

void
CatCTC::CTC::writeNormal(const u8 value)
{
	if((value & CONTROL_OR_VECTOR) == 0) {
		// 割り込みベクタ設定
		vector = value;
		return;
	}
	channelCtrolWord = value;
	if(channelCtrolWord & TIME_CONSTANT) {
		writeState = WriteState::TIME_CONSTANT;
	}
	if(channelCtrolWord & RESET) {
		state = State::IDLE;
	}
}

void
CatCTC::CTC::write8(u8 value)
{
	switch(writeState) {
		case WriteState::NORMAL:
			writeNormal(value);
			return;
		case WriteState::TIME_CONSTANT:
			writeTimeConstant(value);
			return;
	}
}
u8
CatCTC::CTC::read8()
{
	if(isCounterMode()) {
		return downCounter;
	} else {
		//return downCounter / ((channelCtrolWord & PRESCALER_VALUE) ? 256 : 16);
		const auto mult = ((channelCtrolWord & PRESCALER_VALUE) ? 256 : 16);
		return (downCounter + mult - 1) / mult; // 切り上げで取得してみる
	}
}

void
CatCTC::CTC::hardReset()
{
	state = State::IDLE;
	writeState = WriteState::NORMAL;
	channelCtrolWord = 0;
	timeControlRegister = 0;
	downCounter = 0;
	vector = 0;
}

void
CatCTC::CTC::adjustClock(s32& clock)
{
	switch(state) {
		case State::IDLE:
			return;
		case State::EXECUTE:
			if(isTimerMode()) {
				// タイマモード
				if(downCounter >= 0) {
					clock = (clock < downCounter) ? clock : downCounter;
				}
			}
			return;
	}
}

s32
CatCTC::CTC::addPuls(s32 clock)
{
	s32 iniVector = -1;
	switch(state) {
		case State::IDLE:
			if((channelCtrolWord & (MODE | TIMER_TRIGGER)) == TIMER_TRIGGER) {
				// タイマモードで、かつ、PULS STARTなら実行開始
				downCounter = calcDownCounter();
				state = State::EXECUTE;
			}
			break;
		case State::EXECUTE:
			downCounter -= clock;
			while(downCounter <= 0) {
				// 次のカウンタをセット
				downCounter += calcDownCounter();
				if(chain) {
					if(auto tmp = chain->addPuls(1); tmp >= 0 && iniVector < 0) {
						iniVector = tmp;
					}
				}
				if((iniVector < 0) && (channelCtrolWord & INTERRUPT)) {
					iniVector = vector + channel * 2; // 割り込み発生
				}
			}
			break;
	}
	return iniVector;
}

s32
CatCTC::CTC::execute(s32 clock)
{
	if(isCounterMode()) {
		// カウンタモード
		if(channel == 1 || channel == 2) {
			clock = (clock + 1) / 2; // 2MHzなので半分にする
		} else {
			// channel 0は、Vccに繋がってるので、カウントしない
			// channel 3は、channel 0のTRGが入力
			return -1;
		}
	}

	s32 iniVector = -1;
	switch(state) {
		case State::IDLE:
			break;
		case State::EXECUTE:
			downCounter -= clock;
			while(downCounter <= 0) {
				// 次のカウンタをセット
				downCounter += calcDownCounter();
				if(chain) {
					// 繋がっているのがあれば、TRGを発生させる
					if(auto tmp = chain->addPuls(1); tmp >= 0 && iniVector < 0) {
						iniVector = tmp;
					}
				}
				if((iniVector < 0) && (channelCtrolWord & INTERRUPT)) {
					iniVector = vector + channel * 2; // 割り込み発生
				}
			}
			break;
	}
	return iniVector;
}

CatCTC::CatCTC()
{
	ctc[3] = new CTC(3);
	ctc[2] = new CTC(2);
	ctc[1] = new CTC(1);
	ctc[0] = new CTC(0, ctc[3]);
}

CatCTC::~CatCTC()
{
	for(s32 i = 0; i < 4; ++i) {
		if(ctc[i]) {
			delete ctc[i];
			ctc[i] = nullptr;
		}
	}
}

s32
CatCTC::initialize()
{
	ctc[3]->initialize();
	ctc[2]->initialize();
	ctc[1]->initialize();
	ctc[0]->initialize();
	return 0;
}

void
CatCTC::terminate()
{
	ctc[3]->terminate();
	ctc[2]->terminate();
	ctc[1]->terminate();
	ctc[0]->terminate();
}

u8
CatCTC::read8(u8 no)
{
	return ctc[no]->read8();
}

void
CatCTC::write8(u8 no, u8 value)
{
	ctc[no]->write8(value);
}

void
CatCTC::adjustClock(s32& clock)
{
	for(s32 i = 0; i < 4; ++i) {
		ctc[i]->adjustClock(clock);
	}
}

s32
CatCTC::execute(s32 clock)
{
	s32 iniVector = -1;
	for(s32 i = 0; i < 4; ++i) {
		if(auto tmp = ctc[i]->execute(clock); tmp >= 0 && iniVector < 0) {
			iniVector = tmp;
		}
	}
	return iniVector;
}
