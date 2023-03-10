#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"
#include "sos.h"
#include "platform.h"
#include "platform/device/catCtc.h"
#include "platform/X1/catPCG.h"
#include "platform/catPlatformBase.h"
#include "platform/catPlatformFactory.h"

CatPlatformBase* platform = nullptr;

void
initPlatform(s32 platformID)
{
	//CatPlatformFactory::PlatformID platformID = CatPlatformFactory::PlatformID::None;
//#if IS_TARGET_X1_SERIES(TARGET)
//	platformID = CatPlatformFactory::PlatformID::X1;
//#endif // IS_TARGET_X1_SERIES(TARGET)
	delete platform;
	platform = CatPlatformFactory::createPlatform((CatPlatformFactory::PlatformID)platformID);
	platform->initialize(nullptr);
}

void*
getPlatformVRAMImage()
{
	return platform->render();
}

u8
platformInPort(u8* io, u16 port)
{
	return platform->platformInPort(io, port);
}

void
platformOutPort(u8* io, u16 port, u8 value)
{
	platform->platformOutPort(io, port, value);
}

u8
platformReadMemory(u8* mem, u16 address)
{
	return platform->platformReadMemory(mem, address);
}

void
platformWriteMemory(u8* mem, u16 address, u8 value)
{
	platform->platformWriteMemory(mem, address, value);
}


void
resetPlatformTick()
{
	platform->resetTick();
}

void
progressPlatformTick(s32 targetTick)
{
	platform->tick(targetTick);
}

bool
adjustPlatformClock(s32& tick)
{
	// 実行するクロックを調整する
	return platform->adjustTick(tick);
}

void
writePlatformPCG(u32 ch, u8* data)
{
	platform->writePCG(ch, data);
}

void
readPlatformPCG(u32 ch, u8* data)
{
	platform->readPCG(ch, data);
}
