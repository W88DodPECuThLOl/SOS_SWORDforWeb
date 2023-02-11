#pragma once

#include "../cat/low/catLowBasicTypes.h"

/**
 * @brief 機種作成
 */
class CatPlatformFactory {
public:
	/**
	 * @brief 機種の識別子
	 */
	enum class PlatformID : s32 {
		None = 0,
		X1,
	};

	/**
	 * @brief 機種を作成する
	 * @param[in]	platformID	作成する機種
	 */
	static class CatPlatformBase* createPlatform(const PlatformID platformID);
};
