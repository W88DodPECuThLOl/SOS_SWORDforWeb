#pragma once

#include "../../cat/low/catLowBasicTypes.h"

class CatPCG {
	u8 indexB;
	u8 indexG;
	u8 indexR;
	u8 indexROM;
	u8 pcg[24*256 + 24*256];
	u16 ch;
public:
	CatPCG();
	~CatPCG();

	s32 initialize();
	void terminate();

	void setChar(u16 value);
	u8* getData(u16 ch);
	void writeB(const u8 pattern);
	void writeG(const u8 pattern);
	void writeR(const u8 pattern);
	u8 readROM();
	u8 readB();
	u8 readG();
	u8 readR();

	void setPCG(u16 ch, u8* data);
};
