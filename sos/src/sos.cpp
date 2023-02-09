#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"
#include "sos.h"
#include "platform.h"

#ifdef BUILD_WASM
void setupHeap(void* heapBase, size_t heapSize);
#endif // BUILD_WASM

class SOS_Context {
	static unsigned char readByte(void* arg, unsigned short addr) { return ((SOS_Context*)arg)->RAM[addr]; }
	static void writeByte(void* arg, unsigned short addr, unsigned char value) {
		// S-OSのフック部分が書き換えられたら、フックを全部削除する
		// 以降、S-OSは使えなくなり、完全なZ80ワールドになる。
		if(ADDRESS_JUMPTABLE <= addr && addr <= ADDRESS_JUMPTABLE_END) {
			if(((SOS_Context*)arg)->RAM[addr] != value) {
				((SOS_Context*)arg)->z80.removeAllBreakPoints();
			}
		}
		((SOS_Context*)arg)->RAM[addr] = value;
	}
	static unsigned char inPort(void* arg, unsigned short port) {
		return platformInPort(((SOS_Context*)arg)->IO, port);
	}
	static void outPort(void* arg, unsigned short port, unsigned char value) {
		platformOutPort(((SOS_Context*)arg)->IO, port, value);
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
		// この２つは特殊
		//GETPC	= 0x1F80,
		//_HL_  = 0x1F81, // [HL]
		//
		MON     = 0x1F8E,
		PEEK_	= 0x1F91, // PEEK@
		PEEK	= 0x1F94,
		POKE_	= 0x1F97, // POKE@
		POKE	= 0x1F9A,
		FPRNT	= 0x1F9D,
		FSAME	= 0x1FA0,
		FILE	= 0x1FA3,
		RDD     = 0x1FA6,
		FCB	    = 0x1FA9,
		WRD	    = 0x1FAC,
		WOPEN	= 0x1FAF,
		HLHEX	= 0x1FB2,
		_2HEX	= 0x1FB5, // 2HEX
		HEX	    = 0x1FB8,
		ASC	    = 0x1FBB,
		PRTHL	= 0x1FBE,
		PRTHX	= 0x1FC1,
		BELL	= 0x1FC4,
		PAUSE	= 0x1FC7,
		INKEY	= 0x1FCA,
		BRKEY	= 0x1FCD,
		GETKY	= 0x1FD0,
		GETL	= 0x1FD3,
		LPTOF	= 0x1FD6,
		LPTON	= 0x1FD9,
		LPRNT	= 0x1FDC,
		TAB	    = 0x1FDF,
		MPRNT	= 0x1FE2,
		MSX     = 0x1FE5,
		MSG     = 0x1FE8,
		NL      = 0x1FEB,
		LTNL    = 0x1FEE,
		PRNTS   = 0x1FF1,
		PRINT   = 0x1FF4,
		VER     = 0x1FF7,
		HOT     = 0x1FFA,
		COLD    = 0x1FFD,

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

		// 隠し？
		COMMAND = 0x211B,

		// DOSモジュール
		RDI     = 0x2900,
		TROPN   = 0x2903,
		WRI     = 0x2906,
		TWRD    = 0x2909,
		TRDD    = 0x290c,
		TDIR    = 0x290f,
		P_FNAM  = 0x2912,
		DEVCHK  = 0x2915,
		TPCHK   = 0x2918,
		PARSC   = 0x292a,
		PARCS   = 0x293f,

		// ディスクI/O
		DREAD   = 0x2B00,
		DWRITE  = 0x2B03,
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
			bool js;
		};
		SubroutineTable subroutineTable[] = {
			{ COLD,  cold  },
			{ HOT,   hot   , true },
			{ VER,   ver   },
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
			{ GETL,	 getl , true },
			{ GETKY, getky},
			{ BRKEY, brkey},
			{ INKEY, inkey, true },
			{ PAUSE, pause, true },
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
			{ MON,   mon, true },
//			{ _HL_,  _hl_ }, // [HL]   メモ)Z80のコードで直接書く
//			{ GETPC, getpc}, //        メモ)Z80のコードで直接書く
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
			{ FLGET, flget, true },
			{ RDVSW, rdvsw},
			{ SDVSW, sdvsw},
			{ INP,   inp  },
			{ OUT,   out  },
			{ WIDCH, widch},
			{ ERROR, error},

			{ COMMAND, command },

			// DOSモジュール
			{ RDI,   rdi},
			{ TROPN, tropn},
			{ WRI,   wri},
			{ TWRD,  twrd},
			{ TRDD,  trdd},
			{ TDIR,  tdir},
			{ P_FNAM, p_fnam},
			{ DEVCHK, devchk},
			{ TPCHK, tpchk},
			{ PARSC, parsc},
			{ PARCS, parcs},
			// ディスクI/O
			{ DREAD, dread},
			{ DWRITE, dwrite},
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
			if(it.js) {
				// jsで処理が完了するまでループさせておく
				// メモ）jsの処理が完了したら、PCを無理やり書き換えて次の命令を実行するようにしている。
				WRITE_JP(dst, dst - RAM);
			}
			WRITE_RET(dst);
		}
		// S-OSのサブルーチン部分
		for(const auto& it : subroutineTable) {
			u8* dst = &RAM[it.address];
			WRITE_JP(dst, index++);	// JavaScript呼び出し部分へ
			if(it.js) {
				index += 3; // JP xxxx
			}
		}
	}
#ifndef BUILD_WASM
#define SOS_HOOK(NAME) static void NAME(void* ctx_) { SOS_Context* ctx = (SOS_Context*)ctx_; sos_##NAME(&ctx->z80.reg, sizeof(z80.reg), &ctx->RAM[0], &ctx->IO[0]); }
#else
#define SOS_HOOK(NAME) static void NAME(void* ctx_) { sos_##NAME(); }
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
//	SOS_HOOK(_hl_ ) // メモ)Z80のコードで直接書く
//	SOS_HOOK(getpc) // メモ)Z80のコードで直接書く
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

	SOS_HOOK(command)

	// DOSモジュール
	SOS_HOOK(rdi)
	SOS_HOOK(tropn)
	SOS_HOOK(wri)
	SOS_HOOK(twrd)
	SOS_HOOK(trdd)
	SOS_HOOK(tdir)
	SOS_HOOK(p_fnam)
	SOS_HOOK(devchk)
	SOS_HOOK(tpchk)
	SOS_HOOK(parsc)
	SOS_HOOK(parcs)
	// ディスクI/O
	SOS_HOOK(dread)
	SOS_HOOK(dwrite)
#undef SOS_HOOK

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
		// 割り込みモードを2に
		z80.reg.interrupt &= 0b11111100;
		z80.reg.interrupt |= 2; // モード2に
		// 割り込み有効に
		z80.reg.IFF |= 0b00000101;
		z80.reg.execEI = 1;
		z80.reg.I = 0;
	}

	/**
	 * @brief リセットする
	 */
	void reset()
	{
		z80.initialize();
		setVRAMDirty();
		// 割り込みモードを2に
		z80.reg.interrupt &= 0b11111100;
		z80.reg.interrupt |= 2; // モード2に
		// 割り込み有効に
		z80.reg.IFF |= 0b00000101;
		z80.reg.execEI = 1;
		z80.reg.I = 0;
	}

	/**
	 * @brief 実行する
	 * @param[in]	clock	進めるクロック数
	 * @return 実際に進んだクロック数
	 */
	int execute(int clock) {
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

	s32 getExecutedClock() const noexcept {return z80.getExecutedClock(); }

	/**
	 * @brief IRQ割り込み要求
	 */
	void generateIRQ(const u8 vector) noexcept { z80.generateIRQ(vector); }
};

/**
 * @brief 実態
 */
SOS_Context* ctx = nullptr;

void
initialize(void* heapBase, size_t heapSize)
{
#ifdef BUILD_WASM
	setupHeap(heapBase, heapSize);
#endif
	delete ctx;
	ctx = new SOS_Context();
	initPlatform();
/*
       31FE                     VSYNC_CHECK:
0001FE 31FE 3E1A             7   LD A,1AH
000200 3200 DB01            11   IN A,(01H)
	u8* mem = ctx->getRAM() + 0x0000;
	*mem++ = 0x3E; *mem++ = 0x1A;
	*mem++ = 0xDB; *mem++ = 0x01;

//00005B 305B 01A01F          10   LD BC,01FA0H
//0000DE 30DE 11FA07          10   LD DE,007FAH
//0000E1 30E1 ED51            12   OUT    (C),D
//0000E3 30E3 ED59            12   OUT    (C),E
//0000E5 30E5 ED78            12   IN A,(C)
	*mem++ = 0x01; *mem++ = 0xA0; *mem++ = 0x1F;
	*mem++ = 0x11; *mem++ = 0xFA; *mem++ = 0x07;
	*mem++ = 0xED; *mem++ = 0x51;
	*mem++ = 0xED; *mem++ = 0x59;
	*mem++ = 0xED; *mem++ = 0x78;
//0000E9 30E9 ED51            12   OUT    (C),D
//0000EB 30EB ED51            12   OUT    (C),D
//0000ED 30ED ED78            12   IN A,(C)
	*mem++ = 0xED; *mem++ = 0x51;
	*mem++ = 0xED; *mem++ = 0x51;
	*mem++ = 0xED; *mem++ = 0x78;
*/
}

/**
 * @brief リセットする
 */
void
z80Reset()
{
	delete ctx;
	ctx = new SOS_Context();
	initPlatform();
	return ctx->reset();
}

/**
 * @brief 実行する
 */
int
exeute(int clock)
{
	s32 tick = 0;
	// 周辺機器のチックをリセット
	resetPlatformTick();
	while(tick < clock) {
		s32 remain = clock - tick;
		// 実行するクロックを調整する
		// メモ）タイマ割り込み等で進むクロックを制限したい時など
		adjustPlatformClock(remain);
		// CPUを実行
		s32 executed = ctx->execute(remain);
		tick += executed;
		// CPUが実行した所まで周辺機器のチックを進める
		progressPlatformTick(tick);
	}
	return tick;
}

int
getStatus()
{
	return ctx->getStatus();
}

void*
getRAM()
{
	return ctx->getRAM();
}

void*
getIO()
{
	return ctx->getIO();
}

void*
getZ80Regs()
{
	return ctx->getZ80Regs();
}
s32
getZ80RegsSize()
{
	return ctx->getZ80RegsSize();
}

bool
isVRAMDirty()
{
	return ctx->isVRAMDirty();
}

void
setVRAMDirty()
{
	ctx->setVRAMDirty();
}

void*
getVRAMImage()
{
	if(!ctx->isVRAMDirty()) {
		return nullptr;
	}
	ctx->resetVRAMDirty();
	return getPlatformVRAMImage();
}

void
writeIO(u16 port, u8 value)
{
	platformOutPort(ctx->getIO(), port, value);
}


s32
getExecutedClock()
{
	return ctx->getExecutedClock();
}

void
generateIRQ(const u8 vector)
{
	ctx->generateIRQ(vector);
}
