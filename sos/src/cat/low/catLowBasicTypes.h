#pragma once

#if BUILD_WASM

// WebAssembly

// 基本的な型
typedef signed   char   s8;
typedef unsigned char   u8;
typedef signed   short  s16;
typedef unsigned short  u16;
typedef signed   int    s32;
typedef unsigned int    u32;
typedef signed   long long s64;
typedef unsigned long long u64;
typedef float    f32;
typedef double   f64;
typedef char8_t  c8;
typedef char16_t c16;
typedef char32_t c32;

#if BUILD_WASM == 32
typedef unsigned long size_t; // --target = wasm32
#elif BUILD_WASM == 64
typedef unsigned long long size_t; // --target = wasm64
#else
static_assert(false) // 未対応
#endif

// インポート(JavaScriptの関数)
#define WASM_IMPORT(MODULE,NAME) __attribute__((import_module(MODULE), import_name(NAME)))
// エクスポート(watの関数)
#define WASM_EXPORT              __attribute__((visibility("default")))

// 可変長引数用のマクロ等
typedef __builtin_va_list   va_list;
#define va_start(v,l)       __builtin_va_start(v,l)
#define va_end(v)           __builtin_va_end(v)
#define va_arg(v,l)         __builtin_va_arg(v,l)
#define va_copy(dest, src)  __builtin_va_copy(dest, src)

int vsnprintf(char *buffer, size_t count, const char *format, va_list argptr);
#else

// VC++

#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <cstdarg>

// 基本的な型
typedef std::int8_t   s8;
typedef std::uint8_t  u8;
typedef std::int16_t  s16;
typedef std::uint16_t u16;
typedef std::int32_t  s32;
typedef std::uint32_t u32;
typedef std::int64_t  s64;
typedef std::uint64_t u64;
typedef float         f32;
typedef double        f64;
#if __cpp_char8_t
typedef char8_t       c8;
#else
typedef char          c8;
#endif // __cpp_char8_t
typedef char16_t      c16;
typedef char32_t      c32;

// インポート(JavaScriptの関数)
#define WASM_IMPORT(MODULE,NAME)
#define WASM_EXPORT

#endif

static_assert(sizeof(s8)  == 1);
static_assert(sizeof(u8)  == 1);
static_assert(sizeof(s16) == 2);
static_assert(sizeof(u16) == 2);
static_assert(sizeof(s32) == 4);
static_assert(sizeof(u32) == 4);
static_assert(sizeof(s64) == 8);
static_assert(sizeof(u64) == 8);
static_assert(sizeof(c8)  == 1);
static_assert(sizeof(c16) == 2);
static_assert(sizeof(c32) == 4);
static_assert(sizeof(size_t) == sizeof(void*));

#if BUILD_WASM

#define catAssert(EXPR,fmt, ...)

#else
inline void catHalt()
{
	std::exit(EXIT_FAILURE);
}

#define catAssert(EXPR,fmt, ...) \
do { \
	if(!(EXPR)) { \
		std::printf(fmt, __VA_ARGS__); \
		catHalt(); \
	} \
} while(false)

#endif

namespace cat::low {
/**
 * @brief ヌルポインタを表すポインタリテラルnullptrの型。
 */
using nullptr_t = decltype(nullptr);

/**
 * @brief 小さい方を返す
 * 
 * @param[in]	a	パラメータ
 * @param[in]	b	パラメータ
 * @return 小さい方
 */
template<typename T, typename U> decltype(T() + U()) min(T a, U b) { return a < b ? a : b; }

/**
 * @brief 大きい方を返す
 * 
 * @param[in]	a	パラメータ
 * @param[in]	b	パラメータ
 * @return 大きい方
 */
template<typename T> T max(T a, T b) { return a > b ? a : b; }
} // namespace cat::low

#include "catLowMemory.h"
//#include "catLowUniquePtr.h"
//#include "catLowSharedPtr.h"
//#include "catLowStr32.h"
//#include "catLowVector.h"
