#include "catCRTC.h"

CatCRTC::CatCRTC(const u16 baseAddress)
	: baseAddress(baseAddress)
	, accessRegisterNo()
{
}

s32
CatCRTC::initialize()
{
	accessRegisterNo = 0;
	return 0;
}

void
CatCRTC::terminate()
{
}

bool
CatCRTC::checkAddress(const u16 address) noexcept
{
	return  baseAddress == address
		|| (baseAddress + 1) == address;
}

void
CatCRTC::write(const u16 address, u8 value)
{
	if(baseAddress == address) {
		setAccessRegisterNo(value);
	} else {
		writeRegister(accessRegisterNo, value);
	}
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
