#pragma once

#include "cat/low/catLowBasicTypes.h"
#include "z80/z80.hpp"

/**
 * @brief 機種
 * 
 * VRAMの表示やPSGに対応するために使用
 */
#define TARGET (0x20)

// X1
#define TARGET_X1 (0x20)
// X1turbo (Oh!MZ掲載版)  
#define TARGET_X1_TURBO (0x21)
// X1turbo (高速版)  
#define TARGET_X1_TURBO_HIGH_SPEED (0x22)

// X1シリーズかどうか
#define IS_TARGET_X1_SERIES(X) (((X)==TARGET_X1) || ((X)==TARGET_X1_TURBO) || ((X)==TARGET_X1_TURBO_HIGH_SPEED))

/**
 * @brief 初期化
 * @param[in]	heapBase	ヒープメモリの先頭アドレス
 * @param[in]	heapSize	ヒープメモリのサイズ
 */
WASM_EXPORT
extern "C" void initialize(void* heapBase, size_t heapSize);

/**
 * @brief リセット
 */
WASM_EXPORT
extern "C" void z80Reset();

/**
 * @brief 実行する
 * @param[in]	clock	実行するクロック
 * @return 実際に実行されたクロック
 */
WASM_EXPORT
extern "C" int exeute(int clock);


WASM_EXPORT
extern "C" void* getScratchMemory();
WASM_EXPORT
extern "C" size_t getScratchMemorySize();

/**
 * @brief 状態を取得する
 * @return 状態
 * @retval	0: 実行中
 * @retval	1: 停止中
 */
WASM_EXPORT
extern "C" int getStatus();

/**
 * @brief メモリの先頭アドレスを取得する
 * @return メモリの先頭アドレス
 */
WASM_EXPORT
extern "C" void* getRAM();

/**
 * @brief IOの先頭アドレスを取得する
 * @return IOの先頭アドレス
 */
WASM_EXPORT
extern "C" void* getIO();

/**
 * @brief Z80のレジスタの先頭アドレスを取得する
 * @return Z80のレジスタの先頭アドレス
 */
WASM_EXPORT
extern "C" void* getZ80Regs();

/**
 * @brief Z80のレジスタのサイズを取得する
 * @return Z80のレジスタのサイズ
 */
WASM_EXPORT
extern "C" s32 getZ80RegsSize();

/**
 * @brief VRAMが更新されているかどうか
 * @return VRAMが更新されているかどうか
 * @retval	true:	更新されている
 */
WASM_EXPORT
extern "C" bool isVRAMDirty();

/**
 * @brief VRAMの更新フラグをセットする
 */
WASM_EXPORT
extern "C" void setVRAMDirty();

/**
 * @brief 表示用に変換されたVRAMイメージを取得する
 * @return 表示用に変換されたVRAMイメージ
 * @retval nullptr: 変換に失敗した、もしくは、VRAMが変更されていない。
 */
WASM_EXPORT
extern "C" void* getVRAMImage();

WASM_EXPORT
extern "C" void writeIO(u16 port, u8 value);

WASM_EXPORT
extern "C" u8 readIO(u16 port);

/**
 * @brief PSGへ書き込みがされた時に呼び出される関数
 * 
 * @note	clockは、execute()開始時に0で、Z80の命令が実行されるごとに増える。
 *			これを使って音声を上手く生成する……予定
 * @oaram[in]	clock	書き込みが発生したときのクロック
 * @param[in]	reg		書き込まれたPSGのレジスタ番号
 * @param[in]	value	PSGへ書き込まれた値
 */
WASM_IMPORT("io", "writePSG")
extern "C" void writePSG(s32 clock, u8 reg, u8 value);

/**
 * @brief ゲームパッドの読み込み
 * 
 * @param[in]	index	読み込むゲームパッドの番号(0,1)
 * @return ゲームパッドの状態（ボタンは負論理）
 * @retval 0x01 : デジタルの上ボタン
 * @retval 0x02 : デジタルの下ボタン
 * @retval 0x04 : デジタルの左ボタン
 * @retval 0x08 : デジタルの右ボタン
 * @retval 0x10 : 未使用（常に１）
 * @retval 0x20 : トリガー１
 * @retval 0x40 : トリガー２
 * @retval 0x80 : 未使用（常に１）
 */
WASM_IMPORT("io", "readGamePad")
extern "C" u8 readGamePad(u8 index);

/**
 * @brief 実行されたクロック数を取得する
 * 
 * execute()で実行されたクロックを取得する。
 * 内部用の関数で、RAMやIOに書き込んだ時のクロックを取得したい時などに使用する。
 * 同期などを正確に取りたい時など。
 * @return 実行されたクロック数
 */
s32 getExecutedClock();

void generateIRQ(const u8 vector);

/**
 * @brief S-OSワークアドレス
 */
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

	// 変身セット

	/**
	 * @brief Eドライブの未フォーマット時のクラスタ数
	 */
	ETRK    = 0x20FF,

	// DOSモジュール ワーク
	OPNFG   = 0x291e, 
	FTYPE   = 0x291f,
	DFDV    = 0x2920,

	// ディスクI/O ワーク
	UNITNO = 0x2B06,
};

/**
 * @brief S-OSジャンプテーブルのアドレス
 * 
 * このアドレスにZ80エミュのブレイクポイントが仕掛けてあり、JavaScriptへフックされる。
 */
static constexpr u16 ADDRESS_JUMPTABLE     = 0x0100; // ～ 0x017F
static constexpr u16 ADDRESS_JUMPTABLE_END = 0x017F;
/**
 * @brief S-OS IBバッファのアドレス
 */
static constexpr u16 ADDRESS_IBFAD     = 0x0180; // ～ 0x019F
/**
 * @brief S-OSカーソルのアドレス
 */
static constexpr u16 ADDRESS_XYADR     = 0x01A0; // ～ 0x01A1
/**
 * @brief S-OSキーボードバッファのアドレス
 */
static constexpr u16 ADDRESS_KBFAD     = 0x0200; // ～ 0x02FF
/**
 * @brief S-OSファットバッファのアドレス
 */
static constexpr u16 ADDRESS_FATBF     = 0x0300; // ～ 0x03FF
/**
 * @brief S-OSセクタリードバッファのアドレス
 */
static constexpr u16 ADDRESS_DTBUF     = 0x0400; // ～ 0x04FF
/**
 * @brief S-OS スタックアドレス
 */
static constexpr u16 ADDRESS_STKAD     = 0x0800; // 0x0500 ～ 0x07FF
/**
 * @brief S-OS 使用できるメモリの最大アドレス
 * 
 * 0x3000～0xFFFFが空き。
 * @note 0x0700～0x2FFFも使用していないので、自由に使える
 */
static constexpr u16 ADDRESS_MEMAX     = 0xFFFF;

//
// S-OSサブルーチンの関数定義
//
// WASM_IMPORT()は、JavaScript側の関数を呼び出す設定

#ifndef BUILD_WASM
#define SOS_ARGS Z80::Register* z80Regs, int z80RegsSize, u8* ram, u8* io
#else
#define SOS_ARGS
#endif
#define SOS_FUNC(NAME) WASM_IMPORT("sos", #NAME) extern "C" void sos_##NAME(SOS_ARGS);
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
//	SOS_FUNC(_hl_ ) メモ)Z80のコードで直接書く
//	SOS_FUNC(getpc) メモ)Z80のコードで直接書く
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
	SOS_FUNC(command)
	// DOSモジュール
	SOS_FUNC(rdi)
	SOS_FUNC(tropn)
	SOS_FUNC(wri)
	SOS_FUNC(twrd)
	SOS_FUNC(trdd)
	SOS_FUNC(tdir)
	SOS_FUNC(p_fnam)
	SOS_FUNC(devchk)
	SOS_FUNC(tpchk)
	SOS_FUNC(parsc)
	SOS_FUNC(parcs)
	// ディスクI/O
	SOS_FUNC(dread)
	SOS_FUNC(dwrite)
#undef SOS_FUNC
#undef SOS_ARGS
