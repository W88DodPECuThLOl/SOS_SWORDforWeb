#ifndef BUILD_WASM
#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"
#include "sos.h"

#include <string.h>
#include <stdio.h>

#define SOS_ARGS Z80::Register* z80Regs, int z80RegsSize, u8* ram, u8* io
#define SOS_FUNC(NAME) void sos_##NAME(SOS_ARGS)

#define WRITE_U16(addr, value) ram[addr    ] = value & 0xFF; ram[addr + 1] = value >> 8;
#define WRITE_U8( addr, value) ram[addr    ] = value & 0xFF;
#define READ_U16(addr) (u16)ram[addr] | ((u16)ram[addr + 1] << 8);

void jslogHex02(int operandNumber)
{
}

void jslogHex04(int operandNumber)
{
}

void sos_putchar(int ch)
{
	putchar(ch);
}

void
writeSoundRegister(s32 clock, s32 no, u8 reg, u8 value)
{
}

u8
readGamePad(u8 index)
{
	return 0xFF;
}

SOS_FUNC(cold)
{
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
}

SOS_FUNC(hot  )
{
//	z80Regs->PC += 3;
}

SOS_FUNC(ver  )
{
	z80Regs->pair.H = 0x00;
	z80Regs->pair.L = 0x00;
}

SOS_FUNC(print)
{
	sos_putchar(z80Regs->pair.A);
}

SOS_FUNC(prnts)
{
	sos_putchar(0x20);
}

SOS_FUNC(ltnl )
{
}

SOS_FUNC(nl   )
{
}

SOS_FUNC(msg  )
{
}

SOS_FUNC(msx  )
{
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
}

SOS_FUNC(tab  )
{
}

SOS_FUNC(lprnt)
{
}

SOS_FUNC(lpton)
{
}

SOS_FUNC(lptof)
{
}

SOS_FUNC(getl )
{
}

SOS_FUNC(getky)
{
}

SOS_FUNC(brkey)
{
}

SOS_FUNC(inkey)
{
}

SOS_FUNC(pause)
{
}

SOS_FUNC(bell )
{
}

SOS_FUNC(prthx)
{
}

SOS_FUNC(prthl)
{
}

SOS_FUNC(asc  )
{
}

SOS_FUNC(hex  )
{
}

SOS_FUNC(_2hex)
{
}

SOS_FUNC(hlhex)
{
}

SOS_FUNC(wopen)
{
}

SOS_FUNC(wrd  )
{
}

SOS_FUNC(fcb  )
{
}

SOS_FUNC(rdd  )
{
}

SOS_FUNC(file )
{
}

SOS_FUNC(fsame)
{
}

SOS_FUNC(fprnt)
{
}

SOS_FUNC(poke )
{
}

SOS_FUNC(poke_)
{
}

SOS_FUNC(peek )
{
}

SOS_FUNC(peek_)
{
}

SOS_FUNC(mon  )
{
}

/*
// メモ)Z80のコードで直接書く
SOS_FUNC(_hl_ )
{
}

// メモ)Z80のコードで直接書く
SOS_FUNC(getpc)
{
}
*/

SOS_FUNC(drdsb)
{
}

SOS_FUNC(dwtsb)
{
}

SOS_FUNC(dir  )
{
}

SOS_FUNC(ropen)
{
}

SOS_FUNC(set  )
{
}

SOS_FUNC(reset)
{
}

SOS_FUNC(name )
{
}

SOS_FUNC(kill )
{
}

SOS_FUNC(csr  )
{
}

SOS_FUNC(scrn )
{
}

SOS_FUNC(loc  )
{
}

SOS_FUNC(flget)
{
}

SOS_FUNC(rdvsw)
{
}

SOS_FUNC(sdvsw)
{
}

SOS_FUNC(inp  )
{
}

SOS_FUNC(out  )
{
}

SOS_FUNC(widch)
{
}

SOS_FUNC(error)
{
}

SOS_FUNC(command)
{
}

// DOSモジュール
SOS_FUNC(rdi)
{
}
SOS_FUNC(tropn)
{
}
SOS_FUNC(wri)
{
}
SOS_FUNC(twrd)
{
}
SOS_FUNC(trdd)
{
}
SOS_FUNC(tdir)
{
}
SOS_FUNC(p_fnam)
{
}
SOS_FUNC(devchk)
{
}
SOS_FUNC(tpchk)
{
}
SOS_FUNC(parsc)
{
}
SOS_FUNC(parcs)
{
}

// IO
SOS_FUNC(dread)
{
}

SOS_FUNC(dwrite)
{
}

int main()
{
	initialize(0, 0);


	while(1) {
		exeute(0x400000);
	}
	
	return 0;
}

#endif // BUILD_WASM
