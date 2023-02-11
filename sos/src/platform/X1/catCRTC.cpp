#include "catCRTC.h"

CatCRTC::CatCRTC()
	: accessRegisterNo()
{
}

void
CatCRTC::terminate()
{
}

void
CatCRTC::setAccessRegisterNo(const u8 value) noexcept
{
	accessRegisterNo = value;
}

void
CatCRTC::writeRegister(const u8 value) noexcept
{
	writeRegister(accessRegisterNo, value);
}

void
CatCRTC::writeRegister(const u8 registerNo, const u8 value) noexcept
{
	if(registerNo >= MaxRegisterNo) [[unlikely]] {
		return;
	}
	registers[registerNo] = value;
}

u8
CatCRTC::readRegister(const u8 registerNo) const noexcept
{
	if(registerNo >= MaxRegisterNo) [[unlikely]] {
		return 0xFF;
	}
	return registers[registerNo];
}
