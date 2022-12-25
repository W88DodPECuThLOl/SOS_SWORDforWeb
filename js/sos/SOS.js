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
	#specialRAM = new Array(0x10000);
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
	 * デバッグ用のログ出力
	 * @param {string} text 出力するテキスト
	 */
	#Log(text)
	{
		//console.log(text);
	}

	/**
	 * S-OSのワークからカーソル位置を設定する
	 * @param {TaskContext} ctx 
	 */
	#beginCursor(ctx)
	{
		// 出力位置
		const address  = this.#memReadU16(SOSWorkAddr.XYADR);
		const position = this.#memReadU16(address);
		ctx.setScreenLocate({x: position & 0xFF, y:position >> 8});
	}

	/**
	 * カーソル位置をS-OSのワークに設定する
	 * @param {TaskContext} ctx 
	 */
	#endCursor(ctx)
	{
		const position = ctx.getScreenLocate();
		const address = this.#memReadU16(SOSWorkAddr.XYADR);
		this.#memWriteU16(address, (position.x & 0xFF) | ((position.y & 0xFF) << 8));
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
	 * 文字を16進数として扱い変換する
	 * @param {number} value 文字
	 * @returns {number}	変換された値(0～0xF)  
	 * 						-1の時は失敗
	 */
	#hex(value){
		if(0x30 <= value && value <= 0x39) { // 0～9
			return value - 0x30;
		} else if(0x41 <= value && value <= 0x46) { // A～F
			return value - 0x41 + 10;
		} else if(0x61 <= value && value <= 0x66) { // a～f
			return value - 0x61 + 10;
		} else {
			return -1; // エラー
		}
	}
	/**
	 * 0x0～0xFの値を16進の文字に変換する
	 * @param {number} value 値
	 * @returns {number} 16進の文字
	 */
	#asc(value)
	{
		value &= 0xF;
		if(value <= 9) {
			return value + 0x30; // '0'～'9'
		} else {
			return value + 0x41 - 10; // 'A'～'F'
		}
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
		const deviceName = this.#memReadU8(SOSWorkAddr.DSK);
		// ファイル名
		const ib_base = this.#memReadU16(SOSWorkAddr.IBFAD);
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
		let deviceName = this.#memReadU8(SOSWorkAddr.DSK);

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
			const ch = this.#memReadU8(filenamePtr)
			if(ch == 0 || ch == 0x2E || ch == 0x3A) { break; } // "." ":"
			if(ch != 0x0D) {
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
				if(ch != 0x0D) {
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
	 * @returns {number}
	 */
	sos_cold(ctx) {
		this.#Log("sos_cold");
		// this.#memWriteU16( SOSWorkAddr.USR,    0x1FFA );
		this.#memWriteU8(  SOSWorkAddr.DVSW,   0 );
		this.#memWriteU8(  SOSWorkAddr.LPSW,   0 );
		this.#memWriteU16( SOSWorkAddr.PRCNT,  0 );
		this.#memWriteU16( SOSWorkAddr.XYADR,  0x0010 );
		//this.#memWriteU16( SOSWorkAddr.KBFAD,  ADDRESS_KBFAD );
		//this.#memWriteU16( SOSWorkAddr.IBFAD,  ADDRESS_IBFAD );
		this.#memWriteU16( SOSWorkAddr.SIZE,   0 );
		this.#memWriteU16( SOSWorkAddr.DTADR,  0 );
		this.#memWriteU16( SOSWorkAddr.EXADR,  0 );
		//this.#memWriteU16( SOSWorkAddr.STKAD,  ADDRESS_STKAD );
		//this.#memWriteU16( SOSWorkAddr.MEMAX,  ADDRESS_MEMAX );
		this.#memWriteU16( SOSWorkAddr.WKSIZ,  0xFFFF );
		this.#memWriteU8(  SOSWorkAddr.DIRNO,  0 );
		this.#memWriteU8(  SOSWorkAddr.MXTRK,  0x50 );
		//this.#memWriteU16( SOSWorkAddr.DTBUF,  ADDRESS_DTBUF );
		//this.#memWriteU16( SOSWorkAddr.FATBF,  ADDRESS_FATBF );
		this.#memWriteU16( SOSWorkAddr.DIRPS,  0x0010 );
		this.#memWriteU16( SOSWorkAddr.FATPOS, 0x000E );
		this.#memWriteU8(  SOSWorkAddr.DSK,    0x41 );

		//this.#memWriteU8(  SOSWorkAddr.WIDTH,  80 );
		//this.#memWriteU8(  SOSWorkAddr.MAXLIN, 25 );

		// 画面サイズを変更
		ctx.changeScreenSize(this.#memReadU8(SOSWorkAddr.WIDTH), this.#memReadU8(SOSWorkAddr.MAXLIN));
		// 初期化メッセージ表示
		ctx.initialMsg();
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);

		// USRのアドレスへコール
		this.setSP(this.#memReadU16(SOSWorkAddr.STKAD));
		this.setPC(0x0003);
		this.#memWriteU16(0x0004, this.#memReadU16(SOSWorkAddr.USR));

		// メモリクリア
		for(let i = 0x3000; i <= 0xFFFF; ++i) { this.#memWriteU8(i, 0); }
		// IOクリア
		for(let i = 0x4000; i <= 0xFFFF; ++i) { this.#ioWrite(i, 0); }

		// 各種ローカルの設定を初期化
		this.#isCpuOccupation = false;
		this.#pauseState = PauseState.Idle;
		return 0;
	}

	/**
	 * #HOT(1FFAH)
	 * 
	 * S-OSのモニタになっており、プロンプト#が出てコマンド入力待ちになる。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_hot(ctx){
		if(!ctx.taskMonitor.isActive()) {
			this.#Log("sos_hot - z80 freeze");
			// モニタ起動する
			ctx.taskMonitor.start();
			this.#isCpuOccupation = false;
			this.#pauseState = PauseState.Idle;
			return 1;
		} else {
			if(ctx.taskMonitor.isFinished()) {
				this.#Log("sos_hot - z80 wakeup!");
				// モニタ完了した
				ctx.taskMonitor.changeState(0); // モニタをidle状態に設定
				// カーソル位置をS-OSのワークに設定する
				this.#endCursor(ctx);

				// スタックポインタを初期化
				this.setSP(this.#memReadU16(SOSWorkAddr.STKAD));
				// ジャンプ先をコールする命令から再開させる
				this.setPC(0x0006);
				// 各種ローカルの設定を初期化
				this.#isCpuOccupation = false;
				this.#pauseState = PauseState.Idle;
				// CPU停止していたのを終わらせる
				return 0;
			} else {
				this.#Log("sos_hot - mon working");
				return 1; // まだ、モニタが動作中なので、CPUは停止状態にしておく
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
	 * @returns {number} 
	 */
	sos_ver(ctx){
		this.#Log("sos_ver");
		this.#setHL(0x7820); // @todo
		return 0;
	}
	/**
	 * #PRINT(1FF4H)
	 * 
	 * Ａﾚｼﾞｽﾀをｱｽｷｰｺｰﾄﾞとみなし表示する（１文字表示）
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_print(ctx){
		this.#Log("sos_print");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// Aレジスタ取得して1文字出力
		ctx.PRINT(this.#getA());
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		return 0;
	}
	/**
	 * #PRINTS(1FF1H)
	 * 
	 * ｽﾍﾟｰｽをひとつ表示する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_prints(ctx){
		this.#Log("sos_prints");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// スペース出力
		ctx.PRINT(0x20);
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		return 0;
	}
	/**
	 * #LTNL(1FEEH)
	 * 
	 * 改行する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_ltnl(ctx){
		this.#Log("sos_ltnl");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 改行
		ctx.PRINT(0x0D);
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		return 0;
	}
	/**
	 * #NL(1FEBH)
	 * 
	 * ｶｰｿﾙが先頭になければ改行する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_nl(ctx){
		this.#Log("sos_nl");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		if(ctx.getScreenLocate().x != 0) {
			// 改行
			ctx.PRINT(0x0D);
			// カーソル位置をS-OSのワークに設定する
			this.#endCursor(ctx);
		}
		return 0;
	}
	/**
	 * #MSG(1FE8H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから0DＨがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_msg(ctx){
		this.#Log("sos_msg");
		this.#msgSub(ctx, 0x0D);
		return 0;
	}
	/**
	 * #MSX(1FE5H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから00Ｈがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_msx(ctx){
		this.#Log("sos_msx");
		this.#msgSub(ctx, 0);
		return 0;
	}
	/**
	 * #MPRINT(1FE2H)
	 * 
	 * これをｺｰﾙした次のｱﾄﾞﾚｽから00Ｈがあるまでｱｽｷｰｺｰﾄﾞとみなし文字列を表示する。  
	 * 例)  CALL #MPRINT  
	 *      DM   "MESSAGE"  
	 *      DB   0
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_mprnt(ctx){
		this.#Log("sos_mprnt");
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
		return 0;
	}
	/**
	 * #TAB(1FDFH)
	 * 
	 * Ｂﾚｼﾞｽﾀの値とｶｰｿﾙＸ座標との差だけｽﾍﾟｰｽを表示する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_tab(ctx){
		this.#Log("sos_tab");
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
		return 0;
	}
	/**
	 * #LPRNT(1FDCH)
	 * 
	 * Ａﾚｼﾞｽﾀの内容をｱｽｷｰｺｰﾄﾞとみなしﾌﾟﾘﾝﾀのみに出力する。  
	 * ﾌﾟﾘﾝﾀｴﾗｰがあった場合は、ｷｬﾘﾌﾗｸﾞをｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_lprnt(ctx){
		this.#Log("sos_lprnt");
		// エラー
		this.#setA(SOSErrorCode.DeviceOffline);
		this.#setCY(); // キャリフラグをセット
		return 0;
	}
	/**
	 * #LPTON(1FD9H)
	 * 
	 * 上記#PRINT～#TAB、#PRTHX、#PRTHLの出力をﾃﾞｨｽﾌﾟﾚｲだけでなくﾌﾟﾘﾝﾀにも出力するかどうかのﾌﾗｸﾞ#LPTSWをｾｯﾄする。  
	 * これをｺｰﾙしたあとは、上記ｻﾌﾞﾙｰﾁﾝでﾌﾟﾘﾝﾀにも出力される。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_lpton(ctx){
		this.#Log("sos_lpton");
		this.#memWriteU8(SOSWorkAddr.LPSW, 0xFF);
		return 0;
	}
	/**
	 * #LPTOF(1FD6H)
	 * 
	 * ﾌﾗｸﾞ#LPTSWをﾘｾｯﾄする。  
	 * これをｺｰﾙしたあとは、#PRINT～#TAB、#PRTHX、#PRTHLの出力をﾃﾞｨｽﾌﾟﾚｲのみにする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_lptof(ctx){
		this.#Log("sos_lptof");
		this.#memWriteU8(SOSWorkAddr.LPSW, 0x00);
		return 0;
	}
	/**
	 * #GETL(1FD3H)
	 * 
	 * DEﾚｼﾞｽﾀにｷｰ入力ﾊﾞｯﾌｧの先頭ｱﾄﾞﾚｽを入れてｺｰﾙすると、ｷｰﾎﾞｰﾄﾞから１行入力をして文字列をﾊﾞｯﾌｧに格納しﾘﾀｰﾝする。  
	 * ｴﾝﾄﾞｺｰﾄﾞは00Ｈ。  
	 * 途中でSHIFT+BREAKが押されたら、ﾊﾞｯﾌｧ先頭に1BＨが格納される。  
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_getl(ctx){
		if(!ctx.taskLineInput.isActive()) {
			this.#Log("sos_getl - z80 freeze");
			// １行入力を起動する
			ctx.taskLineInput.start();
			this.#getl_dstAddr = this.#getDE();
			return 1;
		} else {
			if(ctx.taskLineInput.isFinished()) {
				this.#Log("sos_getl - z80 wakeup!");
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
				return 0;
			} else {
				this.#Log("sos_getl - working");
				return 1; // まだ、動作中なので、CPUは停止状態にしておく
			}
		}
	}
	/**
	 * #GETKY(1FD0H)
	 * 
	 * ｷｰﾎﾞｰﾄﾞからﾘｱﾙﾀｲﾑｷｰ入力をする。  
	 * 入力したﾃﾞｰﾀはＡﾚｼﾞｽﾀに格納され、何も押されていないときはＡﾚｼﾞｽﾀﾀに０をｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_getky(ctx){
		this.#Log("sos_getky");
		let key = Number(ctx.keyMan.inKey());
		if(isNaN(key)) {
			key = 0; // キー文字列の場合は、0にしておく
		}
		this.#setA(key);
		return 0;
	}
	/**
	 * #BRKEY(1FCDH)
	 * 
	 * ﾌﾞﾚｲｸｷｰが押されているかどうかをﾁｪｯｸする。  
	 * 押されているときはｾﾞﾛﾌﾗｸﾞをｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_brkey(ctx){
		this.#Log("sos_brkey");
		if(ctx.keyMan.isKeyDown(0x1B)) {
			this.#setZ();
		} else {
			this.#clearZ();
		}
		return 0;
	}
	/**
	 * #INKEY(1FCAH)
	 * 
	 * 何かｷｰを押すまでｷｰ入力待ちをし、ｷｰ入力があるとﾘﾀｰﾝする。  
	 * 押されたｷｰのｱｽｷｰｺｰﾄﾞはＡﾚｼﾞｽﾀにｾｯﾄされる。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_inkey(ctx){
		if(!this.#isCpuOccupation) {
			this.#Log("sos_inkey - z80 freeze");
			ctx.keyMan.keyBufferClear();
			this.#isCpuOccupation = true;
			return 1;
		} else {
			let key = Number(ctx.keyMan.inKey());
			if(isNaN(key)) {
				key = 0;
			}
			if(key) {
				this.#Log("sos_inkey - z80 wakeup!");
				this.#isCpuOccupation = false;
				this.#setA(key);
				return 0;
			} else {
				this.#Log("sos_inkey - working");
				return 1; // まだ、動作中なので、CPUは停止状態にしておく
			}
		}
	}
	/**
	 * #PAUSE(1F07H)
	 * 
	 * ｽﾍﾟｰｽが押されていれば、再び何かｷｰを押すまでﾘﾀｰﾝしない。  
	 * このときSHIFT+BREAKを押すと、このﾙｰﾁﾝをｺｰﾙした次のｱﾄﾞﾚｽの２ﾊﾞｲﾄの内容を参照し、そこヘｼﾞｬﾝﾌﾟする。  
	 * 例) CALL #PAUSE  
	 *     DW   BRKJOB  
	 * ここでBREAKを押すとBRKJOBヘｼﾞｬﾝﾌﾟ  
	 * さもなくばDW BRKJOBはｽｷｯﾌﾟ。
	 * 
	 * @todo テスト
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_pause(ctx){
		this.#Log("sos_pause");
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
				return 1;
			} else {
				// 戻るアドレスを書き換える
				this.#memWriteU16(this.#getSP(), retAddress + 2);
				return 0;
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
				return 0;
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
					return 0;
				} else {
					// ポーズ継続
					return 1;
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
	 * @returns {number} 
	 */
	sos_bell(ctx){
		this.#Log("sos_bell");
		return 0;
	}
	/**
	 * #PRTHX(1FC1H)
	 * 
	 * Ａﾚｼﾞｽﾀの内容を16進数２桁で表示する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_prthx(ctx){
		this.#Log("sos_prthx");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 表示
		let value = this.#getA();
		ctx.PRINT(this.#asc((value >>  4) & 0x0F));
		ctx.PRINT(this.#asc((value      ) & 0x0F));
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		return 0;
	}
	/**
	 * #PRTHL(1FBEH)
	 * 
	 * HLﾚｼﾞｽﾀの内容を16進数４桁で表示する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_prthl(ctx){
		this.#Log("sos_prthl");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// 表示
		const value = this.#getHL();
		ctx.PRINT(this.#asc((value >> 12) & 0x0F));
		ctx.PRINT(this.#asc((value >>  8) & 0x0F));
		ctx.PRINT(this.#asc((value >>  4) & 0x0F));
		ctx.PRINT(this.#asc((value      ) & 0x0F));
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		return 0;
	}
	/**
	 * #ASC(1FBBH)
	 * 
	 * Ａﾚｼﾞｽﾀの下位４ﾋﾞｯﾄの値を16進数を表すｱｽｷｰｺｰﾄﾞに変換し、Ａﾚｼﾞｽﾀにｾｯﾄする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_asc(ctx){
		this.#Log("sos_asc");
		this.#setA(this.#asc(this.#getA()));
		return 0;
	}
	/**
	 * #HEX(1FB8H)
	 * 
	 * Ａﾚｼﾞｽﾀの内容を16進数を表すｱｽｷｰｺｰﾄﾞとしてﾊﾞｲﾅﾘに変換し、Ａﾚｼﾞｽﾀにｾｯﾄする。  
	 * Ａﾚｼﾞｽﾀの内容が16進数を表すｱｽｷｰｺｰﾄﾞでない場合は、ｷｬﾘﾌﾗｸﾞをｾｯﾄしてﾘﾀｰﾝする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_hex(ctx){
		this.#Log("sos_hex");
		if(this.#checkHex(this.#getA())) {
			this.#setA(this.#hex(this.#getA()));
			this.#clearCY();
		} else {
			// エラー
			//this.#setA(SOSErrorCode.BadData);
			this.#setCY();
		}
		return 0;
	}
	/**
	 * 2HEX(1FB5H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから２ﾊﾞｲﾄの内容を、２桁の16進数を表すｱｽｷｰｺｰﾄﾞとしてﾊﾞｲﾅﾘに変換し、Ａﾚｼﾞｽﾀにｾｯﾄする。  
	 * ｴﾗｰがあった場合はｷｬﾘﾌﾗｸﾞがｾｯﾄされる。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos__2hex (ctx){
		this.#Log("sos_2hex");
		const address = this.#getDE();
		this.#setDE(address + 2);
		const value1 = this.#memReadU8(address);
		const value2 = this.#memReadU8(address + 1);
		if(this.#checkHex(value1) && this.#checkHex(value2)) {
			this.#setA((this.#hex(value1) << 4) | this.#hex(value2));
			this.#clearCY();
		} else {
			// エラー
			this.#setA(SOSErrorCode.BadData);
			this.#setCY();
		}
		return 0;
	}
	/**
	 * #HLHEX(1FB2H)
	 * 
	 * DEﾚｼﾞｽﾀの示すｱﾄﾞﾚｽから４ﾊﾞｲﾄの内容を、４桁の16進数を表すｱｽｷｰｺｰﾄﾞとしてﾊﾞｲﾅﾘに変換し、HLﾚｼﾞｽﾀにｾｯﾄする。  
	 * ｴﾗｰがあった場合は、ｷｬﾘﾌﾗｸﾞがｾｯﾄされる。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_hlhex(ctx){
		this.#Log("sos_hlhex");
		const address = this.#getDE();
		this.#setDE(address + 4);
		const value1 = this.#memReadU8(address);
		const value2 = this.#memReadU8(address + 1);
		const value3 = this.#memReadU8(address + 2);
		const value4 = this.#memReadU8(address + 3);
		if(this.#checkHex(value1) && this.#checkHex(value2) && this.#checkHex(value3) && this.#checkHex(value4)) {
			this.#setA(
				  (this.#hex(value1) << 12)
				| (this.#hex(value2) <<  8)
				| (this.#hex(value3) <<  4)
				|  this.#hex(value4)
			);
			this.#clearCY();
		} else {
			// エラー
			this.#setA(SOSErrorCode.BadData);
			this.#setCY();
		}
		return 0;
	}
	/**
	 * #WOPEN●(旧#WRI)(1FAFH)
	 * 
	 * #FILEでｾｯﾄされたﾌｧｲﾙ名、(#DTADR)、(#SIZE)、(#EXADR)をﾃｰﾌﾟに書き込む。  
	 * ﾃﾞｨｽｸの場合は、新しいﾌｧｲﾙかどうかのﾁｪｯｸを行う。  
	 * ｴﾗｰ発生時にはｷｬﾘﾌﾗｸﾞが立つ
	 * @todo テスト
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_wopen(ctx){
		this.#Log("sos_wopen");

		// @todo 新しいﾌｧｲﾙかどうかのﾁｪｯｸを行う。
		// メモ） #WRD側で、よきにはからうので、不要かもしれない
		if(false) {
			// エラー
			this.#setA(SOSErrorCode.DeviceIOError);
			this.#setCY();
			return 0;
		}
		this.#clearCY();
		return 0;
	}
	/**
	 * #WRD●(1FACH)
	 * 
	 * (#DTADRS)、(#SIZE)、(#EXADR)に従って、ﾃﾞﾊﾞｲｽにﾃﾞｰﾀをｾｰﾌﾞする。  
	 * ﾃﾞｨｽｸの場合#WOPEN後でないとFile not Openのｴﾗｰが出る。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_wrd(ctx){
		this.#Log("sos_wrd");
		const saveAddress = this.#memReadU16(SOSWorkAddr.DTADR);
		const dataSize    = this.#memReadU16(SOSWorkAddr.SIZE);
		const execAddress = this.#memReadU16(SOSWorkAddr.EXADR);
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
		const dirRecord = this.#memReadU8(SOSWorkAddr.DIRPS);
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
	 * @returns {number} 
	 */
	sos_fcb(ctx){
		this.#Log("sos_fcb");
		const deviceName = this.#memReadU8(SOSWorkAddr.DSK);
		const maxDirNo = this.#memReadU8(SOSWorkAddr.MXTRK);
		let dirNo = this.#memReadU8(SOSWorkAddr.DIRNO);
		let cacheRecord = -1;
		while(true) {
			if(dirNo >= maxDirNo) {
				// オーバーしているので駄目
				this.#memWriteU8(SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return 0;
			}
			const dirRecord = ((dirNo * SOSInfomationBlock.InfomationBlockSize) >>> 8) + this.#memReadU16(SOSWorkAddr.DIRPS); // ibのあるディレクトリレコード
			const ibOffset  = ((dirNo * SOSInfomationBlock.InfomationBlockSize) & 0xFF); // レコード内でのib位置
			// IBのあるレコードを読み込む
			if(cacheRecord != dirRecord) {
				cacheRecord = dirRecord;
				data = ctx.ReadRecord(deviceName, dirRecord);
				if(data.result != 0) {
					// エラー
					this.#setA(data.result);
					this.#setCY();
					return 0;
				}
			}
			const attribute = data.value[ibOffset + SOSInfomationBlock.ib_attribute];
			if(attribute == 0xFF) {
				// 終わり
				this.#memWriteU8(SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return 0;
			} else if(attribute == 0x00) {
				// 空きなので、次を検索
				dirNo++;
				continue;
			}
			// ibへコピー
			const ib_base = this.#memReadU16(SOSWorkAddr.IBFAD);
			for(let i = 0; i < SOSInfomationBlock.InfomationBlockSize; ++i) {
				this.#memWriteU8(ib_base + i, data.value[ibOffset + i]);
			}
			// ibをワークに反映
			this.#memWriteU16(SOSWorkAddr.DTADR, this.#memReadU16(ib_base + SOSInfomationBlock.ib_startAddress));	// 読み込みアドレス
			this.#memWriteU16(SOSWorkAddr.SIZE,  this.#memReadU16(ib_base + SOSInfomationBlock.ib_size));			// ファイルサイズ
			this.#memWriteU16(SOSWorkAddr.EXADR, this.#memReadU16(ib_base + SOSInfomationBlock.ib_executeAddress)); // 実行アドレス
			// キー処理
			if(ctx.keyMan.isKeyDown(0x1B)) {
				// ブレイクキー押下されてる
				this.#memWriteU8(SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return 0;
			}
			if(ctx.keyMan.isKeyDown(0x0D)) {
				// リターンキー押下されている
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return 0;
			}
			// 次のへ
			dirNo++;
			if(dirNo >= maxDirNo) {
				// オーバーしているので駄目
				this.#memWriteU8(SOSWorkAddr.DIRNO, 0);
				this.#setA(SOSErrorCode.FileNotFound);
				this.#setCY();
				return 0;
			}
			this.#memWriteU8(SOSWorkAddr.DIRNO, dirNo);
			// 正常終了
			this.#clearCY();
			return 0;
		}
	}
	/**
	 * #RDD●(1FA6H)
	 * 
	 * (#DTADRS)、(#SIZE)、(#EXADR)に従って、ﾃﾞﾊﾞｲｽ上のﾌｧｲﾙを読み込む。  
	 * #ROPEN後でないとFile not Openのｴﾗｰが出る。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_rdd(ctx){
		this.#Log("sos_rdd");
		// @todo オープンチェック
		const loadAddress = this.#memReadU16(SOSWorkAddr.DTADR);	// 読み込みアドレス
		const fileSize = this.#memReadU16(SOSWorkAddr.SIZE);		// ファイルサイズ
		//const execAddress = this.#memReadU16(SOSWorkAddr.EXADR);	// 実行アドレス
		const filename = this.#getFilenameFromIB();				// ファイル名
		// 読み込む
		const dirRecord = this.#memReadU8(SOSWorkAddr.DIRPS);
		let data = ctx.ReadFile(filename.deviceName, dirRecord, filename.filename, filename.extension);
		if(data.result != 0) {
			this.#setA(data.result);
			this.#setCY();
			return 0;
		}
		// メモリにコピー
		const minSize = this.min(fileSize, data.value.length);
		for(let i = 0; i < minSize; ++i) {
			ctx.z80Emu.memWriteU8(loadAddress + i, data.value[i]);
		}
		// 正常終了
		this.#clearCY();
		return 0;
	}

	/**
	 * #FILE●(1FA3H)
	 * 
	 * Ａﾚｼﾞｽﾀのﾌｧｲﾙのｱﾄﾘﾋﾞｭｰﾄ、DEﾚｼﾞｽﾀにﾌｧｲﾙ名の入っている元頭ｱﾄﾞﾚｽをｾｯﾄしてｺｰﾙすると(#IBFAD)にﾌｧｲﾙ名のｾｯﾄと(#DSK)にﾌｧｲﾙﾃﾞｨｽｸﾘﾌﾟﾀのｾｯﾄを行う。  
	 * ﾌｧｲﾙを操作する前には、必ずこのｻﾌﾞﾙｰﾁﾝにより、ﾌｧｲﾙ名とｱﾄﾘﾋﾞｭｰﾄをｾｯﾄしなければならない。  
	 * ｺｰﾙ後DEﾚｼﾞｽﾀは行の終わり(00Ｈ)か：(コロン)の位置を示している。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_file(ctx){
		this.#Log("sos_file");
		const ib_base = this.#memReadU16(SOSWorkAddr.IBFAD);
		// 属性
		this.#memWriteU8(ib_base + SOSWorkAddr.ib_attribute, this.#getA());
		// パスワードなし
		this.#memWriteU8(ib_base + SOSWorkAddr.ib_password, 0x20);
		// ファイル名を分割して
		const result = this.#splitPath(this.#getDE());
		// デバイス名に設定
		this.#memWriteU8(SOSWorkAddr.DSK, result.deviceName);
		// ファイル名も設定
		for(let i = 0; i < 13; ++i) { this.#memWriteU8(ib_base + SOSWorkAddr.ib_filename + i, result.filename[i]); }
		// 拡張子にも設定
		for(let i = 0; i < 3; ++i) { this.#memWriteU8(ib_base + SOSWorkAddr.ib_extension + i, result.extension[i]); }
		// 忘れずにDEを更新しとく
		this.#setDE(result.filenamePtr);
		return 0;
	}
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
	 * @returns {number} 
	 */
	sos_fsame(ctx){
		this.#Log("sos_fsame");
		const ib_base = this.#memReadU16(SOSWorkAddr.IBFAD);
		// 属性
		if(!SOSInfomationBlock.isEquelAttribute(this.#memReadU8(ib_base + SOSInfomationBlock.ib_attribute), this.#getA())) {
			this.#setCY();
			this.#setA(SOSErrorCode.BadFileMode);
			this.#clearZ();
			return 0;
		}
		// ファイル名を分割
		const result = this.#splitPath(this.#getDE());
		// デバイス名
		if(this.#memReadU8(SOSWorkAddr.DSK) != result.deviceName) {
			this.#setCY();
			this.#setA(SOSErrorCode.BadFileDescripter);
			this.#clearZ();
			return 0;
		}
		// ファイル名
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
			if(this.#memReadU8(ib_base + SOSInfomationBlock.ib_filename + i) != result.filename[i]) {
				this.#setCY();
				this.#setA(SOSErrorCode.DeviceIOError);
				this.#clearZ();
				return 0;
			}
		}
		// 拡張子
		for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
			if(this.#memReadU8(ib_base + SOSInfomationBlock.ib_extension + i) != result.extension[i]) {
				this.#setCY();
				this.#setA(SOSErrorCode.DeviceIOError);
				this.#clearZ();
				return 0;
			}
		}
		// 一致している
		this.#clearCY();
		this.#setZ();
		return 0;
	}
	/**
	 * #FRRNT●(1F9DH)
	 * 
	 * ﾃｰﾌﾟから読み込んだﾌｧｲﾙﾈｰﾑを表示する。  
	 * ｽﾍﾟｰｽｷｰを押すと表示後一時停止する。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_fprnt(ctx){
		this.#Log("sos_fprnt");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// ファイル名
		const ib_base = this.#memReadU16(SOSWorkAddr.IBFAD);
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
		return 0;
	}
	/**
	 * #POKE(1F9AH)
	 * 
	 * HLﾚｼﾞｽﾀの内容をｵﾌｾｯﾄｱﾄﾞﾚｽとして、CIOS用特殊ﾜｰｸｴﾘｱにＡﾚｼﾞｽﾀの内容を書き込む。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_poke(ctx){
		this.#Log("sos_poke");
		const offset = this.#getHL();
		const value = this.#getA();
		this.#specialRAM[offset & this.#specialRamMask] = value & 0xFF;
		return 0;
	}
	/**
	 * #POKE@(1F97H)
	 * 
	 * ﾒｲﾝﾒﾓﾘからS-OS用特殊ﾜｰｸｴﾘｱにﾃﾞｰﾀを転送する。  
	 * HLﾚｼﾞｽﾀにﾒﾓﾘ先頭ｱﾄﾞﾚｽ、DEﾚｼﾞｽﾀにﾜｰｸｴﾘｱｵﾌｾｯﾄｱﾄﾞﾚｽ、ｴﾘｱｵﾌｾｯﾄｱﾄﾞﾚｽ、BCﾚｼﾞｽﾀにﾊﾞｲﾄ数を入れてｺｰﾙする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_poke_(ctx){
		this.#Log("sos_poke@");
		let src = this.#getHL();
		let dst = this.#getDE();
		const size = this.#getBC();
		for(let i = 0; i < size; ++i) {
			this.#specialRAM[dst++ & this.#specialRamMask] = this.#memReadU8(src++) & 0xFF;
		}
		return 0;
	}
	/**
	 * #PEEK(1F94H)
	 * 
	 * HLﾚｼﾞｽﾀの肉容をｵﾌｾｯﾄｱﾄﾞﾚｽとして、S-OS用特殊ﾜｰｸｴﾘｱからＡﾚｼﾞｽﾀにﾃﾞｰﾀを読み出す。  
	 * #POKEと逆の動作。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_peek(ctx){
		this.#Log("sos_peek");
		const offset = this.#getHL();
		this.#setA(this.#specialRAM[offset & this.#specialRamMask] & 0xFF);
		return 0;
	}
	/**
	 * #PEEK@(1F91H)
	 * 
	 * S-OS用特殊ﾜｰｸｴﾘｱからﾒｲﾝﾒﾓﾘにﾃﾞｰﾀを転送する。  
	 * HL，DE，BCﾚｼﾞｽﾀにｾｯﾄするﾊﾟﾗﾒｰﾀは#POKE@と同じ。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_peek_(ctx){
		this.#Log("sos_peek@");
		let src  = this.#getHL();
		let dst  = this.#getDE();
		let size = this.#getBC();
		for(let i = 0; i < size; ++i) {
			this.#memWriteU8(src++, this.#specialRAM[dst++ & this.#specialRamMask] & 0xFF);
		}
		return 0;
	}
	/**
	 * #MON(1F8EH)
	 * 
	 * 各機種のﾓﾆﾀにｼﾞｬﾝﾌﾟする。
	 * @todo 実装すること
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_mon(ctx){
		this.#Log("sos_mon");
		return 0;
	}
	/**
	 * [HL](1F81H)
	 * 
	 * HLﾚｼﾞｽﾀにｺｰﾙしたいｱﾄﾞﾚｽを入れ、  
	 *    CALL [HL]  
	 * と使うことにより、擬次的な相対ｺｰﾙが可能。  
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos__hl_(ctx){
		this.#Log("sos_[hl]");
		this.setPC(this.#getHL());
		return 0;
	}
	/**
	 * #GETPC(1F80H)
	 * 
	 * 現在のﾌﾟﾛｸﾞﾗﾑｶｳﾝﾀの値をHLにｺﾋﾟｰする。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_getpc(ctx){
		this.#Log("sos_getpc");
		// 戻るアドレスを取得
		const retAddress = this.#memReadU16(this.#getSP());
		this.#setHL(retAddress);
		return 0;
	}
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
	 * @returns {number} 
	 */
	sos_drdsb(ctx){
		this.#Log("sos_drdsb");
		const deviceName = this.#memReadU8(SOSWorkAddr.DSK);
		let record = this.#getDE();
		let dstAddress = this.#getHL();
		for(let i = 0; i < this.#getA(); ++i) {
			// 読み込み
			data = ctx.ReadRecord(deviceName, record + i);
			if(data.result != 0) {
				// エラー
				this.#setA(data.result);
				this.#setCY();
				return 0;
			}
			// コピー
			for(let j = 0; j < 0x100; ++j) {
				this.#memWriteU8(dstAddress + j, data.value[j]);
			}
			dstAddress += 0x100;
		}
		this.#clearCY();
		return 0;
	}
	/**
	 * #DWTSB※(2003H)
	 * 
	 * HLが示すｱﾄﾞﾚｽからＡﾚｺｰﾄﾞ分（Ａ×256ﾊﾞｲﾄ）の内容を、  
	 * DEを先頭ﾚｺｰﾄﾞとして記録する。連続ｾｸﾀﾗｲﾄ。  
	 * (#DSK)にﾃﾞﾊﾞｲｽ（Ａ～Ｄ）をｾｯﾄしてｺｰﾙ。
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_dwtsb(ctx){
		this.#Log("sos_dwtsb");

		const deviceName = this.#memReadU8(SOSWorkAddr.DSK);
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
	}
	/**
	 * #DIR※(2006H)
	 * 
	 * (#DSK)で指定されたﾃﾞﾊﾞｲｽ上の全ﾃﾞｨﾚｸﾄﾘを表示する。
	 * @todo テスト
	 * @param {TaskContext} ctx 
	 * @returns {number} 
	 */
	sos_dir(ctx){
		this.#Log("sos_dir");
		// デバイス名
		const deviceName = this.#memReadU8(SOSWorkAddr.DSK);
		// ディレクトリのレコード
		const dirRecord  = this.#memReadU16(SOSWorkAddr.DIRPS);
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
	}
	/**
	 * #ROPEN(2009H)※
	 * 
	 * テープの場合は、先に#FILEでセットされたファイル名と、読み込んだＩＢを比較し、同一ファイルならゼロ、違えばノンゼロでリターンする。  
	 * ディスクの場合は、#FILEでセットされたファイルがディスク上にあるかどうかのチェックを行う。  
	 * ゼロフラグは常にリセットとなる。  
	 * いずれの場合にも、エラーが発生したときにはキャリでリターンする。  
	 * またファイルの情報は、(#DATADR)，(#SIZE)，(#EXADR)へ転送される。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_ropen(ctx){
		this.#Log("sos_ropen");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const entrySector = this.#memReadU8(SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.GetInfomationBlock(filename.deviceName, entrySector, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#clearZ();
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// 属性チェック
		const ib_base = this.#memReadU16(SOSWorkAddr.IBFAD);
		const attribute = this.#memReadU8(ib_base + SOSInfomationBlock.ib_attribute);
		// 属性
		if(!SOSInfomationBlock.isEquelAttribute(result.fileMode, attribute)) {
			// エラー
			this.#clearZ();
			this.#setA(SOSErrorCode.BadFileMode);
			this.#setCY();
			return 0;
		}
		// ワークに情報書き込む
		this.#memWriteU16(SOSWorkAddr.DTADR, result.loadAddress);
		this.#memWriteU16(SOSWorkAddr.SIZE, result.fileSize);
		this.#memWriteU16(SOSWorkAddr.EXADR, result.execAddress);
		// 正常終了
		this.#clearZ();
		this.#clearCY();
		return 0;
	}
	/**
	 * #SET※(200CH)
	 * 
	 * #IBDADで示されるＩＢﾊﾞｯﾌｧの内容と一致するﾃﾞｨｽｸ上のﾌｧｲﾙをﾗｲﾄﾌﾟﾛﾃｸﾄする。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_set(ctx){
		this.#Log("sos_set");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU8(SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.SetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// 正常終了
		this.#clearCY();
		return 0;
	}
	/**
	 * #RESET※(200FH)
	 * 
	 * #IBDADで示されるＩＢﾊﾞｯﾌｧの内容と一致するﾌｧｲﾙのﾌﾟﾛﾃｸﾄをはずす。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_reset(ctx){
		this.#Log("sos_reset");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU8(SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.ResetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// 正常終了
		this.#clearCY();
		return 0;
	}
	/**
	 * #NAME※(2012H)
	 * 
	 * #FILEで設定されたﾌｧｲﾙ名を、DEﾚｼﾞｽﾀが示すﾒﾓﾘ上のﾃﾞｰﾀに変える。ﾘﾈｰﾑ。  
	 * ﾒﾓﾘ上のﾃﾞｰﾀ中にﾃﾞﾊﾞｲｽﾃﾞｨｽｸﾘﾌﾟﾀが入っていても無視する。  
	 * またDE＋16以内にｴﾝｺｰﾄﾞ（00H,'：'）がないときにはｴﾗｰが発生する。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_name(ctx){
		this.#Log("sos_name");
		// 変更するファイル名
		const newFilename = this.#splitPath(this.#getDE()); // ファイル名を分割
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU8(SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.Rename(filename.deviceName, dirRecord, filename.filename, filename.extension, newFilename.filename, newFilename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// 正常終了
		this.#clearCY();
		return 0;
	}
	/**
	 * #KILL※(2015H)
	 * 
	 * #IBFADで示されるＩＢﾊﾞｯﾌｧの内容と一致するﾃﾞｨｽｸ上のﾌｧｲﾙをキルする。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_kill(ctx){
		this.#Log("sos_kill");
		// ファイル名取得
		const filename = this.#getFilenameFromIB();
		// ディレクトリのレコード
		const dirRecord = this.#memReadU8(SOSWorkAddr.DIRPS);
		// 問い合わせ
		const result = ctx.Kill(filename.deviceName, dirRecord, filename.filename, filename.extension);
		// 処理
		if(result.result != 0) {
			// エラー
			this.#setA(result.result);
			this.#setCY();
			return 0;
		}
		// 正常終了
		this.#clearCY();
		return 0;
	}
	/**
	 * #CSR※(2018H)
	 * 
	 * 現在のｶｰｿﾙ位置を、ＨにＹ座標、ＬにＸ座標の順で読み出す。  
	 * 以後、ｶｰｿﾙ位置の読み出しは必ずこの方法によること。(#XYADR)は使わない
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_csr(ctx){
		this.#Log("sos_csr");
		const pos = ctx.getScreenLocate();
		this.#setHL((pos.x & 0xFF) | ((pos.y & 0xFF) << 8));
		return 0;
	}
	/**
	 * #SCRN※(201BH)
	 * 
	 * ＨにＹ座標、ＬにＸ座標をｾｯﾄしｺｰﾙすると、画面上の同位置にあるｷｬﾗｸﾀをＡに読み出す。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_scrn(ctx){
		this.#Log("sos_scrn");
		const hl = this.#getHL();
		const x = hl & 0xFF;
		const y = (hl >> 8) & 0xFF;
		if(x >= this.#memReadU8(SOSWorkAddr.WIDTH) || y >= this.#memReadU8(SOSWorkAddr.MAXLIN)) {
			// 画面範囲外
			this.#setCY();
			this.#setA(0);	
			return 0;
		}
		this.#clearCY();
		this.#setA(ctx.getCodePoint(x, y));
		return 0;
	}
	/**
	 * #LOC※(201EH)
	 * 
	 * ＨにＹ座標、ＬにＸ座標を入れてｺｰﾙすると、ｶｰｿﾙ位置がそこにｾｯﾄされる。  
	 * 以後、ｶｰｿﾙ位置の設定は必ずこの方法にとること。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_loc(ctx){
		this.#Log("sos_loc");
		const hl = this.#getHL();
		ctx.setScreenLocate({x: (hl & 0xFF), y: ((hl >> 8) & 0xFF)});
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		// 正常終了
		this.#clearCY();
		return 0;
	}
	/**
	 * #FLGET※(2021H)
	 * ｶｰｿﾙ位置で、ｶｰｿﾙ点滅１文字入力を行い、Ａに押されたｷｬﾗｸﾀをｾｯﾄ。
	 * ｵｰﾄﾘﾋﾟｰﾄもかかる（MZ-80K／C/1200は不可）。
	 * 画面へのｴｺｰﾊﾞｯｸは行わない。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_flget(ctx){
		if(!this.#isCpuOccupation) {
			this.#Log("sos_flget - z80 freeze");
			ctx.keyMan.keyBufferClear(); // キーボードバッファをクリア
			this.#isCpuOccupation = true;
			// カーソル位置を設定
			const address = this.#memReadU16(SOSWorkAddr.XYADR);
			const pos     = this.#memReadU16(address);
			ctx.setScreenLocate({x: pos & 0xFF, y:pos >> 8});
			// カーソル表示
			ctx.setDisplayCursor(true);
			return 1;
		} else {
			let key = Number(ctx.keyMan.inKey());
			if(isNaN(key)) { key = 0; }
			if(key) {
				this.#Log("sos_flget - z80 wakeup!");
				this.#isCpuOccupation = false;
				this.#setA(key);
				// カーソル非表示
				ctx.setDisplayCursor(true);
				// 正常終了
				this.#clearCY();
				return 0;
			} else {
				//this.#Log("sos_flget - working");
				return 1; // まだ、動作中なので、CPUは停止状態にしておく
			}
		}
	}
	/**
	 * #RDVSW※(2024H)
	 * 
	 * ﾃﾞﾌｫﾙﾄﾃﾞﾊﾞｲｽをＡに読み出す。  
	 * ﾃﾞﾌｫﾙﾄを知りたいときには必ずこの方法によるものとする。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_rdvsw(ctx){
		this.#Log("sos_rdvsw");
		this.#setA(this.#memReadU8(SOSWorkAddr.DVSW));
		return 0;
	}
	/**
	 * #SDVSW※(2027H)
	 * 
	 * ﾃﾞﾌｫﾙﾄにしたいﾃﾞﾊﾞｲｽ名をＡに入れｺｰﾙすると、ﾃﾞﾌｫﾙﾄﾃﾞﾊﾞｲｽがｾｯﾄされる。  
	 * 今後必ずこの方法によること。  
	 * (#DVSW）を直接触ることも禁止する。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_sdvsw(ctx){
		this.#Log("sos_sdvsw");
		this.#memWriteU8(SOSWorkAddr.DVSW, this.#getA());
		return 0;
	}
	/**
	 * #INP※(202AH)
	 * 
	 * 共通I/Oﾎﾟｰﾄから１ﾊﾞｲﾄをＡに読み込む。  
	 * ﾎﾟｰﾄはＣで指定する。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_inp(ctx){
		this.#Log("sos_inp");
		// @todo 機能がわからない……
		return 0;
	}
	/**
	 * #OUT※(202DH) 
	 * 
	 * 共通I/OﾎﾟｰﾄへＡを出力する。ﾎﾟｰﾄはＣで指定する。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_out(ctx){
		this.#Log("sos_out");
		// @todo 機能がわからない……
		return 0;
	}
	/**
	 * #WIDCH※(2030H)
	 * 画面のﾓｰﾄﾞ（40ｷｬﾗ、80ｷｬﾗ）を切り替える。  
	 * Ａに40以下の数をｾｯﾄすると40ｷｬﾗ、  
	 * 40より大きい数をｾｯﾄしてｺｰﾙすると80ｷｬﾗとなる。  
	 * 現在のモードは(#WIDTH)に入っている。  
	 * この機能は80K／C／1200／700／1500にはない。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_widch(ctx){
		this.#Log("sos_widch");
		const height = this.#memReadU8(SOSWorkAddr.MAXLIN);
		if(this.#getA() <= 40) {
			ctx.changeScreenSize(40, height);
			this.#memWriteU8(SOSWorkAddr.WIDTH, 40);
		} else {
			ctx.changeScreenSize(80, height);
			this.#memWriteU8(SOSWorkAddr.WIDTH, 80);
		}
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		// 正常終了
		this.#clearCY();
		return 0;
	}
	/**
	 * #ERROR※(2033H)
	 * 
	 * Ａにｴﾗｰ番号をｾｯﾄしてｺｰﾙすることによりｴﾗｰﾒｯｾｰｼﾞを表示する。
	 * @param {TaskContext} ctx 
	 * @returns {number}
	 */
	sos_error(ctx){
		this.#Log("sos_error");
		// S-OSのワークからカーソル位置を設定する
		this.#beginCursor(ctx);
		// エラー文言表示
		ctx.ERROR(this.#getA());
		// カーソル位置をS-OSのワークに設定する
		this.#endCursor(ctx);
		return 0;
	}
}