#pragma once

#if BUILD_WASM

// WebAssembly

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

WASM_IMPORT("js", "sin")
extern "C" double sin(double);
WASM_IMPORT("js", "pow")
extern "C" double pow(double, double);
WASM_IMPORT("js", "log")
extern "C" double log(double);
WASM_IMPORT("js", "floor")
extern "C" double floor(double);
WASM_IMPORT("js", "rand")
extern "C" int rand();

#else

#define STRICT
#define WIN32_LEAN_AND_MEAN

#include "windows.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <assert.h>

#ifdef _MSC_VER
	#undef max
	#define max _MAX
	#undef min
	#define min _MIN
#endif

// インポート(JavaScriptの関数)
#define WASM_IMPORT(MODULE,NAME)
#define WASM_EXPORT

#endif
