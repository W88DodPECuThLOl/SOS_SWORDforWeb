"use strict";

/**
 * Web版の独自拡張機能
 * @type {}
 */
const SOS_Web_Ext = {
	/**
	 * FATを2セクタで処理するように拡張する
	 */
	FAT2SECTOR: true,
};

const DOSWorkAddr = {
	NXCLST: 0x27DE, // DS 1
	DEBUF: 0x27DF, // DS 2
	HLBUF: 0x27E1, // DS 2

	OPNFG: 0x291e,
	FTYPE: 0x291f,
/*
	_RDI	equ	2900h
	_TROPN	equ	2903h
	_WRI	equ	2906h
	_TWRD	equ	2909h
	_TRDD	equ	290ch
	_TDIR	equ	290fh
	_DEVCHK	equ	2915h
	_OPNFG	equ	291eh
	_FTYPE	equ	291fh
	_DFDV	equ	2920h
	_PARSC	equ	292ah
	_PARCS	equ	293fh
	;EXCOM	equ	1cc0h		;for original RUN & SUBMIT
	EXCOM	equ	1c00h		;for RUN & SUBMIT
*/
};

const DiskWorkAddr = {
	UNITNO: 0x2b06
};

/**
 * #PAUSEの状態
 */
class PauseState {
	/**
	 * 通常状態
	 * @type {number}
	 */
	static Idle = 0;
	/**
	 * スペースキー押下されて停止状態
	 * - 何かキー押下で、通常状態へ
	 * - BREAK押下で、ブレイク先へジャンプ
	 * @type {number}
	 */
	static Pause = 1;
}

/**
 * S-OSのサブルーチン
 */
class SOS {
	/**
	 * Z80のエミュレータ
	 * @type {Z80Emu}
	 */
	#z80;

	/**
	 * 特殊ワーク
	 * @type {Uint8Array}
	 */
	#specialRAM = new Uint8Array(0x10000);
	/**
	 * 特殊ワークのアドレスマスク
	 * 
	 * 0x0000～0xFFFFにしている。
	 * @type {number}
	 */
	#specialRamMask = 0xFFFF;

	/**
	 * ライン入力の格納先アドレス
	 * @type {number}
	 */
	#getl_dstAddr = 0x0000;

	/**
	 * CPUを停止させているかどうか
	 * @type {boolean}
	 */
	#isCpuOccupation = false;
	/**
	 * #PAUSE処理しているかどうか
	 * @type {boolean}
	 */
	#pauseState = PauseState.Idle;

	// --------------------------------------------------
	// --------------------------------------------------

	/**
	 * コンストラクタ
	 * @param {Z80Emu} z80 Z80のエミュレータ
	 */
	constructor(z80)
	{
		this.#z80 = z80;
		this.#isCpuOccupation = false;
		this.#pauseState = PauseState.Idle;
	}

	/**
	 * 小さい方を返す
	 * @param {*} lhs 
	 * @param {*} rhs 
	 * @returns {number} 小さい方
	 */
	#min(lhs, rhs) { return (lhs < rhs) ? lhs : rhs; }

	/**
	 * デバッグ用のログ出力
	 * @param {string} text 出力するテキスト
	 */
	#Log(ctx, text)
	{
		//console.log("[SOS SUB]" + text);
	}

	#SOSWorkBaseAddress = 0;
	wrkReadUSR() { return this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.USR); }
	wrkReadDVSW() { return this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DVSW); }
	wrkReadXYADR() { return this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.XYADR); }
	wrkReadDSK() { return this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DSK); }
	wrkWriteDSK(value) { this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DSK, value); }

	/**
	 * S-OSのワークからカーソル位置を設定する
	 * @param {TaskContext} ctx 
	 */
	#beginCursor(ctx)
	{
		// 出力位置
		const position = this.#memReadU16(this.wrkReadXYADR());
		ctx.setScreenLocate({x: position & 0xFF, y:position >> 8});
	}

	/**
	 * カーソル位置をS-OSのワークに設定する
	 * @param {TaskContext} ctx 
	 */
	#endCursor(ctx)
	{
		const position = ctx.getScreenLocate();
		this.#memWriteU16(this.wrkReadXYADR(), (position.x & 0xFF) | ((position.y & 0xFF) << 8));
	}

	/**
	 * 文字が16進数で使用されている文字列かどうかを調べる
	 * @param {number} value 文字
	 * @returns {boolean} [0-9a-fA-F]ならtrueを返す
	 */
	#checkHex(value){
		if(0x30 <= value && value <= 0x39) { // 0～9
			return true;
		} else if(0x41 <= value && value <= 0x46) { // A～F
			return true;
		} else if(0x61 <= value && value <= 0x66) { // a～f
			return true;
		} else {
			return false;
		}
	}

	/**
	 * 1文字出力する
	 * 
	 * S-OS #PRINT、#PRINTS、#LTNLの下請け関数
	 * @param {TaskContext} ctx 
	 * @param {number} ch 出力する１文字
	 */
	#putch(ctx, ch)
	{
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// Aレジスタ取得して1文字出力
		ctx.PRINT(ch);
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}

	/**
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから終端文字コードがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する。
	 * @param {TaskContext} ctx 
	 * @param {number} terminator 終端文字コード
	 */
	#msgSub(ctx, terminator)
	{
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// テキストのあるアドレスを取得
		let memPtrText = this.#getDE();
		// 終了文字まで表示
		while(true) {
			const ch = this.#memReadU8(memPtrText++);
			if(ch == terminator) { break; }
			ctx.PRINT(ch);
		}
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}

	/**
	 * IBからファイル名を取得する
	 * @returns {{
	 * 		attribute: number,		// 属性（ファイルモード）
	 * 		deviceName: number,		// デバイス名（'A'～）
	 * 		filename: Uint8Array,	// ファイル名
	 * 		extension: Uint8Array	// 拡張子
	 * }}
	 */
	#getFilenameFromIB()
	{
		// デバイス名
		const deviceName = this.wrkReadDSK();
		// ファイル名
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		let filename = new Uint8Array(SOSInfomationBlock.filename_size);
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
			filename[i] = this.#memReadU8(ib_base + SOSInfomationBlock.ib_filename + i);
		}
		// 拡張子
		let extension = new Uint8Array(SOSInfomationBlock.extension_size);
		for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
			extension[i] = this.#memReadU8(ib_base + SOSInfomationBlock.ib_extension + i);
		}
		return {
			attribute: this.#memReadU8(ib_base + SOSInfomationBlock.ib_attribute), // 属性
			deviceName: deviceName,
			filename: filename,
			extension: extension
		};
	}

	/**
	 * ファイル名を分割する
	 * @param {number} filenamePtr ファイル名を指すポインタ
	 * @returns {{
	 * 		deviceName: number,		// デバイス名（'A'～）
	 * 		filename: Uint8Array,	// ファイル名
	 * 		extension: Uint8Array,	// 拡張子
	 * 		filenamePtr: number		// ファイル名分割後の文字列を指すポインタ
	 * }}
	 */
	#splitPath(filenamePtr) {
		// デバイス名
		let deviceName = this.wrkReadDSK();

		const filename = new Uint8Array(SOSInfomationBlock.filename_size);
		filename.fill(0x20);
		const extension = new Uint8Array(SOSInfomationBlock.extension_size);
		extension.fill(0x20);
		// 空白をスキップ
		while(this.#memReadU8(filenamePtr) == 0x20) { filenamePtr++; }
		// デバイス名（A～D）
		if(this.#memReadU8(filenamePtr + 1) == 0x3A) { // ":"
			const device = this.#memReadU8(filenamePtr);
			if(0x61 <= device && device <= 0x64) { // a～d
				deviceName = device - 0x20;
				filenamePtr += 2;
			} else if(0x41 <= device && device <= 0x44) { // A～D
				deviceName = device;
				filenamePtr += 2;
			}
		}
		// ファイル名
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
			const ch = this.#memReadU8(filenamePtr);
			if(ch == 0 || ch == 0x2E || ch == 0x3A) { break; } // "." ":"
			if(ch != SOSKeyCode.CR) {
				filename[i] = ch;
			}
			filenamePtr++;
		}
		// スキップ
		while(true) {
			const ch = this.#memReadU8(filenamePtr);
			if(ch == 0 || ch == 0x2E || ch == 0x3A) { // "." ":"
				break;
			}
			filenamePtr++;
		}
		// 拡張子
		if(this.#memReadU8(filenamePtr) == 0x2E) { // "."
			filenamePtr++;
			for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
				const ch = this.#memReadU8(filenamePtr);
				if(ch == 0 || ch == 0x3A) { break; } // ":"
				if(ch != SOSKeyCode.CR) {
					extension[i] = ch;
				}
				filenamePtr++;
			}
		}
		// スキップ
		while(this.#memReadU8(filenamePtr) != 0x3A && this.#memReadU8(filenamePtr) != 0) {
			filenamePtr++;
		}
		return {deviceName: deviceName, filename: filename, extension: extension, filenamePtr: filenamePtr};
	}

	// -------------------------------------------------------------------------------------------------
	//  メモリアクセス
	// -------------------------------------------------------------------------------------------------

	/**
	 * 2バイトメモリへ書き込む
	 * @param {number} addr		メモリアドレス
	 * @param {number} value	値
	 */
	#memWriteU16(addr, value) { this.#z80.memWriteU16(addr, value); }

	/**
	 * 1バイトメモリへ書き込む
	 * @param {number} addr		メモリアドレス
	 * @param {number} value	値
	 */
	#memWriteU8(addr, value) { this.#z80.memWriteU8(addr, value); }

	/**
	 * 2バイトメモリから読み込む
	 * @param {number} addr メモリアドレス
	 * @returns {number} 値
	 */
	#memReadU16(addr) { return this.#z80.memReadU16(addr); }

	/**
	 * 1バイトメモリから読み込む
	 * @param {number} addr メモリアドレス
	 * @returns {number} 値
	 */
	#memReadU8(addr) { return this.#z80.memReadU8(addr); }

	/**
	 * 1バイトIOへ書き込む
	 * @param {number} addr		IOアドレス
	 * @param {number} value	値
	 */
	#ioWrite(addr, value) { this.#z80.ioWrite(addr, value); }

	// -------------------------------------------------------------------------------------------------
	//  Z80レジスタアクセス
	// -------------------------------------------------------------------------------------------------
	#setA(A) { this.#z80.setA(A); }
	#getA() { return this.#z80.getA(); }
	#setF(F) { this.#z80.setF(F); }
	#setCY() { this.#z80.setCY(); }
	#clearCY() { this.#z80.clearCY(); }
	#setZ() { this.#z80.setZ(); }
	#clearZ() { this.#z80.clearZ(); }
	#getF() { return this.#z80.getF(); }
	#setB(B) { this.#z80.setB(B); }
	#getB() { return this.#z80.getB(); }
	#setC(C) { this.#z80.setC(C); }
	#getC() { return this.#z80.getC(); }
	#setD(D) { this.#z80.setD(D); }
	#getD() { return this.#z80.getD(); }
	#setE(E) { this.#z80.setE(E); }
	#getE() { return this.#z80.getE(); }
	#setH(H) { this.#z80.setH(H); }
	#getH() { return this.#z80.getH(); }
	#setL(L) { this.#z80.setL(L); }
	#getL() { return this.#z80.getL(); }

	#setAF(AF) { this.#z80.setAF(AF); }
	#getAF() { return this.#z80.getAF(); }
	#setBC(BC) { this.#z80.setBC(BC); }
	#getBC() { return this.#z80.getBC(); }
	#setDE(DE) { this.#z80.setDE(DE); }
	#getDE() { return this.#z80.getDE(); }
	#setHL(HL) { this.#z80.setHL(HL); }
	#getHL() { return this.#z80.getHL(); }
	setPC(PC) { this.#z80.setPC(PC); }
	#getPC() { return this.#z80.getPC(); }
	setSP(SP) { this.#z80.setSP(SP); }
	#getSP() { return this.#z80.getSP(); }
	#setIX(IX) { this.#z80.setIX(IX); }
	#setIY(IY) { this.#z80.setIY(IY); }

	// -------------------------------------------------------------------------------------------------
	//  S-OSのサブルーチン
	// -------------------------------------------------------------------------------------------------

	/**
	 * #COLD(1FFDH)
	 * 
	 * S-OSのコールドスタート。初期設定後メッセージを出力し、ワークエリアUSR(1FFDH)に格納されているアドレスにジャンプする。  
	 * USRには初期値として#HOTのアドレスが格納されている。
	 * @param {TaskContext} ctx 
	 */
	sos_cold(ctx) {
		this.#Log(ctx, "sos_cold");
		// this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.USR,    0x1FFA );
		this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.DVSW,   0 );
		this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.LPSW,   0 );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.PRCNT,  0 );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.XYADR,  0x01A0 );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.KBFAD,  ADDRESS_KBFAD );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD,  ADDRESS_IBFAD );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE,   0 );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR,  0 );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR,  0 );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.STKAD,  ADDRESS_STKAD );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.MEMAX,  ADDRESS_MEMAX );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.WKSIZ,  0xFFFF );
		this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO,  0 );
		this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.MXTRK,  0x50 );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.DTBUF,  ADDRESS_DTBUF );
		//this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF,  ADDRESS_FATBF );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS,  0x0010 );
		this.#memWriteU16( this.#SOSWorkBaseAddress + SOSWorkAddr.FATPOS, 0x000E );
		this.wrkWriteDSK( 0x41 );
		this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.ETRK,   80 );

		//this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.WIDTH,  80 );
		//this.#memWriteU8(  this.#SOSWorkBaseAddress + SOSWorkAddr.MAXLIN, 25 );

		// DOSモジュール ワーク
		this.#memWriteU8( 0x291e, 0 ); // OPNFG
		this.#memWriteU8( 0x291f, 0 ); // FTYPE
		this.#memWriteU8( 0x2920, 0x41 ); // DFDV
		// ディスクI/O ワーク
		this.#memWriteU8( 0x2B06, 0 ); // UNITNO

		// 画面サイズを変更
		ctx.changeScreenSize(this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.WIDTH), this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.MAXLIN));
		// 初期化メッセージ表示
		ctx.initialMsg();
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);

		// USRのアドレスへコール
		this.setSP(this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.STKAD));
		this.setPC(0x0003);
		this.#memWriteU16(0x0004, this.wrkReadUSR());

		// ジャンプテーブルに出来なかったので、直接書く
		// S-OS #GETPC
		this.#memWriteU8(0x1F80, 0xE1); // POP HL
		// S-OS #[HL]
		this.#memWriteU8(0x1F81, 0xE9); // JP (HL)

		// 各種ローカルの設定を初期化
		this.#isCpuOccupation = false;
		this.#pauseState = PauseState.Idle;
	}

	/**
	 * #HOT(1FFAH)
	 * 
	 * S-OSのモニタになっており、プロンプト#が出てコマンド入力待ちになる。
	 * @param {TaskContext} ctx 
	 */
	sos_hot(ctx){
		if(!ctx.taskMonitor.isActive()) {
			this.#Log(ctx, "sos_hot - z80 freeze");
			// S-OSモニタ起動する
			ctx.taskMonitor.start();
			this.#isCpuOccupation = false;
			this.#pauseState = PauseState.Idle;
		} else {
			if(ctx.taskMonitor.isFinished()) {
				this.#Log(ctx, "sos_hot - z80 wakeup!");
				// S-OSモニタ完了した
				ctx.taskMonitor.changeState(0); // モニタをidle状態に設定
				// カーソル位置をS-OSのワークに設定する
				this.#endCursor(ctx);

				// スタックポインタを初期化
				this.setSP(this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.STKAD));
				// ジャンプ先をコールする命令から再開させる
				this.setPC(0x0006);
				// 各種ローカルの設定を初期化
				this.#isCpuOccupation = false;
				this.#pauseState = PauseState.Idle;
			} else {
				//this.#Log(ctx, "sos_hot - mon working");
			}
		}
	}

	/**
	 * #VER(1FF7H)
	 * 
	 * HLﾚｼﾞｽﾀにS-OSの機種とﾊﾞｰｼﾞｮﾝを返す。  
	 * Ｈﾚｼﾞｽﾀは機種を表しており、上位４ビットで機種の系列を示し、下位４ビットで系列内の機種番号を示す。  
	 * 　上位　下位  
	 * 　　０　　０　ＭＺ－80Ｋ／Ｃ／1200  
	 * 　　０　　１　ＭＺ－700  
	 * 　　０　　２　ＭＺ－1500  
	 * 　　１　　０　ＭＺ－80Ｂ  
	 * 　　１　　１　ＭＺ－2000／2200  
	 * 　　２　　０　X1／Ｃ／Ｄ／Ｆ／ｔｕｒｂｏ  
	 * ＬﾚｼﾞｽﾀはS-OSﾊﾞｰｼﾞｮﾝを示しており、今後各種ﾊﾟｯｹｰｼﾞを追加したりした場合のS-OSのﾊﾞｰｼﾞｮﾝをﾁｪｯｸできるようにする。  
	 * 基本的にS-OSに依存しながらも機種ごとに特別なｻﾌﾞﾙｰﾁﾝが必要な場合に、ｿﾌﾄｳｪｱ上で機種をﾁｪｯｸしてﾌﾟﾛｸﾞﾗﾑの共通化を図ったり、S-OSのﾊﾞｰｼﾞｮﾝをﾁｪｯｸすることでS-OS内の拡張ル－チンが使用できるかどうかを知ることができる。
	 * 
	 * 以下、 http://000.la.coocan.jp/p6/sword/index.html #VERについて より引用
	 * 
	 * 値	機種  
	 * 00h	MZ-80K/C/1200  
	 * 01h	MZ-700  
	 * 02h	MZ-1500  
	 * 10h	MZ-80B  
	 * 11h	MZ-2000/2200  
	 * 12h	MZ-2500  
	 * 16h	UNIX  
	 * 20h	X1  
	 * 21h	X1turbo (Oh!MZ掲載版)  
	 * 22h	X1turbo (高速版)  
	 * 30h	PC-8801 (ROM版)  
	 * 31h	PC-8001  
	 * 32h	PC-8801 (オールRAM版)  
	 * 40h	FM-7/77  
	 * 50h	SMC-777  
	 * 60h	PASOPIA  
	 * 61h	PASOPIA7  
	 * 70h	PC-286  
	 * 80h	X68000  
	 * 90h	MSX/2/2+/turboR (ANK版)  
	 * 91h	MSX/2/2+/turboR (漢字対応版)  
	 * FFh	PC-G850  
	 * @param {TaskContext} ctx 
	 */
	sos_ver(ctx){
		this.#Log(ctx, "sos_ver");
		//this.#setHL(0x7820); // @todo
		this.#setHL(0x2820); // @todo
	}

	/**
	 * #PRINT(1FF4H)
	 * 
	 * Ａﾚｼﾞｽﾀをｱｽｷｰｺｰﾄﾞとみなし表示する（１文字表示）
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_print(ctx){
		this.#Log(ctx, "sos_print");
		this.#putch(ctx, this.#getA());
	}
	/**
	 * #PRINTS(1FF1H)
	 * 
	 * ｽﾍﾟｰｽをひとつ表示する。
	 * @param {TaskContext} ctx 
	 */
	sos_prints(ctx){
		this.#Log(ctx, "sos_prints");
		this.#putch(ctx, 0x20);
	}
	/**
	 * #LTNL(1FEEH)
	 * 
	 * 改行する。
	 * @param {TaskContext} ctx 
	 */
	sos_ltnl(ctx){
		this.#Log(ctx, "sos_ltnl");
		this.#putch(ctx, SOSKeyCode.CR);
	}
	/**
	 * #NL(1FEBH)
	 * 
	 * ｶｰｿﾙが先頭になければ改行する。
	 * @param {TaskContext} ctx 
	 */
	sos_nl(ctx){
		this.#Log(ctx, "sos_nl");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		if(ctx.getScreenLocate().x != 0) {
			// 改行
			ctx.PRINT(SOSKeyCode.CR);
			// カーソル位置をS-OSのワークに設定する
			this.#endCursor(ctx);
		}
	}
	/**
	 * #MSG(1FE8H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから0DＨがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する。
	 * @param {TaskContext} ctx 
	 */
	sos_msg(ctx){
		this.#Log(ctx, "sos_msg");
		this.#msgSub(ctx, 0x0D);
	}
	/**
	 * #MSX(1FE5H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから00Ｈがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する
	 * @param {TaskContext} ctx 
	 */
	sos_msx(ctx){
		this.#Log(ctx, "sos_msx");
		this.#msgSub(ctx, 0);
	}
	/**
	 * #MPRINT(1FE2H)
	 * 
	 * これをｺｰﾙした次のｱﾄﾞﾚｽから00Ｈがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する。  
	 * 例)  CALL #MPRINT  
	 *      DM   "MESSAGE"  
	 *      DB   0
	 * @param {TaskContext} ctx 
	 */
	sos_mprnt(ctx){
		this.#Log(ctx, "sos_mprnt");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 戻るアドレスを取得
		let retAddress = this.#memReadU16(this.#getSP());
		// 文字列描画
		while(true) {
			const ch = this.#memReadU8(retAddress++);
			if(ch == 0) { break; }
			ctx.PRINT(ch);
		}
		// 戻るアドレスを書き換える
		this.#memWriteU16(this.#getSP(), retAddress);
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}
	/**
	 * #TAB(1FDFH)
	 * 
	 * Ｂﾚｼﾞｽﾀの値とｶｰｿﾙＸ座標との差だけｽﾍﾟｰｽを表示する。
	 * @param {TaskContext} ctx 
	 */
	sos_tab(ctx){
		this.#Log(ctx, "sos_tab");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 指定位置の手前までスペース表示
		// 元々オーバーしていたら何もしない
		const regB = this.#getB();
		let posX = ctx.getScreenLocate().x;
		while(posX < regB) {
			ctx.PRINT(0x20);
			posX++;
		}
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}
	/**
	 * #LPRNT(1FDCH)
	 * 
	 * Ａﾚｼﾞｽﾀの内容をｱｽｷｰｺｰﾄﾞとみなしﾌﾟﾘﾝﾀのみに出力する。  
	 * ﾌﾟﾘﾝﾀｴﾗｰがあった場合は、ｷｬﾘﾌﾗｸﾞをｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 */
	sos_lprnt(ctx){
		this.#Log(ctx, "sos_lprnt");
		// エラー
		this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.LPSW, 0); // OFFにする
		this.#setCY(); // キャリフラグをセット
	}
	/**
	 * #LPTON(1FD9H)
	 * 
	 * 上記#PRINT～#TAB、#PRTHX、#PRTHLの出力をﾃﾞｨｽﾌﾟﾚｲだけでなくﾌﾟﾘﾝﾀにも出力するかどうかのﾌﾗｸﾞ#LPTSWをｾｯﾄする。  
	 * これをｺｰﾙしたあとは、上記ｻﾌﾞﾙｰﾁﾝでﾌﾟﾘﾝﾀにも出力される。
	 * @param {TaskContext} ctx 
	 */
	sos_lpton(ctx){
		this.#Log(ctx, "sos_lpton");
		this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.LPSW, 1);
	}
	/**
	 * #LPTOF(1FD6H)
	 * 
	 * ﾌﾗｸﾞ#LPTSWをﾘｾｯﾄする。  
	 * これをｺｰﾙしたあとは、#PRINT～#TAB、#PRTHX、#PRTHLの出力をﾃﾞｨｽﾌﾟﾚｲのみにする。
	 * @param {TaskContext} ctx 
	 */
	sos_lptof(ctx){
		this.#Log(ctx, "sos_lptof");
		this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.LPSW, 0);
	}
	/**
	 * #GETL(1FD3H)
	 * 
	 * DEﾚｼﾞｽﾀにｷｰ入力ﾊﾞｯﾌｧの先頭ｱﾄﾞﾚｽを入れてｺｰﾙすると、ｷｰﾎﾞｰﾄﾞから１行入力をして文字列をﾊﾞｯﾌｧに格納しﾘﾀｰﾝする。  
	 * ｴﾝﾄﾞｺｰﾄﾞは00Ｈ。  
	 * 途中でSHIFT+BREAKが押されたら、ﾊﾞｯﾌｧ先頭に1BＨが格納される。  
	 * @param {TaskContext} ctx 
	 */
	sos_getl(ctx){
		if(!ctx.taskLineInput.isActive()) {
			this.#Log(ctx, "sos_getl - z80 freeze");
			// １行入力を起動する
			ctx.taskLineInput.start();
			this.#getl_dstAddr = this.#getDE();
			return;
		} else {
			if(ctx.taskLineInput.isFinished()) {
				this.#Log(ctx, "sos_getl - z80 wakeup!");
				// 完了した
				// 結果をバッファにコピー
				const result = ctx.taskLineInput.getResult().result;
				for(let i = 0; i < result.length; ++i) {
					this.#memWriteU8(this.#getl_dstAddr + i, result[i]);
				}
				// 入力を終了させる
				ctx.taskLineInput.end(ctx);
				// カーソル位置をS-OSのワークに設定する
				this.#endCursor(ctx);
				// CPU停止していたのを終わらせる
				this.setPC(this.#getPC() + 3);
				return;
			} else {
				//this.#Log(ctx, "sos_getl - working");
				return;
			}
		}
	}
	/**
	 * #GETKY(1FD0H)
	 * 
	 * ｷｰﾎﾞｰﾄﾞからﾘｱﾙﾀｲﾑｷｰ入力をする。  
	 * 入力したﾃﾞｰﾀはＡﾚｼﾞｽﾀに格納され、何も押されていないときはＡﾚｼﾞｽﾀﾀに０をｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 */
	sos_getky(ctx){
		this.#Log(ctx, "sos_getky");
		let key = Number(ctx.keyMan.inKey());
		if(isNaN(key)) {
			key = 0; // キー文字列の場合は、0にしておく
		}
		this.#setA(key);
	}
	/**
	 * #BRKEY(1FCDH)
	 * 
	 * ﾌﾞﾚｲｸｷｰが押されているかどうかをﾁｪｯｸする。  
	 * 押されているときはｾﾞﾛﾌﾗｸﾞをｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 */
	sos_brkey(ctx){
		this.#Log(ctx, "sos_brkey");
		if(ctx.keyMan.isKeyDown(0x1B)) {
			this.#setZ();
		} else {
			this.#clearZ();
		}
	}
	/**
	 * #INKEY(1FCAH)
	 * 
	 * 何かｷｰを押すまでｷｰ入力待ちをし、ｷｰ入力があるとﾘﾀｰﾝする。  
	 * 押されたｷｰのｱｽｷｰｺｰﾄﾞはＡﾚｼﾞｽﾀにｾｯﾄされる。
	 * @param {TaskContext} ctx 
	 */
	sos_inkey(ctx){
		if(!this.#isCpuOccupation) {
			this.#Log(ctx, "sos_inkey - z80 freeze");
			ctx.keyMan.keyBufferClear();
			this.#isCpuOccupation = true;
			return;
		} else {
			let key = Number(ctx.keyMan.inKey());
			if(isNaN(key)) {
				key = 0;
			}
			if(key) {
				this.#Log(ctx, "sos_inkey - z80 wakeup!");
				this.#isCpuOccupation = false;
				this.#setA(key);

				this.setPC(this.#getPC() + 3);
				return;
			} else {
				this.#Log(ctx, "sos_inkey - working");
				return;
			}
		}
	}
	/**
	 * #PAUSE(1F07H)      ※メモ）1FC7Hが正しいはず
	 * 
	 * ｽﾍﾟｰｽが押されていれば、再び何かｷｰを押すまでﾘﾀｰﾝしない。  
	 * このときSHIFT+BREAKを押すと、このﾙｰﾁﾝをｺｰﾙした次のｱﾄﾞﾚｽの２ﾊﾞｲﾄの内容を参照し、そこヘｼﾞｬﾝﾌﾟする。  
	 * 例) CALL #PAUSE  
	 *     DW   BRKJOB  
	 * ここでBREAKを押すとBRKJOBヘｼﾞｬﾝﾌﾟ  
	 * さもなくばDW BRKJOBはｽｷｯﾌﾟ。
	 * 
	 * @param {TaskContext} ctx 
	 */
	sos_pause(ctx){
		this.#Log(ctx, "sos_pause");
		// 戻るアドレスを取得
		let retAddress = this.#memReadU16(this.#getSP());
		if(this.#pauseState == PauseState.Idle) {
			if(ctx.keyMan.isKeyDown(0x20)) {
				// スペースキー押された
				// キーバッファをクリアしておく
				ctx.keyMan.keyBufferClear();
				// ポーズ状態へ
				this.#pauseState = PauseState.Pause;
				// カーソル表示
				ctx.setDisplayCursor(true);
				return;
			} else {
				// 戻るアドレスを書き換える
				this.#memWriteU16(this.#getSP(), retAddress + 2);
				// CPU停止していたのを終わらせる
				this.setPC(this.#getPC() + 3);
				return;
			}
		} else if(this.#pauseState == PauseState.Pause) {
			// ポーズ中
			if(ctx.keyMan.isKeyDown(0x1B)) {
				// ポーズ中にbreakキー押された
				// 戻るアドレスを書き換える
				this.#memWriteU16(this.#getSP(), this.#memReadU16(retAddress));
				// 通常状態に初期化
				this.#pauseState = PauseState.Idle;
				// キーバッファをクリアしておく
				ctx.keyMan.keyBufferClear();
				// カーソル非表示
				ctx.setDisplayCursor(false);
				// CPU停止していたのを終わらせる
				this.setPC(this.#getPC() + 3);
				return;
			} else {
				let key = Number(ctx.keyMan.inKey());
				if(isNaN(key)) { key = 0; }
				if(key) {
					// ポーズ中に何か押された
					// 戻るアドレスを書き換える
					this.#memWriteU16(this.#getSP(), retAddress + 2);
					// 通常状態に
					this.#pauseState = PauseState.Idle;
					// キーバッファをクリアしておく
					ctx.keyMan.keyBufferClear();
					// カーソル非表示
					ctx.setDisplayCursor(false);
					// CPU停止していたのを終わらせる
					this.setPC(this.#getPC() + 3);
					return;
				} else {
					// ポーズ継続
					return;
				}
			}
		}
	}
	/**
	 * #BELL(1FC4H)
	 * 
	 * ベル（ビープ音）を鳴らす。
	 * @todo 実装すること
	 * @param {TaskContext} ctx 
	 */
	sos_bell(ctx){
		this.#Log(ctx, "sos_bell");
		ctx.BELL(0);
	}
	/**
	 * #PRTHX(1FC1H)  
	 * 破壊: AF  
	 * 
	 * Aレジスタの内容を16進数2桁で表示する。
	 * 
	 * メモ）移植：済み テスト：未
	 * @param {TaskContext} ctx 
	 */
	sos_prthx(ctx){
		this.#Log(ctx, "sos_prthx");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 表示
		const value = this.#getA();
		ctx.PRINT(Asc(value >>  4));
		ctx.PRINT(Asc(value      ));
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}
	/**
	 * #PRTHL(1FBEH)
	 * 
	 * HLﾚｼﾞｽﾀの内容を16進数４桁で表示する。
	 * 
	 * メモ）移植：済み テスト：未
	 * @param {TaskContext} ctx 
	 */
	sos_prthl(ctx){
		this.#Log(ctx, "sos_prthl");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 表示
		const value = this.#getHL();
		ctx.PRINT(Asc(value >> 12));
		ctx.PRINT(Asc(value >>  8));
		ctx.PRINT(Asc(value >>  4));
		ctx.PRINT(Asc(value      ));
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}
	/**
	 * #ASC(1FBBH)
	 * 
	 * Ａﾚｼﾞｽﾀの下位４ﾋﾞｯﾄの値を16進数を表すｱｽｷｰｺｰﾄﾞに変換し、Ａﾚｼﾞｽﾀにｾｯﾄする。
	 * 
	 * メモ）移植：済み テスト：未
	 * @param {TaskContext} ctx 
	 */
	sos_asc(ctx){
		this.#Log(ctx, "sos_asc");
		this.#setA(Asc(this.#getA()));
	}
	/**
	 * #HEX(1FB8H)
	 * 
	 * Ａﾚｼﾞｽﾀの内容を16進数を表すｱｽｷｰｺｰﾄﾞとしてﾊﾞｲﾅﾘに変換し、Ａﾚｼﾞｽﾀにｾｯﾄする。  
	 * Ａﾚｼﾞｽﾀの内容が16進数を表すｱｽｷｰｺｰﾄﾞでない場合は、ｷｬﾘﾌﾗｸﾞをｾｯﾄしてﾘﾀｰﾝする。
	 * 
	 * メモ）移植：済み テスト：未
	 * @param {TaskContext} ctx 
	 */
	sos_hex(ctx){
		this.#Log(ctx, "sos_hex");
		if(this.#checkHex(this.#getA())) {
			this.#setA(ParseHex(this.#getA()));
			this.#clearCY();
		} else {
			// エラー
			this.#setCY();
		}
	}
	/**
	 * 2HEX(1FB5H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから２ﾊﾞｲﾄの内容を、２桁の16進数を表すｱｽｷｰｺｰﾄﾞとしてﾊﾞｲﾅﾘに変換し、Ａﾚｼﾞｽﾀにｾｯﾄする。  
	 * ｴﾗｰがあった場合はｷｬﾘﾌﾗｸﾞがｾｯﾄされる。
	 * 
	 * メモ）移植：済み テスト：未
	 * @param {TaskContext} ctx 
	 */
	sos__2hex (ctx){
		this.#Log(ctx, "sos_2hex");
		const address = this.#getDE();
		// １文字目
		const value1 = this.#memReadU8(address);
		if(!this.#checkHex(value1)) {
			// エラー
			this.#setA(SOSErrorCode.BadData); // オリジナルでは不定となるが、BadDataを設定してことにする
			this.#setCY();
			this.#setDE(address + 1); // ソースを見ると、DEの値は+1されている
			return;
		}
		// ２文字目
		const value2 = this.#memReadU8(address + 1);
		this.#setDE(address + 2); // ソースを見ると、DEの値は+2されている
		if(!this.#checkHex(value2)) {
			// エラー
			this.#setA(SOSErrorCode.BadData); // オリジナルでは不定となるが、BadDataを設定してことにする
			this.#setCY();
			return;
		}
		// 正常終了
		this.#setA((ParseHex(value1) << 4) | ParseHex(value2));
		this.#clearCY();
	}

	/**
	 * #HLHEX(1FB2H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから４ﾊﾞｲﾄの内容を、４桁の16進数を表すｱｽｷｰｺｰﾄﾞとしてﾊﾞｲﾅﾘに変換し、HLﾚｼﾞｽﾀにｾｯﾄする。  
	 * ｴﾗｰがあった場合は、ｷｬﾘﾌﾗｸﾞがｾｯﾄされる。
	 * 
	 * メモ）移植：済み テスト：未
	 * @param {TaskContext} ctx 
	 */
	sos_hlhex(ctx){
		this.#Log(ctx, "sos_hlhex");
		const address = this.#getDE();
		// １文字目
		const value1 = this.#memReadU8(address);
		if(!this.#checkHex(value1)) {
			// エラー
			this.#setA(SOSErrorCode.BadData); // オリジナルでは不定となるが、BadDataを設定してことにする
			this.#setCY();
			this.#setDE(address + 1); // ソースを見ると、DEの値は+1されている
			return;
		}
		// ２文字目
		const value2 = this.#memReadU8(address + 1);
		if(!this.#checkHex(value2)) {
			// エラー
			this.#setA(SOSErrorCode.BadData); // オリジナルでは不定となるが、BadDataを設定してことにする
			this.#setCY();
			this.#setDE(address + 2); // ソースを見ると、DEの値は+2されている
			return;
		}
		this.#setH((ParseHex(value1) << 4) | ParseHex(value2));
		// ３文字目
		const value3 = this.#memReadU8(address + 2);
		if(!this.#checkHex(value3)) {
			// エラー
			this.#setA(SOSErrorCode.BadData); // オリジナルでは不定となるが、BadDataを設定してことにする
			this.#setCY();
			this.#setDE(address + 3); // ソースを見ると、DEの値は+3されている
			return;
		}
		// ４文字目
		const value4 = this.#memReadU8(address + 3);
		this.#setDE(address + 4);
		if(!this.#checkHex(value4)) {
			// エラー
			this.#setA(SOSErrorCode.BadData); // オリジナルでは不定となるが、BadDataを設定してことにする
			this.#setCY();
			return;
		}
		this.#setL((ParseHex(value3) << 4) | ParseHex(value4));
		this.#clearCY();
	}
	/**
	 * #WOPEN●(旧#WRI)(1FAFH)
	 * 
	 * #FILEでｾｯﾄされたﾌｧｲﾙ名、(#DTADR)、(#SIZE)、(#EXADR)をﾃｰﾌﾟに書き込む。  
	 * ﾃﾞｨｽｸの場合は、新しいﾌｧｲﾙかどうかのﾁｪｯｸを行う。  
	 * ｴﾗｰ発生時にはｷｬﾘﾌﾗｸﾞが立つ
	 * @todo テスト
	 * @param {TaskContext} ctx 
	 */
	sos_wopen(ctx){
		this.#Log(ctx, "sos_wopen");
		this.#dos_wopen(ctx);
	}
	/**
	 * #WRD●(1FACH)
	 * 
	 * (#DTADRS)、(#SIZE)、(#EXADR)に従って、ﾃﾞﾊﾞｲｽにﾃﾞｰﾀをｾｰﾌﾞする。  
	 * ﾃﾞｨｽｸの場合#WOPEN後でないとFile not Openのｴﾗｰが出る。
	 * @param {TaskContext} ctx 
	 */
	sos_wrd(ctx){
		this.#Log(ctx, "sos_wrd");
		this.#dos_wrd(ctx);
		/*
		const saveAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR);
		const dataSize    = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE);
		const execAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR);
		// 値をチェック
		if((dataSize == 0)
			|| (saveAddress > execAddress)
			|| ((saveAddress + dataSize) <= execAddress)
		) {
			this.#setA(SOSErrorCode.DeviceIOError);
			this.#setCY();
			return 0;
		}
		// 書き込むデータを作成
		const data = new Uint8Array(dataSize);
		for(let i = 0; i < dataSize; ++i) {
			data[i] = this.#memReadU8(saveAddress + i);
		}
		// ディレクトリのレコード
		const dirRecord = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		// ファイル名
		const filename = this.#getFilenameFromIB();
		// 書き込む
		const result = ctx.WriteFile(filename.deviceName, dirRecord,
			filename.filename, filename.extension, data,
			saveAddress, saveAddress + dataSize - 1, execAddress,
			filename.attribute // 属性
		);
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// 正常終了
		this.#clearCY();
		return 0;
		*/
	}
	/**
	 * #FCB●(旧#RDI)(1FA9H)
	 * 
	 * ﾃｰﾌﾟの場合従来の#RDIとまったく同じ。  
	 * ﾃﾞｨｽｸの場合#DIRNOの値に従って(#IBFAD)にﾃﾞｨﾚｸﾄﾘの内容を転送する。  
	 * これにより従来のﾃｰﾌﾟﾛｰﾄﾞﾙｰﾁﾝにまったく手を加えることなくﾃﾞｨｽｸﾘｰﾄﾞを行うことができる。  
	 * CALL後(#DIRNO)はｲﾝｸﾘﾒﾝﾄされる。  
	 * ﾌﾞﾚｲｸｷｰが押されると(#DIRNO)をクリアする。  
	 * ﾘﾀｰﾝｷｰが押されるとｷｬﾘﾌﾗｸﾞを立ててﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 */
	sos_fcb(ctx){
		this.#Log(ctx, "sos_fcb");
		const deviceName = this.wrkReadDSK();
		const maxDirNo = this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.MXTRK);
		let dirNo = this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO);
		let cacheRecord = -1;
		let data;
		while(true) {
			if(dirNo >= maxDirNo) {
				// オーバーしているので駄目
				this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return;
			}
			const dirRecord = ((dirNo * SOSInfomationBlock.InfomationBlockSize) >>> 8) + this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS); // ibのあるディレクトリレコード
			const ibOffset  = ((dirNo * SOSInfomationBlock.InfomationBlockSize) & 0xFF); // レコード内でのib位置
			// IBのあるレコードを読み込む
			if(cacheRecord != dirRecord) {
				cacheRecord = dirRecord;
				data = ctx.ReadRecord(deviceName, dirRecord);
				if(data.result != 0) {
					// エラー
					this.#setA(data.result);
					this.#setCY();
					return;
				}
			}
			const attribute = data.value[ibOffset + SOSInfomationBlock.ib_attribute];
			if(attribute == 0xFF) {
				// 終わり
				this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return;
			} else if(attribute == 0x00) {
				// 空きなので、次を検索
				dirNo++;
				continue;
			}
			// ibへコピー
			const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
			for(let i = 0; i < SOSInfomationBlock.InfomationBlockSize; ++i) {
				this.#memWriteU8(ib_base + i, data.value[ibOffset + i]);
			}
			// ibをワークに反映
			this.#memWriteU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR, this.#memReadU16(ib_base + SOSInfomationBlock.ib_startAddress));	// 読み込みアドレス
			this.#memWriteU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE,  this.#memReadU16(ib_base + SOSInfomationBlock.ib_size));			// ファイルサイズ
			this.#memWriteU16(this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR, this.#memReadU16(ib_base + SOSInfomationBlock.ib_executeAddress)); // 実行アドレス
			// キー処理
			if(ctx.keyMan.isKeyDown(0x1B)) {
				// ブレイクキー押下されてる
				this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return;
			}
			if(ctx.keyMan.isKeyDown(SOSKeyCode.CR)) {
				// リターンキー押下されている
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return;
			}
			// 次のへ
			dirNo++;
			if(dirNo >= maxDirNo) {
				// オーバーしているので駄目
				this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return;
			}
			this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO, dirNo);
			// 正常終了
			this.#clearCY();
			return;
		}
	}
	/**
	 * #RDD●(1FA6H)
	 * 
	 * (#DTADRS)、(#SIZE)、(#EXADR)に従って、ﾃﾞﾊﾞｲｽ上のﾌｧｲﾙを読み込む。  
	 * #ROPEN後でないとFile not Openのｴﾗｰが出る。
	 * @param {TaskContext} ctx 
	 */
	sos_rdd(ctx){
		this.#Log(ctx, "sos_rdd");
		this.#dos_rdd(ctx);
		/*
		// @todo オープンチェック
		const loadAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR);	// 読み込みアドレス
		const fileSize = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE);		// ファイルサイズ
		//const execAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR);	// 実行アドレス
		const filename = this.#getFilenameFromIB();				// ファイル名
		// 読み込む
		const dirRecord = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		let data = ctx.ReadFile(filename.deviceName, dirRecord, filename.filename, filename.extension);
		if(data.result != 0) {
			this.#setA(data.result);
			this.#setCY();
			return 0;
		}
		// メモリにコピー
		const minSize = this.#min(fileSize, data.value.length);
		for(let i = 0; i < minSize; ++i) {
			ctx.z80Emu.memWriteU8(loadAddress + i, data.value[i]);
		}
		// 正常終了
		this.#clearCY();
		return 0;
		*/
	}

	/**
	 * #FILE●(1FA3H)
	 * 
	 * Ａﾚｼﾞｽﾀのﾌｧｲﾙのｱﾄﾘﾋﾞｭｰﾄ、DEﾚｼﾞｽﾀにﾌｧｲﾙ名の入っている元頭ｱﾄﾞﾚｽをｾｯﾄしてｺｰﾙすると(#IBFAD)にﾌｧｲﾙ名のｾｯﾄと(#DSK)にﾌｧｲﾙﾃﾞｨｽｸﾘﾌﾟﾀのｾｯﾄを行う。  
	 * ﾌｧｲﾙを操作する前には、必ずこのｻﾌﾞﾙｰﾁﾝにより、ﾌｧｲﾙ名とｱﾄﾘﾋﾞｭｰﾄをｾｯﾄしなければならない。  
	 * ｺｰﾙ後DEﾚｼﾞｽﾀは行の終わり(00Ｈ)か：(コロン)の位置を示している。
	 * @param {TaskContext} ctx 
	 */
	sos_file(ctx){
		this.#Log(ctx, "sos_file");
		/*
		;------------------------
		;**  FILE - File descripter set
		
		FILE
			call	FNAME
			push	de
			ld	hl,NAMEBF
			ld	de,@IBUF
			ld	bc,18
			ldir
			pop	de
			call	SPCUT
			or	a
			ret
		*/
		/*
		GETDEV
			call	SPCUT
			inc	de
			ld	a,(de)
			dec	de
			cp	":"
			jr	z,GETDEV_1
			call	_RDVSW
			ret
			;
		GETDEV_1
			ld	a,(de)
			inc	de
			inc	de
		;
		*/
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		// 属性
		this.#memWriteU8(ib_base + SOSInfomationBlock.ib_attribute, this.#getA());
		this.#memWriteU8(DOSWorkAddr.FTYPE, this.#getA()); // for DOSモジュール
		// パスワードなし
		this.#memWriteU8(ib_base + SOSInfomationBlock.ib_password, 0x20);
		// ファイル名を分割して
		const result = this.#splitPath(this.#getDE());
		// デバイス名に設定
		this.wrkWriteDSK(result.deviceName);
		// ファイル名も設定
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) { this.#memWriteU8(ib_base + SOSInfomationBlock.ib_filename + i, result.filename[i]); }
		// 拡張子にも設定
		for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) { this.#memWriteU8(ib_base + SOSInfomationBlock.ib_extension + i, result.extension[i]); }
		// 忘れずにDEを更新しとく
		this.#setDE(result.filenamePtr);
		// 一応キャリーフラグをリセットしておく
		this.#clearCY();
	}
	/*
		FNAME
			ld	hl,NAMEBF
			ld	(hl),a
			inc	hl
			ld	(_FTYPE),a
			call	GETDEV
			call	_DEVCHK
			ret	c
			ld	(_DSK),a	; Device name set
		FILE2
			ld	b,13
			call	FILE3
			ld	a,(de)
			jr	nz,FILE2_1
			ld	a," "
			dec	de
		FILE2_1
			cp	"."
			jr	nz,FILE2_2
			ld	a," "
			dec	de
		FILE2_2
			ld	(hl),a
			inc	de
			inc	hl
			djnz	FILE2+2
			ld	a,(de)
			cp	"."
			jr	nz,FILE21
			inc	de
		FILE21
			ld	b,3
			call	FILE3
			ld	a,(de)
			jr	nz,FILE21_1
			ld	a," "
			dec	de
		FILE21_1
			ld	(hl),a
			inc	de
			inc	hl
			djnz	FILE21+2
			ld	(hl)," "
		;
			ld	a,(_DSK)
			call	_TPCHK
			ret	nz
			cp	"S"
			ret	z
		;
			ld	hl,NAMEBF+17
			ld	b,17
		MZ0DF
			ld	a,(hl)
			cp	" "+1
			ret	nc
			ld	(hl),0dh
			dec	hl
			djnz	MZ0DF
			ret
		
		FILE3
			push	de
			call	SPCUT
			ld	a,(de)
			pop	de
			cp	":"
			ret	z
			cp	20h
			ret	nc
			cp	a
		FILE3_1
			ret
	*/



	/**
	 * #FSAME●(1FA0H)
	 * 
	 * #FILEでｾｯﾄされたﾌｧｲﾙﾈｰﾑと、読み込んだﾌｧｲﾙﾈｰﾑを比較する。  
	 * 一致すれぱｾﾞﾛ、不一致ならばﾉﾝｾﾞﾛでﾘﾀｰﾝする。  
	 * ｱﾄﾘﾋﾞｭｰﾄのﾁｪｯｸも同時に行う。  
	 * 
	 * http://000.la.coocan.jp/p6/sword/index.html  
	 * Accに入れたファイル属性とDEから始まるファイル名を、#FILEでセットしたものと比較する。一致すればZフラグセット。
	 * @param {TaskContext} ctx 
	 */
	sos_fsame(ctx){
		this.#Log(ctx, "sos_fsame");
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		// 属性
		if(!SOSInfomationBlock.isEquelAttribute(this.#memReadU8(ib_base + SOSInfomationBlock.ib_attribute), this.#getA())) {
			this.#setCY();
			this.#setA(SOSErrorCode.BadFileMode);
			this.#clearZ();
			return;
		}
		// ファイル名を分割
		const result = this.#splitPath(this.#getDE());
		// デバイス名
		if(this.wrkReadDSK() != result.deviceName) {
			this.#setCY();
			this.#setA(SOSErrorCode.BadFileDescripter);
			this.#clearZ();
			return;
		}
		// ファイル名
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
			if(this.#memReadU8(ib_base + SOSInfomationBlock.ib_filename + i) != result.filename[i]) {
				this.#setCY();
				this.#setA(SOSErrorCode.DeviceIOError);
				this.#clearZ();
				return;
			}
		}
		// 拡張子
		for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
			if(this.#memReadU8(ib_base + SOSInfomationBlock.ib_extension + i) != result.extension[i]) {
				this.#setCY();
				this.#setA(SOSErrorCode.DeviceIOError);
				this.#clearZ();
				return;
			}
		}
		// 一致している
		this.#clearCY();
		this.#setZ();
		return;
	}
	/**
	 * #FRRNT●(1F9DH)
	 * 
	 * ﾃｰﾌﾟから読み込んだﾌｧｲﾙﾈｰﾑを表示する。  
	 * ｽﾍﾟｰｽｷｰを押すと表示後一時停止する。
	 * @param {TaskContext} ctx 
	 */
	sos_fprnt(ctx){
		this.#Log(ctx, "sos_fprnt");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// ファイル名
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
			ctx.PRINT(this.#memReadU8(ib_base + SOSInfomationBlock.ib_filename + i));
		}
		//
		ctx.PRINT(0x2E); // "."
		// 拡張子
		for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
			ctx.PRINT(this.#memReadU8(ib_base + SOSInfomationBlock.ib_extension + i));
		}
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}
	/**
	 * #POKE(1F9AH)
	 * 
	 * HLﾚｼﾞｽﾀの内容をｵﾌｾｯﾄｱﾄﾞﾚｽとして、CIOS用特殊ﾜｰｸｴﾘｱにＡﾚｼﾞｽﾀの内容を書き込む。
	 * @param {TaskContext} ctx 
	 */
	sos_poke(ctx){
		this.#Log(ctx, "sos_poke");
		this.#specialRAM[this.#getHL()] = this.#getA();
	}
	/**
	 * #POKE@(1F97H)
	 * 
	 * ﾒｲﾝﾒﾓﾘからS-OS用特殊ﾜｰｸｴﾘｱにﾃﾞｰﾀを転送する。  
	 * HLﾚｼﾞｽﾀにﾒﾓﾘ先頭ｱﾄﾞﾚｽ、DEﾚｼﾞｽﾀにﾜｰｸｴﾘｱｵﾌｾｯﾄｱﾄﾞﾚｽ、ｴﾘｱｵﾌｾｯﾄｱﾄﾞﾚｽ、BCﾚｼﾞｽﾀにﾊﾞｲﾄ数を入れてｺｰﾙする。
	 * @param {TaskContext} ctx 
	 */
	sos_poke_(ctx){
		this.#Log(ctx, "sos_poke@");
		let src = this.#getHL();
		let dst = this.#getDE();
		const size = this.#getBC();
		for(let i = 0; i < size; ++i) {
			this.#specialRAM[dst++ & this.#specialRamMask] = this.#memReadU8(src++);
		}
	}
	/**
	 * #PEEK(1F94H)
	 * 
	 * HLﾚｼﾞｽﾀの肉容をｵﾌｾｯﾄｱﾄﾞﾚｽとして、S-OS用特殊ﾜｰｸｴﾘｱからＡﾚｼﾞｽﾀにﾃﾞｰﾀを読み出す。  
	 * #POKEと逆の動作。
	 * @param {TaskContext} ctx 
	 */
	sos_peek(ctx){
		this.#Log(ctx, "sos_peek");
		this.#setA(this.#specialRAM[this.#getHL()]);
	}
	/**
	 * #PEEK@(1F91H)
	 * 
	 * S-OS用特殊ﾜｰｸｴﾘｱからﾒｲﾝﾒﾓﾘにﾃﾞｰﾀを転送する。  
	 * HL，DE，BCﾚｼﾞｽﾀにｾｯﾄするﾊﾟﾗﾒｰﾀは#POKE@と同じ。
	 * @param {TaskContext} ctx 
	 */
	sos_peek_(ctx){
		this.#Log(ctx, "sos_peek@");
		let src  = this.#getHL();
		let dst  = this.#getDE();
		let size = this.#getBC();
		for(let i = 0; i < size; ++i) {
			this.#memWriteU8(src++, this.#specialRAM[dst++ & this.#specialRamMask]);
		}
	}
	/**
	 * #MON(1F8EH)
	 * 
	 * 各機種のﾓﾆﾀにｼﾞｬﾝﾌﾟする。
	 * @param {TaskContext} ctx 
	 */
	sos_mon(ctx){
		if(!ctx.taskPlatformMonitor.isActive()) {
			this.#Log(ctx, "sos_mon - z80 freeze");
			// キーバッファをクリア
			ctx.keyMan.keyBufferClear();
			// プラットフォームモニタ開始
			ctx.taskPlatformMonitor.start(ctx);
			return;
		} else {
			if(!ctx.taskPlatformMonitor.isFinished()) {
				// モニタ動作中
				return;
			} else {
				// カーソル位置をS-OSのワークに設定する
				this.#endCursor(ctx);
				// CPU停止していたのを終わらせる
				this.setPC(this.#getPC() + 3);
				return;
			}
		}
	}
	/*
	 * [HL](1F81H)
	 * 
	 * HLﾚｼﾞｽﾀにｺｰﾙしたいｱﾄﾞﾚｽを入れ、  
	 *    CALL [HL]  
	 * と使うことにより、擬次的な相対ｺｰﾙが可能。  
	 */
	// Z80で直接記述
	/*
	 * #GETPC(1F80H)
	 * 
	 * 現在のﾌﾟﾛｸﾞﾗﾑｶｳﾝﾀの値をHLにｺﾋﾟｰする。
	 */
	// Z80で直接記述

	/**
	 * #DRDSB※(2000H)
	 * 
	 * DEが示すﾚｺｰﾄﾞﾅﾝﾊﾞｰからＡが示すﾚｺｰﾄﾞ数だけ  
	 * HLが示すｱﾄﾞﾚｽに読み込む。連続ｾｸﾀﾘｰﾄﾞ。  
	 * (#DSK)にﾃﾞﾊﾞｲｽ（Ａ～Ｄ）をｾｯﾄしてｺｰﾙする。  
	 *    LD     DE,(#FATPOS)  
	 *    LD     HL,(#FATBF)  
	 *    LD     A,1  
	 *    CALL   #SCTRD  
	 * とすれば、FATﾊﾞｯﾌｧにFATを読み出すことができる。
	 * @param {TaskContext} ctx 
	 */
	sos_drdsb(ctx){
		this.#Log(ctx, "sos_drdsb");
		let record = this.#getDE();
		let buffer = this.#getHL();
		let recordSize = this.#getA();
		//this.#Log(ctx, "A(RecordSize):" + recordSize);
		//this.#Log(ctx, "HL(Buffer):0x" + (buffer).toString(16));
		//this.#Log(ctx, "DE(RecordNo):" + record);
		this.#dos_dskred(ctx, buffer, record, recordSize);
		/*
		const deviceName = this.wrkReadDSK();
		let record = this.#getDE();
		let dstAddress = this.#getHL();
		let readRecordSize = this.#getA();
		this.#Log(ctx, "A(ReadSize):" + readRecordSize);
		this.#Log(ctx, "DE(RecordNo):" + record);
		this.#Log(ctx, "HL(DstAddr):0x" + (dstAddress).toString(16));
		for(let i = 0; i < readRecordSize; ++i) {
			// 読み込み
			const data = ctx.ReadRecord(deviceName, record + i);
			if(data.result != 0) {
				// エラー
				this.#setA(data.result);
				this.#setCY();
				this.#Log(ctx, "Error:" + data.result);
				return 0;
			}
			// コピー
			//this.#Log(ctx, "書き込みアドレス:" + (dstAddress).toString(16) + " 読み込んだバイト数:" + data.value.length);
			for(let j = 0; j < 0x100; ++j) {
				this.#memWriteU8(dstAddress + j, data.value[j]);
			}
			dstAddress += 0x100;
		}
		this.#clearCY();
		return 0;
		*/
	}
	/**
	 * #DWTSB※(2003H)
	 * 
	 * HLが示すｱﾄﾞﾚｽからＡﾚｺｰﾄﾞ分（Ａ×256ﾊﾞｲﾄ）の内容を、  
	 * DEを先頭ﾚｺｰﾄﾞとして記録する。連続ｾｸﾀﾗｲﾄ。  
	 * (#DSK)にﾃﾞﾊﾞｲｽ（Ａ～Ｄ）をｾｯﾄしてｺｰﾙ。
	 * @param {TaskContext} ctx 
	 */
	sos_dwtsb(ctx){
		this.#Log(ctx, "sos_dwtsb");
		let record = this.#getDE();
		let buffer = this.#getHL();
		let recordSize = this.#getA();
		//this.#Log(ctx, "A(RecordSize):" + recordSize);
		//this.#Log(ctx, "DE(RecordNo):" + record);
		//this.#Log(ctx, "HL(Buffer):0x" + (buffer).toString(16));
		this.#dos_dskwrt(ctx, buffer, record, recordSize);
		/*
		const deviceName = this.wrkReadDSK();
		let record = this.#getDE();
		let srcAddress = this.#getHL();
		for(let i = 0; i < this.#getA(); ++i) {
			// コピー
			const data = new Uint8Array(0x100);
			for(let j = 0; j < 0x100; ++j) {
				data[j] = this.#memReadU8(srcAddress + j);
			}
			srcAddress += 0x100;
			// 書き込み
			result = ctx.WriteRecord(deviceName, record + i, data);
			if(result.result != 0) {
				// エラー
				this.#setA(result.result);
				this.#setCY();
				return 0;
			}
		}
		this.#clearCY();
		return 0;
		*/
	}
	/**
	 * #DIR※(2006H)
	 * 
	 * (#DSK)で指定されたﾃﾞﾊﾞｲｽ上の全ﾃﾞｨﾚｸﾄﾘを表示する。
	 * @todo テスト
	 * @param {TaskContext} ctx 
	 */
	sos_dir(ctx){
		this.#Log(ctx, "sos_dir");
		this.#dos_dir(ctx);
		/*
		// デバイス名
		const deviceName = this.wrkReadDSK();
		// ディレクトリのレコード
		const dirRecord  = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.Files(deviceName, dirRecord);
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 結果を表示
		ctx.PrintFiles(result);
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		// 正常終了
		this.#clearCY();
		return 0;
		*/
	}
	/**
	 * #ROPEN(2009H)※
	 * 
	 * テープの場合は、先に#FILEでセットされたファイル名と、読み込んだＩＢを比較し、同一ファイルならゼロ、違えばノンゼロでリターンする。  
	 * ディスクの場合は、#FILEでセットされたファイルがディスク上にあるかどうかのチェックを行う。  
	 * ゼロフラグは常にリセットとなる。  
	 * いずれの場合にも、エラーが発生したときにはキャリでリターンする。  
	 * またファイルの情報は、(#DATADR)，(#SIZE)，(#EXADR)へ転送される。
	 * 
	 * http://000.la.coocan.jp/p6/sword/index.html  
	 * テープの場合は、#FILEでセットしたファイル名と読み込んだヘッダを比較し、同一ならZフラグセットでリターン。ディスクの場合は、ファイルが存在するかチェックする。
	 * @param {TaskContext} ctx 
	 */
	sos_ropen(ctx){
		this.#Log(ctx, "sos_ropen");
		this.#dos_ropen(ctx);
	}
	/**
	 * #SET※(200CH)
	 * 
	 * #IBDADで示されるＩＢﾊﾞｯﾌｧの内容と一致するﾃﾞｨｽｸ上のﾌｧｲﾙをﾗｲﾄﾌﾟﾛﾃｸﾄする。
	 * @param {TaskContext} ctx 
	 */
	sos_set(ctx){
		this.#Log(ctx, "sos_set");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.SetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return;
		}
		// 正常終了
		this.#clearCY();
		return;
	}
	/**
	 * #RESET※(200FH)
	 * 
	 * #IBDADで示されるＩＢﾊﾞｯﾌｧの内容と一致するﾌｧｲﾙのﾌﾟﾛﾃｸﾄをはずす。
	 * @param {TaskContext} ctx 
	 */
	sos_reset(ctx){
		this.#Log(ctx, "sos_reset");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.ResetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return;
		}
		// 正常終了
		this.#clearCY();
		return;
	}
	/**
	 * #NAME※(2012H)
	 * 
	 * #FILEで設定されたﾌｧｲﾙ名を、DEﾚｼﾞｽﾀが示すﾒﾓﾘ上のﾃﾞｰﾀに変える。ﾘﾈｰﾑ。  
	 * ﾒﾓﾘ上のﾃﾞｰﾀ中にﾃﾞﾊﾞｲｽﾃﾞｨｽｸﾘﾌﾟﾀが入っていても無視する。  
	 * またDE＋16以内にｴﾝｺｰﾄﾞ（00H,'：'）がないときにはｴﾗｰが発生する。
	 * @param {TaskContext} ctx 
	 */
	sos_name(ctx){
		this.#Log(ctx, "sos_name");
		// 変更するファイル名
		const newFilename = this.#splitPath(this.#getDE()); // ファイル名を分割
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.Rename(filename.deviceName, dirRecord, filename.filename, filename.extension, newFilename.filename, newFilename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return;
		}
		// 正常終了
		this.#clearCY();
		return;
	}
	/**
	 * #KILL※(2015H)
	 * 
	 * #IBFADで示されるＩＢﾊﾞｯﾌｧの内容と一致するﾃﾞｨｽｸ上のﾌｧｲﾙをキルする。
	 * @param {TaskContext} ctx 
	 */
	sos_kill(ctx){
		this.#Log(ctx, "sos_kill");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.Kill(filename.deviceName, dirRecord, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return;
		}
		// 正常終了
		this.#clearCY();
		return;
	}
	/**
	 * #CSR※(2018H)
	 * 
	 * 現在のｶｰｿﾙ位置を、ＨにＹ座標、ＬにＸ座標の順で読み出す。  
	 * 以後、ｶｰｿﾙ位置の読み出しは必ずこの方法によること。(#XYADR)は使わない
	 * @param {TaskContext} ctx 
	 */
	sos_csr(ctx){
		this.#Log(ctx, "sos_csr");
		const pos = ctx.getScreenLocate();
		this.#setHL((pos.x & 0xFF) | ((pos.y & 0xFF) << 8));
	}
	/**
	 * #SCRN※(201BH)
	 * 
	 * ＨにＹ座標、ＬにＸ座標をｾｯﾄしｺｰﾙすると、画面上の同位置にあるｷｬﾗｸﾀをＡに読み出す。  
	 * メモ）  
	 * ・ソースを見ると、画面範囲外の場合Aレジスタに14(BadData)を設定している。  
	 * ・取得した値が0x20未満だったら、0x20にしている
	 * @param {TaskContext} ctx 
	 */
	sos_scrn(ctx){
		this.#Log(ctx, "sos_scrn");
		const hl = this.#getHL();
		// 範囲チェック
		const x = hl & 0xFF;
		const y = (hl >> 8) & 0xFF;
		if(x >= this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.WIDTH) || y >= this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.MAXLIN)) {
			// エラー画面範囲外
			this.#setCY();
			this.#setA(SOSErrorCode.BadData);
			return;
		}
		// 取得
		let ch = ctx.getCodePoint(x, y);
		// 0x20未満なら0x20（空白）にする
		if(ch < 0x20) { ch = 0x20; }
		this.#setA(ch);
		// 正常終了
		this.#clearCY();
	}
	/**
	 * #LOC※(201EH)
	 * 
	 * ＨにＹ座標、ＬにＸ座標を入れてｺｰﾙすると、ｶｰｿﾙ位置がそこにｾｯﾄされる。  
	 * 以後、ｶｰｿﾙ位置の設定は必ずこの方法にとること。  
	 * メモ）  
	 * ・ソースを見ると、画面範囲外の場合Aレジスタに14(BadData)を設定している。
	 * @param {TaskContext} ctx 
	 */
	sos_loc(ctx){
		this.#Log(ctx, "sos_loc");
		const hl = this.#getHL();
		// 範囲チェック
		const x = hl & 0xFF;
		const y = (hl >> 8) & 0xFF;
		if(x >= this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.WIDTH) || y >= this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.MAXLIN)) {
			// エラー画面範囲外
			this.#setCY();
			this.#setA(SOSErrorCode.BadData);
			return;
		}
		// 設定
		ctx.setScreenLocate({x: x, y: y});
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		// 正常終了
		this.#clearCY();
	}
	/**
	 * #FLGET※(2021H)
	 * ｶｰｿﾙ位置で、ｶｰｿﾙ点滅１文字入力を行い、Ａに押されたｷｬﾗｸﾀをｾｯﾄ。
	 * ｵｰﾄﾘﾋﾟｰﾄもかかる（MZ-80K／C/1200は不可）。
	 * 画面へのｴｺｰﾊﾞｯｸは行わない。
	 * @param {TaskContext} ctx 
	 */
	sos_flget(ctx){
		if(!this.#isCpuOccupation) {
			this.#Log(ctx, "sos_flget - z80 freeze");
			ctx.keyMan.keyBufferClear(); // キーボードバッファをクリア
			// カーソル位置を設定
			const address = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.XYADR);
			const pos     = this.#memReadU16(address);
			ctx.setScreenLocate({x: pos & 0xFF, y:pos >> 8});

			//
			// バッチ処理
			//
			try {
				const result = ctx.batchManager.get();
				if(!result.cy && (result.character != 0)) {
					// バッチから入力された
					this.#setA(result.character);
					// 正常終了
					this.#clearCY();
					// CPU停止していたのを終わらせる
					this.setPC(this.#getPC() + 3);
					return;
				}
			} catch(e) {
				if(e instanceof SOSBatchUserInput) {
					// 「\0」の処理
					ctx.BELL(0); // ベルを鳴らして、ユーザー入力へ
				} else {
					throw e;
				}
			}

			// ユーザーからの入力待ちへ
			this.#isCpuOccupation = true;
			// カーソル表示
			ctx.setDisplayCursor(true);
			return;
		} else {
			// ユーザからの入力
			let key = Number(ctx.keyMan.inKey());
			if(isNaN(key)) { key = 0; }
			if(key) {
				// 入力された
				this.#Log(ctx, "sos_flget - z80 wakeup!");
				this.#isCpuOccupation = false;
				this.#setA(key);
				// カーソル非表示
				ctx.setDisplayCursor(true);
				// 正常終了
				this.#clearCY();
				// CPU停止していたのを終わらせる
				this.setPC(this.#getPC() + 3);
				return;
			} else {
				//this.#Log(ctx, "sos_flget - working");
				return;
			}
		}
	}
	/**
	 * #RDVSW※(2024H)
	 * 
	 * ﾃﾞﾌｫﾙﾄﾃﾞﾊﾞｲｽをＡに読み出す。  
	 * ﾃﾞﾌｫﾙﾄを知りたいときには必ずこの方法によるものとする。
	 * @param {TaskContext} ctx 
	 */
	sos_rdvsw(ctx){
		this.#Log(ctx, "sos_rdvsw");
		this.#setA(this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DSK));
	}
	/**
	 * #SDVSW※(2027H)
	 * 
	 * ﾃﾞﾌｫﾙﾄにしたいﾃﾞﾊﾞｲｽ名をＡに入れｺｰﾙすると、ﾃﾞﾌｫﾙﾄﾃﾞﾊﾞｲｽがｾｯﾄされる。  
	 * 今後必ずこの方法によること。  
	 * (#DVSW）を直接触ることも禁止する。
	 * @param {TaskContext} ctx 
	 */
	sos_sdvsw(ctx){
		this.#Log(ctx, "sos_sdvsw");
		this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DSK, this.#getA());
	}
	/**
	 * #INP※(202AH)
	 * 
	 * 共通I/Oﾎﾟｰﾄから１ﾊﾞｲﾄをＡに読み込む。  
	 * ﾎﾟｰﾄはＣで指定する。
	 * @param {TaskContext} ctx 
	 */
	sos_inp(ctx){
		this.#Log(ctx, "sos_inp");
	}
	/**
	 * #OUT※(202DH) 
	 * 
	 * 共通I/OﾎﾟｰﾄへＡを出力する。ﾎﾟｰﾄはＣで指定する。
	 * @param {TaskContext} ctx 
	 */
	sos_out(ctx){
		this.#Log(ctx, "sos_out");
	}
	/**
	 * #WIDCH※(2030H)
	 * 画面のﾓｰﾄﾞ（40ｷｬﾗ、80ｷｬﾗ）を切り替える。  
	 * Ａに40以下の数をｾｯﾄすると40ｷｬﾗ、  
	 * 40より大きい数をｾｯﾄしてｺｰﾙすると80ｷｬﾗとなる。  
	 * 現在のモードは(#WIDTH)に入っている。  
	 * この機能は80K／C／1200／700／1500にはない。
	 * @param {TaskContext} ctx 
	 */
	sos_widch(ctx){
		this.#Log(ctx, "sos_widch");
		const height = this.#memReadU8(this.#SOSWorkBaseAddress + SOSWorkAddr.MAXLIN);
		if(this.#getA() <= 40) {
			ctx.changeScreenSize(40, height);
			this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.WIDTH, 40);
		} else {
			ctx.changeScreenSize(80, height);
			this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.WIDTH, 80);
		}
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		// 正常終了
		this.#clearCY();
	}
	/**
	 * #ERROR※(2033H)
	 * 
	 * Ａにｴﾗｰ番号をｾｯﾄしてｺｰﾙすることによりｴﾗｰﾒｯｾｰｼﾞを表示する。
	 * @param {TaskContext} ctx 
	 */
	sos_error(ctx){
		this.#Log(ctx, "sos_error");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// エラー文言表示
		ctx.ERROR(this.#getA());
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
	}

	// 隠しサブルーチン？
	/**
	 * #MCOM(211BH)
	 * 
	 * DEレジスタに設定してあるアドレスのコマンドを実行する
	 * @param {TaskContext} ctx 
	 */
	sos_command(ctx)
	{
		this.#Log(ctx, "sos_mcom");
		// コマンドをコピー
		const command = [];
		let address = this.#getDE();
		while(true) {
			const ch = this.#memReadU8(address++);
			command.push(ch);
			if(ch == 0) { break; }
		}
		// コマンド実行
		// @todo モニタを呼び出して、ちゃんとコマンド実行をさせること！
		try {
			ctx.taskMonitor.executeCommand(ctx, command);
			this.#clearCY();
		} catch(e) {
			if(e instanceof SOSError) {
				// S-OSのエラー
				this.#setA(e.GetSOSErrorCode());
				this.#setCY();
			} else {
				// その他のエラー
				this.#Log(ctx, e.name + ': ' + e.message + '\n' + e.stack);
				this.#setA(SOSErrorCode.BadData);
				this.#setCY();
			}
		}
	}

	// --------------------------------------------------------------------------------------------------------------------
	// DOS MODULE
	// --------------------------------------------------------------------------------------------------------------------

	// 次のクラスタ
	#wrkWriteNXCLST(value) { this.#memWriteU8(DOSWorkAddr.NXCLST, value); }
	//#wrkReadNXCLST() { return this.#memReadU8(DOSWorkAddr.NXCLST); }

	// ディレクトリのセクタ
	#wrkWriteDEBUF(value) { this.#memWriteU16(DOSWorkAddr.DEBUF, value); }
	#wrkReadDEBUF() { return this.#memReadU16(DOSWorkAddr.DEBUF); }
	// IBのアドレス
	#wrkWriteHLBUF(value) { this.#memWriteU16(DOSWorkAddr.HLBUF, value); }
	#wrkReadHLBUF() { return this.#memReadU16(DOSWorkAddr.HLBUF); }
	// ?
	#dos_RETPOI;

	/**
	 * 
	 * @returns {boolean} 正常終了時 true
	 */
	#dos_wopen(ctx)
	{
		/*
		;-----------------------------
		;**  WOPEN - Open write file
		
		WOPEN
			call	CLOSE
			ld	a,(_DSK)
			call	DEVCHK
			ret	c
			jp	z,_WRI
			call	DSKCHK
			jr	nc,WOPEN1
			ret		; Reserved feature
		;
		WOPEN1
			call	FATRED
			ret	c	; Read error
			call	FCBSCH
			jr	nz,WOPEN2	;New file
		;
			ld	a,(hl)
			call	WPCHK
			ret	c	; Write protected
			call	FMCHK
			ret	c	; Bad file mode
			;
			push	hl
			ld	bc,1eh
			add	hl,bc
			ld	a,(hl)		; Start record No. get
			pop	hl
			call	ERAFAT
			ret	c	; Bad allocation table
			jr	WOPEN3
			;
		WOPEN2
			call	FRESCH
			ld	a,9	; Device full
			ret	c
		
		WOPEN3
			ld	(DEBUF),de
			ld	(HLBUF),hl
			call	_PARCS
			call	OPEN
			xor	a
			ret
		*/
		this.#dos_close();
		const dsk = this.wrkReadDSK();
		if(!this.#dos_devchk(dsk)) {
			return false; // Bad File Descripter
		}
		// jp	z,_WRI // @todo テープ未対応
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}
		// FAT読み込み
		if(!this.#dos_fatred(ctx)) {
			return false; // Read error
		}
		// ファイル検索
		let res = this.#dos_fcbsch(ctx);
		if(res.result != 0) {
			return false; // エラー
		}
		if(res.found) {
			// ファイル見つかった 既存ファイルの上書き
			const attribute = this.#memReadU8(res.ib_ptr + SOSInfomationBlock.ib_attribute);
			if(!this.#dos_wpchk(attribute)) {
				return false; // Write protected
			}
			if(!this.#dos_fmchk(attribute)) {
				return false; // Bad file mode
			}
			// Start record No. get
			const startRecord = this.#memReadU8(res.ib_ptr + SOSInfomationBlock.ib_cluster);
			// まずは、FATから削除
			if(!this.#dos_erafat(startRecord)) {
				return false; // Bad allocation table
			}
		} else {
			// 見つからなかった 新しくファイルを作成する
			res = this.#dos_fresch(ctx); // 空き見つける
			if(res.result != 0) {
				this.#setA(SOSErrorCode.DeviceFull); // Device full ディスクが一杯
				this.#setCY();
				return false; // エラー
			}
		}

		//ld	(DEBUF),de // ディレクトリのセクタ
		//ld	(HLBUF),hl // IBのアドレス
		this.#wrkWriteDEBUF(res.dir);
		this.#wrkWriteHLBUF(res.ib_ptr); // メモ）DTBUF内のポインタ

		// IB情報へコピー
		this.#dos_parcs();

		// ファイルオープン
		this.#dos_open();

		// 正常終了
		this.#setA(0);
		this.#setZ();
		this.#clearCY();
		return true;
	}

	#dos_ropen(ctx)
	{
		/*
		;***************************************
		;**  ROPEN - Open read file
		
		ROPEN
			call	CLOSE
			ld	a,(_DSK)
			call	DEVCHK
			ret	c	; Bad file descripter
			jp	z,_TROPN	;TAPE
			call	DSKCHK
			jr	nc,ROPEN1
			ret		; Reserved feature
			;
		ROPEN1
			call	FCBSCH
			ret	c
			ld	A,8	; File not found
			scf
			ret	nz
			push	hl
			ld	de,(_IBFAD)
			ld	bc,32
			ldir
			pop	hl
			ld	a,(hl)
			call	FMCHK
			ret	c	; Bad file mode
			;
		ROPEN2
			call	_PARSC
			call	OPEN
			xor	a
			ret
		*/
		this.#dos_close();
		const dsk = this.wrkReadDSK();
		if(!this.#dos_devchk(dsk)) {
			return false; // Bad File Descripter
		}
		// jp	z,_TROPN	;TAPE  // @todo テープ未対応
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}
		// ファイル検索
		const res = this.#dos_fcbsch(ctx);
		if(res.result != 0) {
			return false; // エラー
		}
		if(!res.found) {
			this.#setA(SOSErrorCode.FileNotFound);
			this.#setCY();
			return false; // エラー
		}
		// 見つけたIBをS-OSのIBへコピー
		const ib_ptr = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		for(let i = 0; i < SOSInfomationBlock.InfomationBlockSize; ++i) {
			this.#memWriteU8(ib_ptr + i, this.#memReadU8(res.ib_ptr + i));
		}
		// 属性チェック
		const attribute = this.#memReadU8(res.ib_ptr + SOSInfomationBlock.ib_attribute);
		if(!this.#dos_fmchk(attribute)) {
			return false; // Bad file mode
		}

		this.#dos_parsc();
		this.#dos_open();

		this.#setA(0);
		this.#clearCY();
		return true;
	}


	#dos_wrd(ctx)
	{
		/*
		;***************************************
		;**  WRD - Write Data
		
		WRD
			ld	a,(_DSK)
			call	DEVCHK
			ret	c
			jp	z,_TWRD
			ld	a,(_OPNFG)
			or	a
			jr	nz,WRD1
			scf
			ld	a,12	; File not open
			ret
			;
		WRD1
			call	CLOSE
			ld	a,(_DSK)
			call	DSKCHK
			ret	c	;Reserved feature
			;
			call	DSAVE	; DISK
			ret
		*/	
		const dsk = this.wrkReadDSK();
		if(!this.#dos_devchk(dsk)) {
			return false; // Bad File Descripter
		}
		// jp	z,_TWRD // @todo
		if(!this.#dos_isOpen()) {
			this.#setA(SOSErrorCode.FileNotOpen); // File not open
			this.#setCY();
			return false;
		}
		this.#dos_close();
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}

		return this.#dos_dsave(ctx);
	}

	#dos_rdd(ctx)
	{
		/*
		;***************************************
		;**  RDD - Read Data
		
		RDD
			ld	a,(_DSK)
			call	DEVCHK
			ret	c
			jp	z,_TRDD
			xor	a
			ld	(_DIRNO),a
			ld	(RETPOI),a
			ld	a,(_OPNFG)
			or	a
			jr	nz,RDD1
			scf
			ld	a,12	; File not open
			ret
			;
		RDD1
			call	CLOSE
			ld	a,(_DSK)
			call	DSKCHK
			ret	c	; Reserved Feature
			;
			call	FATRED
			ret	c	;
			call	DLOAD		; DISK
			ret
		*/
		const dsk = this.wrkReadDSK();
		if(!this.#dos_devchk(dsk)) {
			return false; // Bad File Descripter
		}
		// jp	z,_TRDD // @todo

		this.#memWriteU8(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRNO, 0);
		this.#dos_RETPOI = 0; // ?

		if(!this.#dos_isOpen()) {
			this.#setA(SOSErrorCode.FileNotOpen); // File not open
			this.#setCY();
			return false;
		}
		this.#dos_close();
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}
		// FAT読み込み
		if(!this.#dos_fatred(ctx)) {
			return false; // Read error
		}
		// 読み込み
		return this.#dos_dload(ctx);
	}

	/*
	;***************************************
	;**  GETFCB -
	
	GETFCB:
		call	CLOSE
		ld	a,(_DSK)
		call	DEVCHK
		ret	c
		jr	NZ,GETFC1	;*-*-
		call	TRDVSW		;*-*-
		ld	(_DSK),A	;*-*-
		jp	_RDI		;*-*-
	GETFC1
		call	_GETKY
		cp	1bH
		jp	z,DEND
		cp	0dh
		jr	nz,GETFC2
		ld	a,(RETPOI)
		or	a
		jr	nz,DECPOI
	GETFC2
		ld	a,(_DIRNO)
		ld	c,a
		ld	b,3
	SFR41
		srl	a
		djnz	SFR41
		ld	hl,(_DIRPS)
		ld	d,0
		ld	e,a
		add	hl,de
		ex	de,hl
		ld	hl,(_DTBUF)
		ld	a,1
		call	DSKRED
		jr	c,ERRRET
		ld	a,c
		and	07h
		ld	b,5
	SFL51
		add	a,a
		djnz	SFL51
		ld	hl,(_DTBUF)
		add	a,l
		ld	l,a
		jr	nc,$+3
		inc	h
		ld	a,(hl)
		or	a
		jr	z,NEXT1
		cp	0ffh
		jr	z,DEND
	
		ld	de,(_IBFAD)
		ld	bc,20h
		ldir
		call	INCPOI
		jp	ROPEN2
	
	NEXT1
		call	INCPOI
		jr	nc,GETFC1
		ret		;File not found *-*-*-
	
	INCPOI
		ld	hl,_DIRNO
		inc	(hl)
		ld	A,(hl)
		ld	hl,_MXTRK
		cp	(hl)
		jr	z,DEND
		ld	(RETPOI),a
		or	a
		ret
	ERRRET
		push	af
		call	DEND
		pop	af
		ret
	
	DECPOI
		ld	hl,_DIRNO
		ld	a,(hl)
		or	a
		jr	z,$+3
		dec	(hl)
		xor	a
		jr	DEND1
	DEND
		xor	a
		ld	(_DIRNO),a
	DEND1
		ld	(RETPOI),a
		ld	a,8
		scf
		ret
	
	
	RETPOI	db	0
	*/

	#dos_dir(ctx)
	{
		const dsk = this.wrkReadDSK();
		if(!this.#dos_devchk(dsk)) {
			return false; // Bad File Descripter
		}
		// jp	z,_TDIR // @todo
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}
		// FAT読み込み
		if(!this.#dos_fatred(ctx)) {
			return false; // Read error
		}
		// 空き容量
		this.#beginCursor(ctx); // S-OSのワークからカーソル位置を設定する
		const freeClusters = this.#dos_freclu(ctx);
		ctx.printNativeMsg("$" + ToStringHex2(freeClusters) + " Clusters Free\n");
		this.#endCursor(ctx); // カーソル位置をS-OSのワークに設定する

		// ディレクトリのレコード
		const dirRecord  = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		const dataBuffer = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTBUF);
		for(let i = 0; i < 16; ++i) {
			// ディレクトリ読み込み
			if(!this.#dos_dskred(ctx, dataBuffer, dirRecord + i, 1)) {
				return false; // エラー
			}
			// 内容表示
			if(!this.#dos_dirprt(ctx, dataBuffer)) {
				break;
			}
		}
		this.#setA(0);
		this.#setZ();
		this.#clearCY();
		return true;
		/*
		;***************************************
		;**  DIR - Directory display
		
		DIR
			ld	a,(_DSK)
			call	DEVCHK
			ret	c	; Bad File Descripter
			jp	z,_TDIR
			call	DSKCHK
			ret	c	; Reserved Feature
			;
			call	FATRED
			ret	c	; Disk error
			ld	A,"$"
			call	_PRINT
			call	FRECLU
			call	_PRTHX
			ld	de,CSTMES
			call	_MSX
			ld	b,16
			ld	de,(_DIRPS)	; Directory start
		
		DIRL
			ld	hl,(_DTBUF)
			ld	a,1
			call	DSKRED
			ret	c	; Disk error

			call	DIRPRT
			ret	z
			inc	de
			djnz	DIRL
			xor	a
			ret
		*/
	}
	#dos_dirprt(ctx, buffer)
	{
		for(let i = 0; i < (256 / SOSInfomationBlock.InfomationBlockSize | 0); ++i) {
			const ib = buffer + SOSInfomationBlock.InfomationBlockSize * i;
			const attribute = this.#memReadU8(ib + SOSInfomationBlock.ib_attribute);
			if(attribute == 0) { continue; }
			if(attribute == 0xFF) { return false; }
			//
			this.#dos_P_FNAM(ctx, ib);
			this.sos_ltnl(ctx);
			// @todo pause
		}
		return true;
		/*
		DIRPRT
			push	bc
			push	de
			ld	b,8
		DIRPL
			ld	a,(hl)
			or	a
			jr	z,DIRN
			cp	0ffh
			jr	z,DIRPE
			call	P_FNAM
			call	_LTNL
			call	_PAUSE
			dw	DIRPE
		DIRN
			ld	de,20h
			add	hl,de
			djnz	DIRPL
			db	3eh	; Skip next operation
		DIRPE
			xor	a
			pop	de
			pop	bc
			or	a
			ret
		*/
	}
	#dos_P_FNAM(ctx, ib)
	{
		/*
		P_FNAM
			push	bc
			push	de
			push	hl
			ld	de,(_IBFAD)
			ld	bc,20h
			ldir
			call	ATRPRT
			ld	a,(_DSK)
			call	_PRINT
			ld	a,":"
			call	_PRINT
			call	_FPRNT
			;
			call	adrPRT
		*/
		const ib_ptr = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		for(let i = 0; i < SOSInfomationBlock.InfomationBlockSize; ++i) {
			this.#memWriteU8(ib_ptr + i, this.#memReadU8(ib + i));
		}
		// 属性、ライトプロテクト
		this.#dos_atrprt(ctx, this.#memReadU8(ib_ptr + SOSInfomationBlock.ib_attribute));
		// デバイス名
		this.#beginCursor(ctx);
		ctx.PRINT(this.wrkReadDSK());
		ctx.PRINT(0x3a); // ":"
		this.#endCursor(ctx);
		// ファイル名
		this.sos_fprnt(ctx);
		// アドレス
		this.#dos_adrprt(ctx);
	}
	#dos_adrprt(ctx)
	{
		/*
		ADRPRT
			call	_PARSC
			ld	bc,(_SIZE)
			ld	hl,(_DTADR)
			ld	de,(_EXADR)
			call	PHEX
			add	hl,bc
			dec	hl
			call	PHEX
			ex	de,hl
			call	PHEX
			pop	hl
			pop	de
			pop	bc
			ret
		*/
		this.#dos_parsc();
		const dataSize    = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE);
		const address     = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR);
		const execAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR);
		this.#dos_phex(ctx, address);
		this.#dos_phex(ctx, address + dataSize - 1);
		this.#dos_phex(ctx, execAddress);
	}
	#dos_phex(ctx, value)
	{
		this.#beginCursor(ctx); // S-OSのワークからカーソル位置を設定する
		ctx.printNativeMsg(":" + ToStringHex4(value));
		this.#endCursor(ctx); // カーソル位置をS-OSのワークに設定する
		/*
		PHEX
			ld	a,":"
			call	_PRINT
			call	_PRTHL
			ret
		*/
	}

	#dos_atrprt(ctx, attr)
	{
		this.#beginCursor(ctx); // S-OSのワークからカーソル位置を設定する
		ctx.PrintFileAttribute(attr);
		this.#endCursor(ctx); // カーソル位置をS-OSのワークに設定する
		/*
		; FILE ATTRIBUTE PRINT

		ATRPRT
			push	af
			ld	de,ATRMES
			bit	7,a
			jr	z,ATRP1
			ld	a,8
			db	11h	; Skip next operation
		ATRP1
			and	7
			ld	l,a
			ld	h,0
			add	hl,hl
			add	hl,hl
			ld	de,ATRMES
			add	hl,de
			ex	de,hl
			call	_MSX
			pop	af
			bit	6,a
			ld	a,"*"
			jr	nz,ATRP2
			ld	a," "
		ATRP2
			call	_PRINT
			call	_PRNTS
			ret
		*/
	}

	/**
	 * セクタリード
	 * @param {number} buffer	読み込み先(HL)
	 * @param {number} sector	読み込むセクタ(DE)
	 * @param {number} size		読み込むセクタ数(A)
	 * @returns {boolean} 正常に読み込めたら trueを返す。エラーの場合はfalseを返し、Aにエラーコードが設定しキャリフラグが立つ。
	 */
	#dos_dskred(ctx, buffer, sector, size)
	{
		/*
		;***************************************
		;**  SECRD - Sector read
		
		DSKRED
			ex	af,af'
			ld	a,(_DSK)
			call	ALCHK
			ret	c
			call	DSKCHK
			ret	c
			sub	"A"
			ld	(UNITNO),a
			ex	af,af'
			call	DREAD
			ret
		*/
		const dsk = this.wrkReadDSK();
		if(!this.#dos_alchk(dsk)) {
			return false;
		}
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}
		this.#memWriteU8(DiskWorkAddr.UNITNO, dsk - 0x41);
		return this.#js_disk_dread(ctx, buffer, sector, size);
	}

	/**
	 * セクタライト
	 * @param {number} buffer	書き込むバッファ(HL)
	 * @param {number} sector	書き込むセクタ(DE)
	 * @param {number} size		書き込むセクタ数(A)
	 * @returns {boolean} 正常に読み込めたら trueを返す。エラーの場合はfalseを返し、Aにエラーコードが設定しキャリフラグが立つ。
	 */
	#dos_dskwrt(ctx, buffer, sector, size)
	{
		/*
		;***************************************
		;**  SECWR - Sector write
		
		DSKWRT
			ex	af,af'
			ld	a,(_DSK)
			call	ALCHK
			ret	c
			call	DSKCHK
			ret	c
			sub	"A"
			ld	(UNITNO),a
			ex	af,af'
			call	DWRITE
			ret
		*/
		const dsk = this.wrkReadDSK();
		if(!this.#dos_alchk(dsk)) {
			return false;
		}
		if(!this.#dos_dskchk(dsk)) {
			return false; // Reserved feature
		}
		this.#memWriteU8(DiskWorkAddr.UNITNO, dsk - 0x41);
		return this.#js_disk_dwrite(ctx, buffer, sector, size);
	}
	
	// -----------------------------
	//   SUBROUTINES
	// -----------------------------

	//  OPEN FLAG SET/RESET/CHECK

	#dos_open() { this.#memWriteU8(DOSWorkAddr.OPNFG, 1); }
	#dos_close() { this.#memWriteU8(DOSWorkAddr.OPNFG, 0); }
	#dos_isOpen() { return this.#memReadU8(DOSWorkAddr.OPNFG) != 0; }

	// FILE WRITE PROTECT CHECK

	/**
	 * ライトプロテクトが設定されているかどうかをチェックする  
	 * 設定されていれば、Aにエラーコードを設定し、キャリを立てる
	 * @param {number} attribute 属性(ファイルモード)
	 * @returns {boolean} ライトプロテクトが設定されていなければ、trueを返す
	 */
	#dos_wpchk(attribute)
	{
		if((attribute & 0x40) == 0) {
			return true; // ライトプロテクトが設定されていないので大丈夫
		}
		// ライトプロテクトが設定されているので、エラーコード、キャリフラグを立てる
		this.#setA(4); // Write protected
		this.#setCY();
		return false; // エラー
	}

	#dos_fmchk(attribute)
	{
		/*
			; FILE MODE CHECK

			FMCHK
				push	hl
				AND	87h	; 10000111B
				ld	hl,_FTYPE
				cp	(hl)
				pop	hl
				ret	z
				ld	a,6	; Bad file mode
				scf
				ret
		*/
		if(this.#memReadU8(DOSWorkAddr.FTYPE) == (attribute & 0x87)) {
			return true;
		}
		this.#setA(SOSErrorCode.BadFileMode); // Bad file mode
		this.#setCY();
		return false; // エラー
	}

	#dos_devchk(device)
	{
		/*
		DEVCHK
			call	TPCHK
			ret	z
			cp	"A"
			jr	c,DEVCH1
			cp	"L"+1
			ccf
			jr	c,$+4
			or	a
			ret
		DEVCH1
			ld	a,3	; Bad file descripter
			ret
		*/
		if(this.#dos_tpchk(device)) {
			return true; // テープデバイス
		}
		if(device < 0x41) {
			this.#setA(SOSErrorCode.BadFileDescripter);
			this.#setCY();
			return false;
		}
		this.#clearCY();
		this.#setZ();
		// Z
		return true;
	}

	/**
	 * 
	 */
	sos_tpchk(ctx)
	{
		this.#dos_tpchk(ctx.getA());
		return;
	}

	/**
	 * テープデバイスかどうか
	 * @param {number} device デバイス名
	 * @returns {boolean} テープデバイスだったらtrue、Zセット。
	 */
	#dos_tpchk(device)
	{
		/*
		TPCHK
			cp	"T"
			ret	z
			cp	"S"
			ret	z
			cp	"Q"
			ret
		 */
		if(device == 0x54 || device == 0x53 || device == 0x51) {
			// Z
			this.#setZ();
			this.#clearCY();
			return true;
		}
		// NZ
		this.#clearZ();
		return false;
	}
	
	#dos_dskchk(device)
	{
		/*
			; DISK DEVICE NAME CHECK
		DSKCHK
			cp	"A"
			jr	c,DSKCH1
			cp	"D"+1
			ccf
			ret	nc
		DSKCH1
			ld	a,11	;Reserved dfFeature
			ret
		*/

		// メモ）A～Eのみ対応にしとく
		// テープ等未対応
		if(0x41 <= device && device <= 0x45) {
			this.#clearCY();
			return true;
		}
		this.#setA(SOSErrorCode.ReservedFeature); // Reserved dfFeature
		this.#setCY();
		return false;
	}

	#dos_alchk(device)
	{
		/*
		; All Device Check

		ALCHK
			call	DEVCHK
			ret	c	; Bad file descripter
			call	TPCHK
			jr	nz,$+6
			ld	a,3
			scf
			ret
			call	DSKCHK
			ret		;Reserved feature
		*/
		if(!this.#dos_devchk(device)) {
			return false; // Bad File Descripter
		}
		if(this.#dos_tpchk(device)) {
			// テープデバイス
			this.#setA(SOSErrorCode.BadFileDescripter);
			this.#setCY();
			return false;
		}
		if(!this.#dos_dskchk(device)) {
			return false; // Reserved feature
		}
		return true;
	}
	/*
	RDVSW
		ld	a,(_DFDV)
		call	TPCHK
		ret	nz
	*/
	/*
	TRDVSW
		ld	a,(_DVSW)
		or	a
		jr	nz,$+4
		ld	a,"T"
		cp	1
		jr	nz,$+4
		ld	A,"S"
		cp	3
		jr	nz,$+4
		ld	a,"Q"
		ret
	*/
	/*
	SDVSW
		push	af
		ld	(_DFDV),a
		cp	"T"
		jr	nz,$+3
		xor	a
		cp	"S"
		jr	nz,$+4
		ld	a,1
		cp	"Q"
		jr	nz,$+4
		ld	a,3
		ld	(_DVSW),a
		pop	af
		ret
	*/

	#dos_dload(ctx)
	{
		/*
		; LOAD FROM DISK
		
		DLOAD
			ld	hl,(_IBFAD)
			ld	bc,1eh
			add	hl,bc
			ld	a,(hl)		; Record No.
			ld	(NXCLST),a
			ld	bc,(_SIZE)
			ld	hl,(_DTADR)
		DLOAD1
			push	hl
			ld	a,(NXCLST)
			ld	hl,(_FATBF)
			ld	e,a
			ld	d,0
			add	hl,de
			ld	a,(hl)
			ld	(NXCLST),a
			ex	de,hl
			add	hl,hl
			add	hl,hl
			add	hl,hl
			add	hl,hl
			ex	de,hl
			pop	hl
			or	a
			jr	z,DLOAD2
			cp	80h
			jr	nc,DLOAD3
			ld	a,10h
			call	DSKRED
			ret	c	; Disk error
			ld	de,1000h
			add	hl,de
			push	hl
			ld	l,c
			ld	h,b
			or	a
			sbc	hl,de
			ld	c,l
			ld	b,h
			pop	hl
			jr	nc,DLOAD1
		DLOAD2
			ld	a,7	; Bad allocation table
			scf
			ret
			;
		DLOAD3
			sub	7fh
			cp	10h+1
			jr	nc,DLOAD2
			dec	a
			dec	bc
			cp	b
			jr	nz,DLOAD2
			ld	b,0
			inc	bc
			or	a
			jr	z,DLOAD4
			push	af
			call	DSKRED
			jr	c,DLOAD5
			pop	af
		DLOAD4
			push	de
			ld	e,0
			ld	d,a
			add	hl,de
			ex	(sp),hl
			ld	e,a
			ld	d,0
			add	hl,de
			ex	de,hl
			ld	hl,(_DTBUF)
			ld	a,1
			call	DSKRED
		DLOAD5
			pop	de
			ret	c	; Disk error
			ldir
			xor	a
			ret
		*/
		const ib_base     = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		const fatbf       = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF);
		const dtbuf       = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTBUF);
		let   loadAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR);
		let   dataSize    = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE);
		// 初めのクラスタ
		let current = this.#memReadU8(ib_base + SOSInfomationBlock.ib_cluster);
		this.#wrkWriteNXCLST(current);
		while(dataSize > 0) {
			// 読み込むサイズ
			let next = this.#memReadU8(fatbf + current);
			this.#wrkWriteNXCLST(next);
			const readSectorSize = (next < 0x80) ? 0x10 : (next - 0x7F);
			if(next >= 0x80) {
				// 最後のクラスタ
				// ・最後のクラスタの最後の１セクタは、分けて読み込む
				let c = current * 16;
				if(readSectorSize > 1) {
					if(!this.#dos_dskred(ctx, loadAddress, c, readSectorSize - 1)) {
						return false; // エラー
					}
					loadAddress += (readSectorSize - 1) * 0x100;
					dataSize    -= (readSectorSize - 1) * 0x100;
					c += readSectorSize - 1;
				}
				// 最後の最後の１セクタの読み込み
				if(!this.#dos_dskred(ctx, dtbuf, c, 1)) {
					return false; // エラー
				}
				// コピー
				if(dataSize > 0x100) {
					// 最後の１セクタなのに、残りサイズが大きい
					this.#setA(SOSErrorCode.BadAllocationTable);
					this.#setCY();
					return false;
				}
				for(let i = 0; i < dataSize; ++i) {
					this.#memWriteU8(loadAddress + i, this.#memReadU8(dtbuf + i));
				}
				break; // 終わり
			} else {
				// 続きがある場合
				if(!this.#dos_dskred(ctx, loadAddress, current * 16, readSectorSize)) {
					return false; // エラー
				}
				loadAddress += readSectorSize * 0x100;
				dataSize    -= readSectorSize * 0x100;
				current = next;
			}
		}
		// 正常終了
		this.#setA(0);
		this.#clearCY();
		return true;
	}

	#dos_dsave(ctx)
	{
		/*
		; SAVE TO DISK
		
		DSAVE
			ld	de,(DEBUF)
			ld	hl,(HLBUF)
			ld	bc,(_SIZE)
			push	bc
			dec	bc
			srl	b
			srl	b
			srl	b
			srl	b
			inc	b
			call	FRECLU
			cp	b
			pop	bc
			ld	a,9	; Device full
			ret	c
			ld	hl,(_IBFAD)
			push	hl
			push	de
			push	bc
			ld	de,18h
			add	hl,de
			ld	e,l
			ld	d,h
			inc	de
			ld	(hl),0
			ld	bc,7
			ldir
			pop	bc
			pop	de
			pop	hl
			ld	a,1eh
			add	a,l
			ld	l,a
			jr	nc,$+3
			inc	h
			call	FCGET
			ld	(hl),a	; Record No.
			ld	hl,(_DTADR)
		;
		DSAVE1
			push	hl
			ld	hl,(_FATBF)
			ld	e,a
			ld	d,0
			add	hl,de
			ex	de,hl
			add	hl,hl
			add	hl,hl
			add	hl,hl
			add	hl,hl
			ex	de,hl
			dec	bc
			ld	a,b
			inc	bc
			cp	10h
			jr	c,DSAVE3
			ld	(hl),80h
			call	FCGET
			ld	(hl),a
			pop	hl
			push	af
			ld	a,10h
			call	DSKWRT
			jr	c,DSAVE2	; Disk error
			ld	de,1000h
			add	hl,de
			push	hl
			ld	l,c
			ld	h,b
			or	a
			sbc	hl,de
			ld	c,l
			ld	b,h
			pop	hl
			pop	af
			jr	DSAVE1
			;
		DSAVE2
			pop	hl
			ret
			;
		DSAVE3
			inc	a
			push	af
			add	a,7fh
			ld	(hl),a
			pop	af
			pop	hl
			call	DSKWRT
			ret	c	; Disk error
			call	FATWRT
			ret	c	; Disk error
			ld	hl,(_IBFAD)
			ld	de,(HLBUF)
		;	inc	de
			ld	bc,20h	;***
			ldir
			ld	hl,(_DTBUF)
			ld	de,(DEBUF)
			ld	a,1
			call	DSKWRT		; Directory write
			ret	c	; Disk error
			xor	a
			ret
		*/
		// 書き込める容量があるかどうかを確認
		let dataSize = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE); // _SIZE
		const needCluster = ((((dataSize-1) & 0xFFFF) >> 4) + 0x100) >> 8;
		if(this.#dos_freclu(ctx) < needCluster) {
			this.#setA(SOSErrorCode.DeviceFull);
			this.#setCY();
			return false;
		}
		// @todo 日付設定
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		for(let i = 0; i < 5; ++i) {
			this.#memWriteU8(ib_base + SOSInfomationBlock.ib_date + i, 0);
		}
		// 開始クラスタを設定
		let freePos = this.#dos_fcget(ctx); // 空きクラスタを取得
		if(freePos < 0) {
			// メモ）空きを確認しているので、ここには来ない
			this.#setA(SOSErrorCode.DeviceFull);
			this.#setCY();
			return false;
		}
		this.#memWriteU8(ib_base + SOSInfomationBlock.ib_cluster_high,   freePos >> 16);	// 最上位 2Dだと常に0
		this.#memWriteU8(ib_base + SOSInfomationBlock.ib_cluster,        freePos);			// 最下位
		this.#memWriteU8(ib_base + SOSInfomationBlock.ib_cluster_middle, freePos >> 8);		// 真ん中 2Dだと常に0

		//
		//
		//

		let saveAddress = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR); // _DTADR
		let remainSector = dataSize ? (((dataSize - 1) >> 8) + 1) : 1; // 書き込むデータサイズが0の場合は1セクタにする
		while(remainSector > 0) {
			const writeSectorSize = this.#min(16, remainSector);
			if(!this.#dos_dskwrt(ctx, saveAddress, freePos * 16, writeSectorSize)) {
				// 書き込みエラー
				return false;
			}
			saveAddress += 256 * writeSectorSize; // 書き込むアドレスを進める
			remainSector -= writeSectorSize; // 書き込んだ分セクタを減らす

			// FATの繋がりを設定
			const currentFat = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF) + freePos;
			if(remainSector == 0) {
				// 最後のクラスタ
				this.#memWriteU8(currentFat, writeSectorSize + 0x7F);
			} else {
				// まだ残ってるので、次の空いているクラスタを取得
				this.#memWriteU8(currentFat, 0x80); // 別の空きクラスタ位置を取得したいので、一旦使用中にする。
				freePos = this.#dos_fcget(ctx); // 次に続く空きクラスタ位置を取得
				if(freePos < 0) {
					// メモ）空きを確認しているので、ここには来ない
					this.#setA(SOSErrorCode.DeviceFull);
					this.#setCY();
					return false;
				}
				this.#memWriteU8(currentFat, freePos); // 次に続く空きクラスタ位置を設定
			}
		}

		// FAT書き込み
		if(!this.#dos_fatwrt(ctx)) {
			return false; // Disk error
		}
		// IB書き込み
		// バッファへ書き戻して
		for(let i = 0; i < SOSInfomationBlock.InfomationBlockSize; ++i) {
			this.#memWriteU8( this.#wrkReadHLBUF() + i, this.#memReadU8(ib_base + i));
		}
		// 書き込み
		if(!this.#dos_dskwrt(ctx, this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTBUF), this.#wrkReadDEBUF(), 1)) {
			// 書き込みエラー
			return false;
		}
		this.#setA(0);
		this.#setZ();
		this.#clearCY();
		return true;
	}

	/**
	 * FATをFATバッファへ読み込む
	 * @returns {boolean} 正常に読み込めたら trueを返す。エラーの場合はfalseを返し、Aにエラーコードが設定しキャリフラグが立つ。
	 */
	#dos_fatred(ctx)
	{
		/*
		; FAT READ TO BUFFER
		FATRED
			push	de
			push	hl
			ld	de,(_FATPS)	; FAT position
			ld	hl,(_FATBF)
			ld	a,1
			call	DSKRED
			pop	hl
			pop	de
			ret
		*/
		const fatps = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATPOS);
		const fatbf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF);
		let size = 1;
		if(SOS_Web_Ext.FAT2SECTOR) {
			// Web版の拡張
			const deviceName = this.wrkReadDSK();
			const diskType = ctx.GetDiskType(deviceName);
			if(diskType && (fatbf == 0x0300) && (diskType.GetMaxCluster() >= 128)) {
				// バッファがデフォルト
				// 128クラスタ以上なら2セクタ分
				size = 2;
				this.#Log(ctx, "Web拡張機能:FAT2セクタ 読み込み dsk:" + deviceName + " fatps:" + fatps);
			}
		}
		return this.#dos_dskred(ctx, fatbf, fatps, size);
	}

	/**
	 * FATバッファをFATへ書き込む
	 * @returns {boolean} 正常に読み込めたら trueを返す。エラーの場合はfalseを返し、Aにエラーコードが設定しキャリフラグが立つ。
	 */
	#dos_fatwrt(ctx)
	{
		/*
		FATWRT
			push	de
			push	hl
			ld	de,(_FATPS)	; FAT position
			ld	hl,(_FATBF)
			ld	a,1
			call	DSKWRT
			pop	hl
			pop	de
			ret
		*/
		const fatps = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATPOS);
		const fatbf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF);
		let size = 1;
		if(SOS_Web_Ext.FAT2SECTOR) {
			// Web版の拡張
			const deviceName = this.wrkReadDSK();
			const diskType = ctx.GetDiskType(deviceName);
			if(diskType && (fatbf == 0x0300) && (diskType.GetMaxCluster() >= 128)) {
				// バッファがデフォルト
				// 128クラスタ以上なら2セクタ分
				size = 2;
				this.#Log(ctx, "Web拡張機能:FAT2セクタ 書き込み dsk:" + deviceName + " fatps:" + fatps);
			}
		}
		return this.#dos_dskwrt(ctx, fatbf, fatps, size);
	}

	/**
	 * #FRECLU(2721H) FREE CLUSTERS GET
	 * 
	 * #FATBFに読み込まれているFAT情報から空きクラスタ数を取得する。
	 * @returns {number}	空きクラスタ数
	 */
	#dos_freclu(ctx)
	{
		this.#Log(ctx, "dos_freclu");
		/*
		; FREE CLUSTERS GET
		
		FRECLU
			push	bc
			push	hl
			ld		b,80h
			ld		c,0
			ld		hl,(_FATBF)
		FRECL1
			ld		a,(hl)
			or		a
			jr		nz,FRECL2
			inc		c
		FRECL2
			inc		hl
			djnz	FRECL1
			ld		a,c
			pop		hl
			pop		bc
			ret
		*/
		const fatbf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF);
		let maxCluster = 0x80;
		if(SOS_Web_Ext.FAT2SECTOR) {
			// Web版の拡張
			const deviceName = this.wrkReadDSK();
			const diskType = ctx.GetDiskType(deviceName);
			if(diskType && (fatbf == 0x0300) && (diskType.GetMaxCluster() >= 128)) {
				maxCluster = diskType.GetMaxCluster();
				this.#Log(ctx, "Web拡張機能:FAT2セクタ 最大クラスタ分検索する dsk:" + deviceName + " 最大クラスタ数:" + maxCluster);
			}
		}

		let freeClusters = 0;
		for(let i = 0; i < maxCluster; ++i) {
			if(this.#memReadU8(fatbf + i) == 0) {
				freeClusters++;
			}
		}
		return freeClusters;
	}

	/**
	 * #FCGET(2736H) FREE CLUSTER POSITION GET
	 * 
	 * #FATBFに読み込まれているFAT情報から空きクラスタ位置を取得する。
	 * ・エラーが発生した場合は、キャリフラグが立つ
	 * @returns {number}	空きクラスタ位置(0～0x7F)  
	 * 						空きクラスタがない時は -1 を返す
	 */
	#dos_fcget(ctx)
	{
		/*
		; FREE CLUSTER POSITION GET
		
		FCGET
			push	bc
			push	hl
			ld		b,80h
			ld		hl,(_FATBF)
		FCGET2
			ld		a,(hl)
			or		a
			jr		z,FCGET3
			inc		hl
			djnz	FCGET2
			scf
			jr		FCGET4
		FCGET3
			ld		a,80h
			sub		b
			or		a
		FCGET4
			pop		hl
			pop		bc
			ret
		*/
		const fatbf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF);
		let maxCluster = 0x80;
		if(SOS_Web_Ext.FAT2SECTOR) {
			// Web版の拡張
			const deviceName = this.wrkReadDSK();
			const diskType = ctx.GetDiskType(deviceName);
			if(diskType && (fatbf == 0x0300) && (diskType.GetMaxCluster() >= 128)) {
				maxCluster = diskType.GetMaxCluster();
				this.#Log(ctx, "Web拡張機能:FAT2セクタ 最大クラスタ分検索する dsk:" + deviceName + " 最大クラスタ数:" + maxCluster);
			}
		}
		for(let i = 0; i < maxCluster; ++i) {
			if(this.#memReadU8(fatbf + i) == 0) {
				this.#clearCY();
				return i;
			}
		}
		// エラー
		this.#setCY();
		return -1;
	}
		
	/**
	 * #ERAFAT(274EH) FAT EERASE
	 * 
	 * #FATBFに読み込まれているFAT情報から連鎖しているクラスタを消す。
	 * 
	 * ・エラーが発生した場合は、キャリフラグが立つ
	 * ・エラーが発生した場合は、Ａレジスタにエラーコードが設定される
	 * @param {number} startCluster 開始クラスタ
	 * @returns {boolean} 成功したら true を返す
	 */
	#dos_erafat(startCluster)
	{
		/*
		; FAT EERASE

		ERAFAT
			push	de
			push	hl
			ld		de,(_FATBF)
		ERAFA1
			ld		l,a
			ld		h,0
			add		hl,de
			ld		a,(hl)
			ld		(hl),0
			cp		80h
			jr		c,ERAFA1
			pop		hl
			pop		de
			cp		90h
			jr		nc,ERAFA2
			xor		a
			ret
			;
		ERAFA2:	ld		a,7	; Bad allocation table
			scf
			ret
		*/
		let next = startCluster;
		const fatbf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.FATBF);
		while(true) {
			let tempAddr = fatbf + next;
			next = this.#memReadU8(tempAddr);
			this.#memWriteU8(tempAddr, 0);
			if(next < 0x80) {
				continue;
			}
			if(next < 0x90) {
				// 0x80～0x8F
				this.#clearCY();
				return true; // 終わり
			}
			// エラー
			this.#setA(SOSErrorCode.BadAllocationTable); // Bad allocation table
			this.#setCY();
			return false;
		}
	}
		
	/**
	 * ディレクトリを検索して同じファイルが存在するかどうかを調べる
	 * @returns {{
	 * 		result: number,		// 処理結果
	 * 		found: boolean,		// 見つかったかどうか
	 * 		dir: number,		// ディレクトリのセクタ
	 * 		ib_ptr: number		// IBのアドレス
	 * }}
	 */
	#dos_fcbsch(ctx)
	{
		/*
		; FCS SEARCH

		FCBSCH
			push	bc
			ld	c,16		; Directory length
			ld	de,(_DIRPS)	; Directory start
		FCBSC1
			ld	hl,(_DTBUF)
			ld	a,1
			call	DSKRED
			jr	c,FCBSC6
			ld	b,8
		FCBSC2
			ld	a,(hl)
			cp	0ffh
			jr	z,FCBSC4
			or	a
			jr	z,FCBSC3
			push	de
			ld	de,(_IBFAD)
			call	FCOMP
			pop	de
			jr	z,FCBSC5
		FCBSC3
			push	de
			ld	de,32
			add	hl,de
			pop	de
			djnz	FCBSC2
			inc	de
			dec	c
			jr	nz,FCBSC1
		FCBSC4
			db	3eh
		FCBSC5
			xor	a
			or	a
		FCBSC6
			pop	bc
			ret
		*/
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		const dirps = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		const dtbuf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTBUF);
		for(let c = 0; c < 16; ++c) {
			// ディレクトリのレコードを読み込む
			const dir = dirps + c;
			if(!this.#dos_dskred(ctx, dtbuf, dir, 1)) {
				return { result: this.#getA(), found: false }; // エラー
			}
			// メモ）レコードあたり8個のIBがある
			const IBPerSector = 256 / SOSInfomationBlock.InfomationBlockSize | 0;
			for(let i = 0; i < IBPerSector; ++i) {
				const ib_ptr = dtbuf + i * SOSInfomationBlock.InfomationBlockSize;
				// 属性を取得
				const attribute = this.#memReadU8(ib_ptr + SOSInfomationBlock.ib_attribute);
				if(attribute == 0x00) {
					// 未使用なので、スキップ
					continue;
				} else if(attribute == 0xFF) {
					// 終わりのマーカー
					// NZ
					return { result: 0, found: false, dir: dir, ib_ptr: ib_ptr };
				}
				// ファイル比較
				if(this.#dos_fcomp(ib_base, ib_ptr)) {
					// 見つかった
					// Z
					return { result: 0, found: true, dir: dir, ib_ptr: ib_ptr };
				}
			}
		}
		// 見つからなかった
		// NZ
		return { result: 0, found: false, dir: 0, ib_ptr: 0 };
	}
		
	/**
	 * 空きを見つける
	 * @returns 
	 */
	#dos_fresch(ctx)
	{
		/*
		; FREE FCB SEARCH

		FRESCH
			push	bc
			ld	c,16		; Directory length
			ld	de,(_DIRPS)	; Directory start
		FRESC1
			ld	hl,(_DTBUF)
			ld	a,1
			call	DSKRED
			jr	c,FRESC3
			ld	b,8
		FRESC2
			ld	a,(hl)
			or	a
			jr	z,FRESC4
			cp	0ffh
			jr	z,FRESC4
			push	de
			ld	de,32
			add	hl,de
			pop	de
			djnz	FRESC2
			inc	de
			dec	c
			jr	nz,FRESC1
		FRESC3	db	3eh		;Skip next operation
		FRESC4
			xor	a
			pop	bc
			ret
		*/
		const dirps = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DIRPS);
		const dtbuf = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTBUF);
		for(let c = 0; c < 16; ++c) {
			// ディレクトリのレコードを読み込む
			const dir = dirps + c;
			if(!this.#dos_dskred(ctx, dtbuf, dir, 1)) {
				// CY
				return { result: this.#getA(), found: false, dir: 0, ib_ptr: 0 }; // エラー
			}
			// メモ）レコードあたり8個のIBがある
			const IBPerSector = 256 / SOSInfomationBlock.InfomationBlockSize | 0;
			for(let i = 0; i < IBPerSector; ++i) {
				const ib_ptr = dtbuf + i * SOSInfomationBlock.InfomationBlockSize;
				// 属性を取得
				const attribute = this.#memReadU8(ib_ptr + SOSInfomationBlock.ib_attribute);
				if(attribute == 0x00 || attribute == 0xFF) {
					// 未使用
					// 終わりのマーカー
					return { result: 0, found: true, dir: dir, ib_ptr: ib_ptr };
				}
			}
		}
		// 見つからなかった
		// Z
		return { result: 0, found: false, dir: 0, ib_ptr: 0 };
	}

	/**
	 * IBのファイル名、拡張子を比較して同じかどうかを調べる
	 * @param {number} lhs IBのアドレス
	 * @param {number} rhs IBのアドレス
	 * @returns {{boolean}} 同じだったら true を返す
	 */
	#dos_fcomp(lhs, rhs)
	{
		/*
		; FILE NAME COMPARE
		FCOMP
			push	bc
			push	de
			push	hl
			ld	b,16	; Directory length
		FCOMP1
			inc	de
			inc	hl
			ld	a,(de)
			cp	(hl)
			jr	nz,FCOMP2
			djnz	FCOMP1
		FCOMP2
			pop	hl
			pop	de
			pop	bc
			ret
		*/
		// for デバッグ
		//let test = "lhs:";
		//for(let i = 1; i <= 16; ++i) { test += String.fromCodePoint(this.#memReadU8(lhs + i)); }
		//test += ",";
		//for(let i = 1; i <= 16; ++i) { test += String.fromCodePoint(this.#memReadU8(rhs + i)); }
		//this.#Log(ctx, test);

		for(let i = 0; i < 16; ++i) {
			if(this.#memReadU8(++lhs) != this.#memReadU8(++rhs)) {
				// NZ
				return false;
			}
		}
		// Z
		return true;
	}

	/**
	 * #RDI(2900H)
	 * 
	 * @param {TaskContext} ctx 
	 */
	dos_rdi(ctx)
	{
		this.#Log(ctx, "dos_rdi");


		this.#setA(SOSErrorCode.ReservedFeature);
		this.#setCY();

		// @todo 実装
/*
	RDISB
		call	TPACH		;*****
		ld	hl,@NAME
		ld	a," "
		ld	b,17
	RDISB_clearname
		ld	(hl),a
		inc	hl
		djnz	RDISB_clearname
		call	CMT_OPEN_LOAD
	
	RDISB_loop1
		ld	b,3
	RDISB_loop2
		call	CMT_LOAD
		cp	0d3h
		jr	nz,RDISB_loop1
		djnz	RDISB_loop2
	
		call	CMT_LOAD
		ld	de,@IBUF
		ld	(de),a
	
		ld	de,@SIZE
		ld	b,6
	RDISB_loop3
		call	CMT_LOAD
		ld	(de),a
		inc	de
		djnz	RDISB_loop3
	
		ld	de,@NAME
		ld	b,6
	RDISB_loop4
		call	CMT_LOAD
		ld	(de),a
		inc	de
		djnz	RDISB_loop4
	
		call	CMT_CLOSE_LOAD
	
		ld	hl,(@SIZE)
		ld	(_SIZE),hl
		ld	hl,(@DTADR)
		ld	(_DTADR),hl
		ld	hl,(@EXADR)
		ld	(_EXADR),hl
		or	a		;clear c-flag
		ret
	
	RDISB_error
		call	CMT_CLOSE_LOAD
		scf
		ret
*/	



















		// 1:1:2:4:1

	}

	// ===============================
	//   Disk IO  Sub Routine
	// ===============================

	/**
	 * ディスクリード(JS用エントリ)
	 * 
	 * デバイス指定はUNITNO
	 * @param {number} buffer	読み込み先(HL)
	 * @param {number} sector	読み込むセクタ(DE)
	 * @param {number} size		読み込むセクタ数(A)
	 * @returns {boolean} 正常に読み込めたら trueを返す。エラーの場合はfalseを返し、Aにエラーコードが設定しキャリフラグが立つ。
	 */
	#js_disk_dread(ctx, buffer, sector, size)
	{
		this.#Log(ctx, "js_disk_dread");
		const deviceName = this.#memReadU8(DiskWorkAddr.UNITNO) + 0x41;
		for(let i = 0; i < size; ++i) {
			// 読み込み
			const data = ctx.ReadRecord(deviceName, sector + i);
			if(data.result != 0) {
				// エラー
				this.#setA(data.result);
				this.#setCY();
				this.#Log(ctx, "Error:" + data.result);
				return false;
			}
			// コピー
			for(let j = 0; j < 0x100; ++j) {
				this.#memWriteU8(buffer + j, data.value[j]);
			}
			buffer += 0x100;
		}
		// 正常終了
		this.#setA(0);
		this.#clearCY();
		this.#setZ();
		return true;
	}

	/**
	 * #DREAD(2B00H) ディスクリード
	 * 
	 * デバイス指定はUNITNO
	 * @param {TaskContext} ctx 
	 */
	disk_dread(ctx)
	{
		this.#Log(ctx, "disk_dread");
		const buffer = this.getHL(); // 読み込み先
		const sector = this.getDE(); // 読み込むセクタ
		const size   = this.getA();  // 読み込むセクタ数
		this.#js_disk_dread(ctx, buffer, sector, size);
	}

	/**
	 * ディスクライト(JS用エントリ)
	 * 
	 * デバイス指定はUNITNO
	 * @param {number} buffer	書き込むデータ(HL)
	 * @param {number} sector	書き込むセクタ(DE)
	 * @param {number} size		書き込むセクタ数(A)
	 * @returns {boolean} 正常に読み込めたら trueを返す。エラーの場合はfalseを返し、Aにエラーコードが設定しキャリフラグが立つ。
	 */
	#js_disk_dwrite(ctx, buffer, sector, size)
	{
		this.#Log(ctx, "js_disk_dwrite");
		const deviceName = this.#memReadU8(DiskWorkAddr.UNITNO) + 0x41;
		for(let i = 0; i < size; ++i) {
			// コピー
			const data = new Uint8Array(0x100);
			for(let j = 0; j < 0x100; ++j) {
				data[j] = this.#memReadU8(buffer + j);
			}
			buffer += 0x100;
			// 書き込み
			const result = ctx.WriteRecord(deviceName, sector + i, data);
			if(result.result != 0) {
				// エラー
				this.#setA(result.result);
				this.#setCY();
				return false;
			}
		}
		// 正常終了
		this.#setA(0);
		this.#clearCY();
		this.#setZ();
		return true;
	}

	/**
	 * #DWRITE(2B03H) ディスクライト
	 * 
	 * デバイス指定はUNITNO
	 * @param {number} buffer	書き込むデータ(HL)
	 * @param {number} sector	書き込むセクタ(DE)
	 * @param {number} size		書き込むセクタ数(A)
	 */
	disk_dwrite(ctx)
	{
		this.#Log(ctx, "disk_dwrite");
		const buffer = this.getHL(); // 書き込むデータ
		const sector = this.getDE(); // 書き込むセクタ
		const size   = this.getA();  // 書き込むセクタ数
		this.#js_disk_dwrite(ctx, buffer, sector, size);
	}

	#dos_parsc()
	{
		/*
		_PARSC
		push	hl
		ld	hl,(@SIZE)
		ld	(_SIZE),hl
		ld	hl,(@DTADR)
		ld	(_DTADR),hl
		ld	hl,(@EXADR)
		ld	(_EXADR),hl
		pop	hl
		ret
		*/
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		const size  = this.#memReadU16(ib_base + SOSInfomationBlock.ib_size);
		const dtadr = this.#memReadU16(ib_base + SOSInfomationBlock.ib_startAddress);
		const exadr = this.#memReadU16(ib_base + SOSInfomationBlock.ib_executeAddress);
		this.#memWriteU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE,  size);
		this.#memWriteU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR, dtadr);
		this.#memWriteU16(this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR, exadr);
	}
	#dos_parcs()
	{
		/*
			_PARCS
			push	hl
			ld	hl,(_SIZE)
			ld	(@SIZE),hl
			ld	hl,(_DTADR)
			ld	(@DTADR),hl
			ld	hl,(_EXADR)
			ld	(@EXADR),hl
			pop	hl
			ret
		_PARCS_end
		*/
		const ib_base = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.IBFAD);
		const size  = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.SIZE);
		const dtadr = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.DTADR);
		const exadr = this.#memReadU16(this.#SOSWorkBaseAddress + SOSWorkAddr.EXADR);
		this.#memWriteU16(ib_base + SOSInfomationBlock.ib_size,  size);
		this.#memWriteU16(ib_base + SOSInfomationBlock.ib_startAddress, dtadr);
		this.#memWriteU16(ib_base + SOSInfomationBlock.ib_executeAddress, exadr);
	}
}
