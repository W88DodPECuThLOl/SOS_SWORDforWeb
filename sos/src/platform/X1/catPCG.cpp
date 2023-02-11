#include "catPCG.h"

CatPCG::CatPCG()
	: indexB(0)
	, indexG(0)
	, indexR(0)
	, indexROM(0)
	, ch(0)
{
}

CatPCG::~CatPCG()
{
	terminate();
}

s32
CatPCG::initialize()
{
	indexB = 0;
	indexG = 0;
	indexR = 0;
	indexROM = 0;
	ch = 0;
	for(int i = 0; i < 24*256 * 2; ++i) {
		pcg[i] = (i & 1) ? 0xAA : 0x55;
	}

	return 0;
}

void
CatPCG::terminate()
{
}

void
CatPCG::setChar(u16 value)
{
	ch = value & 0xFF;
	indexB = 0;
	indexG = 0;
	indexR = 0;
	indexROM = 0;
}

u8*
CatPCG::getData(u16 ch)
{
	return &pcg[ch * 24];
}

void
CatPCG::writeB(const u8 pattern)
{
	pcg[ch * 24 + 16 + (indexB & 0x7)] = pattern;
	indexB++;
}

void
CatPCG::writeG(const u8 pattern)
{
	pcg[ch * 24 + 8 + (indexG & 0x7)] = pattern;
	indexG++;
}

void
CatPCG::writeR(const u8 pattern)
{
	pcg[ch * 24 + (indexR & 0x7)] = pattern;
	indexR++;
}

u8
CatPCG::readROM()
{
	return pcg[(ch + 0x100) * 24 + (indexROM++ & 0x7)];
}

u8
CatPCG::readB()
{
	return pcg[(ch) * 24 + 16 + (indexB++ & 0x7)];
}

u8
CatPCG::readG()
{
	return pcg[(ch) * 24 + 8 + (indexG++ & 0x7)];
}

u8
CatPCG::readR()
{
	return pcg[(ch) * 24 + (indexR++ & 0x7)];
}

void
CatPCG::setPCG(u16 ch, u8* data)
{
	for(int i = 0; i < 24; ++i) {
		pcg[ch * 24 + i] = data[i];
	}
}
