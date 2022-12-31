#ifndef BUILD_WASM
#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"
#include "sos.h"

#include <string.h>
#include <stdio.h>

#define SOS_ARGS Z80::Register* z80Regs, int z80RegsSize, u8* ram, u8* io
#define SOS_FUNC(NAME) int sos_##NAME(SOS_ARGS)

#define WRITE_U16(addr, value) ram[addr    ] = value & 0xFF; ram[addr + 1] = value >> 8;
#define WRITE_U8( addr, value) ram[addr    ] = value & 0xFF;
#define READ_U16(addr) (u16)ram[addr] | ((u16)ram[addr + 1] << 8);

void sos_putchar(int ch)
{
	putchar(ch);
}

void
writePSG(s32 clock, u8 reg, u8 value)
{
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
	return 0;
}

SOS_FUNC(hot  )
{
//	z80Regs->PC += 3;



	return 0;
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
	initialize(0, 0);

	while(1) {
		exeute(0x400000);
	}
	
	return 0;
}

#endif // BUILD_WASM
