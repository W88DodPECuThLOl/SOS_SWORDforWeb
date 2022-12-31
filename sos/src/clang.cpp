#include "cat/low/catLowBasicTypes.h"

#ifdef BUILD_WASM

// メモ)clangちゃんが、勝手にmemcpy使ってしまうので
extern "C"
void* memcpy(void* dst, const void* src, const size_t size)
{
	const u8* s = (const u8*)src;
	u8* d = (u8*)dst;
	u8* e = d + size;
	while(d != e) { *d++ = *s++; }
	return dst;
}

#endif // BUILD_WASM
