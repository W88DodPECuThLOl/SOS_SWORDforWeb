#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"

#define TARGET (0x20)

// X1  
#define TARGET_X1 (0x20)
// X1turbo (Oh!MZ掲載版)  
#define TARGET_X1_TURBO (0x21)
// X1turbo (高速版)  
#define TARGET_X1_TURBO_HIGH_SPEED (0x22)

#ifndef BUILD_WASM
#include <string.h>
#endif

WASM_EXPORT
extern "C" void z80Reset();
WASM_EXPORT
extern "C" int exeute(int clock);
WASM_EXPORT
extern "C" int getStatus();
WASM_EXPORT
extern "C" void initialize(void* heapBase, size_t heapSize);
WASM_EXPORT
void setupHeap(void* heapBase, size_t heapSize);
WASM_EXPORT
extern "C" void* getRAM();
WASM_EXPORT
extern "C" void* getIO();
WASM_EXPORT
extern "C" void* getZ80Regs();
WASM_EXPORT
extern "C" s32 getZ80RegsSize();

WASM_EXPORT
extern "C" bool isVRAMDirty();
WASM_EXPORT
extern "C" void* getVRAMImage();

#ifndef BUILD_WASM
void debugMessage(void* arg, const char* msg)
{
	printf("%s\n", msg);
}
#endif

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

#ifndef BUILD_WASM
#define SOS_ARGS Z80::Register* z80Regs, int z80RegsSize, u8* ram, u8* io
#else
#define SOS_ARGS
#endif
#define SOS_FUNC(NAME) WASM_IMPORT("sos", #NAME) extern "C" int sos_##NAME(SOS_ARGS);
	SOS_FUNC(cold )
	SOS_FUNC(hot  )
	SOS_FUNC(ver  )
	SOS_FUNC(print)
	SOS_FUNC(prnts)
	SOS_FUNC(ltnl )
	SOS_FUNC(nl   )
	SOS_FUNC(msg  )
	SOS_FUNC(msx  )
	SOS_FUNC(mprnt)
	SOS_FUNC(tab  )
	SOS_FUNC(lprnt)
	SOS_FUNC(lpton)
	SOS_FUNC(lptof)
	SOS_FUNC(getl )
	SOS_FUNC(getky)
	SOS_FUNC(brkey)
	SOS_FUNC(inkey)
	SOS_FUNC(pause)
	SOS_FUNC(bell )
	SOS_FUNC(prthx)
	SOS_FUNC(prthl)
	SOS_FUNC(asc  )
	SOS_FUNC(hex  )
	SOS_FUNC(_2hex)
	SOS_FUNC(hlhex)
	SOS_FUNC(wopen)
	SOS_FUNC(wrd  )
	SOS_FUNC(fcb  )
	SOS_FUNC(rdd  )
	SOS_FUNC(file )
	SOS_FUNC(fsame)
	SOS_FUNC(fprnt)
	SOS_FUNC(poke )
	SOS_FUNC(poke_)
	SOS_FUNC(peek )
	SOS_FUNC(peek_)
	SOS_FUNC(mon  )
	SOS_FUNC(_hl_ )
	SOS_FUNC(getpc)
	SOS_FUNC(drdsb)
	SOS_FUNC(dwtsb)
	SOS_FUNC(dir  )
	SOS_FUNC(ropen)
	SOS_FUNC(set  )
	SOS_FUNC(reset)
	SOS_FUNC(name )
	SOS_FUNC(kill )
	SOS_FUNC(csr  )
	SOS_FUNC(scrn )
	SOS_FUNC(loc  )
	SOS_FUNC(flget)
	SOS_FUNC(rdvsw)
	SOS_FUNC(sdvsw)
	SOS_FUNC(inp  )
	SOS_FUNC(out  )
	SOS_FUNC(widch)
	SOS_FUNC(error)
#undef SOS_FUNC

static constexpr u16 ADDRESS_XYADR     = 0x0010; // ～0x0011
static constexpr u16 ADDRESS_JUMPTABLE = 0x0100; // ～ 0x01FF
static constexpr u16 ADDRESS_KBFAD     = 0x0200; // ～ 0x02FF
static constexpr u16 ADDRESS_FATBF     = 0x0300; // ～ 0x03FF
static constexpr u16 ADDRESS_DTBUF     = 0x0400; // ～ 0x04FF
static constexpr u16 ADDRESS_IBFAD     = 0x0500; // ～ 0x05FF
static constexpr u16 ADDRESS_STKAD     = 0x0700; // 0x0600 ～ 0x06FF

static constexpr u16 ADDRESS_MEMAX     = 0xFFFF;

enum WorkAddress : u16 {
	USR = 0x1F7E,
	DVSW = 0x1F7D,
	LPSW = 0x1F7C,
	PRCNT = 0x1F7A,
	XYADR = 0x1F78,
	KBFAD = 0x1F76,

	IBFAD = 0x1F74,
	SIZE  = 0x1F72,
	DTADR = 0x1F70,
	EXADR = 0x1F6E,
	STKAD = 0x1F6C,
	MEMAX = 0x1F6A,
	WKSIZ = 0x1F68,
	DIRNO = 0x1F67,
	MXTRK = 0x1F66,
	DTBUF = 0x1F64,
	FATBF = 0x1F62,
	DIRPS = 0x1F60,
	FATPOS = 0x1F5E,
	DSK    = 0x1F5D,
	WIDTH  = 0x1F5C,
	MAXLIN = 0x1F5B,
};

#if TARGET == TARGET_X1 || TARGET == TARGET_X1_TURBO || TARGET == TARGET_X1_TURBO_HIGH_SPEED
u8 paletteR[8];
u8 paletteG[8];
u8 paletteB[8];
#endif // TARGET == TARGET_X1 || TARGET == TARGET_X1_TURBO || TARGET == TARGET_X1_TURBO_HIGH_SPEED

class SOS_Context {
	static unsigned char readByte(void* arg, unsigned short addr) { return ((SOS_Context*)arg)->RAM[addr]; }
	static void writeByte(void* arg, unsigned short addr, unsigned char value) { ((SOS_Context*)arg)->RAM[addr] = value; }
	static unsigned char inPort(void* arg, unsigned short port) { return ((SOS_Context*)arg)->IO[port]; }
	static void outPort(void* arg, unsigned short port, unsigned char value) {
#if TARGET == TARGET_X1 || TARGET == TARGET_X1_TURBO || TARGET == TARGET_X1_TURBO_HIGH_SPEED
		// VRAM
		if(0x4000 <= port) [[likely]]{
			((SOS_Context*)arg)->setVRAMDirty();
		} else if((port & 0xFF00) == 0x1000) {
			// PALETTE B
			port = 0x1000;
			if(((SOS_Context*)arg)->IO[port] != value) {
				((SOS_Context*)arg)->setVRAMDirty();
				auto tmp = value;
				for(s32 i = 0; i < 8; ++i) { paletteB[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
			}
		} else if((port & 0xFF00) == 0x1100) {
			// PALETTE R
			port = 0x1100;
			if(((SOS_Context*)arg)->IO[port] != value) {
				((SOS_Context*)arg)->setVRAMDirty();
				auto tmp = value;
				for(s32 i = 0; i < 8; ++i) { paletteR[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
			}
		} else if((port & 0xFF00) == 0x1200) {
			// PALETTE G
			port = 0x1200;
			if(((SOS_Context*)arg)->IO[port] != value) {
				((SOS_Context*)arg)->setVRAMDirty();
				auto tmp = value;
				for(s32 i = 0; i < 8; ++i) { paletteG[i] = (tmp & 0x1) ? 0xFF : 0x00; tmp >>= 1; }
			}
		}
#endif // TARGET == TARGET_X1 || TARGET == TARGET_X1_TURBO || TARGET == TARGET_X1_TURBO_HIGH_SPEED
		((SOS_Context*)arg)->IO[port] = value;
	}

	inline void WRITE_JP(u8*& dst, const u16 address) { *dst++ = 0xC3; *dst++ = address & 0xFF; *dst++ = (address >> 8) & 0xFF; }
	inline void WRITE_CALL(u8*& dst, const u16 address) { *dst++ = 0xCD; *dst++ = address & 0xFF; *dst++ = (address >> 8) & 0xFF; }
	inline void WRITE_RET(u8*& dst) { *dst++ = 0xC9; }

	/**
	 * @brief Z80エミュレータ
	 */
	Z80 z80;
	/**
	 * @brief RAM
	 */
	u8 RAM[0x10000]; // 64KiB memory
	/**
	 * @brief IO
	 */
	u8 IO[0x10000]; // 64KiB port

	/**
	 * @brief 状態
	 */
	s32 status;

	/**
	 * @brief VRAMが変更されたかどうかのフラグ
	 */
	bool bVRAMDirty;

	/**
	 * @brief S-OSのサブルーチンアドレス
	 */
	enum SubroutineAddress : u16 {
		COLD    = 0x1FFD,
		HOT     = 0x1FFA,
		VER     = 0x1FF7,
		PRINT   = 0x1FF4,
		PRNTS   = 0x1FF1,
		LTNL    = 0x1FEE,
		NL      = 0x1FEB,
		MSG     = 0x1FE8,
		MSX     = 0x1FE5,
		MPRNT	= 0x1FE2,
		TAB	    = 0x1FDF,
		LPRNT	= 0x1FDC,
		LPTON	= 0x1FD9,
		LPTOF	= 0x1FD6,
		GETL	= 0x1FD3,
		GETKY	= 0x1FD0,
		BRKEY	= 0x1FCD,
		INKEY	= 0x1FCA,
		PAUSE	= 0x1FC7,
		BELL	= 0x1FC4,
		PRTHX	= 0x1FC1,
		PRTHL	= 0x1FBE,
		ASC	    = 0x1FBB,
		HEX	    = 0x1FB8,
		_2HEX	= 0x1FB5, // 2HEX
		HLHEX	= 0x1FB2,
		WOPEN	= 0x1FAF,
		WRD	    = 0x1FAC,
		FCB	    = 0x1FA9,
		RDD     = 0x1FA6,
		FILE	= 0x1FA3,
		FSAME	= 0x1FA0,
		FPRNT	= 0x1F9D,
		POKE	= 0x1F9A,
		POKE_	= 0x1F97, // POKE@
		PEEK	= 0x1F94,
		PEEK_	= 0x1F91, // PEEK@
		MON     = 0x1F8E,
		_HL_    = 0x1F81, // [HL]
		GETPC	= 0x1F80,
		DRDSB	= 0x2000,
		DWTSB	= 0x2003,
		DIR     = 0x2006,
		ROPEN	= 0x2009,
		SET     = 0x200C,
		RESET	= 0x200F,
		NAME	= 0x2012,
		KILL	= 0x2015,
		CSR     = 0x2018,
		SCRN	= 0x201B,
		LOC     = 0x201E,
		FLGET	= 0x2021,
		RDVSW	= 0x2024,
		SDVSW	= 0x2027,
		INP     = 0x202A,
		OUT     = 0x202D,
		WIDCH	= 0x2030,
		ERROR	= 0x2033,
	};

	/**
	 * @brief 初期化
	 */
	void init()
	{
		using JavaScriptFunction = void (*)(void*);
		struct SubroutineTable {
			u16 address;
			JavaScriptFunction function;
		};
		SubroutineTable subroutineTable[] = {
			{ COLD,  cold },
			{ HOT,   hot  },
			{ VER,   ver  },
			{ PRINT, print },
			{ PRNTS, prnts },
			{ LTNL,  ltnl },
			{ NL,    nl   },
			{ MSG,   msg  },
			{ MSX,   msx  },
			{ MPRNT, mprnt},
			{ TAB,	 tab  },
			{ LPRNT, lprnt},
			{ LPTON, lpton},
			{ LPTOF, lptof},
			{ GETL,	 getl },
			{ GETKY, getky},
			{ BRKEY, brkey},
			{ INKEY, inkey},
			{ PAUSE, pause},
			{ BELL,  bell },
			{ PRTHX, prthx},
			{ PRTHL, prthl},
			{ ASC,	 asc  },
			{ HEX,	 hex  },
			{ _2HEX, _2hex}, // 2HEX
			{ HLHEX, hlhex},
			{ WOPEN, wopen},
			{ WRD,	 wrd  },
			{ FCB,	 fcb  },
			{ RDD,   rdd  },
			{ FILE,	 file },
			{ FSAME, fsame},
			{ FPRNT, fprnt},
			{ POKE,	 poke },
			{ POKE_, poke_}, // POKE@
			{ PEEK,	 peek },
			{ PEEK_, peek_}, // PEEK@
			{ MON,   mon  },
			{ _HL_,  _hl_ }, // [HL]
			{ GETPC, getpc},
			{ DRDSB, drdsb},
			{ DWTSB, dwtsb},
			{ DIR,   dir  },
			{ ROPEN, ropen},
			{ SET,   set  },
			{ RESET, reset},
			{ NAME,	 name },
			{ KILL,	 kill },
			{ CSR,   csr  },
			{ SCRN,	 scrn },
			{ LOC,   loc  },
			{ FLGET, flget},
			{ RDVSW, rdvsw},
			{ SDVSW, sdvsw},
			{ INP,   inp  },
			{ OUT,   out  },
			{ WIDCH, widch},
			{ ERROR, error},
		};
		u8* dst = &RAM[0];
		WRITE_JP(dst, SubroutineAddress::COLD); // COLDにジャンプ
		WRITE_CALL(dst, SubroutineAddress::HOT); // USRを呼び出す
		WRITE_CALL(dst, SubroutineAddress::HOT); // Jコマンドの飛び先を呼び出す
		WRITE_JP(dst, 0x3);
		// JavaScriptの呼び出しを設定
		// ・breakポイントで呼び出している
		u16 index = ADDRESS_JUMPTABLE;
		dst = &RAM[index];
		for(const auto& it : subroutineTable) {
			z80.addBreakPointFP(dst - RAM, it.function);
			WRITE_RET(dst);
		}
		// S-OSのサブルーチン部分
		for(const auto& it : subroutineTable) {
			u8* dst = &RAM[it.address];
			WRITE_JP(dst, index++);	// JavaScript呼び出し部分へ
		}
	}
#ifndef BUILD_WASM
#define SOS_HOOK(NAME) static void NAME(void* ctx_) { SOS_Context* ctx = (SOS_Context*)ctx_; ctx->setResult(sos_##NAME(&ctx->z80.reg, sizeof(z80.reg), &ctx->RAM[0], &ctx->IO[0])); }
#else
#define SOS_HOOK(NAME) static void NAME(void* ctx_) { SOS_Context* ctx = (SOS_Context*)ctx_; ctx->setResult(sos_##NAME()); }
#endif
	SOS_HOOK(cold )
	SOS_HOOK(hot  )
	SOS_HOOK(ver  )
	SOS_HOOK(print)
	SOS_HOOK(prnts)
	SOS_HOOK(ltnl )
	SOS_HOOK(nl   )
	SOS_HOOK(msg  )
	SOS_HOOK(msx  )
	SOS_HOOK(mprnt)
	SOS_HOOK(tab  )
	SOS_HOOK(lprnt)
	SOS_HOOK(lpton)
	SOS_HOOK(lptof)
	SOS_HOOK(getl )
	SOS_HOOK(getky)
	SOS_HOOK(brkey)
	SOS_HOOK(inkey)
	SOS_HOOK(pause)
	SOS_HOOK(bell )
	SOS_HOOK(prthx)
	SOS_HOOK(prthl)
	SOS_HOOK(asc  )
	SOS_HOOK(hex  )
	SOS_HOOK(_2hex)
	SOS_HOOK(hlhex)
	SOS_HOOK(wopen)
	SOS_HOOK(wrd  )
	SOS_HOOK(fcb  )
	SOS_HOOK(rdd  )
	SOS_HOOK(file )
	SOS_HOOK(fsame)
	SOS_HOOK(fprnt)
	SOS_HOOK(poke )
	SOS_HOOK(poke_)
	SOS_HOOK(peek )
	SOS_HOOK(peek_)
	SOS_HOOK(mon  )
	SOS_HOOK(_hl_ )
	SOS_HOOK(getpc)
	SOS_HOOK(drdsb)
	SOS_HOOK(dwtsb)
	SOS_HOOK(dir  )
	SOS_HOOK(ropen)
	SOS_HOOK(set  )
	SOS_HOOK(reset)
	SOS_HOOK(name )
	SOS_HOOK(kill )
	SOS_HOOK(csr  )
	SOS_HOOK(scrn )
	SOS_HOOK(loc  )
	SOS_HOOK(flget)
	SOS_HOOK(rdvsw)
	SOS_HOOK(sdvsw)
	SOS_HOOK(inp  )
	SOS_HOOK(out  )
	SOS_HOOK(widch)
	SOS_HOOK(error)
#undef SOS_HOOK

	void setResult(s32 resultCode)
	{
		status = resultCode;
		if(resultCode == 0) [[likely]] {
			return;
		}
		z80.requestBreak();
	}

	inline void WRITE_U16(u16 addr, u16 value) {
		RAM[addr    ] = value & 0xFF;
		RAM[addr + 1] = value >> 8;
	}
	inline void WRITE_U8(u16 addr, u8 value) {
		RAM[addr    ] = value;
	}

	void initWork()
	{
		WRITE_U16( WorkAddress::USR,    SubroutineAddress::HOT );
		WRITE_U8(  WorkAddress::DVSW,   0 );
		WRITE_U8(  WorkAddress::LPSW,   0 );
		WRITE_U16( WorkAddress::PRCNT,  0 );
		WRITE_U16( WorkAddress::XYADR,  ADDRESS_XYADR );
		WRITE_U16( WorkAddress::KBFAD,  ADDRESS_KBFAD );
		WRITE_U16( WorkAddress::IBFAD,  ADDRESS_IBFAD );
		WRITE_U16( WorkAddress::SIZE,   0 );
		WRITE_U16( WorkAddress::DTADR,  0 );
		WRITE_U16( WorkAddress::EXADR,  0 );
		WRITE_U16( WorkAddress::STKAD,  ADDRESS_STKAD );
		WRITE_U16( WorkAddress::MEMAX,  ADDRESS_MEMAX );
		WRITE_U16( WorkAddress::WKSIZ,  0xFFFF );
		WRITE_U8(  WorkAddress::DIRNO,  0 );
		WRITE_U8(  WorkAddress::MXTRK,  0x50 );
		WRITE_U16( WorkAddress::DTBUF,  ADDRESS_DTBUF );
		WRITE_U16( WorkAddress::FATBF,  ADDRESS_FATBF );
		WRITE_U16( WorkAddress::DIRPS,  0x0010 );
		WRITE_U16( WorkAddress::FATPOS, 0x000E );
		WRITE_U8(  WorkAddress::DSK,    0x41 );
		WRITE_U8(  WorkAddress::WIDTH,  80 );
		WRITE_U8(  WorkAddress::MAXLIN, 25 );
	}
public:
	/**
	 * @brief コンストラクタ
	 */
	SOS_Context()
		: z80(SOS_Context::readByte, SOS_Context::writeByte, SOS_Context::inPort, SOS_Context::outPort, (void*)this, true)
		, status(0)
	{
		init();
		initWork();
		setVRAMDirty();
	}

	/**
	 * @brief リセットする
	 */
	void reset()
	{
		z80.initialize();
		setVRAMDirty();
	}

	/**
	 * @brief 実行する
	 * @param[in]	clock	進めるクロック数
	 * @return 実際に進んだクロック数
	 */
	int execute(int clock) {
#ifndef BUILD_WASM
		z80.setDebugMessageFP(debugMessage);
#endif
		return z80.execute(clock);
	}

	u8* getRAM() noexcept { return &RAM[0]; }
	u8* getIO() noexcept { return &IO[0]; }
	u8* getZ80Regs() noexcept { return (u8*)&z80.reg; }
	s32 getZ80RegsSize() noexcept { return (s32)sizeof(z80.reg); }

	int getStatus() const noexcept { return status; }
	bool isVRAMDirty() const noexcept {return bVRAMDirty; }
	void setVRAMDirty() noexcept { bVRAMDirty = true; }
	void resetVRAMDirty() noexcept { bVRAMDirty = false; }
};

/**
 * @brief 実態
 */
SOS_Context* ctx = nullptr;

/**
 * @brief VRAMのイメージ
 */
u8* imageMemory = nullptr;

void
initialize(void* heapBase, size_t heapSize)
{
#ifdef BUILD_WASM
	setupHeap(heapBase, heapSize);
#endif
	delete[] imageMemory;
	delete ctx;
	ctx = new SOS_Context();
	// VRAMのイメージ化に使用するメモリ
	imageMemory = new u8[640*200*4];
}

/**
 * @brief リセットする
 */
void
z80Reset()
{
	delete ctx;
	ctx = new SOS_Context();
	return ctx->reset();

#if TARGET == TARGET_X1 || TARGET == TARGET_X1_TURBO || TARGET == TARGET_X1_TURBO_HIGH_SPEED
	// パレット
	for(s32 i = 0; i < 8; i++) {
		paletteB[i] = (i & 0x1) ? 0xFF : 0x00;
		paletteR[i] = (i & 0x2) ? 0xFF : 0x00;
		paletteG[i] = (i & 0x4) ? 0xFF : 0x00;
	}
#endif
}

/**
 * @brief 実行する
 */
int
exeute(int clock)
{
	return ctx->execute(clock);
}

int
getStatus()
{
	return ctx->getStatus();
}

void* getRAM()
{
	return ctx->getRAM();
}

void* getIO()
{
	return ctx->getIO();
}

void* getZ80Regs()
{
	return ctx->getZ80Regs();
}
s32 getZ80RegsSize()
{
	return ctx->getZ80RegsSize();
}

bool isVRAMDirty()
{
	return ctx->isVRAMDirty();
}

void* getVRAMImage()
{
#if TARGET == TARGET_X1 || TARGET == TARGET_X1_TURBO || TARGET == TARGET_X1_TURBO_HIGH_SPEED
	if(ctx->isVRAMDirty()) {
		ctx->resetVRAMDirty();

		s8* vramR = (s8*)getIO() + 0x8000;
		s8* vramG = (s8*)getIO() + 0xC000;
		s8* vramB = (s8*)getIO() + 0x4000;
		for(s32 yy = 0; yy < 8; ++yy) {
			s8* dst = (s8*)&imageMemory[yy * 640*4];
			for(s32 y = 0; y < 25; ++y) {
				// 1ライン
				for(s32 x = 0; x < 80; ++x) {
					u8 R = *vramR++;
					u8 G = *vramG++;
					u8 B = *vramB++;
					for(s32 i = 0; i < 8; ++i) {
						u8 index  = B >> 7;  B <<= 1;
						index |= R >> 7 << 1;  R <<= 1;
						index |= G >> 7 << 2;  G <<= 1;
						*dst++ = paletteR[index];
						*dst++ = paletteG[index];
						*dst++ = paletteB[index];
						*dst++ = 0xFF;
					}
				}
				dst += 7 * 640 * 4; // 次の行へ(+8)
			}
			vramR += 0x30;
			vramG += 0x30;
			vramB += 0x30;
		}
	}
#endif
	return (void*)imageMemory;
}

#ifndef BUILD_WASM

#include <stdio.h>

void sos_putchar(int ch)
{
	putchar(ch);
}


#define SOS_FUNC(NAME) int sos_##NAME(SOS_ARGS)

SOS_FUNC(cold)
{
#define WRITE_U16(addr, value) ram[addr    ] = value & 0xFF; ram[addr + 1] = value >> 8;
#define WRITE_U8( addr, value) ram[addr    ] = value & 0xFF;
#define READ_U16(addr) (u16)ram[addr] | ((u16)ram[addr + 1] << 8);

//	WRITE_U16( WorkAddress::USR,    0x1FFA );
	WRITE_U8(  WorkAddress::DVSW,   0 );
	WRITE_U8(  WorkAddress::LPSW,   0 );
	WRITE_U16( WorkAddress::PRCNT,  0 );
	WRITE_U16( WorkAddress::XYADR,  ADDRESS_XYADR );
	WRITE_U16( WorkAddress::KBFAD,  ADDRESS_KBFAD );
	WRITE_U16( WorkAddress::IBFAD,  ADDRESS_IBFAD );
	WRITE_U16( WorkAddress::SIZE,   0 );
	WRITE_U16( WorkAddress::DTADR,  0 );
	WRITE_U16( WorkAddress::EXADR,  0 );
	WRITE_U16( WorkAddress::STKAD,  ADDRESS_STKAD );
	WRITE_U16( WorkAddress::MEMAX,  ADDRESS_MEMAX );
	WRITE_U16( WorkAddress::WKSIZ,  0xFFFF ); // @todo
	WRITE_U8(  WorkAddress::DIRNO,  ADDRESS_MEMAX );
	WRITE_U8(  WorkAddress::MXTRK,  0xFF ); // @todo
	WRITE_U16( WorkAddress::DTBUF,  ADDRESS_DTBUF );
	WRITE_U16( WorkAddress::FATBF,  ADDRESS_FATBF );
	WRITE_U16( WorkAddress::DIRPS,  0x0010 );
	WRITE_U16( WorkAddress::FATPOS, 0x000E );
	WRITE_U8(  WorkAddress::DSK,    0x00 ); // @todo
	WRITE_U8(  WorkAddress::WIDTH,  80 );
	WRITE_U8(  WorkAddress::MAXLIN, 25 );

	z80Regs->PC = READ_U16(WorkAddress::USR);
	z80Regs->SP = READ_U16(WorkAddress::STKAD);
	return 0;
}

SOS_FUNC(hot  )
{
	return 1;
}

SOS_FUNC(ver  )
{
	z80Regs->pair.H = 0x00;
	z80Regs->pair.L = 0x00;
	return 0;
}

SOS_FUNC(print)
{
	sos_putchar(z80Regs->pair.A);
	return 0;
}

SOS_FUNC(prnts)
{
	sos_putchar(0x20);
	return 0;
}

SOS_FUNC(ltnl )
{
	return 0;
}

SOS_FUNC(nl   )
{
	return 0;
}

SOS_FUNC(msg  )
{
	return 0;
}

SOS_FUNC(msx  )
{
	return 0;
}

SOS_FUNC(mprnt)
{
	// 戻るアドレスを取得
	u16 retAddress = READ_U16(z80Regs->SP);
	u8* src = &ram[retAddress];
	u8 ch;
	while((ch = *src++) != 0) { sos_putchar(ch); }
	// 戻るアドレスを書き換える
	WRITE_U16(z80Regs->SP, src - &ram[0]);
	return 0;
}

SOS_FUNC(tab  )
{
	return 0;
}

SOS_FUNC(lprnt)
{
	return 0;
}

SOS_FUNC(lpton)
{
	return 0;
}

SOS_FUNC(lptof)
{
	return 0;
}

SOS_FUNC(getl )
{
	return 0;
}

SOS_FUNC(getky)
{
	return 0;
}

SOS_FUNC(brkey)
{
	return 0;
}

SOS_FUNC(inkey)
{
	return 0;
}

SOS_FUNC(pause)
{
	return 0;
}

SOS_FUNC(bell )
{
	return 0;
}

SOS_FUNC(prthx)
{
	return 0;
}

SOS_FUNC(prthl)
{
	return 0;
}

SOS_FUNC(asc  )
{
	return 0;
}

SOS_FUNC(hex  )
{
	return 0;
}

SOS_FUNC(_2hex)
{
	return 0;
}

SOS_FUNC(hlhex)
{
	return 0;
}

SOS_FUNC(wopen)
{
	return 0;
}

SOS_FUNC(wrd  )
{
	return 0;
}

SOS_FUNC(fcb  )
{
	return 0;
}

SOS_FUNC(rdd  )
{
	return 0;
}

SOS_FUNC(file )
{
	return 0;
}

SOS_FUNC(fsame)
{
	return 0;
}

SOS_FUNC(fprnt)
{
	return 0;
}

SOS_FUNC(poke )
{
	return 0;
}

SOS_FUNC(poke_)
{
	return 0;
}

SOS_FUNC(peek )
{
	return 0;
}

SOS_FUNC(peek_)
{
	return 0;
}

SOS_FUNC(mon  )
{
	return 0;
}

SOS_FUNC(_hl_ )
{
	return 0;
}

SOS_FUNC(getpc)
{
	return 0;
}

SOS_FUNC(drdsb)
{
	return 0;
}

SOS_FUNC(dwtsb)
{
	return 0;
}

SOS_FUNC(dir  )
{
	return 0;
}

SOS_FUNC(ropen)
{
	return 0;
}

SOS_FUNC(set  )
{
	return 0;
}

SOS_FUNC(reset)
{
	return 0;
}

SOS_FUNC(name )
{
	return 0;
}

SOS_FUNC(kill )
{
	return 0;
}

SOS_FUNC(csr  )
{
	return 0;
}

SOS_FUNC(scrn )
{
	return 0;
}

SOS_FUNC(loc  )
{
	return 0;
}

SOS_FUNC(flget)
{
	return 0;
}

SOS_FUNC(rdvsw)
{
	return 0;
}

SOS_FUNC(sdvsw)
{
	return 0;
}

SOS_FUNC(inp  )
{
	return 0;
}

SOS_FUNC(out  )
{
	return 0;
}

SOS_FUNC(widch)
{
	return 0;
}

SOS_FUNC(error)
{
	return 0;
}

int main()
{
	return 0;
}

#endif // BUILD_WASM
