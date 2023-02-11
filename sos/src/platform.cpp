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
initPlatform()
{
	CatPlatformFactory::PlatformID platformID = CatPlatformFactory::PlatformID::None;
#if IS_TARGET_X1_SERIES(TARGET)
	platformID = CatPlatformFactory::PlatformID::X1;
#endif // IS_TARGET_X1_SERIES(TARGET)
	delete platform;
	platform = CatPlatformFactory::createPlatform(platformID);
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
	return platform->platformOutPort(io, port, value);
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

void
adjustPlatformClock(s32& tick)
{
	// 実行するクロックを調整する
	platform->adjustTick(tick);
}

void
writePlatformPCG(u16 ch, u8* data)
{
	platform->writePCG(ch, data);
}

void
readPlatformPCG(u16 ch, u8* data)
{
	platform->readPCG(ch, data);
}
