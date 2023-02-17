﻿// ---------------------------------------------------------------------------
//	FM sound generator common timer module
//	Copyright (C) cisc 1998, 2000.
// ---------------------------------------------------------------------------
//	$fmgen-Id: fmtimer.h,v 1.2 2003/04/22 13:12:53 cisc Exp $

#pragma once

// ---------------------------------------------------------------------------

namespace FM
{
	class Timer
	{
	public:
		void	Reset();
		bool	Count(int32 us);
		int32	GetNextEvent();
	
	protected:
		virtual void SetStatus(uint bit) = 0;
		virtual void ResetStatus(uint bit) = 0;

		void	SetTimerBase(uint clock);
		void	SetTimerA(uint addr, uint data);
		void	SetTimerB(uint data);
		void	SetTimerControl(uint data);
		
		uint8	status;
		uint8	regtc;
	
	private:
		virtual void TimerA() {}
		uint8	regta[2];
		
		int32	timera, timera_count;
		int32	timerb, timerb_count;
		int32	timer_step;
	};

// ---------------------------------------------------------------------------
//	初期化
//
inline void Timer::Reset()
{
	timera_count = 0;
	timerb_count = 0;
}

} // namespace FM
