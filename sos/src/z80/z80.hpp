﻿/**
 * SUZUKI PLAN - Z80 Emulator
 * -----------------------------------------------------------------------------
 * The MIT License (MIT)
 * 
 * Copyright (c) 2019 Yoji Suzuki.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * -----------------------------------------------------------------------------
 */
#ifndef INCLUDE_Z80_HPP
#define INCLUDE_Z80_HPP

#define DISABLE_EXCEPTION
#define DISABLE_LOG
#define DISABLE_BREAK_POINTS
#define DISABLE_BREAK_OPERANDS

#define R800 (1)

#ifndef BUILD_WASM
#include <functional>
#include <limits.h>
#include <map>
#include <stdarg.h>
#include <stdexcept>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <vector>
#endif // BUILD_WASM

WASM_IMPORT("log", "logHex02")
extern "C" void jslogHex02(int operandNumber);
WASM_IMPORT("log", "logHex04")
extern "C" void jslogHex04(int operandNumber);

//using ReadFuncType = std::function<unsigned char(void*, unsigned short)>;
//using WriteFuncType = std::function<void(void*, unsigned short, unsigned char)>;
using ReadFuncType = unsigned char(*)(void*, unsigned short);
using WriteFuncType = void(*)(void*, unsigned short, unsigned char);
using DeviceInType = unsigned char(*)(void*, unsigned short);
using DeviceOutType = void(*)(void*, unsigned short, unsigned char);

class Z80
{
  public: // Interface data types
    struct WaitClocks {
        int fetch; // Wait T-cycle (Hz) before fetching instruction (default is 0 = no wait)
        int read;  // Wait T-cycle (Hz) before to read memory (default is 0 = no wait)
        int write; // Wait T-cycle (Hz) before to write memory (default is 0 = no wait)
    } wtc;

    struct RegisterPair {
        unsigned char A;
        unsigned char F;
        unsigned char B;
        unsigned char C;
        unsigned char D;
        unsigned char E;
        unsigned char H;
        unsigned char L;
    };

    struct Register {
        struct RegisterPair pair;
        struct RegisterPair back;
        unsigned short PC;
        unsigned short SP;
        unsigned short IX;
        unsigned short IY;
        unsigned short interruptVector; // interrupt vector for IRQ
        unsigned short interruptAddrN;  // interrupt address for NMI
        unsigned short WZ;
        unsigned short reserved16;
        unsigned char R;
        unsigned char I;
        unsigned char IFF;
        unsigned char interrupt; // NI-- --mm (N: NMI, I: IRQ, mm: mode)
        unsigned char consumeClockCounter;
        unsigned char execEI;
        unsigned char reserved8[2];
    } reg;

    inline unsigned char flagS() { return 0b10000000; }
    inline unsigned char flagZ() { return 0b01000000; }
    inline unsigned char flagY() { return 0b00100000; }
    inline unsigned char flagH() { return 0b00010000; }
    inline unsigned char flagX() { return 0b00001000; }
    inline unsigned char flagPV() { return 0b00000100; }
    inline unsigned char flagN() { return 0b00000010; }
    inline unsigned char flagC() { return 0b00000001; }

    inline unsigned char readByte(unsigned short addr, int clock = 4)
    {
        if (clock && wtc.read) consumeClock(wtc.read);
        unsigned char byte = CB.read(CB.arg, addr);
        if (clock) consumeClock(clock);
        return byte;
    }

    inline void writeByte(unsigned short addr, unsigned char value, int clock = 4)
    {
        if (wtc.write) consumeClock(wtc.write);
        CB.write(CB.arg, addr, value);
        consumeClock(clock);
    }

  private: // Internal functions & variables
    // flag setter
    inline void setFlagS(bool on) { on ? reg.pair.F |= flagS() : reg.pair.F &= ~flagS(); }
    inline void setFlagZ(bool on) { on ? reg.pair.F |= flagZ() : reg.pair.F &= ~flagZ(); }
    inline void setFlagY(bool on) { on ? reg.pair.F |= flagY() : reg.pair.F &= ~flagY(); }
    inline void setFlagH(bool on) { on ? reg.pair.F |= flagH() : reg.pair.F &= ~flagH(); }
    inline void setFlagX(bool on) { on ? reg.pair.F |= flagX() : reg.pair.F &= ~flagX(); }
    inline void setFlagPV(bool on) { on ? reg.pair.F |= flagPV() : reg.pair.F &= ~flagPV(); }
    inline void setFlagN(bool on) { on ? reg.pair.F |= flagN() : reg.pair.F &= ~flagN(); }
    inline void setFlagC(bool on) { on ? reg.pair.F |= flagC() : reg.pair.F &= ~flagC(); }

    inline void setFlagXY(unsigned char value)
    {
        setFlagX(value & flagX());
        setFlagY(value & flagY());
    }

    // flag checker
    inline bool isFlagS() { return reg.pair.F & flagS(); }
    inline bool isFlagZ() { return reg.pair.F & flagZ(); }
    inline bool isFlagH() { return reg.pair.F & flagH(); }
    inline bool isFlagPV() { return reg.pair.F & flagPV(); }
    inline bool isFlagN() { return reg.pair.F & flagN(); }
    inline bool isFlagC() { return reg.pair.F & flagC(); }

    inline bool checkConditionFlag(unsigned char c)
    {
        switch (c) {
            case 0: return !isFlagZ();
            case 1: return isFlagZ();
            case 2: return !isFlagC();
            case 3: return isFlagC();
            case 4: return !isFlagPV();
            case 5: return isFlagPV();
            case 6: return !isFlagS();
            case 7: return isFlagS();
            default: return false;
        }
    }

    inline unsigned char IFF1() { return 0b00000001; }
    inline unsigned char IFF2() { return 0b00000100; }
    inline unsigned char IFF_IRQ() { return 0b00100000; }
    inline unsigned char IFF_NMI() { return 0b01000000; }
    inline unsigned char IFF_HALT() { return 0b10000000; }

    template <typename T>
    class CoExistenceCallback;
    template <typename ReturnType, typename... ArgumentTypes>
    class CoExistenceCallback<ReturnType(ArgumentTypes...)>
    {
      private:
        ReturnType (*fp)(ArgumentTypes...);
#ifndef DISABLE_BREAK_POINTS
        std::function<ReturnType(ArgumentTypes...)> fc;
#endif

      public:
        CoExistenceCallback() { fp = nullptr; }
#ifndef DISABLE_BREAK_POINTS
        void setupAsFunctionObject(const std::function<ReturnType(ArgumentTypes...)>& fc_) { fc = fc_; }
#endif
        void setupAsFunctionPointer(ReturnType (*fp_)(ArgumentTypes...)) { fp = fp_; }
        inline ReturnType operator()(ArgumentTypes... args) { return fp ? fp(args...) : fc(args...); }
    };

    class BreakPoint
    {
      public:
        unsigned short addr = 0;
        void(*callback)(void*) = nullptr;
    };

    class BreakPointFC : public BreakPoint
    {
      public:
        BreakPointFC(unsigned short addr_, const void(*callback_)(void*))
        {
            this->addr = addr_;
            this->callback = (void(*)(void*))callback_;
        }
    };

    class BreakPointFP : public BreakPoint
    {
      public:
        BreakPointFP(unsigned short addr_, void (*callback_)(void*))
        {
            this->addr = addr_;
            this->callback = callback_;
        }
    };

    class BreakOperand
    {
      public:
        int prefixNumber;
        unsigned char operandNumber;
        void(*callback)(void*, unsigned char*, int);
    };

    class BreakOperandFC : public BreakOperand
    {
      public:
        BreakOperandFC(int prefixNumber_, unsigned char operandNumber_, const void(*callback_)(void*, unsigned char*, int))
        {
            this->prefixNumber = prefixNumber_;
            this->operandNumber = operandNumber_;
            this->callback = (void(*)(void*, unsigned char*, int))callback_;
        }
    };

    class BreakOperandFP : public BreakOperand
    {
      public:
        BreakOperandFP(int prefixNumber_, unsigned char operandNumber_, void (*callback_)(void*, unsigned char*, int))
        {
            this->prefixNumber = prefixNumber_;
            this->operandNumber = operandNumber_;
            this->callback = callback_;
        }
    };

    class SimpleHandler
    {
      public:
        void(*callback)(void*);
    };

    class SimpleHandlerFC : public SimpleHandler
    {
      public:
        SimpleHandlerFC(const void(*callback_)(void*) )
        {
            this->callback = (void(*)(void*))callback_;
        }
    };

    class SimpleHandlerFP : public SimpleHandler
    {
      public:
        SimpleHandlerFP(void (*callback_)(void*))
        {
            this->callback = callback_;
        }
    };

    inline void invokeReturnHandlers()
    {
#ifndef DISABLE_BREAK_OPERANDS
        for (auto handler : this->CB.returnHandlers) {
            handler->callback(this->CB.arg);
        }
#endif
    }

    inline void invokeCallHandlers()
    {
#ifndef DISABLE_BREAK_OPERANDS
        for (auto handler : this->CB.callHandlers) {
            handler->callback(this->CB.arg);
        }
#endif
    }

    struct Callback {
        ReadFuncType read;
        WriteFuncType write;
        bool returnPortAs16Bits;
        DeviceInType in;
        DeviceOutType out;
        void(*debugMessage)(void*, const char*);
        bool debugMessageEnabled;
        void(*consumeClock)(void*, int);
        bool consumeClockEnabled;
        //std::map<int, std::vector<BreakPoint*>*> breakPoints;
        static constexpr int MAX_BREAK_POINTS = 64;
        BreakPoint breakPoints[MAX_BREAK_POINTS];
#ifndef DISABLE_BREAK_OPERANDS
        std::map<int, std::vector<BreakOperand*>*> breakOperands;
#endif // DISABLE_BREAK_OPERANDS
#ifndef DISABLE_BREAK_OPERANDS
        std::vector<SimpleHandler*> returnHandlers;
        std::vector<SimpleHandler*> callHandlers;
#endif
        void* arg;
    } CB;

    bool requestBreakFlag;

    inline void checkBreakPoint()
    {
        for(auto& it : CB.breakPoints) {
            if(it.addr == reg.PC && it.callback) {
                it.callback(CB.arg);
                break;
            }
        }
    }

    inline void readFullOpcode(BreakOperand* operand, unsigned char* opcode, int* opcodeLength)
    {
        *opcodeLength = 0;
        switch (operand->prefixNumber) {
            case 0x00:
                opcode[0] = operand->operandNumber;
                *opcodeLength = opLength1[opcode[0]];
                for (int i = 1; i < *opcodeLength; i++) {
                    opcode[i] = readByte(reg.PC + i - 1, 0); // read without consume clocks
                }
                break;
            case 0xCB:
                opcode[0] = 0xCB;
                opcode[1] = operand->operandNumber;
                *opcodeLength = 2;
                break;
            case 0xED:
                opcode[0] = 0xED;
                opcode[1] = operand->operandNumber;
                *opcodeLength = opLengthED[opcode[1]];
                for (int i = 2; i < *opcodeLength; i++) {
                    opcode[i] = readByte(reg.PC + i - 2, 0); // read without consume clocks
                }
                break;
            case 0xDD:
                opcode[0] = 0xDD;
                opcode[1] = operand->operandNumber;
                *opcodeLength = opLengthIXY[opcode[1]];
                for (int i = 2; i < *opcodeLength; i++) {
                    opcode[i] = readByte(reg.PC + i - 2, 0); // read without consume clocks
                }
                break;
            case 0xFD:
                opcode[0] = 0xFD;
                opcode[1] = operand->operandNumber;
                *opcodeLength = opLengthIXY[opcode[1]];
                for (int i = 2; i < *opcodeLength; i++) {
                    opcode[i] = readByte(reg.PC + i - 2, 0); // read without consume clocks
                }
                break;
            case 0xDDCB:
                opcode[0] = 0xDD;
                opcode[1] = 0xCB;
                opcode[2] = operand->operandNumber;
                opcode[3] = readByte(reg.PC, 0);
                *opcodeLength = 4;
                break;
            case 0xFDCB:
                opcode[0] = 0xFD;
                opcode[1] = 0xCB;
                opcode[2] = operand->operandNumber;
                opcode[3] = readByte(reg.PC, 0);
                *opcodeLength = 4;
                break;
        }
    }

    inline void checkBreakOperand(int operandNumber)
    {
#ifndef DISABLE_BREAK_OPERANDS
        if (CB.breakOperands.empty()) return;
        auto it = CB.breakOperands.find(operandNumber);
        if (it == CB.breakOperands.end()) return;
        unsigned char opcode[16];
        int opcodeLength = 16;
        bool first = true;
        for (auto bo : *CB.breakOperands[operandNumber]) {
            if (first) {
                readFullOpcode(bo, opcode, &opcodeLength);
                first = false;
            }
            bo->callback(CB.arg, opcode, opcodeLength);
        }
#endif // DISABLE_BREAK_OPERANDS
    }

    inline void checkBreakOperandCB(unsigned char operandNumber) { checkBreakOperand(0xCB00 | operandNumber); }
    inline void checkBreakOperandED(unsigned char operandNumber) { checkBreakOperand(0xED00 | operandNumber); }
    inline void checkBreakOperandIX(unsigned char operandNumber) { checkBreakOperand(0xDD00 | operandNumber); }
    inline void checkBreakOperandIY(unsigned char operandNumber) { checkBreakOperand(0xFD00 | operandNumber); }
    inline void checkBreakOperandIX4(unsigned char operandNumber) { checkBreakOperand(0xDDCB00 | operandNumber); }
    inline void checkBreakOperandIY4(unsigned char operandNumber) { checkBreakOperand(0xFDCB00 | operandNumber); }

    inline void log(const char* format, ...)
    {
#ifndef BUILD_WASM
        char buf[1024];
        va_list args;
        va_start(args, format);
        vsnprintf(buf, sizeof(buf), format, args);
        va_end(args);
        CB.debugMessage(CB.arg, buf);
#endif
    }

    inline unsigned short getAF() { return make16BitsFromLE(reg.pair.F, reg.pair.A); }
    inline unsigned short getAF2() { return make16BitsFromLE(reg.back.F, reg.back.A); }
    inline unsigned short getBC() { return make16BitsFromLE(reg.pair.C, reg.pair.B); }
    inline unsigned short getBC2() { return make16BitsFromLE(reg.back.C, reg.back.B); }
    inline unsigned short getDE() { return make16BitsFromLE(reg.pair.E, reg.pair.D); }
    inline unsigned short getDE2() { return make16BitsFromLE(reg.back.E, reg.back.D); }
    inline unsigned short getHL() { return make16BitsFromLE(reg.pair.L, reg.pair.H); }
    inline unsigned short getHL2() { return make16BitsFromLE(reg.back.L, reg.back.H); }

    inline void setAF(unsigned short value) { splitTo8BitsPair(value, &reg.pair.A, &reg.pair.F); }
    inline void setAF2(unsigned short value) { splitTo8BitsPair(value, &reg.back.A, &reg.back.F); }
    inline void setBC(unsigned short value) { splitTo8BitsPair(value, &reg.pair.B, &reg.pair.C); }
    inline void setBC2(unsigned short value) { splitTo8BitsPair(value, &reg.back.B, &reg.back.C); }
    inline void setDE(unsigned short value) { splitTo8BitsPair(value, &reg.pair.D, &reg.pair.E); }
    inline void setDE2(unsigned short value) { splitTo8BitsPair(value, &reg.back.D, &reg.back.E); }
    inline void setHL(unsigned short value) { splitTo8BitsPair(value, &reg.pair.H, &reg.pair.L); }
    inline void setHL2(unsigned short value) { splitTo8BitsPair(value, &reg.back.H, &reg.back.L); }

    inline unsigned short getRP(unsigned char rp)
    {
        switch (rp & 0b11) {
            case 0b00: return getBC();
            case 0b01: return getDE();
            case 0b10: return getHL();
            default: return reg.SP;
        }
    }

    inline unsigned short getRPIX(unsigned char rp)
    {
        switch (rp & 0b11) {
            case 0b00: return getBC();
            case 0b01: return getDE();
            case 0b10: return reg.IX;
            default: return reg.SP;
        }
    }

    inline unsigned short getRPIY(unsigned char rp)
    {
        switch (rp & 0b11) {
            case 0b00: return getBC();
            case 0b01: return getDE();
            case 0b10: return reg.IY;
            default: return reg.SP;
        }
    }

    inline void setRP(unsigned char rp, unsigned short value)
    {
        switch (rp & 0b11) {
            case 0b00: setBC(value); break;
            case 0b01: setDE(value); break;
            case 0b10: setHL(value); break;
            default: reg.SP = value;
        }
    }

    inline unsigned char getIXH() { return (reg.IX & 0xFF00) >> 8; }
    inline unsigned char getIXL() { return reg.IX & 0x00FF; }
    inline unsigned char getIYH() { return (reg.IY & 0xFF00) >> 8; }
    inline unsigned char getIYL() { return reg.IY & 0x00FF; }
    inline unsigned char getPCH() { return (reg.PC & 0xFF00) >> 8; }
    inline unsigned char getPCL() { return reg.PC & 0x00FF; }
    inline void setPCH(unsigned char v) { reg.PC = (reg.PC & 0x00FF) + v * 256; }
    inline void setPCL(unsigned char v) { reg.PC = (reg.PC & 0xFF00) + v; }
    inline void setSPH(unsigned char v) { reg.SP = (reg.SP & 0x00FF) + v * 256; }
    inline void setSPL(unsigned char v) { reg.SP = (reg.SP & 0xFF00) + v; }
    inline void setIXH(unsigned char v) { reg.IX = (reg.IX & 0x00FF) + v * 256; }
    inline void setIXL(unsigned char v) { reg.IX = (reg.IX & 0xFF00) + v; }
    inline void setIYH(unsigned char v) { reg.IY = (reg.IY & 0x00FF) + v * 256; }
    inline void setIYL(unsigned char v) { reg.IY = (reg.IY & 0xFF00) + v; }

    inline bool isEvenNumberBits(unsigned char value)
    {
        int on = 0;
        int off = 0;
        value & 0b10000000 ? on++ : off++;
        value & 0b01000000 ? on++ : off++;
        value & 0b00100000 ? on++ : off++;
        value & 0b00010000 ? on++ : off++;
        value & 0b00001000 ? on++ : off++;
        value & 0b00000100 ? on++ : off++;
        value & 0b00000010 ? on++ : off++;
        value & 0b00000001 ? on++ : off++;
        return (on & 1) == 0;
    }

    inline int consumeClock(int hz)
    {
        reg.consumeClockCounter += hz;
        if (CB.consumeClockEnabled && hz) CB.consumeClock(CB.arg, hz);
        return hz;
    }

    inline unsigned short getPort16WithB(unsigned char c) { return make16BitsFromLE(c, reg.pair.B); }
    inline unsigned short getPort16WithA(unsigned char c) { return make16BitsFromLE(c, reg.pair.A); }

    inline unsigned char inPortWithB(unsigned char port, int clock = 4)
    {
        unsigned char byte = CB.in(CB.arg, CB.returnPortAs16Bits ? getPort16WithB(port) : port);
        consumeClock(clock);
        return byte;
    }
    inline unsigned char inPort16(unsigned short port, int clock = 4)
    {
        unsigned char byte = CB.in(CB.arg, CB.returnPortAs16Bits ? port : (port & 0xFF));
        consumeClock(clock);
        return byte;
    }

    inline unsigned char inPortWithA(unsigned char port, int clock = 4)
    {
        unsigned char byte = CB.in(CB.arg, CB.returnPortAs16Bits ? getPort16WithA(port) : port);
        consumeClock(clock);
        return byte;
    }

    inline void outPortWithB(unsigned char port, unsigned char value, int clock = 4)
    {
        CB.out(CB.arg, CB.returnPortAs16Bits ? getPort16WithB(port) : port, value);
        consumeClock(clock);
    }

    inline void outPortWithA(unsigned char port, unsigned char value, int clock = 4)
    {
        CB.out(CB.arg, CB.returnPortAs16Bits ? getPort16WithA(port) : port, value);
        consumeClock(clock);
    }

    static inline void NOP(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] NOP", ctx->reg.PC - 1);
    }

    static inline void HALT(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] HALT", ctx->reg.PC - 1);
        ctx->reg.IFF |= ctx->IFF_HALT();
    }

    static inline void DI(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] DI", ctx->reg.PC - 1);
        ctx->reg.IFF &= ~(ctx->IFF1() | ctx->IFF2());
    }

    static inline void EI(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] EI", ctx->reg.PC - 1);
        ctx->reg.IFF |= ctx->IFF1() | ctx->IFF2();
        ctx->reg.execEI = 1;
    }

    static inline void IM0(Z80* ctx) { ctx->IM(0); }
    static inline void IM1(Z80* ctx) { ctx->IM(1); }
    static inline void IM2(Z80* ctx) { ctx->IM(2); }
    inline void IM(unsigned char interrptMode)
    {
        if (isDebug()) log("[%04X] IM %d", reg.PC - 2, interrptMode);
        reg.interrupt &= 0b11111100;
        reg.interrupt |= interrptMode & 0b11;
    }

    static inline void LD_A_I_(Z80* ctx) { ctx->LD_A_I(); }
    inline void LD_A_I()
    {
        if (isDebug()) log("[%04X] LD A<$%02X>, I<$%02X>", reg.PC - 2, reg.pair.A, reg.I);
        reg.pair.A = reg.I;
        setFlagPV(reg.IFF & IFF2());
        consumeClock(1);
    }

    static inline void LD_I_A_(Z80* ctx) { ctx->LD_I_A(); }
    inline void LD_I_A()
    {
        if (isDebug()) log("[%04X] LD I<$%02X>, A<$%02X>", reg.PC - 2, reg.I, reg.pair.A);
        reg.I = reg.pair.A;
        consumeClock(1);
    }

    static inline void LD_A_R_(Z80* ctx) { ctx->LD_A_R(); }
    inline void LD_A_R()
    {
        if (isDebug()) log("[%04X] LD A<$%02X>, R<$%02X>", reg.PC - 2, reg.pair.A, reg.R);
        reg.pair.A = reg.R;
        setFlagPV(reg.IFF & IFF1());
        consumeClock(1);
    }

    static inline void LD_R_A_(Z80* ctx) { ctx->LD_R_A(); }
    inline void LD_R_A()
    {
        if (isDebug()) log("[%04X] LD R<$%02X>, A<$%02X>", reg.PC - 2, reg.R, reg.pair.A);
        reg.R = reg.pair.A;
        consumeClock(1);
    }

    static inline void OP_CB(Z80* ctx)
    {
        unsigned char operandNumber = ctx->fetch(4);
        ctx->checkBreakOperandCB(operandNumber);
        ctx->opSetCB[operandNumber](ctx);
    }

    static inline void OP_ED(Z80* ctx)
    {
        unsigned char operandNumber = ctx->fetch(4);
        if (!ctx->opSetED[operandNumber]) {
#ifndef DISABLE_EXCEPTION
            char buf[80];
            snprintf(buf, sizeof(buf), "detect an unknown operand (ED,%02X)", operandNumber);
            throw std::runtime_error(buf);
#endif 
        }
        ctx->checkBreakOperandED(operandNumber);
        ctx->opSetED[operandNumber](ctx);
    }

    static inline void OP_IX(Z80* ctx)
    {
        unsigned char operandNumber = ctx->fetch(4);
        if (!ctx->opSetIX[operandNumber]) {
#ifndef BUILD_WASM
            char buf[80];
            snprintf(buf, sizeof(buf), "detect an unknown operand (DD,%02X)", operandNumber);
            throw std::runtime_error(buf);
#endif
        }
        ctx->checkBreakOperandIX(operandNumber);
        ctx->opSetIX[operandNumber](ctx);
    }

    static inline void OP_IY(Z80* ctx)
    {
        unsigned char operandNumber = ctx->fetch(4);
        if (!ctx->opSetIY[operandNumber]) {
#ifndef BUILD_WASM
            char buf[80];
            snprintf(buf, sizeof(buf), "detect an unknown operand (FD,%02X)", operandNumber);
            throw std::runtime_error(buf);
#endif
        }
        ctx->checkBreakOperandIY(operandNumber);
        ctx->opSetIY[operandNumber](ctx);
    }

    static inline void OP_IX4(Z80* ctx)
    {
        signed char op3 = (signed char)ctx->fetch(4);
        unsigned char op4 = ctx->fetch(4);
        ctx->checkBreakOperandIX4(op4);
        ctx->opSetIX4[op4](ctx, op3);
    }

    static inline void OP_IY4(Z80* ctx)
    {
        signed char op3 = (signed char)ctx->fetch(4);
        unsigned char op4 = ctx->fetch(4);
        ctx->checkBreakOperandIY4(op4);
        ctx->opSetIY4[op4](ctx, op3);
    }

    // Load location (HL) with value n
    static inline void LD_HL_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        unsigned short hl = ctx->getHL();
        if (ctx->isDebug()) ctx->log("[%04X] LD (HL<$%04X>), $%02X", ctx->reg.PC - 2, hl, n);
        ctx->writeByte(hl, n, 3);
    }

    // Load Acc. wth location (BC)
    static inline void LD_A_BC(Z80* ctx)
    {
        unsigned short addr = ctx->getBC();
        unsigned char n = ctx->readByte(addr, 3);
        if (ctx->isDebug()) ctx->log("[%04X] LD A, (BC<$%02X%02X>) = $%02X", ctx->reg.PC - 1, ctx->reg.pair.B, ctx->reg.pair.C, n);
        ctx->reg.pair.A = n;
    }

    // Load Acc. wth location (DE)
    static inline void LD_A_DE(Z80* ctx)
    {
        unsigned short addr = ctx->getDE();
        unsigned char n = ctx->readByte(addr, 3);
        if (ctx->isDebug()) ctx->log("[%04X] LD A, (DE<$%02X%02X>) = $%02X", ctx->reg.PC - 1, ctx->reg.pair.D, ctx->reg.pair.E, n);
        ctx->reg.pair.A = n;
    }

    // Load Acc. wth location (nn)
    static inline void LD_A_NN(Z80* ctx)
    {
        unsigned char l = ctx->fetch(3);
        unsigned char h = ctx->fetch(3);
        unsigned short addr = ctx->make16BitsFromLE(l, h);
        unsigned char n = ctx->readByte(addr, 3);
        if (ctx->isDebug()) ctx->log("[%04X] LD A, ($%04X) = $%02X", ctx->reg.PC - 3, addr, n);
        ctx->reg.pair.A = n;
    }

    // Load location (BC) wtih Acc.
    static inline void LD_BC_A(Z80* ctx)
    {
        unsigned short addr = ctx->getBC();
        unsigned char n = ctx->reg.pair.A;
        if (ctx->isDebug()) ctx->log("[%04X] LD (BC<$%02X%02X>), A<$%02X>", ctx->reg.PC - 1, ctx->reg.pair.B, ctx->reg.pair.C, n);
        ctx->writeByte(addr, n, 3);
    }

    // Load location (DE) wtih Acc.
    static inline void LD_DE_A(Z80* ctx)
    {
        unsigned short addr = ctx->getDE();
        unsigned char n = ctx->reg.pair.A;
        if (ctx->isDebug()) ctx->log("[%04X] LD (DE<$%02X%02X>), A<$%02X>", ctx->reg.PC - 1, ctx->reg.pair.D, ctx->reg.pair.E, n);
        ctx->writeByte(addr, n, 3);
    }

    // Load location (nn) with Acc.
    static inline void LD_NN_A(Z80* ctx)
    {
        unsigned char l = ctx->fetch(3);
        unsigned char h = ctx->fetch(3);
        unsigned short addr = ctx->make16BitsFromLE(l, h);
        unsigned char n = ctx->reg.pair.A;
        if (ctx->isDebug()) ctx->log("[%04X] LD ($%04X), A<$%02X>", ctx->reg.PC - 3, addr, n);
        ctx->writeByte(addr, n, 3);
    }

    // Load HL with location (nn).
    static inline void LD_HL_ADDR(Z80* ctx)
    {
        unsigned char l = ctx->fetch(3);
        unsigned char h = ctx->fetch(3);
        unsigned short addr = ctx->make16BitsFromLE(l, h);
        unsigned short hl = ctx->getHL();
        ctx->reg.pair.L = ctx->readByte(addr, 3);
        ctx->reg.pair.H = ctx->readByte(addr + 1, 3);
        if (ctx->isDebug()) ctx->log("[%04X] LD HL<$%04X>, ($%04X) = $%04X", ctx->reg.PC - 3, hl, addr, ctx->getHL());
    }

    // Load location (nn) with HL.
    static inline void LD_ADDR_HL(Z80* ctx)
    {
        unsigned char l = ctx->fetch(3);
        unsigned char h = ctx->fetch(3);
        unsigned short addr = ctx->make16BitsFromLE(l, h);
        if (ctx->isDebug()) ctx->log("[%04X] LD ($%04X), %s", ctx->reg.PC - 3, addr, ctx->registerPairDump(0b10));
        ctx->writeByte(addr, ctx->reg.pair.L, 3);
        ctx->writeByte(addr + 1, ctx->reg.pair.H, 3);
    }

    // Load SP with HL.
    static inline void LD_SP_HL(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] LD %s, HL<$%04X>", ctx->reg.PC - 1, ctx->registerPairDump(0b11), ctx->getHL());
        ctx->reg.SP = ctx->getHL();
        ctx->consumeClock(2);
    }

    // Exchange H and L with D and E
    static inline void EX_DE_HL(Z80* ctx)
    {
        unsigned short de = ctx->getDE();
        unsigned short hl = ctx->getHL();
        if (ctx->isDebug()) ctx->log("[%04X] EX %s, %s", ctx->reg.PC - 1, ctx->registerPairDump(0b01), ctx->registerPairDump(0b10));
        ctx->setDE(hl);
        ctx->setHL(de);
    }

    // Exchange A and F with A' and F'
    static inline void EX_AF_AF2(Z80* ctx)
    {
        unsigned short af = ctx->getAF();
        unsigned short af2 = ctx->getAF2();
        if (ctx->isDebug()) ctx->log("[%04X] EX AF<$%02X%02X>, AF'<$%02X%02X>", ctx->reg.PC - 1, ctx->reg.pair.A, ctx->reg.pair.F, ctx->reg.back.A, ctx->reg.back.F);
        ctx->setAF(af2);
        ctx->setAF2(af);
    }

    static inline void EX_SP_HL(Z80* ctx)
    {
        unsigned short sp = ctx->reg.SP;
        unsigned char l = ctx->pop(4);
        unsigned char h = ctx->pop(4);
        unsigned short hl = ctx->getHL();
        if (ctx->isDebug()) ctx->log("[%04X] EX (SP<$%04X>) = $%02X%02X, HL<$%04X>", ctx->reg.PC - 1, sp, h, l, hl);
        ctx->push(ctx->reg.pair.H, 4);
        ctx->reg.pair.H = h;
        ctx->push(ctx->reg.pair.L, 3);
        ctx->reg.pair.L = l;
    }

    static inline void EXX(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] EXX", ctx->reg.PC - 1);
        unsigned short bc = ctx->getBC();
        unsigned short bc2 = ctx->getBC2();
        unsigned short de = ctx->getDE();
        unsigned short de2 = ctx->getDE2();
        unsigned short hl = ctx->getHL();
        unsigned short hl2 = ctx->getHL2();
        ctx->setBC(bc2);
        ctx->setBC2(bc);
        ctx->setDE(de2);
        ctx->setDE2(de);
        ctx->setHL(hl2);
        ctx->setHL2(hl);
    }

    inline void push(unsigned char value, int clocks)
    {
        reg.SP--;
        writeByte(reg.SP, value, clocks);
    }

    inline unsigned char pop(int clocks)
    {
        unsigned char value = readByte(reg.SP, clocks);
        reg.SP++;
        return value;
    }

    static inline void PUSH_AF(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] PUSH AF<$%02X%02X> <SP:$%04X>", ctx->reg.PC - 1, ctx->reg.pair.A, ctx->reg.pair.F, ctx->reg.SP);
        ctx->push(ctx->reg.pair.A, 4);
        ctx->push(ctx->reg.pair.F, 3);
    }

    static inline void POP_AF(Z80* ctx)
    {
        ctx->reg.pair.F = ctx->pop(3);
        ctx->reg.pair.A = ctx->pop(3);
        if (ctx->isDebug()) ctx->log("[%04X] POP AF <SP:$%04X> = $%04X", ctx->reg.PC - 1, ctx->reg.SP - 2, ctx->getAF());
    }

    inline unsigned char* getRegisterPointer(unsigned char r)
    {
        switch (r) {
            case 0b111: return &reg.pair.A;
            case 0b000: return &reg.pair.B;
            case 0b001: return &reg.pair.C;
            case 0b010: return &reg.pair.D;
            case 0b011: return &reg.pair.E;
            case 0b100: return &reg.pair.H;
            case 0b101: return &reg.pair.L;
            case 0b110: return &reg.pair.F;
        }
        if (isDebug()) log("detected an unknown register number: $%02X", r);
        return nullptr;
    }

    inline unsigned char getRegister(unsigned char r)
    {
        switch (r) {
            case 0b111: return reg.pair.A;
            case 0b000: return reg.pair.B;
            case 0b001: return reg.pair.C;
            case 0b010: return reg.pair.D;
            case 0b011: return reg.pair.E;
            case 0b100: return reg.pair.H;
            case 0b101: return reg.pair.L;
            case 0b110: return reg.pair.F;
        }
        if (isDebug()) log("detected an unknown register number: $%02X", r);
        return 0xFF;
    }

    inline char* registerDump(unsigned char r)
    {
        static char A[16];
        static char B[16];
        static char C[16];
        static char D[16];
        static char E[16];
        static char H[16];
        static char L[16];
        static char F[16];
        static char unknown[2];
#ifndef BUILD_WASM
        switch (r & 0b111) {
            case 0b111: snprintf(A, sizeof(A), "A<$%02X>", reg.pair.A); return A;
            case 0b000: snprintf(B, sizeof(B), "B<$%02X>", reg.pair.B); return B;
            case 0b001: snprintf(C, sizeof(C), "C<$%02X>", reg.pair.C); return C;
            case 0b010: snprintf(D, sizeof(D), "D<$%02X>", reg.pair.D); return D;
            case 0b011: snprintf(E, sizeof(E), "E<$%02X>", reg.pair.E); return E;
            case 0b100: snprintf(H, sizeof(H), "H<$%02X>", reg.pair.H); return H;
            case 0b101: snprintf(L, sizeof(L), "L<$%02X>", reg.pair.L); return L;
            case 0b110: snprintf(F, sizeof(F), "F<$%02X>", reg.pair.F); return F;
        }
#endif
        unknown[0] = '?';
        unknown[1] = '\0';
        return unknown;
    }

    inline char* conditionDump(unsigned char c)
    {
#ifndef BUILD_WASM
        static char CN[4];
        switch (c) {
            case 0b000: strcpy(CN, "NZ"); break;
            case 0b001: strcpy(CN, "Z"); break;
            case 0b010: strcpy(CN, "NC"); break;
            case 0b011: strcpy(CN, "C"); break;
            case 0b100: strcpy(CN, "PO"); break;
            case 0b101: strcpy(CN, "PE"); break;
            case 0b110: strcpy(CN, "P"); break;
            case 0b111: strcpy(CN, "M"); break;
            default: strcpy(CN, "??");
        }
        return CN;
#else
        static char CN[4]{0};
        return CN;
#endif
    }

    inline char* relativeDump(unsigned short pc, signed char e)
    {
#ifndef BUILD_WASM
        static char buf[80];
        if (e < 0) {
            int ee = -e;
            ee -= 2;
            snprintf(buf, sizeof(buf), "$%04X - %d = $%04X", pc, ee, pc + e + 2);
        } else {
            snprintf(buf, sizeof(buf), "$%04X + %d = $%04X", pc, e + 2, pc + e + 2);
        }
        return buf;
#else
        static char buf[80]{};
        return buf;
#endif
    }

    inline char* registerDump2(unsigned char r)
    {
        static char A[16];
        static char B[16];
        static char C[16];
        static char D[16];
        static char E[16];
        static char H[16];
        static char L[16];
        static char unknown[2] = "?";
        switch (r) {
#ifndef BUILD_WASM
            case 0b111: snprintf(A, sizeof(A), "A'<$%02X>", reg.back.A); return A;
            case 0b000: snprintf(B, sizeof(B), "B'<$%02X>", reg.back.B); return B;
            case 0b001: snprintf(C, sizeof(C), "C'<$%02X>", reg.back.C); return C;
            case 0b010: snprintf(D, sizeof(D), "D'<$%02X>", reg.back.D); return D;
            case 0b011: snprintf(E, sizeof(E), "E'<$%02X>", reg.back.E); return E;
            case 0b100: snprintf(H, sizeof(H), "H'<$%02X>", reg.back.H); return H;
            case 0b101: snprintf(L, sizeof(L), "L'<$%02X>", reg.back.L); return L;
#endif
            default: return unknown;
        }
    }

    inline char* registerPairDump(unsigned char ptn)
    {
        static char BC[16];
        static char DE[16];
        static char HL[16];
        static char SP[16];
        static char unknown[2] = "?";
        switch (ptn & 0b11) {
#ifndef BUILD_WASM
            case 0b00: snprintf(BC, sizeof(BC), "BC<$%02X%02X>", reg.pair.B, reg.pair.C); return BC;
            case 0b01: snprintf(DE, sizeof(DE), "DE<$%02X%02X>", reg.pair.D, reg.pair.E); return DE;
            case 0b10: snprintf(HL, sizeof(HL), "HL<$%02X%02X>", reg.pair.H, reg.pair.L); return HL;
            case 0b11: snprintf(SP, sizeof(SP), "SP<$%04X>", reg.SP); return SP;
#endif
            default: return unknown;
        }
    }

    inline char* registerPairDumpIX(unsigned char ptn)
    {
        static char BC[16];
        static char DE[16];
        static char IX[16];
        static char SP[16];
        static char unknown[2] = "?";
        switch (ptn & 0b11) {
#ifndef BUILD_WASM
            case 0b00: snprintf(BC, sizeof(BC), "BC<$%02X%02X>", reg.pair.B, reg.pair.C); return BC;
            case 0b01: snprintf(DE, sizeof(DE), "DE<$%02X%02X>", reg.pair.D, reg.pair.E); return DE;
            case 0b10: snprintf(IX, sizeof(IX), "IX<$%04X>", reg.IX); return IX;
            case 0b11: snprintf(SP, sizeof(SP), "SP<$%04X>", reg.SP); return SP;
#endif
            default: return unknown;
        }
    }

    inline char* registerPairDumpIY(unsigned char ptn)
    {
        static char BC[16];
        static char DE[16];
        static char IY[16];
        static char SP[16];
        static char unknown[2] = "?";
        switch (ptn & 0b11) {
#ifndef BUILD_WASM
            case 0b00: snprintf(BC, sizeof(BC), "BC<$%02X%02X>", reg.pair.B, reg.pair.C); return BC;
            case 0b01: snprintf(DE, sizeof(DE), "DE<$%02X%02X>", reg.pair.D, reg.pair.E); return DE;
            case 0b10: snprintf(IY, sizeof(IY), "IY<$%04X>", reg.IY); return IY;
            case 0b11: snprintf(SP, sizeof(SP), "SP<$%04X>", reg.SP); return SP;
#endif
            default: return unknown;
        }
    }

    // Load Reg. r1 with Reg. r2
    static inline void LD_B_B(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b000); }
    static inline void LD_B_C(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b001); }
    static inline void LD_B_D(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b010); }
    static inline void LD_B_E(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b011); }
    static inline void LD_B_B_2(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b000, 2); }
    static inline void LD_B_C_2(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b001, 2); }
    static inline void LD_B_D_2(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b010, 2); }
    static inline void LD_B_E_2(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b011, 2); }
    static inline void LD_B_H(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b100); }
    static inline void LD_B_L(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b101); }
    static inline void LD_B_A(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b111); }
    static inline void LD_C_B(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b000); }
    static inline void LD_C_C(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b001); }
    static inline void LD_C_D(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b010); }
    static inline void LD_C_E(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b011); }
    static inline void LD_B_A_2(Z80* ctx) { ctx->LD_R1_R2(0b000, 0b111, 2); }
    static inline void LD_C_B_2(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b000, 2); }
    static inline void LD_C_C_2(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b001, 2); }
    static inline void LD_C_D_2(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b010, 2); }
    static inline void LD_C_E_2(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b011, 2); }
    static inline void LD_C_H(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b100); }
    static inline void LD_C_L(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b101); }
    static inline void LD_C_A(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b111); }
    static inline void LD_D_B(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b000); }
    static inline void LD_D_C(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b001); }
    static inline void LD_D_D(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b010); }
    static inline void LD_D_E(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b011); }
    static inline void LD_C_A_2(Z80* ctx) { ctx->LD_R1_R2(0b001, 0b111, 2); }
    static inline void LD_D_B_2(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b000, 2); }
    static inline void LD_D_C_2(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b001, 2); }
    static inline void LD_D_D_2(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b010, 2); }
    static inline void LD_D_E_2(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b011, 2); }
    static inline void LD_D_H(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b100); }
    static inline void LD_D_L(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b101); }
    static inline void LD_D_A(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b111); }
    static inline void LD_E_B(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b000); }
    static inline void LD_E_C(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b001); }
    static inline void LD_E_D(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b010); }
    static inline void LD_E_E(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b011); }
    static inline void LD_D_A_2(Z80* ctx) { ctx->LD_R1_R2(0b010, 0b111, 2); }
    static inline void LD_E_B_2(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b000, 2); }
    static inline void LD_E_C_2(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b001, 2); }
    static inline void LD_E_D_2(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b010, 2); }
    static inline void LD_E_E_2(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b011, 2); }
    static inline void LD_E_H(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b100); }
    static inline void LD_E_L(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b101); }
    static inline void LD_E_A(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b111); }
    static inline void LD_E_A_2(Z80* ctx) { ctx->LD_R1_R2(0b011, 0b111, 2); }
    static inline void LD_H_B(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b000); }
    static inline void LD_H_C(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b001); }
    static inline void LD_H_D(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b010); }
    static inline void LD_H_E(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b011); }
    static inline void LD_H_H(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b100); }
    static inline void LD_H_L(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b101); }
    static inline void LD_H_A(Z80* ctx) { ctx->LD_R1_R2(0b100, 0b111); }
    static inline void LD_L_B(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b000); }
    static inline void LD_L_C(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b001); }
    static inline void LD_L_D(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b010); }
    static inline void LD_L_E(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b011); }
    static inline void LD_L_H(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b100); }
    static inline void LD_L_L(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b101); }
    static inline void LD_L_A(Z80* ctx) { ctx->LD_R1_R2(0b101, 0b111); }
    static inline void LD_A_B(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b000); }
    static inline void LD_A_C(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b001); }
    static inline void LD_A_D(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b010); }
    static inline void LD_A_E(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b011); }
    static inline void LD_A_B_2(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b000, 2); }
    static inline void LD_A_C_2(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b001, 2); }
    static inline void LD_A_D_2(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b010, 2); }
    static inline void LD_A_E_2(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b011, 2); }
    static inline void LD_A_H(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b100); }
    static inline void LD_A_L(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b101); }
    static inline void LD_A_A(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b111); }
    static inline void LD_A_A_2(Z80* ctx) { ctx->LD_R1_R2(0b111, 0b111, 2); }
    inline void LD_R1_R2(unsigned char r1, unsigned char r2, int counter = 1)
    {
        unsigned char* r1p = getRegisterPointer(r1);
        unsigned char* r2p = getRegisterPointer(r2);
        if (isDebug()) log("[%04X] LD %s, %s", reg.PC - counter, registerDump(r1), registerDump(r2));
        if (r1p && r2p) *r1p = *r2p;
    }

    // Load Reg. r with value n
    static inline void LD_A_N(Z80* ctx) { ctx->LD_R_N(0b111); }
    static inline void LD_B_N(Z80* ctx) { ctx->LD_R_N(0b000); }
    static inline void LD_C_N(Z80* ctx) { ctx->LD_R_N(0b001); }
    static inline void LD_D_N(Z80* ctx) { ctx->LD_R_N(0b010); }
    static inline void LD_E_N(Z80* ctx) { ctx->LD_R_N(0b011); }
    static inline void LD_H_N(Z80* ctx) { ctx->LD_R_N(0b100); }
    static inline void LD_L_N(Z80* ctx) { ctx->LD_R_N(0b101); }
    static inline void LD_A_N_3(Z80* ctx) { ctx->LD_R_N(0b111, 3); }
    static inline void LD_B_N_3(Z80* ctx) { ctx->LD_R_N(0b000, 3); }
    static inline void LD_C_N_3(Z80* ctx) { ctx->LD_R_N(0b001, 3); }
    static inline void LD_D_N_3(Z80* ctx) { ctx->LD_R_N(0b010, 3); }
    static inline void LD_E_N_3(Z80* ctx) { ctx->LD_R_N(0b011, 3); }
    inline void LD_R_N(unsigned char r, int pc = 2)
    {
        unsigned char* rp = getRegisterPointer(r);
        unsigned char n = fetch(3);
        if (isDebug()) log("[%04X] LD %s, $%02X", reg.PC - pc, registerDump(r), n);
        if (rp) *rp = n;
    }

    // Load Reg. IX(high) with value n
    static inline void LD_IXH_N_(Z80* ctx) { ctx->LD_IXH_N(); }
    inline void LD_IXH_N()
    {
        unsigned char n = fetch(3);
        if (isDebug()) log("[%04X] LD IXH, $%02X", reg.PC - 3, n);
        setIXH(n);
    }

    // Load Reg. IX(high) with value Reg.
    static inline void LD_IXH_A(Z80* ctx) { ctx->LD_IXH_R(0b111); }
    static inline void LD_IXH_B(Z80* ctx) { ctx->LD_IXH_R(0b000); }
    static inline void LD_IXH_C(Z80* ctx) { ctx->LD_IXH_R(0b001); }
    static inline void LD_IXH_D(Z80* ctx) { ctx->LD_IXH_R(0b010); }
    static inline void LD_IXH_E(Z80* ctx) { ctx->LD_IXH_R(0b011); }
    inline void LD_IXH_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD IXH, %s", reg.PC - 2, registerDump(r));
        setIXH(*rp);
    }

    // Load Reg. IX(high) with value IX(high)
    static inline void LD_IXH_IXH_(Z80* ctx) { ctx->LD_IXH_IXH(); }
    inline void LD_IXH_IXH()
    {
        if (isDebug()) log("[%04X] LD IXH, IXH<$%02X>", reg.PC - 2, getIXH());
    }

    // Load Reg. IX(high) with value IX(low)
    static inline void LD_IXH_IXL_(Z80* ctx) { ctx->LD_IXH_IXL(); }
    inline void LD_IXH_IXL()
    {
        if (isDebug()) log("[%04X] LD IXH, IXL<$%02X>", reg.PC - 2, getIXL());
        setIXH(getIXL());
    }

    // Load Reg. IX(low) with value n
    static inline void LD_IXL_N_(Z80* ctx) { ctx->LD_IXL_N(); }
    inline void LD_IXL_N()
    {
        unsigned char n = fetch(3);
        if (isDebug()) log("[%04X] LD IXL, $%02X", reg.PC - 3, n);
        setIXL(n);
    }

    // Load Reg. IX(low) with value Reg.
    static inline void LD_IXL_A(Z80* ctx) { ctx->LD_IXL_R(0b111); }
    static inline void LD_IXL_B(Z80* ctx) { ctx->LD_IXL_R(0b000); }
    static inline void LD_IXL_C(Z80* ctx) { ctx->LD_IXL_R(0b001); }
    static inline void LD_IXL_D(Z80* ctx) { ctx->LD_IXL_R(0b010); }
    static inline void LD_IXL_E(Z80* ctx) { ctx->LD_IXL_R(0b011); }
    inline void LD_IXL_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD IXL, %s", reg.PC - 2, registerDump(r));
        setIXL(*rp);
    }

    // Load Reg. IX(low) with value IX(high)
    static inline void LD_IXL_IXH_(Z80* ctx) { ctx->LD_IXL_IXH(); }
    inline void LD_IXL_IXH()
    {
        if (isDebug()) log("[%04X] LD IXL, IXH<$%02X>", reg.PC - 2, getIXH());
        setIXL(getIXH());
    }

    // Load Reg. IX(low) with value IX(low)
    static inline void LD_IXL_IXL_(Z80* ctx) { ctx->LD_IXL_IXL(); }
    inline void LD_IXL_IXL()
    {
        if (isDebug()) log("[%04X] LD IXL, IXL<$%02X>", reg.PC - 2, getIXL());
    }

    // Load Reg. IY(high) with value n
    static inline void LD_IYH_N_(Z80* ctx) { ctx->LD_IYH_N(); }
    inline void LD_IYH_N()
    {
        unsigned char n = fetch(3);
        if (isDebug()) log("[%04X] LD IYH, $%02X", reg.PC - 3, n);
        setIYH(n);
    }

    // Load Reg. IY(high) with value Reg.
    static inline void LD_IYH_A(Z80* ctx) { ctx->LD_IYH_R(0b111); }
    static inline void LD_IYH_B(Z80* ctx) { ctx->LD_IYH_R(0b000); }
    static inline void LD_IYH_C(Z80* ctx) { ctx->LD_IYH_R(0b001); }
    static inline void LD_IYH_D(Z80* ctx) { ctx->LD_IYH_R(0b010); }
    static inline void LD_IYH_E(Z80* ctx) { ctx->LD_IYH_R(0b011); }
    inline void LD_IYH_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD IYH, %s", reg.PC - 2, registerDump(r));
        setIYH(*rp);
    }

    // Load Reg. IY(high) with value IY(high)
    static inline void LD_IYH_IYH_(Z80* ctx) { ctx->LD_IYH_IYH(); }
    inline void LD_IYH_IYH()
    {
        if (isDebug()) log("[%04X] LD IYH, IYH<$%02X>", reg.PC - 2, getIYH());
    }

    // Load Reg. IY(high) with value IY(low)
    static inline void LD_IYH_IYL_(Z80* ctx) { ctx->LD_IYH_IYL(); }
    inline void LD_IYH_IYL()
    {
        if (isDebug()) log("[%04X] LD IYH, IYL<$%02X>", reg.PC - 2, getIYL());
        setIYH(getIYL());
    }

    // Load Reg. IY(low) with value n
    static inline void LD_IYL_N_(Z80* ctx) { ctx->LD_IYL_N(); }
    inline void LD_IYL_N()
    {
        unsigned char n = fetch(3);
        if (isDebug()) log("[%04X] LD IYL, $%02X", reg.PC - 3, n);
        setIYL(n);
    }

    // Load Reg. IY(low) with value Reg.
    static inline void LD_IYL_A(Z80* ctx) { ctx->LD_IYL_R(0b111); }
    static inline void LD_IYL_B(Z80* ctx) { ctx->LD_IYL_R(0b000); }
    static inline void LD_IYL_C(Z80* ctx) { ctx->LD_IYL_R(0b001); }
    static inline void LD_IYL_D(Z80* ctx) { ctx->LD_IYL_R(0b010); }
    static inline void LD_IYL_E(Z80* ctx) { ctx->LD_IYL_R(0b011); }
    inline void LD_IYL_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD IYL, %s", reg.PC - 2, registerDump(r));
        setIYL(*rp);
    }

    // Load Reg. IY(low) with value IY(high)
    static inline void LD_IYL_IYH_(Z80* ctx) { ctx->LD_IYL_IYH(); }
    inline void LD_IYL_IYH()
    {
        if (isDebug()) log("[%04X] LD IYL, IYH<$%02X>", reg.PC - 2, getIYH());
        setIYL(getIYH());
    }

    // Load Reg. IY(low) with value IY(low)
    static inline void LD_IYL_IYL_(Z80* ctx) { ctx->LD_IYL_IYL(); }
    inline void LD_IYL_IYL()
    {
        if (isDebug()) log("[%04X] LD IYL, IYL<$%02X>", reg.PC - 2, getIYL());
    }

    // Load Reg. r with location (HL)
    static inline void LD_B_HL(Z80* ctx) { ctx->LD_R_HL(0b000); }
    static inline void LD_C_HL(Z80* ctx) { ctx->LD_R_HL(0b001); }
    static inline void LD_D_HL(Z80* ctx) { ctx->LD_R_HL(0b010); }
    static inline void LD_E_HL(Z80* ctx) { ctx->LD_R_HL(0b011); }
    static inline void LD_H_HL(Z80* ctx) { ctx->LD_R_HL(0b100); }
    static inline void LD_L_HL(Z80* ctx) { ctx->LD_R_HL(0b101); }
    static inline void LD_A_HL(Z80* ctx) { ctx->LD_R_HL(0b111); }
    inline void LD_R_HL(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        unsigned char n = readByte(getHL(), 3);
        if (isDebug()) log("[%04X] LD %s, (%s) = $%02X", reg.PC - 1, registerDump(r), registerPairDump(0b10), n);
        if (rp) *rp = n;
    }

    // Load Reg. r with location (IX+d)
    static inline void LD_A_IX(Z80* ctx) { ctx->LD_R_IX(0b111); }
    static inline void LD_B_IX(Z80* ctx) { ctx->LD_R_IX(0b000); }
    static inline void LD_C_IX(Z80* ctx) { ctx->LD_R_IX(0b001); }
    static inline void LD_D_IX(Z80* ctx) { ctx->LD_R_IX(0b010); }
    static inline void LD_E_IX(Z80* ctx) { ctx->LD_R_IX(0b011); }
    static inline void LD_H_IX(Z80* ctx) { ctx->LD_R_IX(0b100); }
    static inline void LD_L_IX(Z80* ctx) { ctx->LD_R_IX(0b101); }
    inline void LD_R_IX(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((reg.IX + d) & 0xFFFF);
        if (isDebug()) log("[%04X] LD %s, (IX<$%04X>+$%02X) = $%02X", reg.PC - 3, registerDump(r), reg.IX, d, n);
        if (rp) *rp = n;
        consumeClock(3);
    }

    // Load Reg. r with IXH
    static inline void LD_A_IXH(Z80* ctx) { ctx->LD_R_IXH(0b111); }
    static inline void LD_B_IXH(Z80* ctx) { ctx->LD_R_IXH(0b000); }
    static inline void LD_C_IXH(Z80* ctx) { ctx->LD_R_IXH(0b001); }
    static inline void LD_D_IXH(Z80* ctx) { ctx->LD_R_IXH(0b010); }
    static inline void LD_E_IXH(Z80* ctx) { ctx->LD_R_IXH(0b011); }
    inline void LD_R_IXH(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD %s, IXH<$%02X>", reg.PC - 2, registerDump(r), getIXH());
        if (rp) *rp = getIXH();
    }

    // Load Reg. r with IXL
    static inline void LD_A_IXL(Z80* ctx) { ctx->LD_R_IXL(0b111); }
    static inline void LD_B_IXL(Z80* ctx) { ctx->LD_R_IXL(0b000); }
    static inline void LD_C_IXL(Z80* ctx) { ctx->LD_R_IXL(0b001); }
    static inline void LD_D_IXL(Z80* ctx) { ctx->LD_R_IXL(0b010); }
    static inline void LD_E_IXL(Z80* ctx) { ctx->LD_R_IXL(0b011); }
    inline void LD_R_IXL(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD %s, IXL<$%02X>", reg.PC - 2, registerDump(r), getIXL());
        if (rp) *rp = getIXL();
    }

    // Load Reg. r with location (IY+d)
    static inline void LD_A_IY(Z80* ctx) { ctx->LD_R_IY(0b111); }
    static inline void LD_B_IY(Z80* ctx) { ctx->LD_R_IY(0b000); }
    static inline void LD_C_IY(Z80* ctx) { ctx->LD_R_IY(0b001); }
    static inline void LD_D_IY(Z80* ctx) { ctx->LD_R_IY(0b010); }
    static inline void LD_E_IY(Z80* ctx) { ctx->LD_R_IY(0b011); }
    static inline void LD_H_IY(Z80* ctx) { ctx->LD_R_IY(0b100); }
    static inline void LD_L_IY(Z80* ctx) { ctx->LD_R_IY(0b101); }
    inline void LD_R_IY(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((reg.IY + d) & 0xFFFF);
        if (isDebug()) log("[%04X] LD %s, (IY<$%04X>+$%02X) = $%02X", reg.PC - 3, registerDump(r), reg.IY, d, n);
        if (rp) *rp = n;
        consumeClock(3);
    }

    // Load Reg. r with IYH
    static inline void LD_A_IYH(Z80* ctx) { ctx->LD_R_IYH(0b111); }
    static inline void LD_B_IYH(Z80* ctx) { ctx->LD_R_IYH(0b000); }
    static inline void LD_C_IYH(Z80* ctx) { ctx->LD_R_IYH(0b001); }
    static inline void LD_D_IYH(Z80* ctx) { ctx->LD_R_IYH(0b010); }
    static inline void LD_E_IYH(Z80* ctx) { ctx->LD_R_IYH(0b011); }
    inline void LD_R_IYH(unsigned char r)
    {
        unsigned char iyh = getIYH();
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD %s, IYH<$%02X>", reg.PC - 2, registerDump(r), iyh);
        if (rp) *rp = iyh;
    }

    // Load Reg. r with IYL
    static inline void LD_A_IYL(Z80* ctx) { ctx->LD_R_IYL(0b111); }
    static inline void LD_B_IYL(Z80* ctx) { ctx->LD_R_IYL(0b000); }
    static inline void LD_C_IYL(Z80* ctx) { ctx->LD_R_IYL(0b001); }
    static inline void LD_D_IYL(Z80* ctx) { ctx->LD_R_IYL(0b010); }
    static inline void LD_E_IYL(Z80* ctx) { ctx->LD_R_IYL(0b011); }
    inline void LD_R_IYL(unsigned char r)
    {
        unsigned char iyl = getIYL();
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] LD %s, IYL<$%02X>", reg.PC - 2, registerDump(r), iyl);
        if (rp) *rp = iyl;
    }

    // Load location (HL) with Reg. r
    static inline void LD_HL_B(Z80* ctx) { ctx->LD_HL_R(0b000); }
    static inline void LD_HL_C(Z80* ctx) { ctx->LD_HL_R(0b001); }
    static inline void LD_HL_D(Z80* ctx) { ctx->LD_HL_R(0b010); }
    static inline void LD_HL_E(Z80* ctx) { ctx->LD_HL_R(0b011); }
    static inline void LD_HL_H(Z80* ctx) { ctx->LD_HL_R(0b100); }
    static inline void LD_HL_L(Z80* ctx) { ctx->LD_HL_R(0b101); }
    static inline void LD_HL_A(Z80* ctx) { ctx->LD_HL_R(0b111); }
    inline void LD_HL_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        unsigned short addr = getHL();
        if (isDebug()) log("[%04X] LD (%s), %s", reg.PC - 1, registerPairDump(0b10), registerDump(r));
        writeByte(addr, *rp, 3);
    }

    // 	Load location (IX+d) with Reg. r
    static inline void LD_IX_A(Z80* ctx) { ctx->LD_IX_R(0b111); }
    static inline void LD_IX_B(Z80* ctx) { ctx->LD_IX_R(0b000); }
    static inline void LD_IX_C(Z80* ctx) { ctx->LD_IX_R(0b001); }
    static inline void LD_IX_D(Z80* ctx) { ctx->LD_IX_R(0b010); }
    static inline void LD_IX_E(Z80* ctx) { ctx->LD_IX_R(0b011); }
    static inline void LD_IX_H(Z80* ctx) { ctx->LD_IX_R(0b100); }
    static inline void LD_IX_L(Z80* ctx) { ctx->LD_IX_R(0b101); }
    inline void LD_IX_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        if (isDebug()) log("[%04X] LD (IX<$%04X>+$%02X), %s", reg.PC - 3, reg.IX, d, registerDump(r));
        if (rp) writeByte(addr, *rp);
        consumeClock(3);
    }

    // 	Load location (IY+d) with Reg. r
    static inline void LD_IY_A(Z80* ctx) { ctx->LD_IY_R(0b111); }
    static inline void LD_IY_B(Z80* ctx) { ctx->LD_IY_R(0b000); }
    static inline void LD_IY_C(Z80* ctx) { ctx->LD_IY_R(0b001); }
    static inline void LD_IY_D(Z80* ctx) { ctx->LD_IY_R(0b010); }
    static inline void LD_IY_E(Z80* ctx) { ctx->LD_IY_R(0b011); }
    static inline void LD_IY_H(Z80* ctx) { ctx->LD_IY_R(0b100); }
    static inline void LD_IY_L(Z80* ctx) { ctx->LD_IY_R(0b101); }
    inline void LD_IY_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        if (isDebug()) log("[%04X] LD (IY<$%04X>+$%02X), %s", reg.PC - 3, reg.IY, d, registerDump(r));
        if (rp) writeByte(addr, *rp);
        consumeClock(3);
    }

    // Load location (IX+d) with value n
    static inline void LD_IX_N_(Z80* ctx) { ctx->LD_IX_N(); }
    inline void LD_IX_N()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        writeByte(addr, n, 3);
        if (isDebug()) log("[%04X] LD (IX<$%04X>+$%02X), $%02X", reg.PC - 4, reg.IX, d, n);
    }

    // Load location (IY+d) with value n
    static inline void LD_IY_N_(Z80* ctx) { ctx->LD_IY_N(); }
    inline void LD_IY_N()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        writeByte(addr, n, 3);
        if (isDebug()) log("[%04X] LD (IY<$%04X>+$%02X), $%02X", reg.PC - 4, reg.IY, d, n);
    }

    // Load Reg. pair rp with value nn.
    static inline void LD_BC_NN(Z80* ctx) { ctx->LD_RP_NN(0b00); }
    static inline void LD_DE_NN(Z80* ctx) { ctx->LD_RP_NN(0b01); }
    static inline void LD_HL_NN(Z80* ctx) { ctx->LD_RP_NN(0b10); }
    static inline void LD_SP_NN(Z80* ctx) { ctx->LD_RP_NN(0b11); }
    inline void LD_RP_NN(unsigned char rp)
    {
        unsigned char* rH;
        unsigned char* rL;
        switch (rp) {
            case 0b00:
                rH = &reg.pair.B;
                rL = &reg.pair.C;
                break;
            case 0b01:
                rH = &reg.pair.D;
                rL = &reg.pair.E;
                break;
            case 0b10:
                rH = &reg.pair.H;
                rL = &reg.pair.L;
                break;
            case 0b11: {
                // SP is not managed in pair structure, so calculate directly
                unsigned short sp = reg.SP;
                setSPL(fetch(3));
                setSPH(fetch(3));
                if (isDebug()) log("[%04X] LD SP<$%04X>, $%04X", reg.PC - 3, sp, reg.SP);
                return;
            }
            default:
                if (isDebug()) log("invalid register pair has specified: $%02X", rp);
#ifndef DISABLE_EXCEPTION
                throw std::runtime_error("invalid register pair has specified");
#endif
                return;
        }
        const char* dump = isDebug() ? registerPairDump(rp) : "";
        unsigned char nL = fetch(3);
        *rL = nL;
        unsigned char nH = fetch(3);
        *rH = nH;
        if (isDebug()) log("[%04X] LD %s, $%02X%02X", reg.PC - 3, dump, nH, nL);
    }

    static inline void LD_IX_NN_(Z80* ctx) { ctx->LD_IX_NN(); }
    inline void LD_IX_NN()
    {
        setIXL(fetch(3));
        setIXH(fetch(3));
        if (isDebug()) log("[%04X] LD IX, $%04X", reg.PC - 4, reg.IX);
    }

    static inline void LD_IY_NN_(Z80* ctx) { ctx->LD_IY_NN(); }
    inline void LD_IY_NN()
    {
        setIYL(fetch(3));
        setIYH(fetch(3));
        if (isDebug()) log("[%04X] LD IY, $%04X", reg.PC - 4, reg.IY);
    }

    // Load Reg. pair rp with location (nn)
    static inline void LD_RP_ADDR_BC(Z80* ctx) { ctx->LD_RP_ADDR(0b00); }
    static inline void LD_RP_ADDR_DE(Z80* ctx) { ctx->LD_RP_ADDR(0b01); }
    static inline void LD_RP_ADDR_HL(Z80* ctx) { ctx->LD_RP_ADDR(0b10); }
    static inline void LD_RP_ADDR_SP(Z80* ctx) { ctx->LD_RP_ADDR(0b11); }
    inline void LD_RP_ADDR(unsigned char rp)
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        unsigned char* rL;
        unsigned char* rH;
        switch (rp) {
            case 0:
                rH = &reg.pair.B;
                rL = &reg.pair.C;
                break;
            case 1:
                rH = &reg.pair.D;
                rL = &reg.pair.E;
                break;
            case 2:
                rH = &reg.pair.H;
                rL = &reg.pair.L;
                break;
            case 3: {
                const char* dump = isDebug() ? registerPairDump(rp) : "";
                setSPL(readByte(addr, 3));
                setSPH(readByte(addr + 1, 3));
                reg.WZ = addr + 1;
                if (isDebug()) log("[%04X] LD %s, ($%04X) = $%04X", reg.PC - 4, dump, addr, reg.SP);
                return;
            }
            default:
                if (isDebug()) log("invalid register pair has specified: $%02X", rp);
#ifndef DISABLE_EXCEPTION
                throw std::runtime_error("invalid register pair has specified");
#endif
                return;
        }
        const char* dump = isDebug() ? registerPairDump(rp) : "";
        *rL = readByte(addr, 3);
        *rH = readByte(addr + 1, 3);
        reg.WZ = addr + 1;
        if (isDebug()) log("[%04X] LD %s, ($%04X) = $%04X", reg.PC - 4, dump, addr, make16BitsFromLE(*rL, *rH));
    }

    // Load location (nn) with Reg. pair rp.
    static inline void LD_ADDR_RP_BC(Z80* ctx) { ctx->LD_ADDR_RP(0b00); }
    static inline void LD_ADDR_RP_DE(Z80* ctx) { ctx->LD_ADDR_RP(0b01); }
    static inline void LD_ADDR_RP_HL(Z80* ctx) { ctx->LD_ADDR_RP(0b10); }
    static inline void LD_ADDR_RP_SP(Z80* ctx) { ctx->LD_ADDR_RP(0b11); }
    inline void LD_ADDR_RP(unsigned char rp)
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        if (isDebug()) log("[%04X] LD ($%04X), %s", reg.PC - 4, addr, registerPairDump(rp));
        switch (rp) {
            case 0b00:
                h = reg.pair.B;
                l = reg.pair.C;
                break;
            case 0b01:
                h = reg.pair.D;
                l = reg.pair.E;
                break;
            case 0b10:
                h = reg.pair.H;
                l = reg.pair.L;
                break;
            case 0b11:
                splitTo8BitsPair(reg.SP, &h, &l);
                break;
            default:
                if (isDebug()) log("invalid register pair has specified: $%02X", rp);
#ifndef DISABLE_EXCEPTION
                throw std::runtime_error("invalid register pair has specified");
#endif
                return;
        }
        writeByte(addr, l, 3);
        writeByte(addr + 1, h, 3);
        reg.WZ = addr + 1;
    }

    // Load IX with location (nn)
    static inline void LD_IX_ADDR_(Z80* ctx) { ctx->LD_IX_ADDR(); }
    inline void LD_IX_ADDR()
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        unsigned short ix = reg.IX;
        setIXL(readByte(addr, 3));
        setIXH(readByte(addr + 1, 3));
        if (isDebug()) log("[%04X] LD IX<$%04X>, ($%04X) = $%04X", reg.PC - 4, ix, addr, reg.IX);
    }

    // Load IY with location (nn)
    static inline void LD_IY_ADDR_(Z80* ctx) { ctx->LD_IY_ADDR(); }
    inline void LD_IY_ADDR()
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        unsigned short iy = reg.IY;
        setIYL(readByte(addr, 3));
        setIYH(readByte(addr + 1, 3));
        if (isDebug()) log("[%04X] LD IY<$%04X>, ($%04X) = $%04X", reg.PC - 4, iy, addr, reg.IY);
    }

    static inline void LD_ADDR_IX_(Z80* ctx) { ctx->LD_ADDR_IX(); }
    inline void LD_ADDR_IX()
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        if (isDebug()) log("[%04X] LD ($%04X), IX<$%04X>", reg.PC - 4, addr, reg.IX);
        writeByte(addr, getIXL(), 3);
        writeByte(addr + 1, getIXH(), 3);
    }

    static inline void LD_ADDR_IY_(Z80* ctx) { ctx->LD_ADDR_IY(); }
    inline void LD_ADDR_IY()
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        if (isDebug()) log("[%04X] LD ($%04X), IY<$%04X>", reg.PC - 4, addr, reg.IY);
        writeByte(addr, getIYL(), 3);
        writeByte(addr + 1, getIYH(), 3);
    }

    // Load SP with IX.
    static inline void LD_SP_IX_(Z80* ctx) { ctx->LD_SP_IX(); }
    inline void LD_SP_IX()
    {
        if (isDebug()) log("[%04X] LD %s, IX<$%04X>", reg.PC - 2, registerPairDump(0b11), reg.IX);
        reg.SP = reg.IX;
        consumeClock(2);
    }

    // Load SP with IY.
    static inline void LD_SP_IY_(Z80* ctx) { ctx->LD_SP_IY(); }
    inline void LD_SP_IY()
    {
        if (isDebug()) log("[%04X] LD %s, IY<$%04X>", reg.PC - 2, registerPairDump(0b11), reg.IY);
        reg.SP = reg.IY;
        consumeClock(2);
    }

    // Load location (DE) with Loacation (HL), increment/decrement DE, HL, decrement BC
    inline void repeatLD(bool isIncDEHL, bool isRepeat)
    {
        if (isDebug()) {
            if (isIncDEHL) {
                if (isDebug()) log("[%04X] %s ... %s, %s, %s", reg.PC - 2, isRepeat ? "LDIR" : "LDI", registerPairDump(0b00), registerPairDump(0b01), registerPairDump(0b10));
            } else {
                if (isDebug()) log("[%04X] %s ... %s, %s, %s", reg.PC - 2, isRepeat ? "LDDR" : "LDD", registerPairDump(0b00), registerPairDump(0b01), registerPairDump(0b10));
            }
        }
        unsigned short bc = getBC();
        unsigned short de = getDE();
        unsigned short hl = getHL();
        unsigned char n = readByte(hl);
        writeByte(de, n);
        if (isIncDEHL) {
            de++;
            hl++;
        } else {
            de--;
            hl--;
        }
        bc--;
        setBC(bc);
        setDE(de);
        setHL(hl);
        setFlagH(false);
        setFlagPV(bc != 0);
        setFlagN(false);
        unsigned char an = reg.pair.A + n;
        setFlagY(an & 0b00000010);
        setFlagX(an & 0b00001000);
        if (isRepeat && 0 != bc) {
            reg.PC -= 2;
            consumeClock(5);
        }
    }
    static inline void LDI(Z80* ctx) { ctx->repeatLD(true, false); }
    static inline void LDIR(Z80* ctx) { ctx->repeatLD(true, true); }
    static inline void LDD(Z80* ctx) { ctx->repeatLD(false, false); }
    static inline void LDDR(Z80* ctx) { ctx->repeatLD(false, true); }
#if R800
    // multiply
    inline void mulub(unsigned char r)
    {
        unsigned short value = static_cast<unsigned short>(reg.pair.A) * static_cast<unsigned short>(getRegister(r));
        if (isDebug()) log("[%04X] MULUB A<$%02X>, %s", reg.PC - 2, reg.pair.A, registerDump(r));
        setHL(value);
        setFlagS(false);
        setFlagPV(false);
        setFlagZ(value == 0);
        setFlagC(value > 0xFF);
        consumeClock(14);
    }
    inline void muluw_bc()
    {
        unsigned int value = static_cast<unsigned int>(getHL()) * static_cast<unsigned int>(getBC());
        if (isDebug()) log("[%04X] MULUW HL<$%04X>, BC<$%04X>", reg.PC - 2, getHL(), getBC());
        setDE(value >> 16);
        setHL(value & 0xFFFF);
        setFlagS(false);
        setFlagPV(false);
        setFlagZ(value == 0);
        setFlagC(value > 0xFFFF);
        consumeClock(36);
    }
    inline void muluw_sp()
    {
        unsigned int value = static_cast<unsigned int>(getHL()) * static_cast<unsigned int>(reg.SP);
        if (isDebug()) log("[%04X] MULUW HL<$%04X>, SP<$%04X>", reg.PC - 2, getHL(), reg.SP);
        setDE(value >> 16);
        setHL(value & 0xFFFF);
        setFlagS(false);
        setFlagPV(false);
        setFlagZ(value == 0);
        setFlagC(value > 0xFFFF);
        consumeClock(36);
    }
    static inline void MULUB_A_B(Z80* ctx) { ctx->mulub(0b000); }
    static inline void MULUB_A_C(Z80* ctx) { ctx->mulub(0b001); }
    static inline void MULUB_A_D(Z80* ctx) { ctx->mulub(0b010); }
    static inline void MULUB_A_E(Z80* ctx) { ctx->mulub(0b011); }
    static inline void MULUW_HL_BC(Z80* ctx) { ctx->muluw_bc(); }
    static inline void MULUW_HL_SP(Z80* ctx) { ctx->muluw_sp(); }
#endif
    // Exchange stack top with IX
    static inline void EX_SP_IX_(Z80* ctx) { ctx->EX_SP_IX(); }
    inline void EX_SP_IX()
    {
        unsigned short sp = reg.SP;
        unsigned char l = pop(4);
        unsigned char h = pop(4);
        if (isDebug()) log("[%04X] EX (SP<$%04X>) = $%02X%02X, IX<$%04X>", reg.PC - 2, sp, h, l, reg.IX);
        push(getIXH(), 4);
        setIXH(h);
        push(getIXL(), 3);
        setIXL(l);
    }

    // Exchange stack top with IY
    static inline void EX_SP_IY_(Z80* ctx) { ctx->EX_SP_IY(); }
    inline void EX_SP_IY()
    {
        unsigned short sp = reg.SP;
        unsigned char l = pop(4);
        unsigned char h = pop(4);
        if (isDebug()) log("[%04X] EX (SP<$%04X>) = $%02X%02X, IY<$%04X>", reg.PC - 2, sp, h, l, reg.IY);
        push(getIYH(), 4);
        setIYH(h);
        push(getIYL(), 3);
        setIYL(l);
    }

    // Push Reg. on Stack.
    static inline void PUSH_BC(Z80* ctx) { ctx->PUSH_RP(0b00); }
    static inline void PUSH_DE(Z80* ctx) { ctx->PUSH_RP(0b01); }
    static inline void PUSH_HL(Z80* ctx) { ctx->PUSH_RP(0b10); }
    inline void PUSH_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] PUSH %s <SP:$%04X>", reg.PC - 1, registerPairDump(rp), reg.SP);
        switch (rp) {
            case 0b00:
                push(reg.pair.B, 4);
                push(reg.pair.C, 3);
                break;
            case 0b01:
                push(reg.pair.D, 4);
                push(reg.pair.E, 3);
                break;
            case 0b10:
                push(reg.pair.H, 4);
                push(reg.pair.L, 3);
                break;
            default:
                if (isDebug()) log("invalid register pair has specified: $%02X", rp);
#ifndef DISABLE_EXCEPTION
                throw std::runtime_error("invalid register pair has specified");
#endif
        }
    }

    // Push Reg. on Stack.
    static inline void POP_BC(Z80* ctx) { ctx->POP_RP(0b00); }
    static inline void POP_DE(Z80* ctx) { ctx->POP_RP(0b01); }
    static inline void POP_HL(Z80* ctx) { ctx->POP_RP(0b10); }
    inline void POP_RP(unsigned char rp)
    {
        unsigned short sp = reg.SP;
        const char* dump = isDebug() ? registerPairDump(rp) : "";
        unsigned short after;
        switch (rp) {
            case 0b00:
                reg.pair.C = pop(3);
                reg.pair.B = pop(3);
                after = getBC();
                break;
            case 0b01:
                reg.pair.E = pop(3);
                reg.pair.D = pop(3);
                after = getDE();
                break;
            case 0b10:
                reg.pair.L = pop(3);
                reg.pair.H = pop(3);
                after = getHL();
                break;
            default:
                if (isDebug()) log("invalid register pair has specified: $%02X", rp);
#ifndef DISABLE_EXCEPTION
                throw std::runtime_error("invalid register pair has specified");
#endif
                return;
        }
        if (isDebug()) log("[%04X] POP %s <SP:$%04X> = $%04X", reg.PC - 1, dump, sp, after);
    }

    // Push Reg. IX on Stack.
    static inline void PUSH_IX_(Z80* ctx) { ctx->PUSH_IX(); }
    inline void PUSH_IX()
    {
        if (isDebug()) log("[%04X] PUSH IX<$%04X> <SP:$%04X>", reg.PC - 2, reg.IX, reg.SP);
        push(getIXH(), 4);
        push(getIXL(), 3);
    }

    // Pop Reg. IX from Stack.
    static inline void POP_IX_(Z80* ctx) { ctx->POP_IX(); }
    inline void POP_IX()
    {
        unsigned short sp = reg.SP;
        setIXL(pop(3));
        setIXH(pop(3));
        if (isDebug()) log("[%04X] POP IX <SP:$%04X> = $%04X", reg.PC - 2, sp, reg.IX);
    }

    // Push Reg. IY on Stack.
    static inline void PUSH_IY_(Z80* ctx) { ctx->PUSH_IY(); }
    inline void PUSH_IY()
    {
        if (isDebug()) log("[%04X] PUSH IY<$%04X> <SP:$%04X>", reg.PC - 2, reg.IY, reg.SP);
        push(getIYH(), 4);
        push(getIYL(), 3);
    }

    // Pop Reg. IY from Stack.
    static inline void POP_IY_(Z80* ctx) { ctx->POP_IY(); }
    inline void POP_IY()
    {
        unsigned short sp = reg.SP;
        setIYL(pop(3));
        setIYH(pop(3));
        if (isDebug()) log("[%04X] POP IY <SP:$%04X> = $%04X", reg.PC - 2, sp, reg.IY);
    }

    inline void setFlagByRotate(unsigned char n, bool carry, bool isA = false)
    {
        setFlagC(carry);
        setFlagH(false);
        setFlagN(false);
        setFlagXY(n);
        if (!isA) {
            setFlagS(n & 0x80);
            setFlagZ(0 == n);
            setFlagPV(isEvenNumberBits(n));
        }
    }

    inline unsigned char SLL(unsigned char n)
    {
        unsigned char c = n & 0x80;
        n &= 0b01111111;
        n <<= 1;
        n |= 1; // differ with SLA
        setFlagByRotate(n, c);
        return n;
    }

    inline unsigned char SLA(unsigned char n)
    {
        unsigned char c = n & 0x80 ? 1 : 0;
        n &= 0b01111111;
        n <<= 1;
        setFlagByRotate(n, c);
        return n;
    }

    inline unsigned char SRL(unsigned char n)
    {
        unsigned char n0 = n & 0x01;
        n &= 0b11111110;
        n >>= 1;
        setFlagByRotate(n, n0);
        return n;
    }

    inline unsigned char SRA(unsigned char n)
    {
        unsigned char n0 = n & 0x01;
        unsigned char n7 = n & 0x80;
        n &= 0b11111110;
        n >>= 1;
        n = n7 ? n | 0x80 : n & 0x7F;
        setFlagByRotate(n, n0);
        return n;
    }

    inline unsigned char RLC(unsigned char n, bool isA = false)
    {
        unsigned char c = n & 0x80 ? 1 : 0;
        n &= 0b01111111;
        n <<= 1;
        n |= c; // differ with RL
        setFlagByRotate(n, c, isA);
        return n;
    }

    inline unsigned char RL(unsigned char n, bool isA = false)
    {
        unsigned char c = n & 0x80 ? 1 : 0;
        n &= 0b01111111;
        n <<= 1;
        n |= isFlagC() ? 1 : 0; // differ with RLC
        setFlagByRotate(n, c, isA);
        return n;
    }

    inline unsigned char RRC(unsigned char n, bool isA = false)
    {
        unsigned char c = n & 1 ? 0x80 : 0;
        n &= 0b11111110;
        n >>= 1;
        n |= c; // differ with RR
        setFlagByRotate(n, c, isA);
        return n;
    }

    inline unsigned char RR(unsigned char n, bool isA = false)
    {
        unsigned char c = n & 1 ? 0x80 : 0;
        n &= 0b11111110;
        n >>= 1;
        n |= isFlagC() ? 0x80 : 0; // differ with RR
        setFlagByRotate(n, c, isA);
        return n;
    }

    static inline void RLCA(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] RLCA <A:$%02X, C:%s>", ctx->reg.PC - 1, ctx->reg.pair.A, ctx->isFlagC() ? "ON" : "OFF");
        ctx->reg.pair.A = ctx->RLC(ctx->reg.pair.A, true);
    }

    static inline void RRCA(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] RRCA <A:$%02X, C:%s>", ctx->reg.PC - 1, ctx->reg.pair.A, ctx->isFlagC() ? "ON" : "OFF");
        ctx->reg.pair.A = ctx->RRC(ctx->reg.pair.A, true);
    }

    static inline void RLA(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] RLA <A:$%02X, C:%s>", ctx->reg.PC - 1, ctx->reg.pair.A, ctx->isFlagC() ? "ON" : "OFF");
        ctx->reg.pair.A = ctx->RL(ctx->reg.pair.A, true);
    }

    static inline void RRA(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] RRA <A:$%02X, C:%s>", ctx->reg.PC - 1, ctx->reg.pair.A, ctx->isFlagC() ? "ON" : "OFF");
        ctx->reg.pair.A = ctx->RR(ctx->reg.pair.A, true);
    }

    // Rotate register Left Circular
    static inline void RLC_B(Z80* ctx) { ctx->RLC_R(0b000); }
    static inline void RLC_C(Z80* ctx) { ctx->RLC_R(0b001); }
    static inline void RLC_D(Z80* ctx) { ctx->RLC_R(0b010); }
    static inline void RLC_E(Z80* ctx) { ctx->RLC_R(0b011); }
    static inline void RLC_H(Z80* ctx) { ctx->RLC_R(0b100); }
    static inline void RLC_L(Z80* ctx) { ctx->RLC_R(0b101); }
    static inline void RLC_A(Z80* ctx) { ctx->RLC_R(0b111); }
    inline void RLC_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] RLC %s", reg.PC - 2, registerDump(r));
        *rp = RLC(*rp);
    }

    // Rotate Left register
    static inline void RL_B(Z80* ctx) { ctx->RL_R(0b000); }
    static inline void RL_C(Z80* ctx) { ctx->RL_R(0b001); }
    static inline void RL_D(Z80* ctx) { ctx->RL_R(0b010); }
    static inline void RL_E(Z80* ctx) { ctx->RL_R(0b011); }
    static inline void RL_H(Z80* ctx) { ctx->RL_R(0b100); }
    static inline void RL_L(Z80* ctx) { ctx->RL_R(0b101); }
    static inline void RL_A(Z80* ctx) { ctx->RL_R(0b111); }
    inline void RL_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] RL %s <C:%s>", reg.PC - 2, registerDump(r), isFlagC() ? "ON" : "OFF");
        *rp = RL(*rp);
    }

    // Shift operand register left Arithmetic
    static inline void SLA_B(Z80* ctx) { ctx->SLA_R(0b000); }
    static inline void SLA_C(Z80* ctx) { ctx->SLA_R(0b001); }
    static inline void SLA_D(Z80* ctx) { ctx->SLA_R(0b010); }
    static inline void SLA_E(Z80* ctx) { ctx->SLA_R(0b011); }
    static inline void SLA_H(Z80* ctx) { ctx->SLA_R(0b100); }
    static inline void SLA_L(Z80* ctx) { ctx->SLA_R(0b101); }
    static inline void SLA_A(Z80* ctx) { ctx->SLA_R(0b111); }
    inline void SLA_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] SLA %s", reg.PC - 2, registerDump(r));
        *rp = SLA(*rp);
    }

    // Rotate register Right Circular
    static inline void RRC_B(Z80* ctx) { ctx->RRC_R(0b000); }
    static inline void RRC_C(Z80* ctx) { ctx->RRC_R(0b001); }
    static inline void RRC_D(Z80* ctx) { ctx->RRC_R(0b010); }
    static inline void RRC_E(Z80* ctx) { ctx->RRC_R(0b011); }
    static inline void RRC_H(Z80* ctx) { ctx->RRC_R(0b100); }
    static inline void RRC_L(Z80* ctx) { ctx->RRC_R(0b101); }
    static inline void RRC_A(Z80* ctx) { ctx->RRC_R(0b111); }
    inline void RRC_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] RRC %s", reg.PC - 2, registerDump(r));
        *rp = RRC(*rp);
    }

    // Rotate Right register
    static inline void RR_B(Z80* ctx) { ctx->RR_R(0b000); }
    static inline void RR_C(Z80* ctx) { ctx->RR_R(0b001); }
    static inline void RR_D(Z80* ctx) { ctx->RR_R(0b010); }
    static inline void RR_E(Z80* ctx) { ctx->RR_R(0b011); }
    static inline void RR_H(Z80* ctx) { ctx->RR_R(0b100); }
    static inline void RR_L(Z80* ctx) { ctx->RR_R(0b101); }
    static inline void RR_A(Z80* ctx) { ctx->RR_R(0b111); }
    inline void RR_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] RR %s <C:%s>", reg.PC - 2, registerDump(r), isFlagC() ? "ON" : "OFF");
        *rp = RR(*rp);
    }

    // Shift operand register Right Arithmetic
    static inline void SRA_B(Z80* ctx) { ctx->SRA_R(0b000); }
    static inline void SRA_C(Z80* ctx) { ctx->SRA_R(0b001); }
    static inline void SRA_D(Z80* ctx) { ctx->SRA_R(0b010); }
    static inline void SRA_E(Z80* ctx) { ctx->SRA_R(0b011); }
    static inline void SRA_H(Z80* ctx) { ctx->SRA_R(0b100); }
    static inline void SRA_L(Z80* ctx) { ctx->SRA_R(0b101); }
    static inline void SRA_A(Z80* ctx) { ctx->SRA_R(0b111); }
    inline void SRA_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] SRA %s", reg.PC - 2, registerDump(r));
        *rp = SRA(*rp);
    }

    // Shift operand register Right Logical
    static inline void SRL_B(Z80* ctx) { ctx->SRL_R(0b000); }
    static inline void SRL_C(Z80* ctx) { ctx->SRL_R(0b001); }
    static inline void SRL_D(Z80* ctx) { ctx->SRL_R(0b010); }
    static inline void SRL_E(Z80* ctx) { ctx->SRL_R(0b011); }
    static inline void SRL_H(Z80* ctx) { ctx->SRL_R(0b100); }
    static inline void SRL_L(Z80* ctx) { ctx->SRL_R(0b101); }
    static inline void SRL_A(Z80* ctx) { ctx->SRL_R(0b111); }
    inline void SRL_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] SRL %s", reg.PC - 2, registerDump(r));
        *rp = SRL(*rp);
    }

    // Shift operand register Left Logical
    static inline void SLL_B(Z80* ctx) { ctx->SLL_R(0b000); }
    static inline void SLL_C(Z80* ctx) { ctx->SLL_R(0b001); }
    static inline void SLL_D(Z80* ctx) { ctx->SLL_R(0b010); }
    static inline void SLL_E(Z80* ctx) { ctx->SLL_R(0b011); }
    static inline void SLL_H(Z80* ctx) { ctx->SLL_R(0b100); }
    static inline void SLL_L(Z80* ctx) { ctx->SLL_R(0b101); }
    static inline void SLL_A(Z80* ctx) { ctx->SLL_R(0b111); }
    inline void SLL_R(unsigned char r)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] SLL %s", reg.PC - 2, registerDump(r));
        *rp = SLL(*rp);
    }

    // Rotate memory (HL) Left Circular
    static inline void RLC_HL_(Z80* ctx) { ctx->RLC_HL(); }
    inline void RLC_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RLC (HL<$%04X>) = $%02X", reg.PC - 2, addr, n);
        writeByte(addr, RLC(n), 3);
    }

    // Rotate Left memory
    static inline void RL_HL_(Z80* ctx) { ctx->RL_HL(); }
    inline void RL_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RL (HL<$%04X>) = $%02X <C:%s>", reg.PC - 2, addr, n, isFlagC() ? "ON" : "OFF");
        writeByte(addr, RL(n), 3);
    }

    // Shift operand location (HL) left Arithmetic
    static inline void SLA_HL_(Z80* ctx) { ctx->SLA_HL(); }
    inline void SLA_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SLA (HL<$%04X>) = $%02X", reg.PC - 2, addr, n);
        writeByte(addr, SLA(n), 3);
    }

    // Rotate memory (HL) Right Circular
    static inline void RRC_HL_(Z80* ctx) { ctx->RRC_HL(); }
    inline void RRC_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RRC (HL<$%04X>) = $%02X", reg.PC - 2, addr, n);
        writeByte(addr, RRC(n), 3);
    }

    // Rotate Right memory
    static inline void RR_HL_(Z80* ctx) { ctx->RR_HL(); }
    inline void RR_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RR (HL<$%04X>) = $%02X <C:%s>", reg.PC - 2, addr, n, isFlagC() ? "ON" : "OFF");
        writeByte(addr, RR(n), 3);
    }

    // Shift operand location (HL) Right Arithmetic
    static inline void SRA_HL_(Z80* ctx) { ctx->SRA_HL(); }
    inline void SRA_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SRA (HL<$%04X>) = $%02X", reg.PC - 2, addr, n);
        writeByte(addr, SRA(n), 3);
    }

    // Shift operand location (HL) Right Logical
    static inline void SRL_HL_(Z80* ctx) { ctx->SRL_HL(); }
    inline void SRL_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SRL (HL<$%04X>) = $%02X", reg.PC - 2, addr, n);
        writeByte(addr, SRL(n), 3);
    }

    // Shift operand location (HL) Left Logical
    static inline void SLL_HL_(Z80* ctx) { ctx->SLL_HL(); }
    inline void SLL_HL()
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SLL (HL<$%04X>) = $%02X", reg.PC - 2, addr, n);
        writeByte(addr, SLL(n), 3);
    }

    // Rotate memory (IX+d) Left Circular
    static inline void RLC_IX_(Z80* ctx, signed char d) { ctx->RLC_IX(d); }
    inline void RLC_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RLC (IX+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = RLC(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate memory (IX+d) Left Circular with load to Reg A/B/C/D/E/H/L/F
    static inline void RLC_IX_with_LD_B(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b000); }
    static inline void RLC_IX_with_LD_C(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b001); }
    static inline void RLC_IX_with_LD_D(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b010); }
    static inline void RLC_IX_with_LD_E(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b011); }
    static inline void RLC_IX_with_LD_H(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b100); }
    static inline void RLC_IX_with_LD_L(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b101); }
    static inline void RLC_IX_with_LD_A(Z80* ctx, signed char d) { ctx->RLC_IX_with_LD(d, 0b111); }
    inline void RLC_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RLC_IX(d, rp, buf);
    }

    // Rotate memory (IY+d) Left Circular with load to Reg A/B/C/D/E/H/L/F
    static inline void RLC_IY_with_LD_B(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b000); }
    static inline void RLC_IY_with_LD_C(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b001); }
    static inline void RLC_IY_with_LD_D(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b010); }
    static inline void RLC_IY_with_LD_E(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b011); }
    static inline void RLC_IY_with_LD_H(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b100); }
    static inline void RLC_IY_with_LD_L(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b101); }
    static inline void RLC_IY_with_LD_A(Z80* ctx, signed char d) { ctx->RLC_IY_with_LD(d, 0b111); }
    inline void RLC_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RLC_IY(d, rp, buf);
    }

    // Rotate memory (IX+d) Right Circular
    static inline void RRC_IX_(Z80* ctx, signed char d) { ctx->RRC_IX(d); }
    inline void RRC_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RRC (IX+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = RRC(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate memory (IX+d) Right Circular with load to Reg A/B/C/D/E/H/L/F
    static inline void RRC_IX_with_LD_B(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b000); }
    static inline void RRC_IX_with_LD_C(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b001); }
    static inline void RRC_IX_with_LD_D(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b010); }
    static inline void RRC_IX_with_LD_E(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b011); }
    static inline void RRC_IX_with_LD_H(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b100); }
    static inline void RRC_IX_with_LD_L(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b101); }
    static inline void RRC_IX_with_LD_A(Z80* ctx, signed char d) { ctx->RRC_IX_with_LD(d, 0b111); }
    inline void RRC_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RRC_IX(d, rp, buf);
    }

    // Rotate memory (IY+d) Right Circular with load to Reg A/B/C/D/E/H/L/F
    static inline void RRC_IY_with_LD_B(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b000); }
    static inline void RRC_IY_with_LD_C(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b001); }
    static inline void RRC_IY_with_LD_D(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b010); }
    static inline void RRC_IY_with_LD_E(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b011); }
    static inline void RRC_IY_with_LD_H(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b100); }
    static inline void RRC_IY_with_LD_L(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b101); }
    static inline void RRC_IY_with_LD_A(Z80* ctx, signed char d) { ctx->RRC_IY_with_LD(d, 0b111); }
    inline void RRC_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RRC_IY(d, rp, buf);
    }

    // Rotate Left memory
    static inline void RL_IX_(Z80* ctx, signed char d) { ctx->RL_IX(d); }
    inline void RL_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RL (IX+d<$%04X>) = $%02X <C:%s>%s", reg.PC - 4, addr, n, isFlagC() ? "ON" : "OFF", extraLog ? extraLog : "");
        unsigned char result = RL(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate Left memory with load Reg.
    static inline void RL_IX_with_LD_B(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b000); }
    static inline void RL_IX_with_LD_C(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b001); }
    static inline void RL_IX_with_LD_D(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b010); }
    static inline void RL_IX_with_LD_E(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b011); }
    static inline void RL_IX_with_LD_H(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b100); }
    static inline void RL_IX_with_LD_L(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b101); }
    static inline void RL_IX_with_LD_A(Z80* ctx, signed char d) { ctx->RL_IX_with_LD(d, 0b111); }
    inline void RL_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RL_IX(d, rp, buf);
    }

    // Rotate Left memory with load Reg.
    static inline void RL_IY_with_LD_B(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b000); }
    static inline void RL_IY_with_LD_C(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b001); }
    static inline void RL_IY_with_LD_D(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b010); }
    static inline void RL_IY_with_LD_E(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b011); }
    static inline void RL_IY_with_LD_H(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b100); }
    static inline void RL_IY_with_LD_L(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b101); }
    static inline void RL_IY_with_LD_A(Z80* ctx, signed char d) { ctx->RL_IY_with_LD(d, 0b111); }
    inline void RL_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RL_IY(d, rp, buf);
    }

    // Rotate Right memory
    static inline void RR_IX_(Z80* ctx, signed char d) { ctx->RR_IX(d); }
    inline void RR_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RR (IX+d<$%04X>) = $%02X <C:%s>%s", reg.PC - 4, addr, n, isFlagC() ? "ON" : "OFF", extraLog ? extraLog : "");
        unsigned char result = RR(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate Right memory with load Reg.
    static inline void RR_IX_with_LD_B(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b000); }
    static inline void RR_IX_with_LD_C(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b001); }
    static inline void RR_IX_with_LD_D(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b010); }
    static inline void RR_IX_with_LD_E(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b011); }
    static inline void RR_IX_with_LD_H(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b100); }
    static inline void RR_IX_with_LD_L(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b101); }
    static inline void RR_IX_with_LD_A(Z80* ctx, signed char d) { ctx->RR_IX_with_LD(d, 0b111); }
    inline void RR_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RR_IX(d, rp, buf);
    }

    // Rotate Right memory with load Reg.
    static inline void RR_IY_with_LD_B(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b000); }
    static inline void RR_IY_with_LD_C(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b001); }
    static inline void RR_IY_with_LD_D(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b010); }
    static inline void RR_IY_with_LD_E(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b011); }
    static inline void RR_IY_with_LD_H(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b100); }
    static inline void RR_IY_with_LD_L(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b101); }
    static inline void RR_IY_with_LD_A(Z80* ctx, signed char d) { ctx->RR_IY_with_LD(d, 0b111); }
    inline void RR_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RR_IY(d, rp, buf);
    }

    // Shift operand location (IX+d) left Arithmetic
    static inline void SLA_IX_(Z80* ctx, signed char d) { ctx->SLA_IX(d); }
    inline void SLA_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SLA (IX+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SLA(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Shift operand location (IX+d) left Arithmetic with load Reg.
    static inline void SLA_IX_with_LD_B(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b000); }
    static inline void SLA_IX_with_LD_C(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b001); }
    static inline void SLA_IX_with_LD_D(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b010); }
    static inline void SLA_IX_with_LD_E(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b011); }
    static inline void SLA_IX_with_LD_H(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b100); }
    static inline void SLA_IX_with_LD_L(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b101); }
    static inline void SLA_IX_with_LD_A(Z80* ctx, signed char d) { ctx->SLA_IX_with_LD(d, 0b111); }
    inline void SLA_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SLA_IX(d, rp, buf);
    }

    // Shift operand location (IY+d) left Arithmetic with load Reg.
    static inline void SLA_IY_with_LD_B(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b000); }
    static inline void SLA_IY_with_LD_C(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b001); }
    static inline void SLA_IY_with_LD_D(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b010); }
    static inline void SLA_IY_with_LD_E(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b011); }
    static inline void SLA_IY_with_LD_H(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b100); }
    static inline void SLA_IY_with_LD_L(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b101); }
    static inline void SLA_IY_with_LD_A(Z80* ctx, signed char d) { ctx->SLA_IY_with_LD(d, 0b111); }
    inline void SLA_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SLA_IY(d, rp, buf);
    }

    // Shift operand location (IX+d) Right Arithmetic
    static inline void SRA_IX_(Z80* ctx, signed char d) { ctx->SRA_IX(d); }
    inline void SRA_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SRA (IX+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SRA(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Shift operand location (IX+d) right Arithmetic with load Reg.
    static inline void SRA_IX_with_LD_B(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b000); }
    static inline void SRA_IX_with_LD_C(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b001); }
    static inline void SRA_IX_with_LD_D(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b010); }
    static inline void SRA_IX_with_LD_E(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b011); }
    static inline void SRA_IX_with_LD_H(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b100); }
    static inline void SRA_IX_with_LD_L(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b101); }
    static inline void SRA_IX_with_LD_A(Z80* ctx, signed char d) { ctx->SRA_IX_with_LD(d, 0b111); }
    inline void SRA_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SRA_IX(d, rp, buf);
    }

    // Shift operand location (IY+d) right Arithmetic with load Reg.
    static inline void SRA_IY_with_LD_B(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b000); }
    static inline void SRA_IY_with_LD_C(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b001); }
    static inline void SRA_IY_with_LD_D(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b010); }
    static inline void SRA_IY_with_LD_E(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b011); }
    static inline void SRA_IY_with_LD_H(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b100); }
    static inline void SRA_IY_with_LD_L(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b101); }
    static inline void SRA_IY_with_LD_A(Z80* ctx, signed char d) { ctx->SRA_IY_with_LD(d, 0b111); }
    inline void SRA_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SRA_IY(d, rp, buf);
    }

    // Shift operand location (IX+d) Right Logical
    static inline void SRL_IX_(Z80* ctx, signed char d) { ctx->SRL_IX(d); }
    inline void SRL_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SRL (IX+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SRL(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Shift operand location (IX+d) Right Logical with load Reg.
    static inline void SRL_IX_with_LD_B(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b000); }
    static inline void SRL_IX_with_LD_C(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b001); }
    static inline void SRL_IX_with_LD_D(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b010); }
    static inline void SRL_IX_with_LD_E(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b011); }
    static inline void SRL_IX_with_LD_H(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b100); }
    static inline void SRL_IX_with_LD_L(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b101); }
    static inline void SRL_IX_with_LD_A(Z80* ctx, signed char d) { ctx->SRL_IX_with_LD(d, 0b111); }
    inline void SRL_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SRL_IX(d, rp, buf);
    }

    // Shift operand location (IY+d) Right Logical with load Reg.
    static inline void SRL_IY_with_LD_B(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b000); }
    static inline void SRL_IY_with_LD_C(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b001); }
    static inline void SRL_IY_with_LD_D(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b010); }
    static inline void SRL_IY_with_LD_E(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b011); }
    static inline void SRL_IY_with_LD_H(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b100); }
    static inline void SRL_IY_with_LD_L(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b101); }
    static inline void SRL_IY_with_LD_A(Z80* ctx, signed char d) { ctx->SRL_IY_with_LD(d, 0b111); }
    inline void SRL_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SRL_IY(d, rp, buf);
    }

    // Shift operand location (IX+d) Left Logical
    // NOTE: this function is only for SLL_IX_with_LD
    static inline void SLL_IX_(Z80* ctx, signed char d) { ctx->SLL_IX(d); }
    inline void SLL_IX(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SLL (IX+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SLL(n);
        writeByte(addr, result, 3);
        if (rp) *rp = result;
    }

    // Shift operand location (IX+d) Left Logical with load Reg.
    static inline void SLL_IX_with_LD_B(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b000); }
    static inline void SLL_IX_with_LD_C(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b001); }
    static inline void SLL_IX_with_LD_D(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b010); }
    static inline void SLL_IX_with_LD_E(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b011); }
    static inline void SLL_IX_with_LD_H(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b100); }
    static inline void SLL_IX_with_LD_L(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b101); }
    static inline void SLL_IX_with_LD_A(Z80* ctx, signed char d) { ctx->SLL_IX_with_LD(d, 0b111); }
    inline void SLL_IX_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SLL_IX(d, rp, buf);
    }

    // Shift operand location (IY+d) Left Logical
    // NOTE: this function is only for SLL_IY_with_LD
    static inline void SLL_IY_(Z80* ctx, signed char d) { ctx->SLL_IY(d); }
    inline void SLL_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SLL (IY+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SLL(n);
        writeByte(addr, result, 3);
        if (rp) *rp = result;
    }

    // Shift operand location (IY+d) Left Logical with load Reg.
    static inline void SLL_IY_with_LD_B(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b000); }
    static inline void SLL_IY_with_LD_C(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b001); }
    static inline void SLL_IY_with_LD_D(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b010); }
    static inline void SLL_IY_with_LD_E(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b011); }
    static inline void SLL_IY_with_LD_H(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b100); }
    static inline void SLL_IY_with_LD_L(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b101); }
    static inline void SLL_IY_with_LD_A(Z80* ctx, signed char d) { ctx->SLL_IY_with_LD(d, 0b111); }
    inline void SLL_IY_with_LD(signed char d, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SLL_IY(d, rp, buf);
    }

    // Rotate memory (IY+d) Left Circular
    static inline void RLC_IY_(Z80* ctx, signed char d) { ctx->RLC_IY(d); }
    inline void RLC_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RLC (IY+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = RLC(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate memory (IY+d) Right Circular
    static inline void RRC_IY_(Z80* ctx, signed char d) { ctx->RRC_IY(d); }
    inline void RRC_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RRC (IY+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = RRC(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate Left memory
    static inline void RL_IY_(Z80* ctx, signed char d) { ctx->RL_IY(d); }
    inline void RL_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RL (IY+d<$%04X>) = $%02X <C:%s>%s", reg.PC - 4, addr, n, isFlagC() ? "ON" : "OFF", extraLog ? extraLog : "");
        unsigned char result = RL(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Shift operand location (IY+d) left Arithmetic
    static inline void SLA_IY_(Z80* ctx, signed char d) { ctx->SLA_IY(d); }
    inline void SLA_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SLA (IY+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SLA(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Rotate Right memory
    static inline void RR_IY_(Z80* ctx, signed char d) { ctx->RR_IY(d); }
    inline void RR_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RR (IY+d<$%04X>) = $%02X <C:%s>%s", reg.PC - 4, addr, n, isFlagC() ? "ON" : "OFF", extraLog ? extraLog : "");
        unsigned char result = RR(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Shift operand location (IY+d) Right Arithmetic
    static inline void SRA_IY_(Z80* ctx, signed char d) { ctx->SRA_IY(d); }
    inline void SRA_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SRA (IY+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SRA(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    // Shift operand location (IY+d) Right Logical
    static inline void SRL_IY_(Z80* ctx, signed char d) { ctx->SRL_IY(d); }
    inline void SRL_IY(signed char d, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SRL (IY+d<$%04X>) = $%02X%s", reg.PC - 4, addr, n, extraLog ? extraLog : "");
        unsigned char result = SRL(n);
        if (rp) *rp = result;
        writeByte(addr, result, 3);
    }

    inline void addition8(int addition, int carry) { arithmetic8(false, addition, carry, true, true); }
    inline void subtract8(int subtract, int carry, bool setCarry = true, bool setResult = true) { arithmetic8(true, subtract, carry, setCarry, setResult); }
    inline void arithmetic8(bool negative, int addition, int carry, bool setCarry, bool setResult)
    {
        int before = reg.pair.A;
        int result = before + (negative ? -addition - carry : addition + carry);
        int carryX = before ^ addition ^ result;
        unsigned char finalResult = result & 0xFF;
        setFlagZ(0 == finalResult);
        setFlagN(negative);
        setFlagS(0x80 & finalResult);
        setFlagH(carryX & 0x10);
        setFlagPV(((carryX << 1) ^ carryX) & 0x100);
        if (setCarry) setFlagC(carryX & 0x100);
        if (setResult) {
            reg.pair.A = finalResult;
            setFlagXY(reg.pair.A);
        } else {
            setFlagXY(addition);
        }
    }

    inline void setFlagByIncrement(unsigned char before)
    {
        unsigned char finalResult = before + 1;
        setFlagN(false);
        setFlagZ(0 == finalResult);
        setFlagS(0x80 & finalResult);
        setFlagH((finalResult & 0x0F) == 0x00);
        setFlagPV(finalResult == 0x80);
        setFlagXY(finalResult);
    }

    inline void setFlagByDecrement(unsigned char before)
    {
        unsigned char finalResult = before - 1;
        setFlagN(true);
        setFlagZ(0 == finalResult);
        setFlagS(0x80 & finalResult);
        setFlagH((finalResult & 0x0F) == 0x0F);
        setFlagPV(finalResult == 0x7F);
        setFlagXY(finalResult);
    }

    // Add Reg. r to Acc.
    static inline void ADD_B(Z80* ctx) { ctx->ADD_R(0b000); }
    static inline void ADD_C(Z80* ctx) { ctx->ADD_R(0b001); }
    static inline void ADD_D(Z80* ctx) { ctx->ADD_R(0b010); }
    static inline void ADD_E(Z80* ctx) { ctx->ADD_R(0b011); }
    static inline void ADD_H(Z80* ctx) { ctx->ADD_R(0b100); }
    static inline void ADD_L(Z80* ctx) { ctx->ADD_R(0b101); }
    static inline void ADD_A(Z80* ctx) { ctx->ADD_R(0b111); }
    static inline void ADD_B_2(Z80* ctx) { ctx->ADD_R(0b000, 2); }
    static inline void ADD_C_2(Z80* ctx) { ctx->ADD_R(0b001, 2); }
    static inline void ADD_D_2(Z80* ctx) { ctx->ADD_R(0b010, 2); }
    static inline void ADD_E_2(Z80* ctx) { ctx->ADD_R(0b011, 2); }
    static inline void ADD_A_2(Z80* ctx) { ctx->ADD_R(0b111, 2); }
    inline void ADD_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] ADD %s, %s", reg.PC - pc, registerDump(0b111), registerDump(r));
        unsigned char* rp = getRegisterPointer(r);
        addition8(*rp, 0);
    }

    // Add IXH to Acc.
    static inline void ADD_IXH_(Z80* ctx) { ctx->ADD_IXH(); }
    inline void ADD_IXH()
    {
        if (isDebug()) log("[%04X] ADD %s, IXH<$%02X>", reg.PC - 2, registerDump(0b111), getIXH());
        addition8(getIXH(), 0);
    }

    // Add IXL to Acc.
    static inline void ADD_IXL_(Z80* ctx) { ctx->ADD_IXL(); }
    inline void ADD_IXL()
    {
        if (isDebug()) log("[%04X] ADD %s, IXL<$%02X>", reg.PC - 2, registerDump(0b111), getIXL());
        addition8(getIXL(), 0);
    }

    // Add IYH to Acc.
    static inline void ADD_IYH_(Z80* ctx) { ctx->ADD_IYH(); }
    inline void ADD_IYH()
    {
        if (isDebug()) log("[%04X] ADD %s, IYH<$%02X>", reg.PC - 2, registerDump(0b111), getIYH());
        addition8(getIYH(), 0);
    }

    // Add IYL to Acc.
    static inline void ADD_IYL_(Z80* ctx) { ctx->ADD_IYL(); }
    inline void ADD_IYL()
    {
        if (isDebug()) log("[%04X] ADD %s, IYL<$%02X>", reg.PC - 2, registerDump(0b111), getIYL());
        addition8(getIYL(), 0);
    }

    // Add value n to Acc.
    static inline void ADD_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] ADD %s, $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n);
        ctx->addition8(n, 0);
    }

    // Add location (HL) to Acc.
    static inline void ADD_HL(Z80* ctx)
    {
        unsigned short addr = ctx->getHL();
        unsigned char n = ctx->readByte(addr, 3);
        if (ctx->isDebug()) ctx->log("[%04X] ADD %s, (%s) = $%02X", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), n);
        ctx->addition8(n, 0);
    }

    // Add location (IX+d) to Acc.
    static inline void ADD_IX_(Z80* ctx) { ctx->ADD_IX(); }
    inline void ADD_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] ADD %s, (IX+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), addr, n);
        addition8(n, 0);
        consumeClock(3);
    }

    // Add location (IY+d) to Acc.
    static inline void ADD_IY_(Z80* ctx) { ctx->ADD_IY(); }
    inline void ADD_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] ADD %s, (IY+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), addr, n);
        addition8(n, 0);
        consumeClock(3);
    }

    // Add Resister with carry
    static inline void ADC_B(Z80* ctx) { ctx->ADC_R(0b000); }
    static inline void ADC_C(Z80* ctx) { ctx->ADC_R(0b001); }
    static inline void ADC_D(Z80* ctx) { ctx->ADC_R(0b010); }
    static inline void ADC_E(Z80* ctx) { ctx->ADC_R(0b011); }
    static inline void ADC_H(Z80* ctx) { ctx->ADC_R(0b100); }
    static inline void ADC_L(Z80* ctx) { ctx->ADC_R(0b101); }
    static inline void ADC_A(Z80* ctx) { ctx->ADC_R(0b111); }
    static inline void ADC_B_2(Z80* ctx) { ctx->ADC_R(0b000, 2); }
    static inline void ADC_C_2(Z80* ctx) { ctx->ADC_R(0b001, 2); }
    static inline void ADC_D_2(Z80* ctx) { ctx->ADC_R(0b010, 2); }
    static inline void ADC_E_2(Z80* ctx) { ctx->ADC_R(0b011, 2); }
    static inline void ADC_A_2(Z80* ctx) { ctx->ADC_R(0b111, 2); }
    inline void ADC_R(unsigned char r, int pc = 1)
    {
        unsigned char* rp = getRegisterPointer(r);
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, %s <C:%s>", reg.PC - pc, registerDump(0b111), registerDump(r), c ? "ON" : "OFF");
        addition8(*rp, c);
    }

    // Add IXH to Acc.
    static inline void ADC_IXH_(Z80* ctx) { ctx->ADC_IXH(); }
    inline void ADC_IXH()
    {
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, IXH<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIXH(), c ? "ON" : "OFF");
        addition8(getIXH(), c);
    }

    // Add IXL to Acc.
    static inline void ADC_IXL_(Z80* ctx) { ctx->ADC_IXL(); }
    inline void ADC_IXL()
    {
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, IXL<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIXL(), c ? "ON" : "OFF");
        addition8(getIXL(), c);
    }

    // Add IYH to Acc.
    static inline void ADC_IYH_(Z80* ctx) { ctx->ADC_IYH(); }
    inline void ADC_IYH()
    {
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, IYH<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIYH(), c ? "ON" : "OFF");
        addition8(getIYH(), c);
    }

    // Add IYL to Acc.
    static inline void ADC_IYL_(Z80* ctx) { ctx->ADC_IYL(); }
    inline void ADC_IYL()
    {
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, IYL<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIYL(), c ? "ON" : "OFF");
        addition8(getIYL(), c);
    }

    // Add immediate with carry
    static inline void ADC_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        unsigned char c = ctx->isFlagC() ? 1 : 0;
        if (ctx->isDebug()) ctx->log("[%04X] ADC %s, $%02X <C:%s>", ctx->reg.PC - 2, ctx->registerDump(0b111), n, c ? "ON" : "OFF");
        ctx->addition8(n, c);
    }

    // Add memory with carry
    static inline void ADC_HL(Z80* ctx)
    {
        unsigned short addr = ctx->getHL();
        unsigned char n = ctx->readByte(addr, 3);
        unsigned char c = ctx->isFlagC() ? 1 : 0;
        if (ctx->isDebug()) ctx->log("[%04X] ADC %s, (%s) = $%02X <C:%s>", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), n, c ? "ON" : "OFF");
        ctx->addition8(n, c);
    }

    // Add memory with carry
    static inline void ADC_IX_(Z80* ctx) { ctx->ADC_IX(); }
    inline void ADC_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, (IX+d<$%04X>) = $%02X <C:%s>", reg.PC - 3, registerDump(0b111), addr, n, c ? "ON" : "OFF");
        addition8(n, c);
        consumeClock(3);
    }

    // Add memory with carry
    static inline void ADC_IY_(Z80* ctx) { ctx->ADC_IY(); }
    inline void ADC_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        unsigned char c = isFlagC() ? 1 : 0;
        if (isDebug()) log("[%04X] ADC %s, (IY+d<$%04X>) = $%02X <C:%s>", reg.PC - 3, registerDump(0b111), addr, n, c ? "ON" : "OFF");
        addition8(n, c);
        consumeClock(3);
    }

    // Increment Register
    static inline void INC_B(Z80* ctx) { ctx->INC_R(0b000); }
    static inline void INC_C(Z80* ctx) { ctx->INC_R(0b001); }
    static inline void INC_D(Z80* ctx) { ctx->INC_R(0b010); }
    static inline void INC_E(Z80* ctx) { ctx->INC_R(0b011); }
    static inline void INC_H(Z80* ctx) { ctx->INC_R(0b100); }
    static inline void INC_L(Z80* ctx) { ctx->INC_R(0b101); }
    static inline void INC_A(Z80* ctx) { ctx->INC_R(0b111); }
    static inline void INC_B_2(Z80* ctx) { ctx->INC_R(0b000, 2); }
    static inline void INC_C_2(Z80* ctx) { ctx->INC_R(0b001, 2); }
    static inline void INC_D_2(Z80* ctx) { ctx->INC_R(0b010, 2); }
    static inline void INC_E_2(Z80* ctx) { ctx->INC_R(0b011, 2); }
    static inline void INC_A_2(Z80* ctx) { ctx->INC_R(0b111, 2); }
    inline void INC_R(unsigned char r, int pc = 1)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] INC %s", reg.PC - pc, registerDump(r));
        setFlagByIncrement(*rp);
        (*rp)++;
    }

    // Increment location (HL)
    static inline void INC_HL(Z80* ctx)
    {
        unsigned short addr = ctx->getHL();
        unsigned char n = ctx->readByte(addr);
        if (ctx->isDebug()) ctx->log("[%04X] INC (%s) = $%02X", ctx->reg.PC - 1, ctx->registerPairDump(0b10), n);
        ctx->setFlagByIncrement(n);
        ctx->writeByte(addr, n + 1, 3);
    }

    // Increment location (IX+d)
    static inline void INC_IX_(Z80* ctx) { ctx->INC_IX(); }
    inline void INC_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] INC (IX+d<$%04X>) = $%02X", reg.PC - 3, addr, n);
        setFlagByIncrement(n);
        writeByte(addr, n + 1);
        consumeClock(3);
    }

    // Increment register high 8 bits of IX
    static inline void INC_IXH_(Z80* ctx) { ctx->INC_IXH(); }
    inline void INC_IXH()
    {
        unsigned char ixh = getIXH();
        if (isDebug()) log("[%04X] INC IXH<$%02X>", reg.PC - 2, ixh);
        setFlagByIncrement(ixh++);
        setIXH(ixh);
    }

    // Increment register low 8 bits of IX
    static inline void INC_IXL_(Z80* ctx) { ctx->INC_IXL(); }
    inline void INC_IXL()
    {
        unsigned char ixl = getIXL();
        if (isDebug()) log("[%04X] INC IXL<$%02X>", reg.PC - 2, ixl);
        setFlagByIncrement(ixl++);
        setIXL(ixl);
    }

    // Increment location (IY+d)
    static inline void INC_IY_(Z80* ctx) { ctx->INC_IY(); }
    inline void INC_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] INC (IY+d<$%04X>) = $%02X", reg.PC - 3, addr, n);
        setFlagByIncrement(n);
        writeByte(addr, n + 1);
        consumeClock(3);
    }

    // Increment register high 8 bits of IY
    static inline void INC_IYH_(Z80* ctx) { ctx->INC_IYH(); }
    inline void INC_IYH()
    {
        unsigned char iyh = getIYH();
        if (isDebug()) log("[%04X] INC IYH<$%02X>", reg.PC - 2, iyh);
        setFlagByIncrement(iyh++);
        setIYH(iyh);
    }

    // Increment register low 8 bits of IY
    static inline void INC_IYL_(Z80* ctx) { ctx->INC_IYL(); }
    inline void INC_IYL()
    {
        unsigned char iyl = getIYL();
        if (isDebug()) log("[%04X] INC IYL<$%02X>", reg.PC - 2, iyl);
        setFlagByIncrement(iyl++);
        setIYL(iyl);
    }

    // Subtract Register
    static inline void SUB_B(Z80* ctx) { ctx->SUB_R(0b000); }
    static inline void SUB_C(Z80* ctx) { ctx->SUB_R(0b001); }
    static inline void SUB_D(Z80* ctx) { ctx->SUB_R(0b010); }
    static inline void SUB_E(Z80* ctx) { ctx->SUB_R(0b011); }
    static inline void SUB_H(Z80* ctx) { ctx->SUB_R(0b100); }
    static inline void SUB_L(Z80* ctx) { ctx->SUB_R(0b101); }
    static inline void SUB_A(Z80* ctx) { ctx->SUB_R(0b111); }
    static inline void SUB_B_2(Z80* ctx) { ctx->SUB_R(0b000, 2); }
    static inline void SUB_C_2(Z80* ctx) { ctx->SUB_R(0b001, 2); }
    static inline void SUB_D_2(Z80* ctx) { ctx->SUB_R(0b010, 2); }
    static inline void SUB_E_2(Z80* ctx) { ctx->SUB_R(0b011, 2); }
    static inline void SUB_A_2(Z80* ctx) { ctx->SUB_R(0b111, 2); }
    inline void SUB_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] SUB %s, %s", reg.PC - pc, registerDump(0b111), registerDump(r));
        unsigned char* rp = getRegisterPointer(r);
        subtract8(*rp, 0);
    }

    // Subtract IXH to Acc.
    static inline void SUB_IXH_(Z80* ctx) { ctx->SUB_IXH(); }
    inline void SUB_IXH()
    {
        if (isDebug()) log("[%04X] SUB %s, IXH<$%02X>", reg.PC - 2, registerDump(0b111), getIXH());
        subtract8(getIXH(), 0);
    }

    // Subtract IXL to Acc.
    static inline void SUB_IXL_(Z80* ctx) { ctx->SUB_IXL(); }
    inline void SUB_IXL()
    {
        if (isDebug()) log("[%04X] SUB %s, IXL<$%02X>", reg.PC - 2, registerDump(0b111), getIXL());
        subtract8(getIXL(), 0);
    }

    // Subtract IYH to Acc.
    static inline void SUB_IYH_(Z80* ctx) { ctx->SUB_IYH(); }
    inline void SUB_IYH()
    {
        if (isDebug()) log("[%04X] SUB %s, IYH<$%02X>", reg.PC - 2, registerDump(0b111), getIYH());
        subtract8(getIYH(), 0);
    }

    // Subtract IYL to Acc.
    static inline void SUB_IYL_(Z80* ctx) { ctx->SUB_IYL(); }
    inline void SUB_IYL()
    {
        if (isDebug()) log("[%04X] SUB %s, IYL<$%02X>", reg.PC - 2, registerDump(0b111), getIYL());
        subtract8(getIYL(), 0);
    }

    // Subtract immediate
    static inline void SUB_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] SUB %s, $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n);
        ctx->subtract8(n, 0);
    }

    // Subtract memory
    static inline void SUB_HL(Z80* ctx)
    {
        unsigned short addr = ctx->getHL();
        unsigned char n = ctx->readByte(addr, 3);
        if (ctx->isDebug()) ctx->log("[%04X] SUB %s, (%s) = $%02X", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), n);
        ctx->subtract8(n, 0);
    }

    // Subtract memory
    static inline void SUB_IX_(Z80* ctx) { ctx->SUB_IX(); }
    inline void SUB_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SUB %s, (IX+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), addr, n);
        subtract8(n, 0);
        consumeClock(3);
    }

    // Subtract memory
    static inline void SUB_IY_(Z80* ctx) { ctx->SUB_IY(); }
    inline void SUB_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SUB %s, (IY+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), addr, n);
        subtract8(n, 0);
        consumeClock(3);
    }

    // Subtract Resister with carry
    static inline void SBC_B(Z80* ctx) { ctx->SBC_R(0b000); }
    static inline void SBC_C(Z80* ctx) { ctx->SBC_R(0b001); }
    static inline void SBC_D(Z80* ctx) { ctx->SBC_R(0b010); }
    static inline void SBC_E(Z80* ctx) { ctx->SBC_R(0b011); }
    static inline void SBC_H(Z80* ctx) { ctx->SBC_R(0b100); }
    static inline void SBC_L(Z80* ctx) { ctx->SBC_R(0b101); }
    static inline void SBC_A(Z80* ctx) { ctx->SBC_R(0b111); }
    static inline void SBC_B_2(Z80* ctx) { ctx->SBC_R(0b000, 2); }
    static inline void SBC_C_2(Z80* ctx) { ctx->SBC_R(0b001, 2); }
    static inline void SBC_D_2(Z80* ctx) { ctx->SBC_R(0b010, 2); }
    static inline void SBC_E_2(Z80* ctx) { ctx->SBC_R(0b011, 2); }
    static inline void SBC_A_2(Z80* ctx) { ctx->SBC_R(0b111, 2); }
    inline void SBC_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] SBC %s, %s <C:%s>", reg.PC - pc, registerDump(0b111), registerDump(r), isFlagC() ? "ON" : "OFF");
        subtract8(getRegister(r), isFlagC() ? 1 : 0);
    }

    // Subtract IXH to Acc. with carry
    static inline void SBC_IXH_(Z80* ctx) { ctx->SBC_IXH(); }
    inline void SBC_IXH()
    {
        if (isDebug()) log("[%04X] SBC %s, IXH<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIXH(), isFlagC() ? "ON" : "OFF");
        subtract8(getIXH(), isFlagC() ? 1 : 0);
    }

    // Subtract IXL to Acc. with carry
    static inline void SBC_IXL_(Z80* ctx) { ctx->SBC_IXL(); }
    inline void SBC_IXL()
    {
        if (isDebug()) log("[%04X] SBC %s, IXL<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIXL(), isFlagC() ? "ON" : "OFF");
        subtract8(getIXL(), isFlagC() ? 1 : 0);
    }

    // Subtract IYH to Acc. with carry
    static inline void SBC_IYH_(Z80* ctx) { ctx->SBC_IYH(); }
    inline void SBC_IYH()
    {
        if (isDebug()) log("[%04X] SBC %s, IYH<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIYH(), isFlagC() ? "ON" : "OFF");
        subtract8(getIYH(), isFlagC() ? 1 : 0);
    }

    // Subtract IYL to Acc. with carry
    static inline void SBC_IYL_(Z80* ctx) { ctx->SBC_IYL(); }
    inline void SBC_IYL()
    {
        if (isDebug()) log("[%04X] SBC %s, IYL<$%02X> <C:%s>", reg.PC - 2, registerDump(0b111), getIYL(), isFlagC() ? "ON" : "OFF");
        subtract8(getIYL(), isFlagC() ? 1 : 0);
    }

    // Subtract immediate with carry
    static inline void SBC_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] SBC %s, $%02X <C:%s>", ctx->reg.PC - 2, ctx->registerDump(0b111), n, ctx->isFlagC() ? "ON" : "OFF");
        ctx->subtract8(n, ctx->isFlagC() ? 1 : 0);
    }

    // Subtract memory with carry
    static inline void SBC_HL(Z80* ctx)
    {
        unsigned char n = ctx->readByte(ctx->getHL(), 3);
        if (ctx->isDebug()) ctx->log("[%04X] SBC %s, (%s) = $%02X <C:%s>", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), n, ctx->isFlagC() ? "ON" : "OFF");
        ctx->subtract8(n, ctx->isFlagC() ? 1 : 0);
    }

    // Subtract memory with carry
    static inline void SBC_IX_(Z80* ctx) { ctx->SBC_IX(); }
    inline void SBC_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IX + d));
        if (isDebug()) log("[%04X] SBC %s, (IX+d<$%04X>) = $%02X <C:%s>", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IX + d), n, isFlagC() ? "ON" : "OFF");
        subtract8(n, isFlagC() ? 1 : 0);
        consumeClock(3);
    }

    // Subtract memory with carry
    static inline void SBC_IY_(Z80* ctx) { ctx->SBC_IY(); }
    inline void SBC_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IY + d));
        if (isDebug()) log("[%04X] SBC %s, (IY+d<$%04X>) = $%02X <C:%s>", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IY + d), n, isFlagC() ? "ON" : "OFF");
        subtract8(n, isFlagC() ? 1 : 0);
        consumeClock(3);
    }

    // Decrement Register
    static inline void DEC_B(Z80* ctx) { ctx->DEC_R(0b000); }
    static inline void DEC_C(Z80* ctx) { ctx->DEC_R(0b001); }
    static inline void DEC_D(Z80* ctx) { ctx->DEC_R(0b010); }
    static inline void DEC_E(Z80* ctx) { ctx->DEC_R(0b011); }
    static inline void DEC_H(Z80* ctx) { ctx->DEC_R(0b100); }
    static inline void DEC_L(Z80* ctx) { ctx->DEC_R(0b101); }
    static inline void DEC_A(Z80* ctx) { ctx->DEC_R(0b111); }
    static inline void DEC_B_2(Z80* ctx) { ctx->DEC_R(0b000, 2); }
    static inline void DEC_C_2(Z80* ctx) { ctx->DEC_R(0b001, 2); }
    static inline void DEC_D_2(Z80* ctx) { ctx->DEC_R(0b010, 2); }
    static inline void DEC_E_2(Z80* ctx) { ctx->DEC_R(0b011, 2); }
    static inline void DEC_A_2(Z80* ctx) { ctx->DEC_R(0b111, 2); }
    inline void DEC_R(unsigned char r, int pc = 1)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] DEC %s", reg.PC - pc, registerDump(r));
        setFlagByDecrement(*rp);
        (*rp)--;
    }

    // Decrement location (HL)
    static inline void DEC_HL(Z80* ctx)
    {
        unsigned short addr = ctx->getHL();
        unsigned char n = ctx->readByte(addr);
        if (ctx->isDebug()) ctx->log("[%04X] DEC (%s) = $%02X", ctx->reg.PC - 1, ctx->registerPairDump(0b10), n);
        ctx->setFlagByDecrement(n);
        ctx->writeByte(addr, n - 1, 3);
    }

    // Decrement location (IX+d)
    static inline void DEC_IX_(Z80* ctx) { ctx->DEC_IX(); }
    inline void DEC_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] DEC (IX+d<$%04X>) = $%02X", reg.PC - 3, addr, n);
        setFlagByDecrement(n);
        writeByte(addr, n - 1);
        consumeClock(3);
    }

    // Decrement high 8 bits of IX
    static inline void DEC_IXH_(Z80* ctx) { ctx->DEC_IXH(); }
    inline void DEC_IXH()
    {
        unsigned char ixh = getIXH();
        if (isDebug()) log("[%04X] DEC IXH<$%02X>", reg.PC - 2, ixh);
        setFlagByDecrement(ixh--);
        setIXH(ixh);
    }

    // Decrement low 8 bits of IX
    static inline void DEC_IXL_(Z80* ctx) { ctx->DEC_IXL(); }
    inline void DEC_IXL()
    {
        unsigned char ixl = getIXL();
        if (isDebug()) log("[%04X] DEC IXL<$%02X>", reg.PC - 2, ixl);
        setFlagByDecrement(ixl--);
        setIXL(ixl);
    }

    // Decrement location (IY+d)
    static inline void DEC_IY_(Z80* ctx) { ctx->DEC_IY(); }
    inline void DEC_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] DEC (IY+d<$%04X>) = $%02X", reg.PC - 3, addr, n);
        setFlagByDecrement(n);
        writeByte(addr, n - 1);
        consumeClock(3);
    }

    // Decrement high 8 bits of IY
    static inline void DEC_IYH_(Z80* ctx) { ctx->DEC_IYH(); }
    inline void DEC_IYH()
    {
        unsigned char iyh = getIYH();
        if (isDebug()) log("[%04X] DEC IYH<$%02X>", reg.PC - 2, iyh);
        setFlagByDecrement(iyh--);
        setIYH(iyh);
    }

    // Decrement low 8 bits of IY
    static inline void DEC_IYL_(Z80* ctx) { ctx->DEC_IYL(); }
    inline void DEC_IYL()
    {
        unsigned char iyl = getIYL();
        if (isDebug()) log("[%04X] DEC IYL<$%02X>", reg.PC - 2, iyl);
        setFlagByDecrement(iyl--);
        setIYL(iyl);
    }

    inline void setFlagByAdd16(unsigned short before, unsigned short addition)
    {
        int result = before + addition;
        int carrybits = before ^ addition ^ result;
        setFlagN(false);
        setFlagXY((result & 0xFF00) >> 8);
        setFlagC((carrybits & 0x10000) != 0);
        setFlagH((carrybits & 0x1000) != 0);
    }

    inline void setFlagByAdc16(unsigned short before, unsigned short addition)
    {
        int result = before + addition;
        int carrybits = before ^ addition ^ result;
        unsigned short finalResult = (unsigned short)(result);
        // same as ADD
        setFlagN(false);
        setFlagXY((finalResult & 0xFF00) >> 8);
        setFlagC((carrybits & 0x10000) != 0);
        setFlagH((carrybits & 0x1000) != 0);
        // only ADC
        setFlagS(finalResult & 0x8000);
        setFlagZ(0 == finalResult);
        setFlagPV((((carrybits << 1) ^ carrybits) & 0x10000) != 0);
    }

    // Add register pair to H and L
    static inline void ADD_HL_BC(Z80* ctx) { ctx->ADD_HL_RP(0b00); }
    static inline void ADD_HL_DE(Z80* ctx) { ctx->ADD_HL_RP(0b01); }
    static inline void ADD_HL_HL(Z80* ctx) { ctx->ADD_HL_RP(0b10); }
    static inline void ADD_HL_SP(Z80* ctx) { ctx->ADD_HL_RP(0b11); }
    inline void ADD_HL_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] ADD %s, %s", reg.PC - 1, registerPairDump(0b10), registerPairDump(rp));
        unsigned short hl = getHL();
        unsigned short nn = getRP(rp);
        reg.WZ = nn + 1;
        setFlagByAdd16(hl, nn);
        setHL(hl + nn);
        consumeClock(7);
    }

    // Add with carry register pair to HL
    static inline void ADC_HL_BC(Z80* ctx) { ctx->ADC_HL_RP(0b00); }
    static inline void ADC_HL_DE(Z80* ctx) { ctx->ADC_HL_RP(0b01); }
    static inline void ADC_HL_HL(Z80* ctx) { ctx->ADC_HL_RP(0b10); }
    static inline void ADC_HL_SP(Z80* ctx) { ctx->ADC_HL_RP(0b11); }
    inline void ADC_HL_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] ADC %s, %s <C:%s>", reg.PC - 2, registerPairDump(0b10), registerPairDump(rp), isFlagC() ? "ON" : "OFF");
        unsigned short hl = getHL();
        unsigned short nn = getRP(rp);
        unsigned char c = isFlagC() ? 1 : 0;
        reg.WZ = hl + 1;
        setFlagByAdc16(hl, c + nn);
        setHL(hl + c + nn);
        consumeClock(7);
    }

    // Add register pair to IX
    static inline void ADD_IX_BC(Z80* ctx) { ctx->ADD_IX_RP(0b00); }
    static inline void ADD_IX_DE(Z80* ctx) { ctx->ADD_IX_RP(0b01); }
    static inline void ADD_IX_IX(Z80* ctx) { ctx->ADD_IX_RP(0b10); }
    static inline void ADD_IX_SP(Z80* ctx) { ctx->ADD_IX_RP(0b11); }
    inline void ADD_IX_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] ADD IX<$%04X>, %s", reg.PC - 2, reg.IX, registerPairDumpIX(rp));
        unsigned short nn = getRPIX(rp);
        setFlagByAdd16(reg.IX, nn);
        reg.IX += nn;
        consumeClock(7);
    }

    // Add register pair to IY
    static inline void ADD_IY_BC(Z80* ctx) { ctx->ADD_IY_RP(0b00); }
    static inline void ADD_IY_DE(Z80* ctx) { ctx->ADD_IY_RP(0b01); }
    static inline void ADD_IY_IY(Z80* ctx) { ctx->ADD_IY_RP(0b10); }
    static inline void ADD_IY_SP(Z80* ctx) { ctx->ADD_IY_RP(0b11); }
    inline void ADD_IY_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] ADD IY<$%04X>, %s", reg.PC - 2, reg.IY, registerPairDumpIY(rp));
        unsigned short nn = getRPIY(rp);
        setFlagByAdd16(reg.IY, nn);
        reg.IY += nn;
        consumeClock(7);
    }

    // Increment register pair
    static inline void INC_RP_BC(Z80* ctx) { ctx->INC_RP(0b00); }
    static inline void INC_RP_DE(Z80* ctx) { ctx->INC_RP(0b01); }
    static inline void INC_RP_HL(Z80* ctx) { ctx->INC_RP(0b10); }
    static inline void INC_RP_SP(Z80* ctx) { ctx->INC_RP(0b11); }
    inline void INC_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] INC %s", reg.PC - 1, registerPairDump(rp));
        setRP(rp, getRP(rp) + 1);
        consumeClock(2);
    }

    // Increment IX
    static inline void INC_IX_reg_(Z80* ctx) { ctx->INC_IX_reg(); }
    inline void INC_IX_reg()
    {
        if (isDebug()) log("[%04X] INC IX<$%04X>", reg.PC - 2, reg.IX);
        reg.IX++;
        consumeClock(2);
    }

    // Increment IY
    static inline void INC_IY_reg_(Z80* ctx) { ctx->INC_IY_reg(); }
    inline void INC_IY_reg()
    {
        if (isDebug()) log("[%04X] INC IY<$%04X>", reg.PC - 2, reg.IY);
        reg.IY++;
        consumeClock(2);
    }

    // Decrement register pair
    static inline void DEC_RP_BC(Z80* ctx) { ctx->DEC_RP(0b00); }
    static inline void DEC_RP_DE(Z80* ctx) { ctx->DEC_RP(0b01); }
    static inline void DEC_RP_HL(Z80* ctx) { ctx->DEC_RP(0b10); }
    static inline void DEC_RP_SP(Z80* ctx) { ctx->DEC_RP(0b11); }
    inline void DEC_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] DEC %s", reg.PC - 1, registerPairDump(rp));
        setRP(rp, getRP(rp) - 1);
        consumeClock(2);
    }

    // Decrement IX
    static inline void DEC_IX_reg_(Z80* ctx) { ctx->DEC_IX_reg(); }
    inline void DEC_IX_reg()
    {
        if (isDebug()) log("[%04X] DEC IX<$%04X>", reg.PC - 2, reg.IX);
        reg.IX--;
        consumeClock(2);
    }

    // Decrement IY
    static inline void DEC_IY_reg_(Z80* ctx) { ctx->DEC_IY_reg(); }
    inline void DEC_IY_reg()
    {
        if (isDebug()) log("[%04X] DEC IY<$%04X>", reg.PC - 2, reg.IY);
        reg.IY--;
        consumeClock(2);
    }

    inline void setFlagBySbc16(unsigned short before, unsigned short subtract)
    {
        int result = before - subtract;
        int carrybits = before ^ subtract ^ result;
        unsigned short finalResult = (unsigned short)result;
        setFlagN(true);
        setFlagXY((finalResult & 0xFF00) >> 8);
        setFlagC((carrybits & 0x10000) != 0);
        setFlagH((carrybits & 0x1000) != 0);
        setFlagS(finalResult & 0x8000);
        setFlagZ(0 == finalResult);
        setFlagPV((((carrybits << 1) ^ carrybits) & 0x10000) != 0);
    }

    // Subtract register pair from HL with carry
    static inline void SBC_HL_BC(Z80* ctx) { ctx->SBC_HL_RP(0b00); }
    static inline void SBC_HL_DE(Z80* ctx) { ctx->SBC_HL_RP(0b01); }
    static inline void SBC_HL_HL(Z80* ctx) { ctx->SBC_HL_RP(0b10); }
    static inline void SBC_HL_SP(Z80* ctx) { ctx->SBC_HL_RP(0b11); }
    inline void SBC_HL_RP(unsigned char rp)
    {
        if (isDebug()) log("[%04X] SBC %s, %s <C:%s>", reg.PC - 2, registerPairDump(0b10), registerPairDump(rp), isFlagC() ? "ON" : "OFF");
        unsigned short hl = getHL();
        unsigned short nn = getRP(rp);
        unsigned char c = isFlagC() ? 1 : 0;
        reg.WZ = hl + 1;
        setFlagBySbc16(hl, c + nn);
        setHL(hl - c - nn);
        consumeClock(7);
    }

    inline void setFlagByLogical(bool h)
    {
        setFlagS(reg.pair.A & 0x80);
        setFlagZ(reg.pair.A == 0);
        setFlagXY(reg.pair.A);
        setFlagH(h);
        setFlagPV(isEvenNumberBits(reg.pair.A));
        setFlagN(false);
        setFlagC(false);
    }

    inline void and8(unsigned char n)
    {
        reg.pair.A &= n;
        setFlagByLogical(true);
    }

    inline void or8(unsigned char n)
    {
        reg.pair.A |= n;
        setFlagByLogical(false);
    }

    inline void xor8(unsigned char n)
    {
        reg.pair.A ^= n;
        setFlagByLogical(false);
    }

    // AND Register
    static inline void AND_B(Z80* ctx) { ctx->AND_R(0b000); }
    static inline void AND_C(Z80* ctx) { ctx->AND_R(0b001); }
    static inline void AND_D(Z80* ctx) { ctx->AND_R(0b010); }
    static inline void AND_E(Z80* ctx) { ctx->AND_R(0b011); }
    static inline void AND_H(Z80* ctx) { ctx->AND_R(0b100); }
    static inline void AND_L(Z80* ctx) { ctx->AND_R(0b101); }
    static inline void AND_A(Z80* ctx) { ctx->AND_R(0b111); }
    static inline void AND_B_2(Z80* ctx) { ctx->AND_R(0b000, 2); }
    static inline void AND_C_2(Z80* ctx) { ctx->AND_R(0b001, 2); }
    static inline void AND_D_2(Z80* ctx) { ctx->AND_R(0b010, 2); }
    static inline void AND_E_2(Z80* ctx) { ctx->AND_R(0b011, 2); }
    static inline void AND_A_2(Z80* ctx) { ctx->AND_R(0b111, 2); }
    inline void AND_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] AND %s, %s", reg.PC - pc, registerDump(0b111), registerDump(r));
        and8(getRegister(r));
    }

    // AND with register IXH
    static inline void AND_IXH_(Z80* ctx) { ctx->AND_IXH(); }
    inline void AND_IXH()
    {
        if (isDebug()) log("[%04X] AND %s, IXH<$%02X>", reg.PC - 2, registerDump(0b111), getIXH());
        and8(getIXH());
    }

    // AND with register IXL
    static inline void AND_IXL_(Z80* ctx) { ctx->AND_IXL(); }
    inline void AND_IXL()
    {
        if (isDebug()) log("[%04X] AND %s, IXL<$%02X>", reg.PC - 2, registerDump(0b111), getIXL());
        and8(getIXL());
    }

    // AND with register IYH
    static inline void AND_IYH_(Z80* ctx) { ctx->AND_IYH(); }
    inline void AND_IYH()
    {
        if (isDebug()) log("[%04X] AND %s, IYH<$%02X>", reg.PC - 2, registerDump(0b111), getIYH());
        and8(getIYH());
    }

    // AND with register IYL
    static inline void AND_IYL_(Z80* ctx) { ctx->AND_IYL(); }
    inline void AND_IYL()
    {
        if (isDebug()) log("[%04X] AND %s, IYL<$%02X>", reg.PC - 2, registerDump(0b111), getIYL());
        and8(getIYL());
    }

    // AND immediate
    static inline void AND_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] AND %s, $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n);
        ctx->and8(n);
    }

    // AND Memory
    static inline void AND_HL(Z80* ctx)
    {
        unsigned short addr = ctx->getHL();
        unsigned char n = ctx->readByte(addr, 3);
        if (ctx->isDebug()) ctx->log("[%04X] AND %s, (%s) = $%02X", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), n);
        ctx->and8(n);
    }

    // AND Memory
    static inline void AND_IX_(Z80* ctx) { ctx->AND_IX(); }
    inline void AND_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IX + d));
        if (isDebug()) log("[%04X] AND %s, (IX+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IX + d), reg.pair.A & n);
        and8(n);
        consumeClock(3);
    }

    // AND Memory
    static inline void AND_IY_(Z80* ctx) { ctx->AND_IY(); }
    inline void AND_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IY + d));
        if (isDebug()) log("[%04X] AND %s, (IY+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IY + d), reg.pair.A & n);
        and8(n);
        consumeClock(3);
    }

    // OR Register
    static inline void OR_B(Z80* ctx) { ctx->OR_R(0b000); }
    static inline void OR_C(Z80* ctx) { ctx->OR_R(0b001); }
    static inline void OR_D(Z80* ctx) { ctx->OR_R(0b010); }
    static inline void OR_E(Z80* ctx) { ctx->OR_R(0b011); }
    static inline void OR_H(Z80* ctx) { ctx->OR_R(0b100); }
    static inline void OR_L(Z80* ctx) { ctx->OR_R(0b101); }
    static inline void OR_A(Z80* ctx) { ctx->OR_R(0b111); }
    static inline void OR_B_2(Z80* ctx) { ctx->OR_R(0b000, 2); }
    static inline void OR_C_2(Z80* ctx) { ctx->OR_R(0b001, 2); }
    static inline void OR_D_2(Z80* ctx) { ctx->OR_R(0b010, 2); }
    static inline void OR_E_2(Z80* ctx) { ctx->OR_R(0b011, 2); }
    static inline void OR_A_2(Z80* ctx) { ctx->OR_R(0b111, 2); }
    inline void OR_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] OR %s, %s", reg.PC - pc, registerDump(0b111), registerDump(r));
        or8(getRegister(r));
    }

    // OR with register IXH
    static inline void OR_IXH_(Z80* ctx) { ctx->OR_IXH(); }
    inline void OR_IXH()
    {
        if (isDebug()) log("[%04X] OR %s, IXH<$%02X>", reg.PC - 2, registerDump(0b111), getIXH());
        or8(getIXH());
    }

    // OR with register IXL
    static inline void OR_IXL_(Z80* ctx) { ctx->OR_IXL(); }
    inline void OR_IXL()
    {
        if (isDebug()) log("[%04X] OR %s, IXL<$%02X>", reg.PC - 2, registerDump(0b111), getIXL());
        or8(getIXL());
    }

    // OR with register IYH
    static inline void OR_IYH_(Z80* ctx) { ctx->OR_IYH(); }
    inline void OR_IYH()
    {
        if (isDebug()) log("[%04X] OR %s, IYH<$%02X>", reg.PC - 2, registerDump(0b111), getIYH());
        or8(getIYH());
    }

    // OR with register IYL
    static inline void OR_IYL_(Z80* ctx) { ctx->OR_IYL(); }
    inline void OR_IYL()
    {
        if (isDebug()) log("[%04X] OR %s, IYL<$%02X>", reg.PC - 2, registerDump(0b111), getIYL());
        or8(getIYL());
    }

    // OR immediate
    static inline void OR_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] OR %s, $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n);
        ctx->or8(n);
    }

    // OR Memory
    static inline void OR_HL(Z80* ctx)
    {
        unsigned char n = ctx->readByte(ctx->getHL(), 3);
        if (ctx->isDebug()) ctx->log("[%04X] OR %s, (%s) = $%02X", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), ctx->reg.pair.A | n);
        ctx->or8(n);
    }

    // OR Memory
    static inline void OR_IX_(Z80* ctx) { ctx->OR_IX(); }
    inline void OR_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IX + d));
        if (isDebug()) log("[%04X] OR %s, (IX+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IX + d), reg.pair.A | n);
        or8(n);
        consumeClock(3);
    }

    // OR Memory
    static inline void OR_IY_(Z80* ctx) { ctx->OR_IY(); }
    inline void OR_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IY + d));
        if (isDebug()) log("[%04X] OR %s, (IY+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IY + d), reg.pair.A | n);
        or8(n);
        consumeClock(3);
    }

    // XOR Reigster
    static inline void XOR_B(Z80* ctx) { ctx->XOR_R(0b000); }
    static inline void XOR_C(Z80* ctx) { ctx->XOR_R(0b001); }
    static inline void XOR_D(Z80* ctx) { ctx->XOR_R(0b010); }
    static inline void XOR_E(Z80* ctx) { ctx->XOR_R(0b011); }
    static inline void XOR_H(Z80* ctx) { ctx->XOR_R(0b100); }
    static inline void XOR_L(Z80* ctx) { ctx->XOR_R(0b101); }
    static inline void XOR_A(Z80* ctx) { ctx->XOR_R(0b111); }
    static inline void XOR_B_2(Z80* ctx) { ctx->XOR_R(0b000, 2); }
    static inline void XOR_C_2(Z80* ctx) { ctx->XOR_R(0b001, 2); }
    static inline void XOR_D_2(Z80* ctx) { ctx->XOR_R(0b010, 2); }
    static inline void XOR_E_2(Z80* ctx) { ctx->XOR_R(0b011, 2); }
    static inline void XOR_A_2(Z80* ctx) { ctx->XOR_R(0b111, 2); }
    inline void XOR_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] XOR %s, %s", reg.PC - pc, registerDump(0b111), registerDump(r));
        xor8(getRegister(r));
    }

    // XOR with register IXH
    static inline void XOR_IXH_(Z80* ctx) { ctx->XOR_IXH(); }
    inline void XOR_IXH()
    {
        if (isDebug()) log("[%04X] XOR %s, IXH<$%02X>", reg.PC - 2, registerDump(0b111), getIXH());
        xor8(getIXH());
    }

    // XOR with register IXL
    static inline void XOR_IXL_(Z80* ctx) { ctx->XOR_IXL(); }
    inline void XOR_IXL()
    {
        if (isDebug()) log("[%04X] XOR %s, IXL<$%02X>", reg.PC - 2, registerDump(0b111), getIXL());
        xor8(getIXL());
    }

    // XOR with register IYH
    static inline void XOR_IYH_(Z80* ctx) { ctx->XOR_IYH(); }
    inline void XOR_IYH()
    {
        if (isDebug()) log("[%04X] XOR %s, IYH<$%02X>", reg.PC - 2, registerDump(0b111), getIYH());
        xor8(getIYH());
    }

    // XOR with register IYL
    static inline void XOR_IYL_(Z80* ctx) { ctx->XOR_IYL(); }
    inline void XOR_IYL()
    {
        if (isDebug()) log("[%04X] XOR %s, IYL<$%02X>", reg.PC - 2, registerDump(0b111), getIYL());
        xor8(getIYL());
    }

    // XOR immediate
    static inline void XOR_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] XOR %s, $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n);
        ctx->xor8(n);
    }

    // XOR Memory
    static inline void XOR_HL(Z80* ctx)
    {
        unsigned char n = ctx->readByte(ctx->getHL(), 3);
        if (ctx->isDebug()) ctx->log("[%04X] XOR %s, (%s) = $%02X", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), ctx->reg.pair.A ^ n);
        ctx->xor8(n);
    }

    // XOR Memory
    static inline void XOR_IX_(Z80* ctx) { ctx->XOR_IX(); }
    inline void XOR_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IX + d));
        if (isDebug()) log("[%04X] XOR %s, (IX+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IX + d), reg.pair.A ^ n);
        xor8(n);
        consumeClock(3);
    }

    // XOR Memory
    static inline void XOR_IY_(Z80* ctx) { ctx->XOR_IY(); }
    inline void XOR_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IY + d));
        if (isDebug()) log("[%04X] XOR %s, (IY+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IY + d), reg.pair.A ^ n);
        xor8(n);
        consumeClock(3);
    }

    // Complement acc. (1's Comp.)
    static inline void CPL(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] CPL %s", ctx->reg.PC - 1, ctx->registerDump(0b111));
        ctx->reg.pair.A = ~ctx->reg.pair.A;
        ctx->setFlagH(true);
        ctx->setFlagN(true);
        ctx->setFlagXY(ctx->reg.pair.A);
    }

    // Negate Acc. (2's Comp.)
    static inline void NEG_(Z80* ctx) { ctx->NEG(); }
    inline void NEG()
    {
        if (isDebug()) log("[%04X] NEG %s", reg.PC - 2, registerDump(0b111));
        unsigned char a = reg.pair.A;
        reg.pair.A = 0;
        subtract8(a, 0);
    }

    //　Complement Carry Flag
    static inline void CCF(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] CCF <C:%s -> %s>", ctx->reg.PC - 1, ctx->isFlagC() ? "ON" : "OFF", !ctx->isFlagC() ? "ON" : "OFF");
        ctx->setFlagH(ctx->isFlagC());
        ctx->setFlagN(false);
        ctx->setFlagC(!ctx->isFlagC());
        ctx->setFlagXY(ctx->reg.pair.A);
    }

    // Set Carry Flag
    static inline void SCF(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] SCF <C:%s -> ON>", ctx->reg.PC - 1, ctx->isFlagC() ? "ON" : "OFF");
        ctx->setFlagH(false);
        ctx->setFlagN(false);
        ctx->setFlagC(true);
        ctx->setFlagXY(ctx->reg.pair.A);
    }

    // Test BIT b of register r
    static inline void BIT_B_0(Z80* ctx) { ctx->BIT_R(0b000, 0); }
    static inline void BIT_B_1(Z80* ctx) { ctx->BIT_R(0b000, 1); }
    static inline void BIT_B_2(Z80* ctx) { ctx->BIT_R(0b000, 2); }
    static inline void BIT_B_3(Z80* ctx) { ctx->BIT_R(0b000, 3); }
    static inline void BIT_B_4(Z80* ctx) { ctx->BIT_R(0b000, 4); }
    static inline void BIT_B_5(Z80* ctx) { ctx->BIT_R(0b000, 5); }
    static inline void BIT_B_6(Z80* ctx) { ctx->BIT_R(0b000, 6); }
    static inline void BIT_B_7(Z80* ctx) { ctx->BIT_R(0b000, 7); }
    static inline void BIT_C_0(Z80* ctx) { ctx->BIT_R(0b001, 0); }
    static inline void BIT_C_1(Z80* ctx) { ctx->BIT_R(0b001, 1); }
    static inline void BIT_C_2(Z80* ctx) { ctx->BIT_R(0b001, 2); }
    static inline void BIT_C_3(Z80* ctx) { ctx->BIT_R(0b001, 3); }
    static inline void BIT_C_4(Z80* ctx) { ctx->BIT_R(0b001, 4); }
    static inline void BIT_C_5(Z80* ctx) { ctx->BIT_R(0b001, 5); }
    static inline void BIT_C_6(Z80* ctx) { ctx->BIT_R(0b001, 6); }
    static inline void BIT_C_7(Z80* ctx) { ctx->BIT_R(0b001, 7); }
    static inline void BIT_D_0(Z80* ctx) { ctx->BIT_R(0b010, 0); }
    static inline void BIT_D_1(Z80* ctx) { ctx->BIT_R(0b010, 1); }
    static inline void BIT_D_2(Z80* ctx) { ctx->BIT_R(0b010, 2); }
    static inline void BIT_D_3(Z80* ctx) { ctx->BIT_R(0b010, 3); }
    static inline void BIT_D_4(Z80* ctx) { ctx->BIT_R(0b010, 4); }
    static inline void BIT_D_5(Z80* ctx) { ctx->BIT_R(0b010, 5); }
    static inline void BIT_D_6(Z80* ctx) { ctx->BIT_R(0b010, 6); }
    static inline void BIT_D_7(Z80* ctx) { ctx->BIT_R(0b010, 7); }
    static inline void BIT_E_0(Z80* ctx) { ctx->BIT_R(0b011, 0); }
    static inline void BIT_E_1(Z80* ctx) { ctx->BIT_R(0b011, 1); }
    static inline void BIT_E_2(Z80* ctx) { ctx->BIT_R(0b011, 2); }
    static inline void BIT_E_3(Z80* ctx) { ctx->BIT_R(0b011, 3); }
    static inline void BIT_E_4(Z80* ctx) { ctx->BIT_R(0b011, 4); }
    static inline void BIT_E_5(Z80* ctx) { ctx->BIT_R(0b011, 5); }
    static inline void BIT_E_6(Z80* ctx) { ctx->BIT_R(0b011, 6); }
    static inline void BIT_E_7(Z80* ctx) { ctx->BIT_R(0b011, 7); }
    static inline void BIT_H_0(Z80* ctx) { ctx->BIT_R(0b100, 0); }
    static inline void BIT_H_1(Z80* ctx) { ctx->BIT_R(0b100, 1); }
    static inline void BIT_H_2(Z80* ctx) { ctx->BIT_R(0b100, 2); }
    static inline void BIT_H_3(Z80* ctx) { ctx->BIT_R(0b100, 3); }
    static inline void BIT_H_4(Z80* ctx) { ctx->BIT_R(0b100, 4); }
    static inline void BIT_H_5(Z80* ctx) { ctx->BIT_R(0b100, 5); }
    static inline void BIT_H_6(Z80* ctx) { ctx->BIT_R(0b100, 6); }
    static inline void BIT_H_7(Z80* ctx) { ctx->BIT_R(0b100, 7); }
    static inline void BIT_L_0(Z80* ctx) { ctx->BIT_R(0b101, 0); }
    static inline void BIT_L_1(Z80* ctx) { ctx->BIT_R(0b101, 1); }
    static inline void BIT_L_2(Z80* ctx) { ctx->BIT_R(0b101, 2); }
    static inline void BIT_L_3(Z80* ctx) { ctx->BIT_R(0b101, 3); }
    static inline void BIT_L_4(Z80* ctx) { ctx->BIT_R(0b101, 4); }
    static inline void BIT_L_5(Z80* ctx) { ctx->BIT_R(0b101, 5); }
    static inline void BIT_L_6(Z80* ctx) { ctx->BIT_R(0b101, 6); }
    static inline void BIT_L_7(Z80* ctx) { ctx->BIT_R(0b101, 7); }
    static inline void BIT_A_0(Z80* ctx) { ctx->BIT_R(0b111, 0); }
    static inline void BIT_A_1(Z80* ctx) { ctx->BIT_R(0b111, 1); }
    static inline void BIT_A_2(Z80* ctx) { ctx->BIT_R(0b111, 2); }
    static inline void BIT_A_3(Z80* ctx) { ctx->BIT_R(0b111, 3); }
    static inline void BIT_A_4(Z80* ctx) { ctx->BIT_R(0b111, 4); }
    static inline void BIT_A_5(Z80* ctx) { ctx->BIT_R(0b111, 5); }
    static inline void BIT_A_6(Z80* ctx) { ctx->BIT_R(0b111, 6); }
    static inline void BIT_A_7(Z80* ctx) { ctx->BIT_R(0b111, 7); }
    inline void BIT_R(unsigned char r, unsigned char bit)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] BIT %s of bit-%d", reg.PC - 2, registerDump(r), bit);
        unsigned char n = 0;
        switch (bit) {
            case 0: n = *rp & 0b00000001; break;
            case 1: n = *rp & 0b00000010; break;
            case 2: n = *rp & 0b00000100; break;
            case 3: n = *rp & 0b00001000; break;
            case 4: n = *rp & 0b00010000; break;
            case 5: n = *rp & 0b00100000; break;
            case 6: n = *rp & 0b01000000; break;
            case 7: n = *rp & 0b10000000; break;
        }
        setFlagZ(n ? false : true);
        setFlagPV(isFlagZ());
        setFlagS(!isFlagZ() && 7 == bit);
        setFlagH(true);
        setFlagN(false);
        setFlagXY(*rp);
    }

    // Test BIT b of location (HL)
    static inline void BIT_HL_0(Z80* ctx) { ctx->BIT_HL(0); }
    static inline void BIT_HL_1(Z80* ctx) { ctx->BIT_HL(1); }
    static inline void BIT_HL_2(Z80* ctx) { ctx->BIT_HL(2); }
    static inline void BIT_HL_3(Z80* ctx) { ctx->BIT_HL(3); }
    static inline void BIT_HL_4(Z80* ctx) { ctx->BIT_HL(4); }
    static inline void BIT_HL_5(Z80* ctx) { ctx->BIT_HL(5); }
    static inline void BIT_HL_6(Z80* ctx) { ctx->BIT_HL(6); }
    static inline void BIT_HL_7(Z80* ctx) { ctx->BIT_HL(7); }
    inline void BIT_HL(unsigned char bit)
    {
        unsigned char n = readByte(getHL());
        if (isDebug()) log("[%04X] BIT (%s) = $%02X of bit-%d", reg.PC - 2, registerPairDump(0b10), n, bit);
        switch (bit) {
            case 0: n &= 0b00000001; break;
            case 1: n &= 0b00000010; break;
            case 2: n &= 0b00000100; break;
            case 3: n &= 0b00001000; break;
            case 4: n &= 0b00010000; break;
            case 5: n &= 0b00100000; break;
            case 6: n &= 0b01000000; break;
            case 7: n &= 0b10000000; break;
        }
        setFlagZ(!n);
        setFlagPV(isFlagZ());
        setFlagS(!isFlagZ() && 7 == bit);
        setFlagH(true);
        setFlagN(false);
        setFlagXY((reg.WZ & 0xFF00) >> 8);
    }

    // Test BIT b of location (IX+d)
    static inline void BIT_IX_0(Z80* ctx, signed char d) { ctx->BIT_IX(d, 0); }
    static inline void BIT_IX_1(Z80* ctx, signed char d) { ctx->BIT_IX(d, 1); }
    static inline void BIT_IX_2(Z80* ctx, signed char d) { ctx->BIT_IX(d, 2); }
    static inline void BIT_IX_3(Z80* ctx, signed char d) { ctx->BIT_IX(d, 3); }
    static inline void BIT_IX_4(Z80* ctx, signed char d) { ctx->BIT_IX(d, 4); }
    static inline void BIT_IX_5(Z80* ctx, signed char d) { ctx->BIT_IX(d, 5); }
    static inline void BIT_IX_6(Z80* ctx, signed char d) { ctx->BIT_IX(d, 6); }
    static inline void BIT_IX_7(Z80* ctx, signed char d) { ctx->BIT_IX(d, 7); }
    inline void BIT_IX(signed char d, unsigned char bit)
    {
        unsigned char n = readByte((unsigned short)(reg.IX + d));
        if (isDebug()) log("[%04X] BIT (IX+d<$%04X>) = $%02X of bit-%d", reg.PC - 4, (unsigned short)(reg.IX + d), n, bit);
        switch (bit) {
            case 0: n &= 0b00000001; break;
            case 1: n &= 0b00000010; break;
            case 2: n &= 0b00000100; break;
            case 3: n &= 0b00001000; break;
            case 4: n &= 0b00010000; break;
            case 5: n &= 0b00100000; break;
            case 6: n &= 0b01000000; break;
            case 7: n &= 0b10000000; break;
        }
        setFlagZ(!n);
        setFlagPV(isFlagZ());
        setFlagS(!isFlagZ() && 7 == bit);
        setFlagH(true);
        setFlagN(false);
        setFlagXY((reg.WZ & 0xFF00) >> 8);
    }

    // Test BIT b of location (IY+d)
    static inline void BIT_IY_0(Z80* ctx, signed char d) { ctx->BIT_IY(d, 0); }
    static inline void BIT_IY_1(Z80* ctx, signed char d) { ctx->BIT_IY(d, 1); }
    static inline void BIT_IY_2(Z80* ctx, signed char d) { ctx->BIT_IY(d, 2); }
    static inline void BIT_IY_3(Z80* ctx, signed char d) { ctx->BIT_IY(d, 3); }
    static inline void BIT_IY_4(Z80* ctx, signed char d) { ctx->BIT_IY(d, 4); }
    static inline void BIT_IY_5(Z80* ctx, signed char d) { ctx->BIT_IY(d, 5); }
    static inline void BIT_IY_6(Z80* ctx, signed char d) { ctx->BIT_IY(d, 6); }
    static inline void BIT_IY_7(Z80* ctx, signed char d) { ctx->BIT_IY(d, 7); }
    inline void BIT_IY(signed char d, unsigned char bit)
    {
        unsigned char n = readByte((unsigned short)(reg.IY + d));
        if (isDebug()) log("[%04X] BIT (IY+d<$%04X>) = $%02X of bit-%d", reg.PC - 4, (unsigned short)(reg.IY + d), n, bit);
        switch (bit) {
            case 0: n &= 0b00000001; break;
            case 1: n &= 0b00000010; break;
            case 2: n &= 0b00000100; break;
            case 3: n &= 0b00001000; break;
            case 4: n &= 0b00010000; break;
            case 5: n &= 0b00100000; break;
            case 6: n &= 0b01000000; break;
            case 7: n &= 0b10000000; break;
        }
        setFlagZ(!n);
        setFlagPV(isFlagZ());
        setFlagS(!isFlagZ() && 7 == bit);
        setFlagH(true);
        setFlagN(false);
        setFlagXY((reg.WZ & 0xFF00) >> 8);
    }

    // SET bit b of register r
    static inline void SET_B_0(Z80* ctx) { ctx->SET_R(0b000, 0); }
    static inline void SET_B_1(Z80* ctx) { ctx->SET_R(0b000, 1); }
    static inline void SET_B_2(Z80* ctx) { ctx->SET_R(0b000, 2); }
    static inline void SET_B_3(Z80* ctx) { ctx->SET_R(0b000, 3); }
    static inline void SET_B_4(Z80* ctx) { ctx->SET_R(0b000, 4); }
    static inline void SET_B_5(Z80* ctx) { ctx->SET_R(0b000, 5); }
    static inline void SET_B_6(Z80* ctx) { ctx->SET_R(0b000, 6); }
    static inline void SET_B_7(Z80* ctx) { ctx->SET_R(0b000, 7); }
    static inline void SET_C_0(Z80* ctx) { ctx->SET_R(0b001, 0); }
    static inline void SET_C_1(Z80* ctx) { ctx->SET_R(0b001, 1); }
    static inline void SET_C_2(Z80* ctx) { ctx->SET_R(0b001, 2); }
    static inline void SET_C_3(Z80* ctx) { ctx->SET_R(0b001, 3); }
    static inline void SET_C_4(Z80* ctx) { ctx->SET_R(0b001, 4); }
    static inline void SET_C_5(Z80* ctx) { ctx->SET_R(0b001, 5); }
    static inline void SET_C_6(Z80* ctx) { ctx->SET_R(0b001, 6); }
    static inline void SET_C_7(Z80* ctx) { ctx->SET_R(0b001, 7); }
    static inline void SET_D_0(Z80* ctx) { ctx->SET_R(0b010, 0); }
    static inline void SET_D_1(Z80* ctx) { ctx->SET_R(0b010, 1); }
    static inline void SET_D_2(Z80* ctx) { ctx->SET_R(0b010, 2); }
    static inline void SET_D_3(Z80* ctx) { ctx->SET_R(0b010, 3); }
    static inline void SET_D_4(Z80* ctx) { ctx->SET_R(0b010, 4); }
    static inline void SET_D_5(Z80* ctx) { ctx->SET_R(0b010, 5); }
    static inline void SET_D_6(Z80* ctx) { ctx->SET_R(0b010, 6); }
    static inline void SET_D_7(Z80* ctx) { ctx->SET_R(0b010, 7); }
    static inline void SET_E_0(Z80* ctx) { ctx->SET_R(0b011, 0); }
    static inline void SET_E_1(Z80* ctx) { ctx->SET_R(0b011, 1); }
    static inline void SET_E_2(Z80* ctx) { ctx->SET_R(0b011, 2); }
    static inline void SET_E_3(Z80* ctx) { ctx->SET_R(0b011, 3); }
    static inline void SET_E_4(Z80* ctx) { ctx->SET_R(0b011, 4); }
    static inline void SET_E_5(Z80* ctx) { ctx->SET_R(0b011, 5); }
    static inline void SET_E_6(Z80* ctx) { ctx->SET_R(0b011, 6); }
    static inline void SET_E_7(Z80* ctx) { ctx->SET_R(0b011, 7); }
    static inline void SET_H_0(Z80* ctx) { ctx->SET_R(0b100, 0); }
    static inline void SET_H_1(Z80* ctx) { ctx->SET_R(0b100, 1); }
    static inline void SET_H_2(Z80* ctx) { ctx->SET_R(0b100, 2); }
    static inline void SET_H_3(Z80* ctx) { ctx->SET_R(0b100, 3); }
    static inline void SET_H_4(Z80* ctx) { ctx->SET_R(0b100, 4); }
    static inline void SET_H_5(Z80* ctx) { ctx->SET_R(0b100, 5); }
    static inline void SET_H_6(Z80* ctx) { ctx->SET_R(0b100, 6); }
    static inline void SET_H_7(Z80* ctx) { ctx->SET_R(0b100, 7); }
    static inline void SET_L_0(Z80* ctx) { ctx->SET_R(0b101, 0); }
    static inline void SET_L_1(Z80* ctx) { ctx->SET_R(0b101, 1); }
    static inline void SET_L_2(Z80* ctx) { ctx->SET_R(0b101, 2); }
    static inline void SET_L_3(Z80* ctx) { ctx->SET_R(0b101, 3); }
    static inline void SET_L_4(Z80* ctx) { ctx->SET_R(0b101, 4); }
    static inline void SET_L_5(Z80* ctx) { ctx->SET_R(0b101, 5); }
    static inline void SET_L_6(Z80* ctx) { ctx->SET_R(0b101, 6); }
    static inline void SET_L_7(Z80* ctx) { ctx->SET_R(0b101, 7); }
    static inline void SET_A_0(Z80* ctx) { ctx->SET_R(0b111, 0); }
    static inline void SET_A_1(Z80* ctx) { ctx->SET_R(0b111, 1); }
    static inline void SET_A_2(Z80* ctx) { ctx->SET_R(0b111, 2); }
    static inline void SET_A_3(Z80* ctx) { ctx->SET_R(0b111, 3); }
    static inline void SET_A_4(Z80* ctx) { ctx->SET_R(0b111, 4); }
    static inline void SET_A_5(Z80* ctx) { ctx->SET_R(0b111, 5); }
    static inline void SET_A_6(Z80* ctx) { ctx->SET_R(0b111, 6); }
    static inline void SET_A_7(Z80* ctx) { ctx->SET_R(0b111, 7); }
    inline void SET_R(unsigned char r, unsigned char bit)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] SET %s of bit-%d", reg.PC - 2, registerDump(r), bit);
        switch (bit) {
            case 0: *rp |= 0b00000001; break;
            case 1: *rp |= 0b00000010; break;
            case 2: *rp |= 0b00000100; break;
            case 3: *rp |= 0b00001000; break;
            case 4: *rp |= 0b00010000; break;
            case 5: *rp |= 0b00100000; break;
            case 6: *rp |= 0b01000000; break;
            case 7: *rp |= 0b10000000; break;
        }
    }

    // SET bit b of location (HL)
    static inline void SET_HL_0(Z80* ctx) { ctx->SET_HL(0); }
    static inline void SET_HL_1(Z80* ctx) { ctx->SET_HL(1); }
    static inline void SET_HL_2(Z80* ctx) { ctx->SET_HL(2); }
    static inline void SET_HL_3(Z80* ctx) { ctx->SET_HL(3); }
    static inline void SET_HL_4(Z80* ctx) { ctx->SET_HL(4); }
    static inline void SET_HL_5(Z80* ctx) { ctx->SET_HL(5); }
    static inline void SET_HL_6(Z80* ctx) { ctx->SET_HL(6); }
    static inline void SET_HL_7(Z80* ctx) { ctx->SET_HL(7); }
    inline void SET_HL(unsigned char bit)
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SET (%s) = $%02X of bit-%d", reg.PC - 2, registerPairDump(0b10), n, bit);
        switch (bit) {
            case 0: n |= 0b00000001; break;
            case 1: n |= 0b00000010; break;
            case 2: n |= 0b00000100; break;
            case 3: n |= 0b00001000; break;
            case 4: n |= 0b00010000; break;
            case 5: n |= 0b00100000; break;
            case 6: n |= 0b01000000; break;
            case 7: n |= 0b10000000; break;
        }
        writeByte(addr, n, 3);
    }

    // SET bit b of location (IX+d)
    static inline void SET_IX_0(Z80* ctx, signed char d) { ctx->SET_IX(d, 0); }
    static inline void SET_IX_1(Z80* ctx, signed char d) { ctx->SET_IX(d, 1); }
    static inline void SET_IX_2(Z80* ctx, signed char d) { ctx->SET_IX(d, 2); }
    static inline void SET_IX_3(Z80* ctx, signed char d) { ctx->SET_IX(d, 3); }
    static inline void SET_IX_4(Z80* ctx, signed char d) { ctx->SET_IX(d, 4); }
    static inline void SET_IX_5(Z80* ctx, signed char d) { ctx->SET_IX(d, 5); }
    static inline void SET_IX_6(Z80* ctx, signed char d) { ctx->SET_IX(d, 6); }
    static inline void SET_IX_7(Z80* ctx, signed char d) { ctx->SET_IX(d, 7); }
    inline void SET_IX(signed char d, unsigned char bit, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SET (IX+d<$%04X>) = $%02X of bit-%d%s", reg.PC - 4, addr, n, bit, extraLog ? extraLog : "");
        switch (bit) {
            case 0: n |= 0b00000001; break;
            case 1: n |= 0b00000010; break;
            case 2: n |= 0b00000100; break;
            case 3: n |= 0b00001000; break;
            case 4: n |= 0b00010000; break;
            case 5: n |= 0b00100000; break;
            case 6: n |= 0b01000000; break;
            case 7: n |= 0b10000000; break;
        }
        if (rp) *rp = n;
        writeByte(addr, n, 3);
    }

    // SET bit b of location (IX+d) with load Reg.
    static inline void SET_IX_0_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b000); }
    static inline void SET_IX_1_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b000); }
    static inline void SET_IX_2_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b000); }
    static inline void SET_IX_3_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b000); }
    static inline void SET_IX_4_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b000); }
    static inline void SET_IX_5_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b000); }
    static inline void SET_IX_6_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b000); }
    static inline void SET_IX_7_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b000); }
    static inline void SET_IX_0_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b001); }
    static inline void SET_IX_1_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b001); }
    static inline void SET_IX_2_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b001); }
    static inline void SET_IX_3_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b001); }
    static inline void SET_IX_4_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b001); }
    static inline void SET_IX_5_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b001); }
    static inline void SET_IX_6_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b001); }
    static inline void SET_IX_7_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b001); }
    static inline void SET_IX_0_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b010); }
    static inline void SET_IX_1_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b010); }
    static inline void SET_IX_2_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b010); }
    static inline void SET_IX_3_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b010); }
    static inline void SET_IX_4_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b010); }
    static inline void SET_IX_5_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b010); }
    static inline void SET_IX_6_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b010); }
    static inline void SET_IX_7_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b010); }
    static inline void SET_IX_0_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b011); }
    static inline void SET_IX_1_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b011); }
    static inline void SET_IX_2_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b011); }
    static inline void SET_IX_3_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b011); }
    static inline void SET_IX_4_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b011); }
    static inline void SET_IX_5_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b011); }
    static inline void SET_IX_6_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b011); }
    static inline void SET_IX_7_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b011); }
    static inline void SET_IX_0_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b100); }
    static inline void SET_IX_1_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b100); }
    static inline void SET_IX_2_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b100); }
    static inline void SET_IX_3_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b100); }
    static inline void SET_IX_4_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b100); }
    static inline void SET_IX_5_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b100); }
    static inline void SET_IX_6_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b100); }
    static inline void SET_IX_7_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b100); }
    static inline void SET_IX_0_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b101); }
    static inline void SET_IX_1_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b101); }
    static inline void SET_IX_2_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b101); }
    static inline void SET_IX_3_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b101); }
    static inline void SET_IX_4_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b101); }
    static inline void SET_IX_5_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b101); }
    static inline void SET_IX_6_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b101); }
    static inline void SET_IX_7_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b101); }
    static inline void SET_IX_0_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 0, 0b111); }
    static inline void SET_IX_1_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 1, 0b111); }
    static inline void SET_IX_2_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 2, 0b111); }
    static inline void SET_IX_3_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 3, 0b111); }
    static inline void SET_IX_4_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 4, 0b111); }
    static inline void SET_IX_5_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 5, 0b111); }
    static inline void SET_IX_6_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 6, 0b111); }
    static inline void SET_IX_7_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IX_with_LD(d, 7, 0b111); }
    inline void SET_IX_with_LD(signed char d, unsigned char bit, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SET_IX(d, bit, rp, buf);
    }

    // SET bit b of location (IY+d)
    static inline void SET_IY_0(Z80* ctx, signed char d) { ctx->SET_IY(d, 0); }
    static inline void SET_IY_1(Z80* ctx, signed char d) { ctx->SET_IY(d, 1); }
    static inline void SET_IY_2(Z80* ctx, signed char d) { ctx->SET_IY(d, 2); }
    static inline void SET_IY_3(Z80* ctx, signed char d) { ctx->SET_IY(d, 3); }
    static inline void SET_IY_4(Z80* ctx, signed char d) { ctx->SET_IY(d, 4); }
    static inline void SET_IY_5(Z80* ctx, signed char d) { ctx->SET_IY(d, 5); }
    static inline void SET_IY_6(Z80* ctx, signed char d) { ctx->SET_IY(d, 6); }
    static inline void SET_IY_7(Z80* ctx, signed char d) { ctx->SET_IY(d, 7); }
    inline void SET_IY(signed char d, unsigned char bit, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] SET (IY+d<$%04X>) = $%02X of bit-%d%s", reg.PC - 4, addr, n, bit, extraLog ? extraLog : "");
        switch (bit) {
            case 0: n |= 0b00000001; break;
            case 1: n |= 0b00000010; break;
            case 2: n |= 0b00000100; break;
            case 3: n |= 0b00001000; break;
            case 4: n |= 0b00010000; break;
            case 5: n |= 0b00100000; break;
            case 6: n |= 0b01000000; break;
            case 7: n |= 0b10000000; break;
        }
        if (rp) *rp = n;
        writeByte(addr, n, 3);
    }

    // SET bit b of location (IY+d) with load Reg.
    static inline void SET_IY_0_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b000); }
    static inline void SET_IY_1_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b000); }
    static inline void SET_IY_2_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b000); }
    static inline void SET_IY_3_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b000); }
    static inline void SET_IY_4_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b000); }
    static inline void SET_IY_5_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b000); }
    static inline void SET_IY_6_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b000); }
    static inline void SET_IY_7_with_LD_B(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b000); }
    static inline void SET_IY_0_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b001); }
    static inline void SET_IY_1_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b001); }
    static inline void SET_IY_2_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b001); }
    static inline void SET_IY_3_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b001); }
    static inline void SET_IY_4_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b001); }
    static inline void SET_IY_5_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b001); }
    static inline void SET_IY_6_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b001); }
    static inline void SET_IY_7_with_LD_C(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b001); }
    static inline void SET_IY_0_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b010); }
    static inline void SET_IY_1_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b010); }
    static inline void SET_IY_2_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b010); }
    static inline void SET_IY_3_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b010); }
    static inline void SET_IY_4_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b010); }
    static inline void SET_IY_5_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b010); }
    static inline void SET_IY_6_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b010); }
    static inline void SET_IY_7_with_LD_D(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b010); }
    static inline void SET_IY_0_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b011); }
    static inline void SET_IY_1_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b011); }
    static inline void SET_IY_2_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b011); }
    static inline void SET_IY_3_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b011); }
    static inline void SET_IY_4_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b011); }
    static inline void SET_IY_5_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b011); }
    static inline void SET_IY_6_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b011); }
    static inline void SET_IY_7_with_LD_E(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b011); }
    static inline void SET_IY_0_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b100); }
    static inline void SET_IY_1_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b100); }
    static inline void SET_IY_2_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b100); }
    static inline void SET_IY_3_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b100); }
    static inline void SET_IY_4_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b100); }
    static inline void SET_IY_5_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b100); }
    static inline void SET_IY_6_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b100); }
    static inline void SET_IY_7_with_LD_H(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b100); }
    static inline void SET_IY_0_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b101); }
    static inline void SET_IY_1_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b101); }
    static inline void SET_IY_2_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b101); }
    static inline void SET_IY_3_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b101); }
    static inline void SET_IY_4_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b101); }
    static inline void SET_IY_5_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b101); }
    static inline void SET_IY_6_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b101); }
    static inline void SET_IY_7_with_LD_L(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b101); }
    static inline void SET_IY_0_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 0, 0b111); }
    static inline void SET_IY_1_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 1, 0b111); }
    static inline void SET_IY_2_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 2, 0b111); }
    static inline void SET_IY_3_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 3, 0b111); }
    static inline void SET_IY_4_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 4, 0b111); }
    static inline void SET_IY_5_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 5, 0b111); }
    static inline void SET_IY_6_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 6, 0b111); }
    static inline void SET_IY_7_with_LD_A(Z80* ctx, signed char d) { ctx->SET_IY_with_LD(d, 7, 0b111); }
    inline void SET_IY_with_LD(signed char d, unsigned char bit, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        SET_IY(d, bit, rp, buf);
    }

    // RESET bit b of register r
    static inline void RES_B_0(Z80* ctx) { ctx->RES_R(0b000, 0); }
    static inline void RES_B_1(Z80* ctx) { ctx->RES_R(0b000, 1); }
    static inline void RES_B_2(Z80* ctx) { ctx->RES_R(0b000, 2); }
    static inline void RES_B_3(Z80* ctx) { ctx->RES_R(0b000, 3); }
    static inline void RES_B_4(Z80* ctx) { ctx->RES_R(0b000, 4); }
    static inline void RES_B_5(Z80* ctx) { ctx->RES_R(0b000, 5); }
    static inline void RES_B_6(Z80* ctx) { ctx->RES_R(0b000, 6); }
    static inline void RES_B_7(Z80* ctx) { ctx->RES_R(0b000, 7); }
    static inline void RES_C_0(Z80* ctx) { ctx->RES_R(0b001, 0); }
    static inline void RES_C_1(Z80* ctx) { ctx->RES_R(0b001, 1); }
    static inline void RES_C_2(Z80* ctx) { ctx->RES_R(0b001, 2); }
    static inline void RES_C_3(Z80* ctx) { ctx->RES_R(0b001, 3); }
    static inline void RES_C_4(Z80* ctx) { ctx->RES_R(0b001, 4); }
    static inline void RES_C_5(Z80* ctx) { ctx->RES_R(0b001, 5); }
    static inline void RES_C_6(Z80* ctx) { ctx->RES_R(0b001, 6); }
    static inline void RES_C_7(Z80* ctx) { ctx->RES_R(0b001, 7); }
    static inline void RES_D_0(Z80* ctx) { ctx->RES_R(0b010, 0); }
    static inline void RES_D_1(Z80* ctx) { ctx->RES_R(0b010, 1); }
    static inline void RES_D_2(Z80* ctx) { ctx->RES_R(0b010, 2); }
    static inline void RES_D_3(Z80* ctx) { ctx->RES_R(0b010, 3); }
    static inline void RES_D_4(Z80* ctx) { ctx->RES_R(0b010, 4); }
    static inline void RES_D_5(Z80* ctx) { ctx->RES_R(0b010, 5); }
    static inline void RES_D_6(Z80* ctx) { ctx->RES_R(0b010, 6); }
    static inline void RES_D_7(Z80* ctx) { ctx->RES_R(0b010, 7); }
    static inline void RES_E_0(Z80* ctx) { ctx->RES_R(0b011, 0); }
    static inline void RES_E_1(Z80* ctx) { ctx->RES_R(0b011, 1); }
    static inline void RES_E_2(Z80* ctx) { ctx->RES_R(0b011, 2); }
    static inline void RES_E_3(Z80* ctx) { ctx->RES_R(0b011, 3); }
    static inline void RES_E_4(Z80* ctx) { ctx->RES_R(0b011, 4); }
    static inline void RES_E_5(Z80* ctx) { ctx->RES_R(0b011, 5); }
    static inline void RES_E_6(Z80* ctx) { ctx->RES_R(0b011, 6); }
    static inline void RES_E_7(Z80* ctx) { ctx->RES_R(0b011, 7); }
    static inline void RES_H_0(Z80* ctx) { ctx->RES_R(0b100, 0); }
    static inline void RES_H_1(Z80* ctx) { ctx->RES_R(0b100, 1); }
    static inline void RES_H_2(Z80* ctx) { ctx->RES_R(0b100, 2); }
    static inline void RES_H_3(Z80* ctx) { ctx->RES_R(0b100, 3); }
    static inline void RES_H_4(Z80* ctx) { ctx->RES_R(0b100, 4); }
    static inline void RES_H_5(Z80* ctx) { ctx->RES_R(0b100, 5); }
    static inline void RES_H_6(Z80* ctx) { ctx->RES_R(0b100, 6); }
    static inline void RES_H_7(Z80* ctx) { ctx->RES_R(0b100, 7); }
    static inline void RES_L_0(Z80* ctx) { ctx->RES_R(0b101, 0); }
    static inline void RES_L_1(Z80* ctx) { ctx->RES_R(0b101, 1); }
    static inline void RES_L_2(Z80* ctx) { ctx->RES_R(0b101, 2); }
    static inline void RES_L_3(Z80* ctx) { ctx->RES_R(0b101, 3); }
    static inline void RES_L_4(Z80* ctx) { ctx->RES_R(0b101, 4); }
    static inline void RES_L_5(Z80* ctx) { ctx->RES_R(0b101, 5); }
    static inline void RES_L_6(Z80* ctx) { ctx->RES_R(0b101, 6); }
    static inline void RES_L_7(Z80* ctx) { ctx->RES_R(0b101, 7); }
    static inline void RES_A_0(Z80* ctx) { ctx->RES_R(0b111, 0); }
    static inline void RES_A_1(Z80* ctx) { ctx->RES_R(0b111, 1); }
    static inline void RES_A_2(Z80* ctx) { ctx->RES_R(0b111, 2); }
    static inline void RES_A_3(Z80* ctx) { ctx->RES_R(0b111, 3); }
    static inline void RES_A_4(Z80* ctx) { ctx->RES_R(0b111, 4); }
    static inline void RES_A_5(Z80* ctx) { ctx->RES_R(0b111, 5); }
    static inline void RES_A_6(Z80* ctx) { ctx->RES_R(0b111, 6); }
    static inline void RES_A_7(Z80* ctx) { ctx->RES_R(0b111, 7); }
    inline void RES_R(unsigned char r, unsigned char bit)
    {
        unsigned char* rp = getRegisterPointer(r);
        if (isDebug()) log("[%04X] RES %s of bit-%d", reg.PC - 2, registerDump(r), bit);
        switch (bit) {
            case 0: *rp &= 0b11111110; break;
            case 1: *rp &= 0b11111101; break;
            case 2: *rp &= 0b11111011; break;
            case 3: *rp &= 0b11110111; break;
            case 4: *rp &= 0b11101111; break;
            case 5: *rp &= 0b11011111; break;
            case 6: *rp &= 0b10111111; break;
            case 7: *rp &= 0b01111111; break;
        }
    }

    // RESET bit b of location (HL)
    static inline void RES_HL_0(Z80* ctx) { ctx->RES_HL(0); }
    static inline void RES_HL_1(Z80* ctx) { ctx->RES_HL(1); }
    static inline void RES_HL_2(Z80* ctx) { ctx->RES_HL(2); }
    static inline void RES_HL_3(Z80* ctx) { ctx->RES_HL(3); }
    static inline void RES_HL_4(Z80* ctx) { ctx->RES_HL(4); }
    static inline void RES_HL_5(Z80* ctx) { ctx->RES_HL(5); }
    static inline void RES_HL_6(Z80* ctx) { ctx->RES_HL(6); }
    static inline void RES_HL_7(Z80* ctx) { ctx->RES_HL(7); }
    inline void RES_HL(unsigned char bit)
    {
        unsigned short addr = getHL();
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RES (%s) = $%02X of bit-%d", reg.PC - 2, registerPairDump(0b10), n, bit);
        switch (bit) {
            case 0: n &= 0b11111110; break;
            case 1: n &= 0b11111101; break;
            case 2: n &= 0b11111011; break;
            case 3: n &= 0b11110111; break;
            case 4: n &= 0b11101111; break;
            case 5: n &= 0b11011111; break;
            case 6: n &= 0b10111111; break;
            case 7: n &= 0b01111111; break;
        }
        writeByte(addr, n, 3);
    }

    // RESET bit b of location (IX+d)
    static inline void RES_IX_0(Z80* ctx, signed char d) { ctx->RES_IX(d, 0); }
    static inline void RES_IX_1(Z80* ctx, signed char d) { ctx->RES_IX(d, 1); }
    static inline void RES_IX_2(Z80* ctx, signed char d) { ctx->RES_IX(d, 2); }
    static inline void RES_IX_3(Z80* ctx, signed char d) { ctx->RES_IX(d, 3); }
    static inline void RES_IX_4(Z80* ctx, signed char d) { ctx->RES_IX(d, 4); }
    static inline void RES_IX_5(Z80* ctx, signed char d) { ctx->RES_IX(d, 5); }
    static inline void RES_IX_6(Z80* ctx, signed char d) { ctx->RES_IX(d, 6); }
    static inline void RES_IX_7(Z80* ctx, signed char d) { ctx->RES_IX(d, 7); }
    inline void RES_IX(signed char d, unsigned char bit, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IX + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RES (IX+d<$%04X>) = $%02X of bit-%d%s", reg.PC - 4, addr, n, bit, extraLog ? extraLog : "");
        switch (bit) {
            case 0: n &= 0b11111110; break;
            case 1: n &= 0b11111101; break;
            case 2: n &= 0b11111011; break;
            case 3: n &= 0b11110111; break;
            case 4: n &= 0b11101111; break;
            case 5: n &= 0b11011111; break;
            case 6: n &= 0b10111111; break;
            case 7: n &= 0b01111111; break;
        }
        if (rp) *rp = n;
        writeByte(addr, n, 3);
    }

    // RESET bit b of location (IX+d) with load Reg.
    static inline void RES_IX_0_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b000); }
    static inline void RES_IX_1_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b000); }
    static inline void RES_IX_2_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b000); }
    static inline void RES_IX_3_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b000); }
    static inline void RES_IX_4_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b000); }
    static inline void RES_IX_5_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b000); }
    static inline void RES_IX_6_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b000); }
    static inline void RES_IX_7_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b000); }
    static inline void RES_IX_0_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b001); }
    static inline void RES_IX_1_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b001); }
    static inline void RES_IX_2_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b001); }
    static inline void RES_IX_3_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b001); }
    static inline void RES_IX_4_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b001); }
    static inline void RES_IX_5_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b001); }
    static inline void RES_IX_6_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b001); }
    static inline void RES_IX_7_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b001); }
    static inline void RES_IX_0_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b010); }
    static inline void RES_IX_1_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b010); }
    static inline void RES_IX_2_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b010); }
    static inline void RES_IX_3_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b010); }
    static inline void RES_IX_4_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b010); }
    static inline void RES_IX_5_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b010); }
    static inline void RES_IX_6_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b010); }
    static inline void RES_IX_7_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b010); }
    static inline void RES_IX_0_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b011); }
    static inline void RES_IX_1_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b011); }
    static inline void RES_IX_2_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b011); }
    static inline void RES_IX_3_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b011); }
    static inline void RES_IX_4_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b011); }
    static inline void RES_IX_5_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b011); }
    static inline void RES_IX_6_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b011); }
    static inline void RES_IX_7_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b011); }
    static inline void RES_IX_0_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b100); }
    static inline void RES_IX_1_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b100); }
    static inline void RES_IX_2_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b100); }
    static inline void RES_IX_3_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b100); }
    static inline void RES_IX_4_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b100); }
    static inline void RES_IX_5_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b100); }
    static inline void RES_IX_6_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b100); }
    static inline void RES_IX_7_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b100); }
    static inline void RES_IX_0_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b101); }
    static inline void RES_IX_1_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b101); }
    static inline void RES_IX_2_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b101); }
    static inline void RES_IX_3_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b101); }
    static inline void RES_IX_4_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b101); }
    static inline void RES_IX_5_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b101); }
    static inline void RES_IX_6_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b101); }
    static inline void RES_IX_7_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b101); }
    static inline void RES_IX_0_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 0, 0b111); }
    static inline void RES_IX_1_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 1, 0b111); }
    static inline void RES_IX_2_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 2, 0b111); }
    static inline void RES_IX_3_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 3, 0b111); }
    static inline void RES_IX_4_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 4, 0b111); }
    static inline void RES_IX_5_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 5, 0b111); }
    static inline void RES_IX_6_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 6, 0b111); }
    static inline void RES_IX_7_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IX_with_LD(d, 7, 0b111); }
    inline void RES_IX_with_LD(signed char d, unsigned char bit, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RES_IX(d, bit, rp, buf);
    }

    // RESET bit b of location (IY+d) with load Reg.
    static inline void RES_IY_0_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b000); }
    static inline void RES_IY_1_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b000); }
    static inline void RES_IY_2_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b000); }
    static inline void RES_IY_3_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b000); }
    static inline void RES_IY_4_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b000); }
    static inline void RES_IY_5_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b000); }
    static inline void RES_IY_6_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b000); }
    static inline void RES_IY_7_with_LD_B(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b000); }
    static inline void RES_IY_0_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b001); }
    static inline void RES_IY_1_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b001); }
    static inline void RES_IY_2_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b001); }
    static inline void RES_IY_3_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b001); }
    static inline void RES_IY_4_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b001); }
    static inline void RES_IY_5_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b001); }
    static inline void RES_IY_6_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b001); }
    static inline void RES_IY_7_with_LD_C(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b001); }
    static inline void RES_IY_0_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b010); }
    static inline void RES_IY_1_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b010); }
    static inline void RES_IY_2_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b010); }
    static inline void RES_IY_3_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b010); }
    static inline void RES_IY_4_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b010); }
    static inline void RES_IY_5_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b010); }
    static inline void RES_IY_6_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b010); }
    static inline void RES_IY_7_with_LD_D(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b010); }
    static inline void RES_IY_0_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b011); }
    static inline void RES_IY_1_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b011); }
    static inline void RES_IY_2_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b011); }
    static inline void RES_IY_3_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b011); }
    static inline void RES_IY_4_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b011); }
    static inline void RES_IY_5_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b011); }
    static inline void RES_IY_6_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b011); }
    static inline void RES_IY_7_with_LD_E(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b011); }
    static inline void RES_IY_0_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b100); }
    static inline void RES_IY_1_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b100); }
    static inline void RES_IY_2_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b100); }
    static inline void RES_IY_3_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b100); }
    static inline void RES_IY_4_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b100); }
    static inline void RES_IY_5_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b100); }
    static inline void RES_IY_6_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b100); }
    static inline void RES_IY_7_with_LD_H(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b100); }
    static inline void RES_IY_0_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b101); }
    static inline void RES_IY_1_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b101); }
    static inline void RES_IY_2_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b101); }
    static inline void RES_IY_3_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b101); }
    static inline void RES_IY_4_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b101); }
    static inline void RES_IY_5_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b101); }
    static inline void RES_IY_6_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b101); }
    static inline void RES_IY_7_with_LD_L(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b101); }
    static inline void RES_IY_0_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 0, 0b111); }
    static inline void RES_IY_1_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 1, 0b111); }
    static inline void RES_IY_2_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 2, 0b111); }
    static inline void RES_IY_3_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 3, 0b111); }
    static inline void RES_IY_4_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 4, 0b111); }
    static inline void RES_IY_5_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 5, 0b111); }
    static inline void RES_IY_6_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 6, 0b111); }
    static inline void RES_IY_7_with_LD_A(Z80* ctx, signed char d) { ctx->RES_IY_with_LD(d, 7, 0b111); }
    inline void RES_IY_with_LD(signed char d, unsigned char bit, unsigned char r)
    {
        char buf[80];
        unsigned char* rp = getRegisterPointer(r);
#ifndef BUILD_WASM
        if (isDebug()) {
            snprintf(buf, sizeof(buf), " --> %s", registerDump(r));
        } else {
#endif
            buf[0] = '\0';
#ifndef BUILD_WASM
        }
#endif
        RES_IY(d, bit, rp, buf);
    }

    // RESET bit b of location (IY+d)
    static inline void RES_IY_0(Z80* ctx, signed char d) { ctx->RES_IY(d, 0); }
    static inline void RES_IY_1(Z80* ctx, signed char d) { ctx->RES_IY(d, 1); }
    static inline void RES_IY_2(Z80* ctx, signed char d) { ctx->RES_IY(d, 2); }
    static inline void RES_IY_3(Z80* ctx, signed char d) { ctx->RES_IY(d, 3); }
    static inline void RES_IY_4(Z80* ctx, signed char d) { ctx->RES_IY(d, 4); }
    static inline void RES_IY_5(Z80* ctx, signed char d) { ctx->RES_IY(d, 5); }
    static inline void RES_IY_6(Z80* ctx, signed char d) { ctx->RES_IY(d, 6); }
    static inline void RES_IY_7(Z80* ctx, signed char d) { ctx->RES_IY(d, 7); }
    inline void RES_IY(signed char d, unsigned char bit, unsigned char* rp = nullptr, const char* extraLog = nullptr)
    {
        unsigned short addr = (unsigned short)(reg.IY + d);
        unsigned char n = readByte(addr);
        if (isDebug()) log("[%04X] RES (IY+d<$%04X>) = $%02X of bit-%d%s", reg.PC - 4, addr, n, bit, extraLog ? extraLog : "");
        switch (bit) {
            case 0: n &= 0b11111110; break;
            case 1: n &= 0b11111101; break;
            case 2: n &= 0b11111011; break;
            case 3: n &= 0b11110111; break;
            case 4: n &= 0b11101111; break;
            case 5: n &= 0b11011111; break;
            case 6: n &= 0b10111111; break;
            case 7: n &= 0b01111111; break;
        }
        if (rp) *rp = n;
        writeByte(addr, n, 3);
    }

    // Compare location (HL) and A, increment/decrement HL and decrement BC
    inline void repeatCP(bool isIncHL, bool isRepeat)
    {
        unsigned short hl = getHL();
        unsigned short bc = getBC();
        unsigned char n = readByte(hl);
        if (isDebug()) {
            if (isIncHL) {
                log("[%04X] %s ... %s, %s = $%02X, %s", reg.PC - 2, isRepeat ? "CPIR" : "CPI", registerDump(0b111), registerPairDump(0b10), n, registerPairDump(0b00));
            } else {
                log("[%04X] %s ... %s, %s = $%02X, %s", reg.PC - 2, isRepeat ? "CPDR" : "CPD", registerDump(0b111), registerPairDump(0b10), n, registerPairDump(0b00));
            }
        }
        subtract8(n, 0, false, false);
        int nn = reg.pair.A;
        nn -= n;
        nn -= isFlagH() ? 1 : 0;
        setFlagY(nn & 0b00000010);
        setFlagX(nn & 0b00001000);
        setHL((unsigned short)(hl + (isIncHL ? 1 : -1)));
        bc--;
        setBC(bc);
        setFlagPV(0 != bc);
        consumeClock(4);
        if (isRepeat && !isFlagZ() && 0 != getBC()) {
            reg.PC -= 2;
            consumeClock(5);
        }
        reg.WZ += isIncHL ? 1 : -1;
    }
    static inline void CPI(Z80* ctx) { ctx->repeatCP(true, false); }
    static inline void CPIR(Z80* ctx) { ctx->repeatCP(true, true); }
    static inline void CPD(Z80* ctx) { ctx->repeatCP(false, false); }
    static inline void CPDR(Z80* ctx) { ctx->repeatCP(false, true); }

    // Compare Register
    static inline void CP_B(Z80* ctx) { ctx->CP_R(0b000); }
    static inline void CP_C(Z80* ctx) { ctx->CP_R(0b001); }
    static inline void CP_D(Z80* ctx) { ctx->CP_R(0b010); }
    static inline void CP_E(Z80* ctx) { ctx->CP_R(0b011); }
    static inline void CP_H(Z80* ctx) { ctx->CP_R(0b100); }
    static inline void CP_L(Z80* ctx) { ctx->CP_R(0b101); }
    static inline void CP_A(Z80* ctx) { ctx->CP_R(0b111); }
    static inline void CP_B_2(Z80* ctx) { ctx->CP_R(0b000, 2); }
    static inline void CP_C_2(Z80* ctx) { ctx->CP_R(0b001, 2); }
    static inline void CP_D_2(Z80* ctx) { ctx->CP_R(0b010, 2); }
    static inline void CP_E_2(Z80* ctx) { ctx->CP_R(0b011, 2); }
    static inline void CP_A_2(Z80* ctx) { ctx->CP_R(0b111, 2); }
    inline void CP_R(unsigned char r, int pc = 1)
    {
        if (isDebug()) log("[%04X] CP %s, %s", reg.PC - pc, registerDump(0b111), registerDump(r));
        unsigned char* rp = getRegisterPointer(r);
        subtract8(*rp, 0, true, false);
    }

    // Compare Register IXH
    static inline void CP_IXH_(Z80* ctx) { ctx->CP_IXH(); }
    inline void CP_IXH()
    {
        if (isDebug()) log("[%04X] CP %s, IXH<$%02X>", reg.PC - 2, registerDump(0b111), getIXH());
        subtract8(getIXH(), 0, true, false);
    }

    // Compare Register IXL
    static inline void CP_IXL_(Z80* ctx) { ctx->CP_IXL(); }
    inline void CP_IXL()
    {
        if (isDebug()) log("[%04X] CP %s, IXL<$%02X>", reg.PC - 2, registerDump(0b111), getIXL());
        subtract8(getIXL(), 0, true, false);
    }

    // Compare Register IYH
    static inline void CP_IYH_(Z80* ctx) { ctx->CP_IYH(); }
    inline void CP_IYH()
    {
        if (isDebug()) log("[%04X] CP %s, IYH<$%02X>", reg.PC - 2, registerDump(0b111), getIYH());
        subtract8(getIYH(), 0, true, false);
    }

    // Compare Register IYL
    static inline void CP_IYL_(Z80* ctx) { ctx->CP_IYL(); }
    inline void CP_IYL()
    {
        if (isDebug()) log("[%04X] CP %s, IYL<$%02X>", reg.PC - 2, registerDump(0b111), getIYL());
        subtract8(getIYL(), 0, true, false);
    }

    // Compare immediate
    static inline void CP_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] CP %s, $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n);
        ctx->subtract8(n, 0, true, false);
    }

    // Compare memory
    static inline void CP_HL(Z80* ctx)
    {
        unsigned char n = ctx->readByte(ctx->getHL(), 3);
        if (ctx->isDebug()) ctx->log("[%04X] CP %s, (%s) = $%02X", ctx->reg.PC - 1, ctx->registerDump(0b111), ctx->registerPairDump(0b10), n);
        ctx->subtract8(n, 0, true, false);
    }

    // Compare memory
    static inline void CP_IX_(Z80* ctx) { ctx->CP_IX(); }
    inline void CP_IX()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IX + d));
        if (isDebug()) log("[%04X] CP %s, (IX+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IX + d), n);
        subtract8(n, 0, true, false);
        consumeClock(3);
    }

    // Compare memory
    static inline void CP_IY_(Z80* ctx) { ctx->CP_IY(); }
    inline void CP_IY()
    {
        signed char d = (signed char)fetch(4);
        unsigned char n = readByte((unsigned short)(reg.IY + d));
        if (isDebug()) log("[%04X] CP %s, (IY+d<$%04X>) = $%02X", reg.PC - 3, registerDump(0b111), (unsigned short)(reg.IY + d), n);
        subtract8(n, 0, true, false);
        consumeClock(3);
    }

    // Jump
    static inline void JP_NN(Z80* ctx)
    {
        unsigned char l = ctx->fetch(3);
        unsigned char h = ctx->fetch(3);
        unsigned short addr = ctx->make16BitsFromLE(l, h);
        if (ctx->isDebug()) ctx->log("[%04X] JP $%04X", ctx->reg.PC - 3, addr);
        ctx->reg.PC = addr;
        ctx->reg.WZ = addr;
    }

    // Conditional Jump
    static inline void JP_C0_NN(Z80* ctx) { ctx->JP_C_NN(0); }
    static inline void JP_C1_NN(Z80* ctx) { ctx->JP_C_NN(1); }
    static inline void JP_C2_NN(Z80* ctx) { ctx->JP_C_NN(2); }
    static inline void JP_C3_NN(Z80* ctx) { ctx->JP_C_NN(3); }
    static inline void JP_C4_NN(Z80* ctx) { ctx->JP_C_NN(4); }
    static inline void JP_C5_NN(Z80* ctx) { ctx->JP_C_NN(5); }
    static inline void JP_C6_NN(Z80* ctx) { ctx->JP_C_NN(6); }
    static inline void JP_C7_NN(Z80* ctx) { ctx->JP_C_NN(7); }
    inline void JP_C_NN(unsigned char c)
    {
        unsigned char l = fetch(3);
        unsigned char h = fetch(3);
        unsigned short addr = make16BitsFromLE(l, h);
        if (isDebug()) log("[%04X] JP %s, $%04X", reg.PC - 3, conditionDump(c), addr);
        if (checkConditionFlag(c)) reg.PC = addr;
        reg.WZ = addr;
    }

    // Jump Relative to PC+e
    static inline void JR_E(Z80* ctx)
    {
        signed char e = (signed char)ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] JR %s", ctx->reg.PC - 2, ctx->relativeDump(ctx->reg.PC - 2, e));
        ctx->reg.PC += e;
        ctx->consumeClock(5);
    }

    // Jump Relative to PC+e, if condition
    static inline void JR_NZ_E(Z80* ctx) { ctx->JR_CND_E(0); }
    static inline void JR_Z_E(Z80* ctx) { ctx->JR_CND_E(1); }
    static inline void JR_NC_E(Z80* ctx) { ctx->JR_CND_E(2); }
    static inline void JR_C_E(Z80* ctx) { ctx->JR_CND_E(3); }
    inline void JR_CND_E(unsigned char cnd)
    {
        signed char e = (signed char)fetch(3);
        if (isDebug()) log("[%04X] JR %s, %s <%s>", reg.PC - 2, conditionDump(cnd), relativeDump(reg.PC - 2, e), checkConditionFlag(cnd) ? "YES" : "NO");
        if (checkConditionFlag(cnd)) {
            reg.PC += e;
            consumeClock(5);
        }
    }

    // Jump to HL
    static inline void JP_HL(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] JP %s", ctx->reg.PC - 1, ctx->registerPairDump(0b10));
        ctx->reg.PC = ctx->getHL();
    }

    // Jump to IX
    static inline void JP_IX(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] JP IX<$%04X>", ctx->reg.PC - 2, ctx->reg.IX);
        ctx->reg.PC = ctx->reg.IX;
    }

    // Jump to IY
    static inline void JP_IY(Z80* ctx)
    {
        if (ctx->isDebug()) ctx->log("[%04X] JP IY<$%04X>", ctx->reg.PC - 2, ctx->reg.IY);
        ctx->reg.PC = ctx->reg.IY;
    }

    // 	Decrement B and Jump relative if B=0
    static inline void DJNZ_E(Z80* ctx)
    {
        signed char e = (signed char)ctx->fetch(4);
        if (ctx->isDebug()) ctx->log("[%04X] DJNZ %s (%s)", ctx->reg.PC - 2, ctx->relativeDump(ctx->reg.PC - 2, e), ctx->registerDump(0b000));
        ctx->reg.pair.B--;
        if (ctx->reg.pair.B) {
            ctx->reg.PC += e;
            ctx->consumeClock(5);
        }
    }

    // Call
    static inline void CALL_NN(Z80* ctx)
    {
        unsigned short addrL = ctx->fetch(4);
        unsigned short addrH = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] CALL $%04X (%s)", ctx->reg.PC - 3, ctx->make16BitsFromLE(addrL, addrH), ctx->registerPairDump(0b11));
        ctx->push(ctx->getPCH(), 3);
        ctx->setPCH(addrH);
        ctx->push(ctx->getPCL(), 3);
        ctx->setPCL(addrL);
        ctx->reg.WZ = ctx->reg.PC;
        ctx->invokeCallHandlers();
    }

    // Return
    static inline void RET(Z80* ctx)
    {
        ctx->invokeReturnHandlers();
        unsigned short pc = ctx->reg.PC - 1;
        const char* dump = ctx->isDebug() ? ctx->registerPairDump(0b11) : "";
        ctx->setPCL(ctx->pop(3));
        ctx->setPCH(ctx->pop(3));
        ctx->reg.WZ = ctx->reg.PC;
        if (ctx->isDebug()) ctx->log("[%04X] RET to $%04X (%s)", pc, ctx->reg.PC, dump);
    }

    // Call with condition
    static inline void CALL_C0_NN(Z80* ctx) { ctx->CALL_C_NN(0); }
    static inline void CALL_C1_NN(Z80* ctx) { ctx->CALL_C_NN(1); }
    static inline void CALL_C2_NN(Z80* ctx) { ctx->CALL_C_NN(2); }
    static inline void CALL_C3_NN(Z80* ctx) { ctx->CALL_C_NN(3); }
    static inline void CALL_C4_NN(Z80* ctx) { ctx->CALL_C_NN(4); }
    static inline void CALL_C5_NN(Z80* ctx) { ctx->CALL_C_NN(5); }
    static inline void CALL_C6_NN(Z80* ctx) { ctx->CALL_C_NN(6); }
    static inline void CALL_C7_NN(Z80* ctx) { ctx->CALL_C_NN(7); }
    inline void CALL_C_NN(unsigned char c)
    {
        bool execute = checkConditionFlag(c);
        unsigned char nL = fetch(3);
        unsigned char nH = fetch(3);
        if (isDebug()) log("[%04X] CALL %s, $%04X (%s) <execute:%s>", reg.PC - 3, conditionDump(c), make16BitsFromLE(nL, nH), registerPairDump(0b11), execute ? "YES" : "NO");
        if (execute) {
            push(getPCH(), 4);
            setPCH(nH);
            push(getPCL(), 3);
            setPCL(nL);
            invokeCallHandlers();
        }
        reg.WZ = reg.PC;
    }

    //  with condition
    static inline void RET_C0(Z80* ctx) { ctx->RET_C(0); }
    static inline void RET_C1(Z80* ctx) { ctx->RET_C(1); }
    static inline void RET_C2(Z80* ctx) { ctx->RET_C(2); }
    static inline void RET_C3(Z80* ctx) { ctx->RET_C(3); }
    static inline void RET_C4(Z80* ctx) { ctx->RET_C(4); }
    static inline void RET_C5(Z80* ctx) { ctx->RET_C(5); }
    static inline void RET_C6(Z80* ctx) { ctx->RET_C(6); }
    static inline void RET_C7(Z80* ctx) { ctx->RET_C(7); }
    inline void RET_C(unsigned char c)
    {
        if (!checkConditionFlag(c)) {
            if (isDebug()) log("[%04X] RET %s <execute:NO>", reg.PC - 1, conditionDump(c));
            consumeClock(1);
            return;
        }
        invokeReturnHandlers();
        unsigned short pc = reg.PC;
        unsigned short sp = reg.SP;
        setPCL(pop(4));
        setPCH(pop(3));
        reg.WZ = reg.PC;
        if (isDebug()) log("[%04X] RET %s to $%04X (SP<$%04X>) <execute:YES>", pc - 1, conditionDump(c), reg.PC, sp);
    }

    // Return from interrupt
    static inline void RETI_(Z80* ctx) { ctx->RETI(); }
    inline void RETI()
    {
        invokeReturnHandlers();
        unsigned short pc = reg.PC;
        unsigned short sp = reg.SP;
        setPCL(pop(3));
        setPCH(pop(3));
        reg.WZ = reg.PC;
        reg.IFF &= ~IFF_IRQ();
        if (isDebug()) log("[%04X] RETI to $%04X (SP<$%04X>)", pc - 2, reg.PC, sp);
    }

    // Return from non maskable interrupt
    static inline void RETN_(Z80* ctx) { ctx->RETN(); }
    inline void RETN()
    {
        invokeReturnHandlers();
        unsigned short pc = reg.PC;
        unsigned short sp = reg.SP;
        setPCL(pop(3));
        setPCH(pop(3));
        reg.WZ = reg.PC;
        reg.IFF &= ~IFF_NMI();
        if (!((reg.IFF & IFF1()) && (reg.IFF & IFF2()))) {
            reg.IFF |= IFF1();
        } else {
            if (reg.IFF & IFF2()) {
                reg.IFF |= IFF1();
            } else {
                reg.IFF &= ~IFF1();
            }
        }
        if (isDebug()) log("[%04X] RETN to $%04X (SP<$%04X>)", pc - 2, reg.PC, sp);
    }

    // Interrupt
    static inline void RST00(Z80* ctx) { ctx->RST(0, true); }
    static inline void RST08(Z80* ctx) { ctx->RST(1, true); }
    static inline void RST10(Z80* ctx) { ctx->RST(2, true); }
    static inline void RST18(Z80* ctx) { ctx->RST(3, true); }
    static inline void RST20(Z80* ctx) { ctx->RST(4, true); }
    static inline void RST28(Z80* ctx) { ctx->RST(5, true); }
    static inline void RST30(Z80* ctx) { ctx->RST(6, true); }
    static inline void RST38(Z80* ctx) { ctx->RST(7, true); }
    inline void RST(unsigned char t, bool isOperand)
    {
        unsigned short addr = t * 8;
        unsigned short sp = reg.SP;
        unsigned short pc = reg.PC;
        push(getPCH(), 4);
        setPCH(0);
        push(getPCL(), 3);
        reg.PC = addr;
        reg.WZ = addr;
        if (isDebug()) log("[%04X] RST $%04X (SP<$%04X>)", pc - (isOperand ? 1 : 0), addr, sp);
        invokeCallHandlers();
    }

    // Input a byte form device n to accu.
    static inline void IN_A_N(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        unsigned char i = ctx->inPortWithA(n);
        if (ctx->isDebug()) ctx->log("[%04X] IN %s, ($%02X) = $%02X", ctx->reg.PC - 2, ctx->registerDump(0b111), n, i);
        ctx->reg.pair.A = i;
    }

    static inline void IN0_B_N(Z80* ctx) { ctx->IN0_B_N_(); }
    inline void IN0_B_N_()
    {
    }

    // Input a byte form device (C) to register.
    static inline void IN_B_C(Z80* ctx) { ctx->IN_R_C(0b000); }
    static inline void IN_C_C(Z80* ctx) { ctx->IN_R_C(0b001); }
    static inline void IN_D_C(Z80* ctx) { ctx->IN_R_C(0b010); }
    static inline void IN_E_C(Z80* ctx) { ctx->IN_R_C(0b011); }
    static inline void IN_H_C(Z80* ctx) { ctx->IN_R_C(0b100); }
    static inline void IN_L_C(Z80* ctx) { ctx->IN_R_C(0b101); }
    static inline void IN_C(Z80* ctx) { ctx->IN_R_C(0, false); }
    static inline void IN_A_C(Z80* ctx) { ctx->IN_R_C(0b111); }
    inline void IN_R_C(unsigned char r, bool setRegister = true)
    {
        unsigned char* rp = setRegister ? getRegisterPointer(r) : nullptr;
        unsigned char i = inPortWithB(reg.pair.C);
        if (rp) {
            if (isDebug()) log("[%04X] IN %s, (%s) = $%02X", reg.PC - 2, registerDump(r), registerDump(0b001), i);
            *rp = i;
        } else {
            if (isDebug()) log("[%04X] IN (%s) = $%02X", reg.PC - 2, registerDump(0b001), i);
        }
        setFlagS(i & 0x80);
        setFlagZ(i == 0);
        setFlagH(false);
        setFlagPV(isEvenNumberBits(i));
        setFlagN(false);
        setFlagXY(i);
    }

    inline void decrementB_forRepeatIO()
    {
        reg.pair.B--;
        reg.pair.F = 0;
        setFlagC(isFlagC());
        setFlagN(true);
        setFlagZ(reg.pair.B == 0);
        setFlagXY(reg.pair.B);
        setFlagS(reg.pair.B & 0x80);
        setFlagH((reg.pair.B & 0x0F) == 0x0F);
        setFlagPV(reg.pair.B == 0x7F);
    }

    // Load location (HL) with input from port (C); or increment/decrement HL and decrement B
    inline void repeatIN(bool isIncHL, bool isRepeat)
    {
        reg.WZ = (unsigned short)(getBC() + (isIncHL ? 1 : -1));
        unsigned char i = inPortWithB(reg.pair.C);
        decrementB_forRepeatIO();
        unsigned short hl = getHL();
        if (isDebug()) {
            if (isIncHL) {
                log("[%04X] %s ... (%s) <- p(%s) = $%02X [%s]", reg.PC - 2, isRepeat ? "INIR" : "INI", registerPairDump(0b10), registerDump(0b001), i, registerDump(0b000));
            } else {
                log("[%04X] %s ... (%s) <- p(%s) = $%02X [%s]", reg.PC - 2, isRepeat ? "INDR" : "IND", registerPairDump(0b10), registerDump(0b001), i, registerDump(0b000));
            }
        }
        writeByte(hl, i);
        hl += isIncHL ? 1 : -1;
        setHL(hl);
        setFlagZ(reg.pair.B == 0);
        setFlagN(i & 0x80);                                               // NOTE: undocumented
        setFlagC(0xFF < i + ((reg.pair.C + 1) & 0xFF));                   // NOTE: undocumented
        setFlagH(isFlagC());                                              // NOTE: undocumented
        setFlagPV((i + (((reg.pair.C + 1) & 0xFF) & 0x07)) ^ reg.pair.B); // NOTE: undocumented
        if (isRepeat && 0 != reg.pair.B) {
            reg.PC -= 2;
            consumeClock(5);
        }
    }
    static inline void INI(Z80* ctx) { ctx->repeatIN(true, false); }
    static inline void INIR(Z80* ctx) { ctx->repeatIN(true, true); }
    static inline void IND(Z80* ctx) { ctx->repeatIN(false, false); }
    static inline void INDR(Z80* ctx) { ctx->repeatIN(false, true); }

    // Load Output port (n) with Acc.
    static inline void OUT_N_A(Z80* ctx)
    {
        unsigned char n = ctx->fetch(3);
        if (ctx->isDebug()) ctx->log("[%04X] OUT ($%02X), %s", ctx->reg.PC - 2, n, ctx->registerDump(0b111));
        ctx->outPortWithA(n, ctx->reg.pair.A);
    }

    // Output a byte to device (C) form register.
    static inline void OUT_C_B(Z80* ctx) { ctx->OUT_C_R(0b000); }
    static inline void OUT_C_C(Z80* ctx) { ctx->OUT_C_R(0b001); }
    static inline void OUT_C_D(Z80* ctx) { ctx->OUT_C_R(0b010); }
    static inline void OUT_C_E(Z80* ctx) { ctx->OUT_C_R(0b011); }
    static inline void OUT_C_H(Z80* ctx) { ctx->OUT_C_R(0b100); }
    static inline void OUT_C_L(Z80* ctx) { ctx->OUT_C_R(0b101); }
    static inline void OUT_C_0(Z80* ctx) { ctx->OUT_C_R(0, true); }
    static inline void OUT_C_A(Z80* ctx) { ctx->OUT_C_R(0b111); }
    inline void OUT_C_R(unsigned char r, bool zero = false)
    {
        if (zero) {
            if (isDebug()) log("[%04X] OUT (%s), 0", reg.PC - 2, registerDump(0b001));
            outPortWithB(reg.pair.C, 0);
        } else {
            if (isDebug()) log("[%04X] OUT (%s), %s", reg.PC - 2, registerDump(0b001), registerDump(r));
            outPortWithB(reg.pair.C, getRegister(r));
        }
    }

    // Load Output port (C) with location (HL), increment/decrement HL and decrement B
    inline void repeatOUT(bool isIncHL, bool isRepeat)
    {
        unsigned char o = readByte(getHL());
        if (isDebug()) {
            if (isIncHL) {
                log("[%04X] %s ... p(%s) <- (%s) <$%02x> [%s]", reg.PC - 2, isRepeat ? "OUTIR" : "OUTI", registerDump(0b001), registerPairDump(0b10), o, registerDump(0b000));
            } else {
                log("[%04X] %s ... p(%s) <- (%s) <$%02x> [%s]", reg.PC - 2, isRepeat ? "OUTDR" : "OUTD", registerDump(0b001), registerPairDump(0b10), o, registerDump(0b000));
            }
        }
        decrementB_forRepeatIO();
        outPortWithB(reg.pair.C, o);
        reg.WZ = (unsigned short)(getBC() + (isIncHL ? 1 : -1));
        setHL((unsigned short)(getHL() + (isIncHL ? 1 : -1)));
        setFlagZ(reg.pair.B == 0);
        setFlagN(o & 0x80);                                // NOTE: ACTUAL FLAG CONDITION IS UNKNOWN
        setFlagH(reg.pair.L + o > 0xFF);                   // NOTE: ACTUAL FLAG CONDITION IS UNKNOWN
        setFlagC(isFlagH());                               // NOTE: ACTUAL FLAG CONDITION IS UNKNOWN
        setFlagPV(((reg.pair.H + o) & 0x07) ^ reg.pair.B); // NOTE: ACTUAL FLAG CONDITION IS UNKNOWN
        if (isRepeat && 0 != reg.pair.B) {
            reg.PC -= 2;
            consumeClock(5);
        }
    }
    static inline void OUTI(Z80* ctx) { ctx->repeatOUT(true, false); }
    static inline void OUTIR(Z80* ctx) { ctx->repeatOUT(true, true); }
    static inline void OUTD(Z80* ctx) { ctx->repeatOUT(false, false); }
    static inline void OUTDR(Z80* ctx) { ctx->repeatOUT(false, true); }

    // Decimal Adjust Accumulator
    static inline void DAA(Z80* ctx) { ctx->daa(); }
    inline void daa()
    {
        int a = reg.pair.A;
        bool c = isFlagC();
        bool ac = reg.pair.A > 0x99;
        int add = (isFlagH() || (a & 0x0F) > 9 ? 0x06 : 0x00) + (c || ac ? 0x60 : 0x00);
        a += isFlagN() ? -add : add;
        a &= 0xFF;
        setFlagS(a & 0x80);
        setFlagXY(a);
        setFlagZ(0 == a);
        setFlagH((a ^ reg.pair.A) & flagH());
        setFlagPV(isEvenNumberBits(a));
        setFlagC(c | ac);
        if (isDebug()) log("[%04X] DAA ... A: $%02X -> $%02X", reg.PC - 1, reg.pair.A, a);
        reg.pair.A = a;
    }

    // Rotate digit Left and right between Acc. and location (HL)
    static inline void RLD_(Z80* ctx) { ctx->RLD(); }
    inline void RLD()
    {
        unsigned short hl = getHL();
        unsigned char beforeN = readByte(hl);
        unsigned char nH = (beforeN & 0b11110000) >> 4;
        unsigned char nL = beforeN & 0b00001111;
        unsigned char aH = (reg.pair.A & 0b11110000) >> 4;
        unsigned char aL = reg.pair.A & 0b00001111;
        unsigned char beforeA = reg.pair.A;
        unsigned char afterA = (aH << 4) | nH;
        unsigned char afterN = (nL << 4) | aL;
        if (isDebug()) log("[%04X] RLD ... A: $%02X -> $%02X, ($%04X): $%02X -> $%02X", reg.PC - 2, beforeA, afterA, hl, beforeN, afterN);
        reg.pair.A = afterA;
        writeByte(hl, afterN);
        setFlagS(reg.pair.A & 0x80);
        setFlagXY(reg.pair.A);
        setFlagZ(reg.pair.A == 0);
        setFlagH(false);
        setFlagPV(isEvenNumberBits(reg.pair.A));
        setFlagN(false);
        consumeClock(2);
    }

    // Rotate digit Right and right between Acc. and location (HL)
    static inline void RRD_(Z80* ctx) { ctx->RRD(); }
    inline void RRD()
    {
        unsigned short hl = getHL();
        unsigned char beforeN = readByte(hl);
        unsigned char nH = (beforeN & 0b11110000) >> 4;
        unsigned char nL = beforeN & 0b00001111;
        unsigned char aH = (reg.pair.A & 0b11110000) >> 4;
        unsigned char aL = reg.pair.A & 0b00001111;
        unsigned char beforeA = reg.pair.A;
        unsigned char afterA = (aH << 4) | nL;
        unsigned char afterN = (aL << 4) | nH;
        if (isDebug()) log("[%04X] RRD ... A: $%02X -> $%02X, ($%04X): $%02X -> $%02X", reg.PC - 2, beforeA, afterA, hl, beforeN, afterN);
        reg.pair.A = afterA;
        writeByte(hl, afterN);
        setFlagS(reg.pair.A & 0x80);
        setFlagXY(reg.pair.A);
        setFlagZ(reg.pair.A == 0);
        setFlagH(false);
        setFlagPV(isEvenNumberBits(reg.pair.A));
        setFlagN(false);
        consumeClock(2);
    }

    int opLength1[256] = {
        1, 3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, // 00 ~ 0F
        2, 3, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, // 10 ~ 1F
        2, 3, 3, 1, 1, 1, 2, 1, 2, 1, 3, 1, 1, 1, 2, 1, // 20 ~ 2F
        2, 3, 3, 1, 1, 1, 2, 1, 2, 1, 3, 1, 1, 1, 2, 1, // 30 ~ 3F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 40 ~ 4F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 50 ~ 5F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 60 ~ 6F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 70 ~ 7F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 80 ~ 8F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 90 ~ 9F
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // A0 ~ AF
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // B0 ~ BF
        1, 1, 3, 3, 3, 1, 2, 1, 1, 1, 3, 2, 3, 3, 2, 1, // C0 ~ CF
        1, 1, 3, 2, 3, 1, 2, 1, 1, 1, 3, 2, 3, 0, 2, 1, // D0 ~ DF
        1, 1, 3, 1, 3, 1, 2, 1, 1, 1, 3, 1, 3, 0, 2, 1, // E0 ~ EF
        1, 1, 3, 1, 3, 1, 2, 1, 1, 1, 3, 1, 3, 0, 2, 1  // F0 ~ FF
    };
    int opLengthED[256] = {
        3, 3, 0, 0, 2, 0, 0, 0, 3, 3, 0, 0, 2, 0, 0, 0, // 00 ~ 0F
        3, 3, 0, 0, 2, 0, 0, 0, 3, 3, 0, 0, 2, 0, 0, 0, // 10 ~ 1F
        3, 3, 0, 0, 2, 0, 0, 0, 3, 3, 0, 0, 2, 0, 0, 0, // 20 ~ 2F
        0, 0, 0, 0, 2, 0, 0, 0, 3, 3, 0, 0, 2, 0, 0, 0, // 30 ~ 3F
        2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2, 2, 0, 2, // 40 ~ 4F
        2, 2, 2, 4, 0, 0, 2, 2, 2, 2, 2, 4, 2, 0, 2, 2, // 50 ~ 5F
        2, 2, 2, 4, 3, 0, 0, 2, 2, 2, 2, 4, 2, 0, 0, 2, // 60 ~ 6F
        2, 2, 2, 4, 3, 0, 2, 0, 2, 2, 2, 4, 2, 0, 0, 0, // 70 ~ 7F
        0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, // 80 ~ 8F
        0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, // 90 ~ 9F
        2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, // A0 ~ AF
        2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, // B0 ~ BF
#if R800
        //                                 .hl←.a * r
        // 1100 0001 ED C1  mulub .a, .b
        // 1100 1001 ED C9  mulub .a, .c
        // 1101 0001 ED D1  mulub .a, .d
        // 1101 1001 ED D9  mulub .a, .e
        //                                 .de:.hl←.hl * ss
        // 1100 0011 ED C3  muluw .hl, .bc
        // 1111 0011 ED F3  muluw .hl, .sp
        0, 2, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, // C0 ~ CF
        0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, // D0 ~ DF
#else
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // C0 ~ CF
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // D0 ~ DF
#endif
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // E0 ~ EF
#if R800
        0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // F0 ~ FF
#else
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // F0 ~ FF
#endif
    };
    int opLengthIXY[256] = {
        0, 0, 0, 0, 2, 2, 3, 0, 0, 2, 0, 0, 2, 2, 3, 0, // 00 ~ 0F
        0, 0, 0, 0, 2, 2, 3, 0, 0, 2, 0, 0, 2, 2, 3, 0, // 10 ~ 1F
        0, 4, 4, 2, 2, 2, 3, 0, 0, 2, 4, 2, 2, 2, 3, 0, // 20 ~ 2F
        0, 0, 0, 0, 3, 3, 4, 0, 0, 2, 0, 0, 2, 2, 3, 0, // 30 ~ 3F
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // 40 ~ 4F
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // 50 ~ 5F
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // 60 ~ 6F
        3, 3, 3, 3, 3, 3, 0, 3, 2, 2, 2, 2, 2, 2, 3, 2, // 70 ~ 7F
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // 80 ~ 8F
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // 90 ~ 9F
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // A0 ~ AF
        2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2, // B0 ~ BF
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, // C0 ~ CF
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // D0 ~ DF
        0, 2, 0, 2, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, // E0 ~ EF
        0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0  // F0 ~ FF
    };
    void (*opSet1[256])(Z80* ctx) = {
        NOP, LD_BC_NN, LD_BC_A, INC_RP_BC, INC_B, DEC_B, LD_B_N, RLCA, EX_AF_AF2, ADD_HL_BC, LD_A_BC, DEC_RP_BC, INC_C, DEC_C, LD_C_N, RRCA,
        DJNZ_E, LD_DE_NN, LD_DE_A, INC_RP_DE, INC_D, DEC_D, LD_D_N, RLA, JR_E, ADD_HL_DE, LD_A_DE, DEC_RP_DE, INC_E, DEC_E, LD_E_N, RRA,
        JR_NZ_E, LD_HL_NN, LD_ADDR_HL, INC_RP_HL, INC_H, DEC_H, LD_H_N, DAA, JR_Z_E, ADD_HL_HL, LD_HL_ADDR, DEC_RP_HL, INC_L, DEC_L, LD_L_N, CPL,
        JR_NC_E, LD_SP_NN, LD_NN_A, INC_RP_SP, INC_HL, DEC_HL, LD_HL_N, SCF, JR_C_E, ADD_HL_SP, LD_A_NN, DEC_RP_SP, INC_A, DEC_A, LD_A_N, CCF,
        LD_B_B, LD_B_C, LD_B_D, LD_B_E, LD_B_H, LD_B_L, LD_B_HL, LD_B_A, LD_C_B, LD_C_C, LD_C_D, LD_C_E, LD_C_H, LD_C_L, LD_C_HL, LD_C_A,
        LD_D_B, LD_D_C, LD_D_D, LD_D_E, LD_D_H, LD_D_L, LD_D_HL, LD_D_A, LD_E_B, LD_E_C, LD_E_D, LD_E_E, LD_E_H, LD_E_L, LD_E_HL, LD_E_A,
        LD_H_B, LD_H_C, LD_H_D, LD_H_E, LD_H_H, LD_H_L, LD_H_HL, LD_H_A, LD_L_B, LD_L_C, LD_L_D, LD_L_E, LD_L_H, LD_L_L, LD_L_HL, LD_L_A,
        LD_HL_B, LD_HL_C, LD_HL_D, LD_HL_E, LD_HL_H, LD_HL_L, HALT, LD_HL_A, LD_A_B, LD_A_C, LD_A_D, LD_A_E, LD_A_H, LD_A_L, LD_A_HL, LD_A_A,
        ADD_B, ADD_C, ADD_D, ADD_E, ADD_H, ADD_L, ADD_HL, ADD_A, ADC_B, ADC_C, ADC_D, ADC_E, ADC_H, ADC_L, ADC_HL, ADC_A,
        SUB_B, SUB_C, SUB_D, SUB_E, SUB_H, SUB_L, SUB_HL, SUB_A, SBC_B, SBC_C, SBC_D, SBC_E, SBC_H, SBC_L, SBC_HL, SBC_A,
        AND_B, AND_C, AND_D, AND_E, AND_H, AND_L, AND_HL, AND_A, XOR_B, XOR_C, XOR_D, XOR_E, XOR_H, XOR_L, XOR_HL, XOR_A,
        OR_B, OR_C, OR_D, OR_E, OR_H, OR_L, OR_HL, OR_A, CP_B, CP_C, CP_D, CP_E, CP_H, CP_L, CP_HL, CP_A,
        RET_C0, POP_BC, JP_C0_NN, JP_NN, CALL_C0_NN, PUSH_BC, ADD_N, RST00, RET_C1, RET, JP_C1_NN, OP_CB, CALL_C1_NN, CALL_NN, ADC_N, RST08,
        RET_C2, POP_DE, JP_C2_NN, OUT_N_A, CALL_C2_NN, PUSH_DE, SUB_N, RST10, RET_C3, EXX, JP_C3_NN, IN_A_N, CALL_C3_NN, OP_IX, SBC_N, RST18,
        RET_C4, POP_HL, JP_C4_NN, EX_SP_HL, CALL_C4_NN, PUSH_HL, AND_N, RST20, RET_C5, JP_HL, JP_C5_NN, EX_DE_HL, CALL_C5_NN, OP_ED, XOR_N, RST28,
        RET_C6, POP_AF, JP_C6_NN, DI, CALL_C6_NN, PUSH_AF, OR_N, RST30, RET_C7, LD_SP_HL, JP_C7_NN, EI, CALL_C7_NN, OP_IY, CP_N, RST38};
    void (*opSetCB[256])(Z80* ctx) = {
        RLC_B, RLC_C, RLC_D, RLC_E, RLC_H, RLC_L, RLC_HL_, RLC_A,
        RRC_B, RRC_C, RRC_D, RRC_E, RRC_H, RRC_L, RRC_HL_, RRC_A,
        RL_B, RL_C, RL_D, RL_E, RL_H, RL_L, RL_HL_, RL_A,
        RR_B, RR_C, RR_D, RR_E, RR_H, RR_L, RR_HL_, RR_A,
        SLA_B, SLA_C, SLA_D, SLA_E, SLA_H, SLA_L, SLA_HL_, SLA_A,
        SRA_B, SRA_C, SRA_D, SRA_E, SRA_H, SRA_L, SRA_HL_, SRA_A,
        SLL_B, SLL_C, SLL_D, SLL_E, SLL_H, SLL_L, SLL_HL_, SLL_A,
        SRL_B, SRL_C, SRL_D, SRL_E, SRL_H, SRL_L, SRL_HL_, SRL_A,
        BIT_B_0, BIT_C_0, BIT_D_0, BIT_E_0, BIT_H_0, BIT_L_0, BIT_HL_0, BIT_A_0,
        BIT_B_1, BIT_C_1, BIT_D_1, BIT_E_1, BIT_H_1, BIT_L_1, BIT_HL_1, BIT_A_1,
        BIT_B_2, BIT_C_2, BIT_D_2, BIT_E_2, BIT_H_2, BIT_L_2, BIT_HL_2, BIT_A_2,
        BIT_B_3, BIT_C_3, BIT_D_3, BIT_E_3, BIT_H_3, BIT_L_3, BIT_HL_3, BIT_A_3,
        BIT_B_4, BIT_C_4, BIT_D_4, BIT_E_4, BIT_H_4, BIT_L_4, BIT_HL_4, BIT_A_4,
        BIT_B_5, BIT_C_5, BIT_D_5, BIT_E_5, BIT_H_5, BIT_L_5, BIT_HL_5, BIT_A_5,
        BIT_B_6, BIT_C_6, BIT_D_6, BIT_E_6, BIT_H_6, BIT_L_6, BIT_HL_6, BIT_A_6,
        BIT_B_7, BIT_C_7, BIT_D_7, BIT_E_7, BIT_H_7, BIT_L_7, BIT_HL_7, BIT_A_7,
        RES_B_0, RES_C_0, RES_D_0, RES_E_0, RES_H_0, RES_L_0, RES_HL_0, RES_A_0,
        RES_B_1, RES_C_1, RES_D_1, RES_E_1, RES_H_1, RES_L_1, RES_HL_1, RES_A_1,
        RES_B_2, RES_C_2, RES_D_2, RES_E_2, RES_H_2, RES_L_2, RES_HL_2, RES_A_2,
        RES_B_3, RES_C_3, RES_D_3, RES_E_3, RES_H_3, RES_L_3, RES_HL_3, RES_A_3,
        RES_B_4, RES_C_4, RES_D_4, RES_E_4, RES_H_4, RES_L_4, RES_HL_4, RES_A_4,
        RES_B_5, RES_C_5, RES_D_5, RES_E_5, RES_H_5, RES_L_5, RES_HL_5, RES_A_5,
        RES_B_6, RES_C_6, RES_D_6, RES_E_6, RES_H_6, RES_L_6, RES_HL_6, RES_A_6,
        RES_B_7, RES_C_7, RES_D_7, RES_E_7, RES_H_7, RES_L_7, RES_HL_7, RES_A_7,
        SET_B_0, SET_C_0, SET_D_0, SET_E_0, SET_H_0, SET_L_0, SET_HL_0, SET_A_0,
        SET_B_1, SET_C_1, SET_D_1, SET_E_1, SET_H_1, SET_L_1, SET_HL_1, SET_A_1,
        SET_B_2, SET_C_2, SET_D_2, SET_E_2, SET_H_2, SET_L_2, SET_HL_2, SET_A_2,
        SET_B_3, SET_C_3, SET_D_3, SET_E_3, SET_H_3, SET_L_3, SET_HL_3, SET_A_3,
        SET_B_4, SET_C_4, SET_D_4, SET_E_4, SET_H_4, SET_L_4, SET_HL_4, SET_A_4,
        SET_B_5, SET_C_5, SET_D_5, SET_E_5, SET_H_5, SET_L_5, SET_HL_5, SET_A_5,
        SET_B_6, SET_C_6, SET_D_6, SET_E_6, SET_H_6, SET_L_6, SET_HL_6, SET_A_6,
        SET_B_7, SET_C_7, SET_D_7, SET_E_7, SET_H_7, SET_L_7, SET_HL_7, SET_A_7};
    void (*opSetED[256])(Z80* ctx) = {
        IN0_B_N, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        IN_B_C, OUT_C_B, SBC_HL_BC, LD_ADDR_RP_BC, NEG_, RETN_, IM0, LD_I_A_,
        IN_C_C, OUT_C_C, ADC_HL_BC, LD_RP_ADDR_BC, nullptr, RETI_, nullptr, LD_R_A_,
        IN_D_C, OUT_C_D, SBC_HL_DE, LD_ADDR_RP_DE, nullptr, nullptr, IM1, LD_A_I_,
        IN_E_C, OUT_C_E, ADC_HL_DE, LD_RP_ADDR_DE, nullptr, nullptr, IM2, LD_A_R_,
        IN_H_C, OUT_C_H, SBC_HL_HL, LD_ADDR_RP_HL, nullptr, nullptr, nullptr, RRD_,
        IN_L_C, OUT_C_L, ADC_HL_HL, LD_RP_ADDR_HL, nullptr, nullptr, nullptr, RLD_,
        IN_C, OUT_C_0, SBC_HL_SP, LD_ADDR_RP_SP, nullptr, nullptr, nullptr, nullptr,
        IN_A_C, OUT_C_A, ADC_HL_SP, LD_RP_ADDR_SP, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        LDI, CPI, INI, OUTI, nullptr, nullptr, nullptr, nullptr,
        LDD, CPD, IND, OUTD, nullptr, nullptr, nullptr, nullptr,
        LDIR, CPIR, INIR, OUTIR, nullptr, nullptr, nullptr, nullptr,
        LDDR, CPDR, INDR, OUTDR, nullptr, nullptr, nullptr, nullptr,
#if R800
        //                                 .hl←.a * r
        // 1100 0001 ED C1  mulub .a, .b
        // 1100 1001 ED C9  mulub .a, .c
        // 1101 0001 ED D1  mulub .a, .d
        // 1101 1001 ED D9  mulub .a, .e
        //                                 .de:.hl←.hl * ss
        // 1100 0011 ED C3  muluw .hl, .bc
        // 1111 0011 ED F3  muluw .hl, .sp
/* C0 */
        nullptr, MULUB_A_B, nullptr, MULUW_HL_BC, nullptr, nullptr, nullptr, nullptr, nullptr, MULUB_A_C, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
/* D0 */
        nullptr, MULUB_A_D, nullptr, nullptr,     nullptr, nullptr, nullptr, nullptr, nullptr, MULUB_A_E, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
/* E0 */
        nullptr, nullptr,   nullptr, nullptr,     nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,   nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
/* F0 */
        nullptr, nullptr,   nullptr, MULUW_HL_SP, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,   nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
#endif
        };
    void (*opSetIX[256])(Z80* ctx) = {
        nullptr, nullptr, nullptr, nullptr, INC_B_2, DEC_B_2, LD_B_N_3, nullptr,
        nullptr, ADD_IX_BC, nullptr, nullptr, INC_C_2, DEC_C_2, LD_C_N_3, nullptr,
        nullptr, nullptr, nullptr, nullptr, INC_D_2, DEC_D_2, LD_D_N_3, nullptr,
        nullptr, ADD_IX_DE, nullptr, nullptr, INC_E_2, DEC_E_2, LD_E_N_3, nullptr,
        nullptr, LD_IX_NN_, LD_ADDR_IX_, INC_IX_reg_, INC_IXH_, DEC_IXH_, LD_IXH_N_, nullptr,
        nullptr, ADD_IX_IX, LD_IX_ADDR_, DEC_IX_reg_, INC_IXL_, DEC_IXL_, LD_IXL_N_, nullptr,
        nullptr, nullptr, nullptr, nullptr, INC_IX_, DEC_IX_, LD_IX_N_, nullptr,
        nullptr, ADD_IX_SP, nullptr, nullptr, INC_A_2, DEC_A_2, LD_A_N_3, nullptr,
        LD_B_B_2, LD_B_C_2, LD_B_D_2, LD_B_E_2, LD_B_IXH, LD_B_IXL, LD_B_IX, LD_B_A_2,
        LD_C_B_2, LD_C_C_2, LD_C_D_2, LD_C_E_2, LD_C_IXH, LD_C_IXL, LD_C_IX, LD_C_A_2,
        LD_D_B_2, LD_D_C_2, LD_D_D_2, LD_D_E_2, LD_D_IXH, LD_D_IXL, LD_D_IX, LD_D_A_2,
        LD_E_B_2, LD_E_C_2, LD_E_D_2, LD_E_E_2, LD_E_IXH, LD_E_IXL, LD_E_IX, LD_E_A_2,
        LD_IXH_B, LD_IXH_C, LD_IXH_D, LD_IXH_E, LD_IXH_IXH_, LD_IXH_IXL_, LD_H_IX, LD_IXH_A,
        LD_IXL_B, LD_IXL_C, LD_IXL_D, LD_IXL_E, LD_IXL_IXH_, LD_IXL_IXL_, LD_L_IX, LD_IXL_A,
        LD_IX_B, LD_IX_C, LD_IX_D, LD_IX_E, LD_IX_H, LD_IX_L, nullptr, LD_IX_A,
        LD_A_B_2, LD_A_C_2, LD_A_D_2, LD_A_E_2, LD_A_IXH, LD_A_IXL, LD_A_IX, LD_A_A_2,
        ADD_B_2, ADD_C_2, ADD_D_2, ADD_E_2, ADD_IXH_, ADD_IXL_, ADD_IX_, ADD_A_2,
        ADC_B_2, ADC_C_2, ADC_D_2, ADC_E_2, ADC_IXH_, ADC_IXL_, ADC_IX_, ADC_A_2,
        SUB_B_2, SUB_C_2, SUB_D_2, SUB_E_2, SUB_IXH_, SUB_IXL_, SUB_IX_, SUB_A_2,
        SBC_B_2, SBC_C_2, SBC_D_2, SBC_E_2, SBC_IXH_, SBC_IXL_, SBC_IX_, SBC_A_2,
        AND_B_2, AND_C_2, AND_D_2, AND_E_2, AND_IXH_, AND_IXL_, AND_IX_, AND_A_2,
        XOR_B_2, XOR_C_2, XOR_D_2, XOR_E_2, XOR_IXH_, XOR_IXL_, XOR_IX_, XOR_A_2,
        OR_B_2, OR_C_2, OR_D_2, OR_E_2, OR_IXH_, OR_IXL_, OR_IX_, OR_A_2,
        CP_B_2, CP_C_2, CP_D_2, CP_E_2, CP_IXH_, CP_IXL_, CP_IX_, CP_A_2,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, OP_IX4, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, POP_IX_, nullptr, EX_SP_IX_, nullptr, PUSH_IX_, nullptr, nullptr,
        nullptr, JP_IX, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, LD_SP_IX_, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr};
    void (*opSetIY[256])(Z80* ctx) = {
        nullptr, nullptr, nullptr, nullptr, INC_B_2, DEC_B_2, LD_B_N_3, nullptr,
        nullptr, ADD_IY_BC, nullptr, nullptr, INC_C_2, DEC_C_2, LD_C_N_3, nullptr,
        nullptr, nullptr, nullptr, nullptr, INC_D_2, DEC_D_2, LD_D_N_3, nullptr,
        nullptr, ADD_IY_DE, nullptr, nullptr, INC_E_2, DEC_E_2, LD_E_N_3, nullptr,
        nullptr, LD_IY_NN_, LD_ADDR_IY_, INC_IY_reg_, INC_IYH_, DEC_IYH_, LD_IYH_N_, nullptr,
        nullptr, ADD_IY_IY, LD_IY_ADDR_, DEC_IY_reg_, INC_IYL_, DEC_IYL_, LD_IYL_N_, nullptr,
        nullptr, nullptr, nullptr, nullptr, INC_IY_, DEC_IY_, LD_IY_N_, nullptr,
        nullptr, ADD_IY_SP, nullptr, nullptr, INC_A_2, DEC_A_2, LD_A_N_3, nullptr,
        LD_B_B_2, LD_B_C_2, LD_B_D_2, LD_B_E_2, LD_B_IYH, LD_B_IYL, LD_B_IY, LD_B_A_2,
        LD_C_B_2, LD_C_C_2, LD_C_D_2, LD_C_E_2, LD_C_IYH, LD_C_IYL, LD_C_IY, LD_C_A_2,
        LD_D_B_2, LD_D_C_2, LD_D_D_2, LD_D_E_2, LD_D_IYH, LD_D_IYL, LD_D_IY, LD_D_A_2,
        LD_E_B_2, LD_E_C_2, LD_E_D_2, LD_E_E_2, LD_E_IYH, LD_E_IYL, LD_E_IY, LD_E_A_2,
        LD_IYH_B, LD_IYH_C, LD_IYH_D, LD_IYH_E, LD_IYH_IYH_, LD_IYH_IYL_, LD_H_IY, LD_IYH_A,
        LD_IYL_B, LD_IYL_C, LD_IYL_D, LD_IYL_E, LD_IYL_IYH_, LD_IYL_IYL_, LD_L_IY, LD_IYL_A,
        LD_IY_B, LD_IY_C, LD_IY_D, LD_IY_E, LD_IY_H, LD_IY_L, nullptr, LD_IY_A,
        LD_A_B_2, LD_A_C_2, LD_A_D_2, LD_A_E_2, LD_A_IYH, LD_A_IYL, LD_A_IY, LD_A_A_2,
        ADD_B_2, ADD_C_2, ADD_D_2, ADD_E_2, ADD_IYH_, ADD_IYL_, ADD_IY_, ADD_A_2,
        ADC_B_2, ADC_C_2, ADC_D_2, ADC_E_2, ADC_IYH_, ADC_IYL_, ADC_IY_, ADC_A_2,
        SUB_B_2, SUB_C_2, SUB_D_2, SUB_E_2, SUB_IYH_, SUB_IYL_, SUB_IY_, SUB_A_2,
        SBC_B_2, SBC_C_2, SBC_D_2, SBC_E_2, SBC_IYH_, SBC_IYL_, SBC_IY_, SBC_A_2,
        AND_B_2, AND_C_2, AND_D_2, AND_E_2, AND_IYH_, AND_IYL_, AND_IY_, AND_A_2,
        XOR_B_2, XOR_C_2, XOR_D_2, XOR_E_2, XOR_IYH_, XOR_IYL_, XOR_IY_, XOR_A_2,
        OR_B_2, OR_C_2, OR_D_2, OR_E_2, OR_IYH_, OR_IYL_, OR_IY_, OR_A_2,
        CP_B_2, CP_C_2, CP_D_2, CP_E_2, CP_IYH_, CP_IYL_, CP_IY_, CP_A_2,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, OP_IY4, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, POP_IY_, nullptr, EX_SP_IY_, nullptr, PUSH_IY_, nullptr, nullptr,
        nullptr, JP_IY, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
        nullptr, LD_SP_IY_, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr};
    void (*opSetIX4[256])(Z80* ctx, signed char d) = {
        RLC_IX_with_LD_B, RLC_IX_with_LD_C, RLC_IX_with_LD_D, RLC_IX_with_LD_E, RLC_IX_with_LD_H, RLC_IX_with_LD_L, RLC_IX_, RLC_IX_with_LD_A,
        RRC_IX_with_LD_B, RRC_IX_with_LD_C, RRC_IX_with_LD_D, RRC_IX_with_LD_E, RRC_IX_with_LD_H, RRC_IX_with_LD_L, RRC_IX_, RRC_IX_with_LD_A,
        RL_IX_with_LD_B, RL_IX_with_LD_C, RL_IX_with_LD_D, RL_IX_with_LD_E, RL_IX_with_LD_H, RL_IX_with_LD_L, RL_IX_, RL_IX_with_LD_A,
        RR_IX_with_LD_B, RR_IX_with_LD_C, RR_IX_with_LD_D, RR_IX_with_LD_E, RR_IX_with_LD_H, RR_IX_with_LD_L, RR_IX_, RR_IX_with_LD_A,
        SLA_IX_with_LD_B, SLA_IX_with_LD_C, SLA_IX_with_LD_D, SLA_IX_with_LD_E, SLA_IX_with_LD_H, SLA_IX_with_LD_L, SLA_IX_, SLA_IX_with_LD_A,
        SRA_IX_with_LD_B, SRA_IX_with_LD_C, SRA_IX_with_LD_D, SRA_IX_with_LD_E, SRA_IX_with_LD_H, SRA_IX_with_LD_L, SRA_IX_, SRA_IX_with_LD_A,
        SLL_IX_with_LD_B, SLL_IX_with_LD_C, SLL_IX_with_LD_D, SLL_IX_with_LD_E, SLL_IX_with_LD_H, SLL_IX_with_LD_L, SLL_IX_, SLL_IX_with_LD_A,
        SRL_IX_with_LD_B, SRL_IX_with_LD_C, SRL_IX_with_LD_D, SRL_IX_with_LD_E, SRL_IX_with_LD_H, SRL_IX_with_LD_L, SRL_IX_, SRL_IX_with_LD_A,
        BIT_IX_0, BIT_IX_0, BIT_IX_0, BIT_IX_0, BIT_IX_0, BIT_IX_0, BIT_IX_0, BIT_IX_0,
        BIT_IX_1, BIT_IX_1, BIT_IX_1, BIT_IX_1, BIT_IX_1, BIT_IX_1, BIT_IX_1, BIT_IX_1,
        BIT_IX_2, BIT_IX_2, BIT_IX_2, BIT_IX_2, BIT_IX_2, BIT_IX_2, BIT_IX_2, BIT_IX_2,
        BIT_IX_3, BIT_IX_3, BIT_IX_3, BIT_IX_3, BIT_IX_3, BIT_IX_3, BIT_IX_3, BIT_IX_3,
        BIT_IX_4, BIT_IX_4, BIT_IX_4, BIT_IX_4, BIT_IX_4, BIT_IX_4, BIT_IX_4, BIT_IX_4,
        BIT_IX_5, BIT_IX_5, BIT_IX_5, BIT_IX_5, BIT_IX_5, BIT_IX_5, BIT_IX_5, BIT_IX_5,
        BIT_IX_6, BIT_IX_6, BIT_IX_6, BIT_IX_6, BIT_IX_6, BIT_IX_6, BIT_IX_6, BIT_IX_6,
        BIT_IX_7, BIT_IX_7, BIT_IX_7, BIT_IX_7, BIT_IX_7, BIT_IX_7, BIT_IX_7, BIT_IX_7,
        RES_IX_0_with_LD_B, RES_IX_0_with_LD_C, RES_IX_0_with_LD_D, RES_IX_0_with_LD_E, RES_IX_0_with_LD_H, RES_IX_0_with_LD_L, RES_IX_0, RES_IX_0_with_LD_A,
        RES_IX_1_with_LD_B, RES_IX_1_with_LD_C, RES_IX_1_with_LD_D, RES_IX_1_with_LD_E, RES_IX_1_with_LD_H, RES_IX_1_with_LD_L, RES_IX_1, RES_IX_1_with_LD_A,
        RES_IX_2_with_LD_B, RES_IX_2_with_LD_C, RES_IX_2_with_LD_D, RES_IX_2_with_LD_E, RES_IX_2_with_LD_H, RES_IX_2_with_LD_L, RES_IX_2, RES_IX_2_with_LD_A,
        RES_IX_3_with_LD_B, RES_IX_3_with_LD_C, RES_IX_3_with_LD_D, RES_IX_3_with_LD_E, RES_IX_3_with_LD_H, RES_IX_3_with_LD_L, RES_IX_3, RES_IX_3_with_LD_A,
        RES_IX_4_with_LD_B, RES_IX_4_with_LD_C, RES_IX_4_with_LD_D, RES_IX_4_with_LD_E, RES_IX_4_with_LD_H, RES_IX_4_with_LD_L, RES_IX_4, RES_IX_4_with_LD_A,
        RES_IX_5_with_LD_B, RES_IX_5_with_LD_C, RES_IX_5_with_LD_D, RES_IX_5_with_LD_E, RES_IX_5_with_LD_H, RES_IX_5_with_LD_L, RES_IX_5, RES_IX_5_with_LD_A,
        RES_IX_6_with_LD_B, RES_IX_6_with_LD_C, RES_IX_6_with_LD_D, RES_IX_6_with_LD_E, RES_IX_6_with_LD_H, RES_IX_6_with_LD_L, RES_IX_6, RES_IX_6_with_LD_A,
        RES_IX_7_with_LD_B, RES_IX_7_with_LD_C, RES_IX_7_with_LD_D, RES_IX_7_with_LD_E, RES_IX_7_with_LD_H, RES_IX_7_with_LD_L, RES_IX_7, RES_IX_7_with_LD_A,
        SET_IX_0_with_LD_B, SET_IX_0_with_LD_C, SET_IX_0_with_LD_D, SET_IX_0_with_LD_E, SET_IX_0_with_LD_H, SET_IX_0_with_LD_L, SET_IX_0, SET_IX_0_with_LD_A,
        SET_IX_1_with_LD_B, SET_IX_1_with_LD_C, SET_IX_1_with_LD_D, SET_IX_1_with_LD_E, SET_IX_1_with_LD_H, SET_IX_1_with_LD_L, SET_IX_1, SET_IX_1_with_LD_A,
        SET_IX_2_with_LD_B, SET_IX_2_with_LD_C, SET_IX_2_with_LD_D, SET_IX_2_with_LD_E, SET_IX_2_with_LD_H, SET_IX_2_with_LD_L, SET_IX_2, SET_IX_2_with_LD_A,
        SET_IX_3_with_LD_B, SET_IX_3_with_LD_C, SET_IX_3_with_LD_D, SET_IX_3_with_LD_E, SET_IX_3_with_LD_H, SET_IX_3_with_LD_L, SET_IX_3, SET_IX_3_with_LD_A,
        SET_IX_4_with_LD_B, SET_IX_4_with_LD_C, SET_IX_4_with_LD_D, SET_IX_4_with_LD_E, SET_IX_4_with_LD_H, SET_IX_4_with_LD_L, SET_IX_4, SET_IX_4_with_LD_A,
        SET_IX_5_with_LD_B, SET_IX_5_with_LD_C, SET_IX_5_with_LD_D, SET_IX_5_with_LD_E, SET_IX_5_with_LD_H, SET_IX_5_with_LD_L, SET_IX_5, SET_IX_5_with_LD_A,
        SET_IX_6_with_LD_B, SET_IX_6_with_LD_C, SET_IX_6_with_LD_D, SET_IX_6_with_LD_E, SET_IX_6_with_LD_H, SET_IX_6_with_LD_L, SET_IX_6, SET_IX_6_with_LD_A,
        SET_IX_7_with_LD_B, SET_IX_7_with_LD_C, SET_IX_7_with_LD_D, SET_IX_7_with_LD_E, SET_IX_7_with_LD_H, SET_IX_7_with_LD_L, SET_IX_7, SET_IX_7_with_LD_A};
    void (*opSetIY4[256])(Z80* ctx, signed char d) = {
        RLC_IY_with_LD_B, RLC_IY_with_LD_C, RLC_IY_with_LD_D, RLC_IY_with_LD_E, RLC_IY_with_LD_H, RLC_IY_with_LD_L, RLC_IY_, RLC_IY_with_LD_A,
        RRC_IY_with_LD_B, RRC_IY_with_LD_C, RRC_IY_with_LD_D, RRC_IY_with_LD_E, RRC_IY_with_LD_H, RRC_IY_with_LD_L, RRC_IY_, RRC_IY_with_LD_A,
        RL_IY_with_LD_B, RL_IY_with_LD_C, RL_IY_with_LD_D, RL_IY_with_LD_E, RL_IY_with_LD_H, RL_IY_with_LD_L, RL_IY_, RL_IY_with_LD_A,
        RR_IY_with_LD_B, RR_IY_with_LD_C, RR_IY_with_LD_D, RR_IY_with_LD_E, RR_IY_with_LD_H, RR_IY_with_LD_L, RR_IY_, RR_IY_with_LD_A,
        SLA_IY_with_LD_B, SLA_IY_with_LD_C, SLA_IY_with_LD_D, SLA_IY_with_LD_E, SLA_IY_with_LD_H, SLA_IY_with_LD_L, SLA_IY_, SLA_IY_with_LD_A,
        SRA_IY_with_LD_B, SRA_IY_with_LD_C, SRA_IY_with_LD_D, SRA_IY_with_LD_E, SRA_IY_with_LD_H, SRA_IY_with_LD_L, SRA_IY_, SRA_IY_with_LD_A,
        SLL_IY_with_LD_B, SLL_IY_with_LD_C, SLL_IY_with_LD_D, SLL_IY_with_LD_E, SLL_IY_with_LD_H, SLL_IY_with_LD_L, SLL_IY_, SLL_IY_with_LD_A,
        SRL_IY_with_LD_B, SRL_IY_with_LD_C, SRL_IY_with_LD_D, SRL_IY_with_LD_E, SRL_IY_with_LD_H, SRL_IY_with_LD_L, SRL_IY_, SRL_IY_with_LD_A,
        BIT_IY_0, BIT_IY_0, BIT_IY_0, BIT_IY_0, BIT_IY_0, BIT_IY_0, BIT_IY_0, BIT_IY_0,
        BIT_IY_1, BIT_IY_1, BIT_IY_1, BIT_IY_1, BIT_IY_1, BIT_IY_1, BIT_IY_1, BIT_IY_1,
        BIT_IY_2, BIT_IY_2, BIT_IY_2, BIT_IY_2, BIT_IY_2, BIT_IY_2, BIT_IY_2, BIT_IY_2,
        BIT_IY_3, BIT_IY_3, BIT_IY_3, BIT_IY_3, BIT_IY_3, BIT_IY_3, BIT_IY_3, BIT_IY_3,
        BIT_IY_4, BIT_IY_4, BIT_IY_4, BIT_IY_4, BIT_IY_4, BIT_IY_4, BIT_IY_4, BIT_IY_4,
        BIT_IY_5, BIT_IY_5, BIT_IY_5, BIT_IY_5, BIT_IY_5, BIT_IY_5, BIT_IY_5, BIT_IY_5,
        BIT_IY_6, BIT_IY_6, BIT_IY_6, BIT_IY_6, BIT_IY_6, BIT_IY_6, BIT_IY_6, BIT_IY_6,
        BIT_IY_7, BIT_IY_7, BIT_IY_7, BIT_IY_7, BIT_IY_7, BIT_IY_7, BIT_IY_7, BIT_IY_7,
        RES_IY_0_with_LD_B, RES_IY_0_with_LD_C, RES_IY_0_with_LD_D, RES_IY_0_with_LD_E, RES_IY_0_with_LD_H, RES_IY_0_with_LD_L, RES_IY_0, RES_IY_0_with_LD_A,
        RES_IY_1_with_LD_B, RES_IY_1_with_LD_C, RES_IY_1_with_LD_D, RES_IY_1_with_LD_E, RES_IY_1_with_LD_H, RES_IY_1_with_LD_L, RES_IY_1, RES_IY_1_with_LD_A,
        RES_IY_2_with_LD_B, RES_IY_2_with_LD_C, RES_IY_2_with_LD_D, RES_IY_2_with_LD_E, RES_IY_2_with_LD_H, RES_IY_2_with_LD_L, RES_IY_2, RES_IY_2_with_LD_A,
        RES_IY_3_with_LD_B, RES_IY_3_with_LD_C, RES_IY_3_with_LD_D, RES_IY_3_with_LD_E, RES_IY_3_with_LD_H, RES_IY_3_with_LD_L, RES_IY_3, RES_IY_3_with_LD_A,
        RES_IY_4_with_LD_B, RES_IY_4_with_LD_C, RES_IY_4_with_LD_D, RES_IY_4_with_LD_E, RES_IY_4_with_LD_H, RES_IY_4_with_LD_L, RES_IY_4, RES_IY_4_with_LD_A,
        RES_IY_5_with_LD_B, RES_IY_5_with_LD_C, RES_IY_5_with_LD_D, RES_IY_5_with_LD_E, RES_IY_5_with_LD_H, RES_IY_5_with_LD_L, RES_IY_5, RES_IY_5_with_LD_A,
        RES_IY_6_with_LD_B, RES_IY_6_with_LD_C, RES_IY_6_with_LD_D, RES_IY_6_with_LD_E, RES_IY_6_with_LD_H, RES_IY_6_with_LD_L, RES_IY_6, RES_IY_6_with_LD_A,
        RES_IY_7_with_LD_B, RES_IY_7_with_LD_C, RES_IY_7_with_LD_D, RES_IY_7_with_LD_E, RES_IY_7_with_LD_H, RES_IY_7_with_LD_L, RES_IY_7, RES_IY_7_with_LD_A,
        SET_IY_0_with_LD_B, SET_IY_0_with_LD_C, SET_IY_0_with_LD_D, SET_IY_0_with_LD_E, SET_IY_0_with_LD_H, SET_IY_0_with_LD_L, SET_IY_0, SET_IY_0_with_LD_A,
        SET_IY_1_with_LD_B, SET_IY_1_with_LD_C, SET_IY_1_with_LD_D, SET_IY_1_with_LD_E, SET_IY_1_with_LD_H, SET_IY_1_with_LD_L, SET_IY_1, SET_IY_1_with_LD_A,
        SET_IY_2_with_LD_B, SET_IY_2_with_LD_C, SET_IY_2_with_LD_D, SET_IY_2_with_LD_E, SET_IY_2_with_LD_H, SET_IY_2_with_LD_L, SET_IY_2, SET_IY_2_with_LD_A,
        SET_IY_3_with_LD_B, SET_IY_3_with_LD_C, SET_IY_3_with_LD_D, SET_IY_3_with_LD_E, SET_IY_3_with_LD_H, SET_IY_3_with_LD_L, SET_IY_3, SET_IY_3_with_LD_A,
        SET_IY_4_with_LD_B, SET_IY_4_with_LD_C, SET_IY_4_with_LD_D, SET_IY_4_with_LD_E, SET_IY_4_with_LD_H, SET_IY_4_with_LD_L, SET_IY_4, SET_IY_4_with_LD_A,
        SET_IY_5_with_LD_B, SET_IY_5_with_LD_C, SET_IY_5_with_LD_D, SET_IY_5_with_LD_E, SET_IY_5_with_LD_H, SET_IY_5_with_LD_L, SET_IY_5, SET_IY_5_with_LD_A,
        SET_IY_6_with_LD_B, SET_IY_6_with_LD_C, SET_IY_6_with_LD_D, SET_IY_6_with_LD_E, SET_IY_6_with_LD_H, SET_IY_6_with_LD_L, SET_IY_6, SET_IY_6_with_LD_A,
        SET_IY_7_with_LD_B, SET_IY_7_with_LD_C, SET_IY_7_with_LD_D, SET_IY_7_with_LD_E, SET_IY_7_with_LD_H, SET_IY_7_with_LD_L, SET_IY_7, SET_IY_7_with_LD_A};

    inline void checkInterrupt()
    {
        // Interrupt processing is not executed by the instruction immediately after executing EI.
        if (reg.execEI) {
            return;
        }
        // check interrupt flag
        if (reg.interrupt & 0b10000000) {
            // execute NMI
            if (reg.IFF & IFF_NMI()) {
                return;
            }
            reg.interrupt &= 0b01111111;
            reg.IFF &= ~IFF_HALT();
            if (isDebug()) log("EXECUTE NMI: $%04X", reg.interruptAddrN);
            reg.R = ((reg.R + 1) & 0x7F) | (reg.R & 0x80);
            reg.IFF |= IFF_NMI();
            reg.IFF &= ~IFF1();
            push(getPCH(), 4);
            push(getPCL(), 4);
            reg.PC = reg.interruptAddrN;
            consumeClock(11);
            invokeCallHandlers();
        } else if (reg.interrupt & 0b01000000) {
            // execute IRQ
            if (!(reg.IFF & IFF1())) {
                return;
            }
            reg.interrupt &= 0b10111111;
            reg.IFF &= ~IFF_HALT();
            reg.IFF |= IFF_IRQ();
            reg.IFF &= ~(IFF1() | IFF2());
            reg.R = ((reg.R + 1) & 0x7F) | (reg.R & 0x80);
            switch (reg.interrupt & 0b00000011) {
                case 0: // mode 0
                    if (isDebug()) log("EXECUTE INT MODE1 (RST TO $%04X)", reg.interruptVector * 8);
                    if (reg.interruptVector == 0xCD) {
                        consumeClock(7);
                    }
                    RST(reg.interruptVector, false);
                    break;
                case 1: // mode 1 (13Hz)
                    if (isDebug()) log("EXECUTE INT MODE1 (RST TO $0038)");
                    consumeClock(1);
                    RST(7, false);
                    break;
                case 2: { // mode 2
                    writeByte(reg.SP - 1, getPCH());
                    writeByte(reg.SP - 2, getPCL());
                    reg.SP -= 2;
                    unsigned short addr = make16BitsFromLE(reg.interruptVector, reg.I);
                    unsigned short pc = make16BitsFromLE(readByte(addr), readByte(addr + 1));
                    if (isDebug()) log("EXECUTE INT MODE2: ($%04X) = $%04X", addr, pc);
                    reg.PC = pc;
                    consumeClock(3);
                    invokeCallHandlers();
                    break;
                }
            }
        }
    }

    inline void updateRefreshRegister()
    {
        reg.R = ((reg.R + 1) & 0x7F) | (reg.R & 0x80);
        consumeClock(2);
    }

  public: // API functions
    Z80( ReadFuncType read,
        WriteFuncType write,
        DeviceInType in,
        DeviceOutType out,
        void* arg,
        bool returnPortAs16Bits = false)
    {
        this->CB.arg = arg;
        initialize();
        setupCallback(read, write, in, out, returnPortAs16Bits);
    }

    // without setup callbacks
    Z80(void* arg)
    {
        this->CB.arg = arg;
        initialize();
    }

    void setupCallback(ReadFuncType read,
                       WriteFuncType write,
                       DeviceInType in,
                       DeviceOutType out,
                       bool returnPortAs16Bits = false)
    {
        setupMemoryCallback(read, write);
        setupDeviceCallback(in, out, returnPortAs16Bits);
    }

    void setupMemoryCallback(ReadFuncType read,
                             WriteFuncType write)
    {
        //CB.read.setupAsFunctionObject(read);
        //CB.write.setupAsFunctionObject(write);
        CB.read = read;
        CB.write = write;
    }

    void setupDeviceCallback(DeviceInType in,
                             DeviceOutType out,
                             bool returnPortAs16Bits)
    {
        CB.in = in;
        CB.out = out;
        CB.returnPortAs16Bits = returnPortAs16Bits;
    }

    void setupCallbackFP(unsigned char (*read)(void* arg, unsigned short addr),
                         void (*write)(void* arg, unsigned short addr, unsigned char value),
                         unsigned char (*in)(void* arg, unsigned short port),
                         void (*out)(void* arg, unsigned short port, unsigned char value),
                         bool returnPortAs16Bits = false)
    {
        setupMemoryCallbackFP(read, write);
        setupDeviceCallbackFP(in, out, returnPortAs16Bits);
    }

    void setupMemoryCallbackFP(unsigned char (*read)(void* arg, unsigned short addr),
                               void (*write)(void* arg, unsigned short addr, unsigned char value))
    {
        CB.read = read;
        CB.write = write;
    }

    void setupDeviceCallbackFP(unsigned char (*in)(void* arg, unsigned short addr),
                               void (*out)(void* arg, unsigned short addr, unsigned char value),
                               bool returnPortAs16Bits)
    {
        CB.in = in;
        CB.out = out;
        CB.returnPortAs16Bits = returnPortAs16Bits;
    }

    inline void z80_memset(void* dst, const int c, int size) noexcept {
        auto d = (unsigned char*)dst;
        while(size-- > 0) { *d++ = c; }
    }

    void initialize()
    {
        resetConsumeClockCallback();
        resetDebugMessage();
        z80_memset(&reg, 0, sizeof(reg));
        reg.pair.A = 0xff;
        reg.pair.F = 0xff;
        reg.SP = 0xffff;
        z80_memset(&wtc, 0, sizeof(wtc));
    }

    ~Z80()
    {
        removeAllBreakOperands();
        removeAllBreakPoints();
        removeAllCallHandlers();
        removeAllReturnHandlers();
    }

    template <typename Functor>
    void setDebugMessage(Functor debugMessage)
    {
        CB.debugMessageEnabled = true;
        CB.debugMessage = debugMessage;
    }

    void setDebugMessage(void (*debugMessage)(void* arg, const char* msg)) { setDebugMessageFP(debugMessage); }
    void setDebugMessageFP(void (*debugMessage)(void* arg, const char* msg))
    {
        CB.debugMessageEnabled = true;
        CB.debugMessage = debugMessage;
    }

    void resetDebugMessage()
    {
        CB.debugMessageEnabled = false;
    }

    inline bool isDebug()
    {
        return CB.debugMessageEnabled;
    }

    inline unsigned short make16BitsFromLE(unsigned char low, unsigned char high)
    {
        unsigned short n = high;
        n <<= 8;
        n |= low;
        return n;
    }

    inline void splitTo8BitsPair(unsigned short value, unsigned char* high, unsigned char* low)
    {
        *high = (value & 0xFF00) >> 8;
        *low = value & 0xFF;
    }

    template <typename Functor>
    void addBreakPoint(unsigned short addr, Functor callback)
    {
#if false
        auto it = CB.breakPoints.find(addr);
        if (it == CB.breakPoints.end()) {
            CB.breakPoints[addr] = new std::vector<BreakPoint*>();
        }
        CB.breakPoints[addr]->push_back(new BreakPointFC(addr, callback));
#endif
    }

    void addBreakPoint(unsigned short addr, void (*callback)(void*)) { addBreakPointFP(addr, callback); }
    void addBreakPointFP(unsigned short addr, void (*callback)(void*))
    {
        for(auto& it : CB.breakPoints) {
            if(it.addr == 0 && it.callback == nullptr) {
                it.addr = addr;
                it.callback = callback;
                break;
            }
        }
    }

    void removeBreakPoint(unsigned short addr)
    {
        for(auto& it : CB.breakPoints) {
            if(it.addr == addr) {
                it.addr = 0;
                it.callback = nullptr;
                break;
            }
        }
    }

    void removeAllBreakPoints()
    {
        for(auto& it : CB.breakPoints) {
            it.addr = 0;
            it.callback = nullptr;
        }
    }

    void addBreakOperand_(int prefixNumber, int operandNumber, const void(*callback)(void*, unsigned char*, int))
    {
#ifndef DISABLE_BREAK_OPERANDS
        auto it = CB.breakOperands.find(operandNumber);
        if (it == CB.breakOperands.end()) {
            CB.breakOperands[operandNumber] = new std::vector<BreakOperand*>();
        }
        CB.breakOperands[operandNumber]->push_back(new BreakOperandFC(prefixNumber, operandNumber, callback));
#endif // DISABLE_BREAK_OPERANDS
    }

    template <typename Functor>
    void addBreakOperand(unsigned char operandNumber, Functor callback)
    {
        addBreakOperand_(0, (int)operandNumber, callback);
    }

    template <typename Functor>
    void addBreakOperand(unsigned char prefixNumber, unsigned char operandNumber, Functor callback)
    {
        addBreakOperand_((int)prefixNumber, make16BitsFromLE(operandNumber, prefixNumber), callback);
    }

    template <typename Functor>
    void addBreakOperand(unsigned char prefixNumber1, unsigned char prefixNumber2, unsigned char operandNumber, Functor callback)
    {
        int n = make16BitsFromLE(prefixNumber2, prefixNumber1);
        int prefixNumber = n;
        n <<= 8;
        n |= operandNumber;
        addBreakOperand_(prefixNumber, n, callback);
    }

    void addBreakOperandFP_(int prefixNumber, int operandNumber, void (*callback)(void*, unsigned char*, int))
    {
#ifndef DISABLE_BREAK_OPERANDS
        auto it = CB.breakOperands.find(operandNumber);
        if (it == CB.breakOperands.end()) {
            CB.breakOperands[operandNumber] = new std::vector<BreakOperand*>();
        }
        CB.breakOperands[operandNumber]->push_back(new BreakOperandFP(prefixNumber, operandNumber, callback));
#endif // DISABLE_BREAK_OPERANDS
    }

    void addBreakOperand(unsigned char operandNumber, void (*callback)(void*, unsigned char*, int)) { addBreakOperandFP(operandNumber, callback); }
    void addBreakOperandFP(unsigned char operandNumber, void (*callback)(void*, unsigned char*, int)) { addBreakOperandFP_(0, (int)operandNumber, callback); }
    void addBreakOperand(unsigned char prefixNumber, unsigned char operandNumber, void (*callback)(void*, unsigned char*, int)) { addBreakOperandFP(prefixNumber, operandNumber, callback); }
    void addBreakOperandFP(unsigned char prefixNumber, unsigned char operandNumber, void (*callback)(void*, unsigned char*, int)) { addBreakOperandFP_((int)prefixNumber, make16BitsFromLE(operandNumber, prefixNumber), callback); }
    void addBreakOperand(unsigned char prefixNumber1, unsigned char prefixNumber2, unsigned char operandNumber, void (*callback)(void*, unsigned char*, int)) { addBreakOperandFP(prefixNumber1, prefixNumber2, operandNumber, callback); }
    void addBreakOperandFP(unsigned char prefixNumber1, unsigned char prefixNumber2, unsigned char operandNumber, void (*callback)(void*, unsigned char*, int))
    {
        int n = make16BitsFromLE(prefixNumber2, prefixNumber1);
        int prefixNumber = n;
        n <<= 8;
        n |= operandNumber;
        addBreakOperandFP_(prefixNumber, n, callback);
    }

    void removeBreakOperand(int operandNumber)
    {
#ifndef DISABLE_BREAK_OPERANDS
        auto it = CB.breakOperands.find(operandNumber);
        if (it == CB.breakOperands.end()) return;
        for (auto bo : *CB.breakOperands[operandNumber]) delete bo;
        delete CB.breakOperands[operandNumber];
        CB.breakOperands.erase(it);
#endif // DISABLE_BREAK_OPERANDS
    }

    void removeBreakOperand(unsigned char prefixNumber, unsigned char operandNumber)
    {
        removeBreakOperand(make16BitsFromLE(operandNumber, prefixNumber));
    }

    void removeBreakOperand(unsigned char prefixNumber1, unsigned char prefixNumber2, unsigned char operandNumber)
    {
        int n = make16BitsFromLE(prefixNumber2, prefixNumber1);
        n <<= 8;
        n |= operandNumber;
        removeBreakOperand(n);
    }

    void removeAllBreakOperands()
    {
#ifndef DISABLE_BREAK_OPERANDS
        std::vector<int> keys;
        for (auto it = CB.breakOperands.begin(); it != CB.breakOperands.end(); it++) {
            keys.push_back(it->first);
        }
        for (auto key : keys) {
            removeBreakOperand(key);
        }
#endif // DISABLE_BREAK_OPERANDS
    }

    template <typename Functor>
    void addReturnHandler(Functor callback) {
#if false
        CB.returnHandlers.push_back(new SimpleHandlerFC(callback));
#endif
    }
    void addReturnHandler(void (*callback)(void*)) { addReturnHandlerFP(callback); }
    void addReturnHandlerFP(void (*callback)(void*)) {
#if false
        CB.returnHandlers.push_back(new SimpleHandlerFP(callback));
#endif
    }

    void removeAllReturnHandlers()
    {
#if false
        for (auto handler : CB.returnHandlers) delete handler;
        CB.returnHandlers.clear();
#endif
    }

    template <typename Functor>
    void addCallHandler(Functor callback) {
#if false
        CB.callHandlers.push_back(new SimpleHandlerFC(callback));
#endif
    }
    void addCallHandler(void (*callback)(void*)) { addCallHandlerFP(callback); }
    void addCallHandlerFP(void (*callback)(void*)) {
#if false
        CB.callHandlers.push_back(new SimpleHandlerFP(callback));
#endif
    }

    void removeAllCallHandlers()
    {
#if false
        for (auto handler : CB.callHandlers) delete handler;
        CB.callHandlers.clear();
#endif
    }

    template <typename Functor>
    void setConsumeClockCallback(Functor consumeClock_)
    {
        CB.consumeClockEnabled = true;
        CB.consumeClock = consumeClock_;
    }

    void setConsumeClockCallback(void (*consumeClock_)(void* arg, int clocks)) { setConsumeClockCallbackFP(consumeClock_); }
    void setConsumeClockCallbackFP(void (*consumeClock_)(void* arg, int clocks))
    {
        CB.consumeClockEnabled = true;
        CB.consumeClock = consumeClock_;
    }

    void resetConsumeClockCallback()
    {
        CB.consumeClockEnabled = false;
    }

    void requestBreak()
    {
        requestBreakFlag = true;
    }

    void generateIRQ(const unsigned char vector)
    {
        reg.interrupt |= 0b01000000;
        reg.interruptVector = vector;
    }

    void cancelIRQ()
    {
        reg.interrupt &= 0b10111111;
    }

    void generateNMI(unsigned short addr)
    {
        reg.interrupt |= 0b10000000;
        reg.interruptAddrN = addr;
    }

    inline unsigned char fetch(int clocks)
    {
        unsigned char result = readByte(reg.PC, clocks);
        reg.PC++;
        return result;
    }

    int executed;
    inline int getExecutedClock() const noexcept { return executed; }
    inline int execute(int clock)
    {
        executed = 0;
        requestBreakFlag = false;
        reg.consumeClockCounter = 0;
        while (0 < clock && !requestBreakFlag) {
            // execute NOP while halt
            if (reg.IFF & IFF_HALT()) {
                reg.execEI = 0;
                readByte(reg.PC); // NOTE: read and discard (to be consumed 4Hz)
            } else {
                if (wtc.fetch) consumeClock(wtc.fetch);
                checkBreakPoint();
                if(requestBreakFlag) {
                    // ブレイク中...
                    break;
                }
                reg.execEI = 0;
                int operandNumber = fetch(2);
                updateRefreshRegister();
                checkBreakOperand(operandNumber);
                opSet1[operandNumber](this);
            }
            executed += reg.consumeClockCounter;
            clock -= reg.consumeClockCounter;
            reg.consumeClockCounter = 0;
            checkInterrupt();
        }
        return executed;
    }

    int executeTick4MHz()
    {
        return execute(4194304 / 60);
    }

    int executeTick8MHz()
    {
        return execute(8388608 / 60);
    }

    void registerDump()
    {
        if (isDebug()) log("===== REGISTER DUMP : START =====");
        if (isDebug()) log("PAIR: %s %s %s %s %s %s %s", registerDump(0b111), registerDump(0b000), registerDump(0b001), registerDump(0b010), registerDump(0b011), registerDump(0b100), registerDump(0b101));
        if (isDebug()) log("PAIR: F<$%02X> ... S:%s, Z:%s, H:%s, P/V:%s, N:%s, C:%s",
                           reg.pair.F,
                           isFlagS() ? "ON" : "OFF",
                           isFlagZ() ? "ON" : "OFF",
                           isFlagH() ? "ON" : "OFF",
                           isFlagPV() ? "ON" : "OFF",
                           isFlagN() ? "ON" : "OFF",
                           isFlagC() ? "ON" : "OFF");
        if (isDebug()) log("BACK: %s %s %s %s %s %s %s F'<$%02X>", registerDump2(0b111), registerDump2(0b000), registerDump2(0b001), registerDump2(0b010), registerDump2(0b011), registerDump2(0b100), registerDump2(0b101), reg.back.F);
        if (isDebug()) log("PC<$%04X> SP<$%04X> IX<$%04X> IY<$%04X>", reg.PC, reg.SP, reg.IX, reg.IY);
        if (isDebug()) log("R<$%02X> I<$%02X> IFF<$%02X>", reg.R, reg.I, reg.IFF);
        if (isDebug()) log("isHalt: %s, interrupt: $%02X", reg.IFF & IFF_HALT() ? "YES" : "NO", reg.interrupt);
        if (isDebug()) log("===== REGISTER DUMP : END =====");
    }
};

#endif // INCLUDE_Z80_HPP
