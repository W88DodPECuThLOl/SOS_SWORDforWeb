#include "cat/low/catLowBasicTypes.h"

#ifdef BUILD_WASM

// vtables.
extern "C" {
  const void *_ZTVN10__cxxabiv123__fundamental_type_infoE;
  const void *_ZTVN10__cxxabiv117__class_type_infoE;
  const void *_ZTVN10__cxxabiv120__si_class_type_infoE;
  const void *_ZTVN10__cxxabiv121__vmi_class_type_infoE;
  const void *_ZTVN10__cxxabiv119__pointer_type_infoE;
  const void *_ZTVN10__cxxabiv129__pointer_to_member_type_infoE;
};

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
