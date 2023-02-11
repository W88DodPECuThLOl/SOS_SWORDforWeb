#include "catPlatformFactory.h"
#include "catPlatformBase.h"
#include "X1/catPlatformX1.h"

CatPlatformBase*
CatPlatformFactory::createPlatform(const PlatformID platformID)
{
	switch(platformID) {
		case PlatformID::None:
		default:
			return new CatPlatformNull();
		case PlatformID::X1:
			return new CatPlatformX1();
	}
	return nullptr; // ここには来ない
}
