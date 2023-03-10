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
		None = 0xFFFF,
		/**
		 * @brief MZ-700
		 */
		MZ700 = 0x01,
		/**
		 * @brief MZ-1500
		 */
		MZ1500 = 0x02,

		/**
		 * @brief X1
		 */
		X1 = 0x20,
		/**
		 * @brief (Oh!MZ掲載版)
		 */
		X1TURBO = 0x21,
		/**
		 * @brief (高速版)
		 */
		X1TURBO_SPEEDUP = 0x22,


		/**
		 * @brief Web版
		 */
		WEB = 0x28
	};

	/**
	 * @brief 機種を作成する
	 * @param[in]	platformID	作成する機種
	 */
	static class CatPlatformBase* createPlatform(const PlatformID platformID);
};
