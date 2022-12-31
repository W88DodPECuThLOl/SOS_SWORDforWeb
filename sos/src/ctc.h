#pragma once

#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"
#include "sos.h"
#include "platform.h"

/**
 * @brief Z80 CTC
 * 
 * 参考 Z80 CTC DataSheet
 * https://arcarc.xmission.com/Tech/Datasheets/Z80%20CTC.pdf
 */
class CatCTC {
public:
	struct CTC {
		static constexpr u8 CONTROL_OR_VECTOR = 1u << 0;
		static constexpr u8 RESET = 1u << 1;
		static constexpr u8 TIME_CONSTANT = 1u << 2;
		static constexpr u8 TIMER_TRIGGER = 1u << 3;
		static constexpr u8 CLK_TRG_EDGE_SELECTION = 1u << 4;
		static constexpr u8 PRESCALER_VALUE = 1u << 5; // 0:16 1:256
		static constexpr u8 MODE = 1u << 6;
		static constexpr u8 INTERRUPT = 1u << 7;

		enum class State : u8 {
			IDLE,
			EXECUTE,
		};
		State state;
		enum class WriteState : u8 {
			NORMAL,
			TIME_CONSTANT,
		};
		WriteState writeState;

		u8 channelCtrolWord;
		u16 timeControlRegister;
		s32 downCounter;
		/**
		 * @brief 割り込みが発生したときに使うベクタアドレス
		 */
		inline static u8  vector = 0;
		s32 channel;
		CTC* chain;

		CTC(s32 channel, CTC* chain = nullptr);

		/**
		 * @brief タイマモードかどうか
		 * 
		 * タイマモードの場合、カウントにはCTCに供給されているクロックが使用される。
		 * @return タイマモードかどうか
		 * @retval	true:	タイマモード
		 */
		inline bool isTimerMode() const noexcept { return (channelCtrolWord & MODE) == 0; }

		/**
		 * @brief カウンタモードかどうか
		 * 
		 * カウンタモードの場合、カウントにはCLK/TRGが使用される。
		 * @return カウンタモードかどうか
		 * @retval	true:	カウンタモード
		 */
		inline bool isCounterMode() const noexcept { return !isTimerMode(); }

		/**
		 * @brief 次のダウンカウンタの値を計算する
		 */
		inline s32 calcDownCounter() const noexcept
		{
			if(isTimerMode()) {
				return (timeControlRegister ? timeControlRegister : 256) * ((channelCtrolWord & PRESCALER_VALUE) ? 256 : 16);
			} else {
				return timeControlRegister ? timeControlRegister : 256;
			}
		}


		void writeTimeConstant(const u8 value);
		void writeNormal(const u8 value);
		void write8(u8 value);
		void hardReset();
		void adjustClock(s32& clock);
		s32 addPuls(s32 clock);
		s32 execute(s32 clock);
	};

	CTC* ctc[4] {0};

	CatCTC();
	~CatCTC();
	void write8(u8 no, u8 value);
	void adjustClock(s32& clock);
	s32 execute(s32 clock);
};
