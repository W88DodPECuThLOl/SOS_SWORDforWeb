#pragma once

//  固定長型とか
typedef unsigned char uchar;
typedef unsigned short ushort;
typedef unsigned int uint;

typedef unsigned char uint8;
typedef unsigned short uint16;
typedef unsigned int  uint32;

typedef signed char sint8;
typedef signed short sint16;
typedef signed int sint32;

typedef signed char int8;
typedef signed short int16;
typedef signed int int32;

static_assert(sizeof(uchar) == 1);
static_assert(sizeof(ushort) == 2);
static_assert(sizeof(uint) == 4);
static_assert(sizeof(uint8) == 1);
static_assert(sizeof(uint16) == 2);
static_assert(sizeof(uint32) == 4);
static_assert(sizeof(sint8) == 1);
static_assert(sizeof(sint16) == 2);
static_assert(sizeof(sint32) == 4);
static_assert(sizeof(int8) == 1);
static_assert(sizeof(int16) == 2);
static_assert(sizeof(int32) == 4);
