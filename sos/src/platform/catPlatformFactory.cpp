#include "catPlatformFactory.h"
#include "catPlatformBase.h"
#if ENABLE_TARGET_X1
#include "X1/catPlatformX1.h"
#endif // ENABLE_TARGET_X1
#if ENABLE_TARGET_MZ700
#include "MZ700/catPlatformMZ700.h"
#endif // ENABLE_TARGET_MZ700

CatPlatformBase*
CatPlatformFactory::createPlatform(const PlatformID platformID)
{
	switch(platformID) {
		case PlatformID::None:
		default:
			return new CatPlatformNull();
#if ENABLE_TARGET_X1
		case PlatformID::WEB: // Web版
		case PlatformID::X1:
		case PlatformID::X1TURBO:
		case PlatformID::X1TURBO_SPEEDUP:
			return new CatPlatformX1();
#endif // ENABLE_TARGET_X1
#if ENABLE_TARGET_MZ700
		case PlatformID::MZ700:
		case PlatformID::MZ1500:
			return new CatPlatformMZ700();
#endif // ENABLE_TARGET_MZ700
	}
	return nullptr; // ここには来ない
}
