"use strict";

class TaskContext {
	/**
	 * Z80のエミュレータ
	 * @type {Z80Emu}
	 */
	z80Emu;

	/**
	 * キー入力管理
	 * @type {CatKey}
	 */
	keyMan;

	/**
	 * テキスト画面管理
	 * @type {CatTextScreen}
	 */
	catTextScreen;

	/**
	 * 一行入力をするタスク
	 * @type {TaskLineInput}
	 */
	taskLineInput;

	/**
	 * S-OS標準モニタのタスク
	 * @type {TaskMonitor}
	 */
	taskMonitor;

	/**
	 * S-OS プラットフォームモニタのタスク
	 * @type {TaskPlatformMonitor}
	 */
	taskPlatformMonitor;

	/**
	 * ディスク管理
	 * @type {HuBasicDisk[]}
	 */
	diskManager;

	/**
	 * サウンド管理
	 */
	sndMan;

	#keyCodeCLS = 0x0C; // CLS
	#keyCodeCR = 0x0D; // Enterキー
	#keyCodeBRK = 0x1B; // Breakキー
	#keyCodeBackSpace = 0x08; // BackSpaceキー
	#keyCodeDelete = 'Delete'; // DELキー

	/**
	 * コンストラクタ
	 * @param {Z80Emu} z80Emu Z80のエミュレータ
	 * @param {CatKey} keyMan キー入力管理
	 * @param {CatTextScreen} catTextScreen テキスト画面管理
	 * @param {TaskLineInput} taskLineInput 一行入力をするタスク
	 * @param {TaskMonitor} taskMonitor S-OS標準モニタのタスク
	 * @param {TaskPlatformMonitor} taskPlatformMonitor S-OS プラットフォームモニタのタスク
	 * @param {HuBasicDisk[]} diskManager ディスク管理
	 * @param {CatSnd} sndMan サウンド管理
	 */
	constructor(z80Emu, keyMan, catTextScreen, taskLineInput, taskMonitor, taskPlatformMonitor, diskManager, sndMan)
	{
		this.z80Emu = z80Emu;
		this.keyMan = keyMan;
		this.catTextScreen = catTextScreen;
		this.taskLineInput = taskLineInput;
		this.taskMonitor = taskMonitor;
		this.taskPlatformMonitor = taskPlatformMonitor;
		this.diskManager = diskManager;
		this.sndMan = sndMan;
	}

	/**
	 * リセットする
	 */
	reset() { this.z80Emu.reset(); }

	/**
	 * 起動時のメッセージを表示する
	 */
	initialMsg()
	{
		this.catTextScreen.clearScreen();
		this.printNativeMsg("<<<<< S-OS  SWORD >>>>>\n");
		this.printNativeMsg("Version 0.00.01 猫大名 ねこ猫\n");
	}

	/**
	 * S-OS標準モニタのジャンプコマンドの飛び先を設定する
	 * 
	 * S-OS標準モニタが終了したときに、ここで設定したアドレスが呼び出される
	 * @param {number} address 飛び先
	 */
	monitorCommandJump(address) { this.z80Emu.monitorCommandJump(address); }

	// --------------------------------------------------------------------
	// 入力
	// --------------------------------------------------------------------

	/**
	 * ライン入力開始
	 */
	startLineInput() { this.taskLineInput.start(this); }

	/**
	 * ライン入力を終わらせる
	 */
	endLineInput() { this.taskLineInput.end(this); }

	/**
	 * ライン入力が完了しているかどうか
	 * @returns {boolean} 完了している場合 true を返す
	 */
	isFinishLineInput() { return this.taskLineInput.isFinished(); }

	/**
	 * ライン入力の結果を取得する
	 * @returns {{
	 * 		resultCode:number,	// 処理結果
	 * 		result:number[],	// 入力された文字列（S-OS準拠の文字コード）
	 * }}
	 */
	getResultLineInput() { return this.taskLineInput.getResult(); }

	// --------------------------------------------------------------------
	// 画面
	// --------------------------------------------------------------------

	/**
	 * 画面サイズを変更する
	 * @param {number} width 横幅のサイズ
	 * @param {number} height 高さのサイズ
	 */
	changeScreenSize(width, height) {
		this.catTextScreen.changeScreenSize(width, height);
		// スタイルを変更して、文字サイズを変える
		var elem = document.getElementById("sos_output");
		elem.style.transform = "scale(" + 40 / width + ", 1.0)";
	}

	/**
	 * カーソル位置を取得する
	 * @returns {{x:number, y:number}} カーソル位置
	 */
	getScreenLocate() { return this.catTextScreen.getCursor(); }

	/**
	 * カーソル位置を設定する
	 * @param {{x, y}} locate カーソル位置
	 */
	setScreenLocate(locate)	{ this.catTextScreen.setCursor(locate.x, locate.y); }

	/**
	 * 指定位置にある文字コードを取得する
	 * @param {number} x 位置
	 * @param {number} y 位置
	 * @returns {number} 文字コード（S-OS準拠の文字コード）
	 */
	getCodePoint(x, y) { return this.catTextScreen.getCodePoint(x, y); }

	/**
	 * １文字出力する
	 * 
	 * 基本的にS-OS準拠の文字コード。
	 * - 0x20未満で、制御コードでは無いものは表示しない
	 * @param {number|string} code 文字コード（S-OS準拠の文字コード、制御文字コード）
	 */
	PRINT(code)
	{
		if(code == this.#keyCodeDelete) {
			this.catTextScreen.putch32('Delete');
			return;
		}
		if(code < 0x20) {
			if(code == this.#keyCodeCLS) {
				this.catTextScreen.clearScreen();
			} else if(code == this.#keyCodeCR) {
				this.catTextScreen.putch32(0x0D);
			} else if(code == 0x001C) {
				this.catTextScreen.putch32('ArrowRight');
			} else if(code == 0x001D) {
				this.catTextScreen.putch32('ArrowLeft');
			} else if(code == 0x001E) {
				this.catTextScreen.putch32('ArrowUp');
			} else if(code == 0x001F) {
				this.catTextScreen.putch32('ArrowDown');
			}
		} else {
			this.catTextScreen.putch32(code);
		}
	}

	/**
	 * ネイティブな文字列を出力する
	 * @param {string} text 表示する文字列
	 */
	printNativeMsg(text)
	{
		for(let ch of text) {
			if(ch != '\n') {
				this.PRINT(ch.codePointAt(0));
			} else {
				this.PRINT(0x0D); // 改行コード
			}
		}
	}

	/**
	 * エラーコードを表示する
	 * @param {number} errorCode エラーコード
	 */
	ERROR(errorCode)
	{
		const errorMsg = [
			"",
			"Device I/O Error",
			"Device Offline",
			"Bad File Descripter",
			"Write Protected",
			"Bad Record",
			"Bad File Mode",
			"Bad Allocation Table",
			"File not Found",
			"Device Full",
			"File Already Exists",
			"Reserved Feature",
			"File not Open",
			"Syntax Error ",
			"Bad Data"
		];
		if(errorCode <= 0 || errorCode > 14) {
			errorCode = SOSErrorCode.BadData;
		}
		this.printNativeMsg(errorMsg[errorCode]);
	}

	/**
	 * カーソルを表示するかどうかを設定する
	 * @param {boolean} display カーソルを表示するかどうか
	 */
	setDisplayCursor(display) { this.catTextScreen.setDisplayCursor(display); }


	tblMojiEncode;
	tblMojiDecode;

	// SMILEBASIC.ttf用の文字変換テーブル X1風（デフォルト）
	tblMojiEncode_SOS = [
		/* 00 */ 0x0000, 0xE101, 0xE102, 0xE103, 0xE104, 0xE105, 0xE106, 0xE107,
		/* 08 */ 0x0008, 0xE109, 0xE10A, 0xE10B, 0x000C, 0x000D, 0xE10E, 0xE10F,
		/* 10 */ 0xE110, 0xE111, 0xE112, 0xE113, 0xE114, 0xE115, 0xE116, 0xE117,
		/* 18 */ 0xE118, 0xE119, 0xE11A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
		/* 20 */ 0x0020, 0x0021, 0x0022, 0x0023, 0x0024, 0x0025, 0x0026, 0x0027,
		/* 28 */ 0x0028, 0x0029, 0x002A, 0x002B, 0x002C, 0x002D, 0x002E, 0x002F,
		/* 30 */ 0x0030, 0x0031, 0x0032, 0x0033, 0x0034, 0x0035, 0x0036, 0x0037,
		/* 38 */ 0x0038, 0x0039, 0x003A, 0x003B, 0x003C, 0x003D, 0x003E, 0x003F,
		/* 40 */ 0x0040, 0x0041, 0x0042, 0x0043, 0x0044, 0x0045, 0x0046, 0x0047,
		/* 48 */ 0x0048, 0x0049, 0x004A, 0x004B, 0x004C, 0x004D, 0x004E, 0x004F,
		/* 50 */ 0x0050, 0x0051, 0x0052, 0x0053, 0x0054, 0x0055, 0x0056, 0x0057,
		/* 58 */ 0x0058, 0x0059, 0x005A, 0x005B, 0x005C, 0x005D, 0x005E, 0x005F,
		/* 60 */ 0x0060, 0x0061, 0x0062, 0x0063, 0x0064, 0x0065, 0x0066, 0x0067,
		/* 68 */ 0x0068, 0x0069, 0x006A, 0x006B, 0x006C, 0x006D, 0x006E, 0x006F,
		/* 70 */ 0x0070, 0x0071, 0x0072, 0x0073, 0x0074, 0x0075, 0x0076, 0x0077,
		/* 78 */ 0x0078, 0x0079, 0x007A, 0xE2A8, 0x007C, 0xE2FF, 0x301C, 0x03C0,
		/* 80 */ 0xE2A1, 0xE2A2, 0xE2A3, 0xE2A4, 0xE2A5, 0xE2A6, 0xE2A7, 0xE2B1,
		/* 88 */ 0xE2AA, 0xE2AB, 0xE2AC, 0xE2AD, 0xE2AE, 0xE2AF, 0xE2B0, 0xE2FC,
		/* 90 */ 0xE295, 0xE296, 0xE290, 0xE291, 0xE294, 0xE292, 0xE293, 0xE299,
		/* 98 */ 0xE29B, 0xE29A, 0xE298, 0xE26C, 0xE26D, 0xE26E, 0xE26B, 0xE2FD, 
		/* A0 */ 0x3000, 0x3002, 0x300C, 0x300D, 0x3001, 0x30FB, 0x30F2, 0x30A1,
		/* A8 */ 0x30A3, 0x30A5, 0x30A7, 0x30A9, 0x30E3, 0x30E5, 0x30E7, 0x30C3, 
		/* B0 */ 0x30FC, 0x30A2, 0x30A4, 0x30A6, 0x30A8, 0x30AA, 0x30AB, 0x30AD,
		/* B8 */ 0x30AF, 0x30B1, 0x30B3, 0x30B5, 0x30B7, 0x30B9, 0x30BB, 0x30BD, 
		/* C0 */ 0x30BF, 0x30C1, 0x30C4, 0x30C6, 0x30C8, 0x30CA, 0x30CB, 0x30CC,
		/* C8 */ 0x30CD, 0x30CE, 0x30CF, 0x30D2, 0x30D5, 0x30D8, 0x30DB, 0x30DE,
		/* D0 */ 0x30DF, 0x30E0, 0x30E1, 0x30E2, 0x30E4, 0x30E6, 0x30E8, 0x30E9,
		/* D8 */ 0x30EA, 0x30EB, 0x30EC, 0x30ED, 0x30EF, 0x30F3, 0x309B, 0x309C,
		/* E0 */ 0x25CF, 0x25CB, 0x2660, 0x2665, 0x2666, 0x2663, 0xE29C, 0xE29D,
		/* E8 */ 0xE2FE, 0xE281, 0xE284, 0xE282, 0xE288, 0xE286, 0xE289, 0x25A1,
		/* F0 */ 0x203B, 0x571F, 0x91D1, 0x6728, 0x6C34, 0x706B, 0x6708, 0x65E5,
		/* F8 */ 0x6642, 0x5206, 0x79D2, 0x5E74, 0x5186, 0x4EBA, 0x751F, 0x3012
	];

	// SMILEBASIC.ttf用の文字変換テーブル PC8001風
	tblMojiEncode_PC8001 = [
		/* 00 */ 0x0000, 0xE101, 0xE102, 0xE103, 0xE104, 0xE105, 0xE106, 0xE107,
		/* 08 */ 0x0008, 0xE109, 0xE10A, 0xE10B, 0x000C, 0x000D, 0xE10E, 0xE10F,
		/* 10 */ 0xE110, 0xE111, 0xE112, 0xE113, 0xE114, 0xE115, 0xE116, 0xE117,
		/* 18 */ 0xE118, 0xE119, 0xE11A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
		/* 20 */ 0x0020, 0x0021, 0x0022, 0x0023, 0x0024, 0x0025, 0x0026, 0x0027,
		/* 28 */ 0x0028, 0x0029, 0x002A, 0x002B, 0x002C, 0x002D, 0x002E, 0x002F,
		/* 30 */ 0x0030, 0x0031, 0x0032, 0x0033, 0x0034, 0x0035, 0x0036, 0x0037,
		/* 38 */ 0x0038, 0x0039, 0x003A, 0x003B, 0x003C, 0x003D, 0x003E, 0x003F,
		/* 40 */ 0x0040, 0x0041, 0x0042, 0x0043, 0x0044, 0x0045, 0x0046, 0x0047,
		/* 48 */ 0x0048, 0x0049, 0x004A, 0x004B, 0x004C, 0x004D, 0x004E, 0x004F,
		/* 50 */ 0x0050, 0x0051, 0x0052, 0x0053, 0x0054, 0x0055, 0x0056, 0x0057,
		/* 58 */ 0x0058, 0x0059, 0x005A, 0x005B, 0x005C, 0x005D, 0x005E, 0x005F,
		/* 60 */ 0x0060, 0x0061, 0x0062, 0x0063, 0x0064, 0x0065, 0x0066, 0x0067,
		/* 68 */ 0x0068, 0x0069, 0x006A, 0x006B, 0x006C, 0x006D, 0x006E, 0x006F,
		/* 70 */ 0x0070, 0x0071, 0x0072, 0x0073, 0x0074, 0x0075, 0x0076, 0x0077,
		/* 78 */ 0x0078, 0x0079, 0x007A, 0x007B, 0x007C, 0x007D, 0x007E, 0x03C0,
		/* 80 */ 0xE2A1, 0xE2A2, 0xE2A3, 0xE2A4, 0xE2A5, 0xE2A6, 0xE2A7, 0xE2B1,
		/* 88 */ 0xE2AA, 0xE2AB, 0xE2AC, 0xE2AD, 0xE2AE, 0xE2AF, 0xE2B0, 0xE293,
		/* 90 */ 0xE290, 0xE291, 0xE294, 0xE292, 0xE2F8, 0xE295, 0xE296, 0xE2FA,
		/* 98 */ 0xE298, 0xE299, 0xE29A, 0xE29B, 0xE26B, 0xE26C, 0xE26D, 0xE26E, 
		/* A0 */ 0x3000, 0x3002, 0x300C, 0x300D, 0x3001, 0x30FB, 0x30F2, 0x30A1,
		/* A8 */ 0x30A3, 0x30A5, 0x30A7, 0x30A9, 0x30E3, 0x30E5, 0x30E7, 0x30C3, 
		/* B0 */ 0x30FC, 0x30A2, 0x30A4, 0x30A6, 0x30A8, 0x30AA, 0x30AB, 0x30AD,
		/* B8 */ 0x30AF, 0x30B1, 0x30B3, 0x30B5, 0x30B7, 0x30B9, 0x30BB, 0x30BD, 
		/* C0 */ 0x30BF, 0x30C1, 0x30C4, 0x30C6, 0x30C8, 0x30CA, 0x30CB, 0x30CC,
		/* C8 */ 0x30CD, 0x30CE, 0x30CF, 0x30D2, 0x30D5, 0x30D8, 0x30DB, 0x30DE,
		/* D0 */ 0x30DF, 0x30E0, 0x30E1, 0x30E2, 0x30E4, 0x30E6, 0x30E8, 0x30E9,
		/* D8 */ 0x30EA, 0x30EB, 0x30EC, 0x30ED, 0x30EF, 0x30F3, 0x309B, 0x309C,
		/* E0 */ 0xE269, 0xE27A, 0xE27B, 0xE27C, 0xE29C, 0xE29D, 0xE29E, 0xE29F,
		/* E8 */ 0x2660, 0x2665, 0x2666, 0x2663, 0x25CF, 0x25CB, 0xE2FC, 0xE2FD,
		/* F0 */ 0xE2FE, 0x5186, 0x5E74, 0x6708, 0x65E5, 0x6642, 0x5206, 0x79D2,
		/* F8 */ 0x00F8, 0x00F9, 0x00FA, 0x00FB, 0x00FC, 0x00FD, 0x00FE, 0x00FF
	];
	//const tblMojiEncode = tblMojiEncode_SOS;
	//const tblMojiEncode = tblMojiEncode_PC8001;

	strcmp(lhs, rhs) {
		let l = 0;
		let r = 0;
		while(true) {
			const ch = (r < rhs.length) ? rhs[r++].codePointAt(0) : 0;
			let rc = lhs[l] - ch;
			if ((rc != 0) || !lhs[l++]) {
				return rc;
			}
		}
	}

	/**
	 * 
	 * @param {Uint8Array} fontName 
	 */
	changeFont(fontName) {
		if(this.strcmp(fontName, "X1") == 0 || this.strcmp(fontName, "SOS") == 0) {
			this.tblMojiEncode = this.tblMojiEncode_SOS;
		} else if(this.strcmp(fontName, "PC8001") == 0 || this.strcmp(fontName, "PC8") == 0) {
			this.tblMojiEncode = this.tblMojiEncode_PC8001;
		} else {
			this.printNativeMsg("Unknown FONT map.\n");
			return;
		}

		this.tblMojiDecode = new Map();
		for(let i = 0; i < 0x100; i++) {
			this.tblMojiDecode.set(this.tblMojiEncode[i], i);
		}

		this.catTextScreen.setCodec(
			// 表示時
			(ch32)=>{
				if(!isNaN(Number(ch32))) {
					if(0x00 <= ch32 && ch32 <= 0xFF) { return this.tblMojiEncode[ch32]; }
				}
				return ch32;
			},
			// 取得時
			(ch32)=>{
				return this.tblMojiDecode.get(ch32);
				//if(tblMojiDecode.has(ch32)) { return tblMojiDecode.get(ch32); }
				//return ch32;
			}
		);
	}

	// --------------------------------------------------------------------
	// デバイス
	// --------------------------------------------------------------------

	/**
	 * ディスクデバイスかどうか
	 * 
	 * メモ)'A'～'D'がディスク
	 * @param {number} descriptor デバイスを示す文字
	 * @return {boolean} ディスクデバイスなら true を返す
	 */
	#checkDiskDescriptor(descriptor)
	{
		return 0x41 <= descriptor && descriptor <= 0x44; // A～D
	}

	/**
	 * ディレクトリにあるファイルを列挙する
	 * @param {number} descriptor	デバイス名
	 * @param {number} dirRecord 	ディレクトリのレコード
	 * @returns {{
	 * 		result:number,				// S-OSのエラーコード
	 * 		entries:{
	 * 			attribute:number,		// ファイル属性
	 * 			filename:Uint8Array,	// ファイル名
	 * 			extension:Uint8Array,	// 拡張子
	 * 			password:number,		// パスワード
	 * 			size:number,			// ファイルサイズ
	 * 			loadAddress:number,		// 読み込みアドレス
	 * 			executeAddress:number,	// 日付データ
	 * 			startCluster:number		// 開始クラスタ
	 * 		}[],
	 * 		freeClusters:number,		// 空きクラスタ数
	 * 		deviceName:number			// デバイス名
	 * }} ディレクトリにあるファイル情報
	 */
	Files(descriptor, dirRecord)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			let result = this.diskManager[descriptor - 0x41].Files(dirRecord);
			result['deviceName'] = descriptor;
			return result;
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * Filesで取得したディレクトリ情報を表示する
	 * @param {{
	 * 		result:number,				// S-OSのエラーコード
	 * 		entries:{
	 * 			attribute:number,		// ファイル属性
	 * 			filename:Uint8Array,	// ファイル名
	 * 			extension:Uint8Array,	// 拡張子
	 * 			password:number,		// パスワード
	 * 			size:number,			// ファイルサイズ
	 * 			loadAddress:number,		// 読み込みアドレス
	 * 			executeAddress:number,	// 日付データ
	 * 			startCluster:number		// 開始クラスタ
	 * 		}[],
	 * 		freeClusters:number,		// 空きクラスタ数
	 * 		deviceName:number			// デバイス名
	 * }} result Filesで取得したディレクトリ情報
	 */
	PrintFiles(result)
	{
		// 空きクラスタサイズ
		this.printNativeMsg("$" + (result.freeClusters).toString(16).toUpperCase() + " Clusters Free\n");
		for(let entry of result.entries) {
			// 属性とライトプロテクト
			this.PrintFileAttribute(entry.attribute);
			// デバイス名
			let text = "";
			text += String.fromCodePoint(result.deviceName) + ":";
			this.printNativeMsg(text);
			// ファイル名
			for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) { this.PRINT(entry.filename[i]); }
			this.PRINT(0x2E); // "."
			for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) { this.PRINT(entry.extension[i]); }
			// 読み込みアドレス
			text = ":" + this.ToStringHex4(entry.loadAddress);
			// 終了アドレス
			text += ":" + this.ToStringHex4(entry.loadAddress + entry.size - 1);
			// 実行アドレス
			text += ":" + this.ToStringHex4(entry.executeAddress);
			this.printNativeMsg(text + "\n");
		}
	}
	ToStringHex4(value)
	{
		return (value).toString(16).padStart(4, 0).toUpperCase();
	}
	PrintFileAttribute(attribute)
	{
		let text;
		// 属性
		if(attribute & 0x80) {
			text = "Dir";
		} else {
			text = ["Nul","Bin","Bas","???","Asc","???","???","???"][attribute & 7];
		}
		// ライトプロテクト
		text += (attribute & 0x40) ? "* " : "  ";
		this.printNativeMsg(text);
	}

	/**
	 * インフォメーションブロックを取得する
	 * @param {number} descriptor		デバイス名
	 * @param {number} DirRecord 		ディレクトリのレコード
	 * @param {Uint8Array} Filename 	ファイル名
	 * @param {Uint8Array} Extension	拡張子
	 * @returns {{
	 *		result: number,			// 処理結果
	 *		fileMode: number,		// ファイルモード
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 *		fileSize: number		// ファイルサイズ
	 *		IB: Uint8Array			// IB
	 * }} インフォメーションブロック
	 */
	GetInfomationBlock(descriptor, DirRecord, Filename, Extension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].GetInfomationBlock(DirRecord, Filename, Extension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * ファイルを読み込む
	 * @param {number} descriptor デバイス名
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 *		result: number,			// 処理結果
	 * 		value: Uint8Array,		// 読み込んだデータ
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 * }} 処理結果
	 */
	ReadFile(descriptor, dirRecord, Filename, Extension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].ReadFile(dirRecord, Filename, Extension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * ファイルを書き込む
	 * @param {number} descriptor デバイス名
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} Data 書き込むデータ
	 * @param {number} SaveAddress セーブアドレス
	 * @param {number} EndAddress 終了アドレス
	 * @param {number} ExecAddress 実行アドレス
	 * @param {number} FileMode 属性（ファイルモード）
	 * @returns {{
	 *		result: number			// 処理結果
	 * }} 処理結果
	 */
	WriteFile(descriptor, dirRecord, Filename, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].WriteFile(dirRecord, Filename, Extension, Data,
				SaveAddress, EndAddress, ExecAddress, FileMode);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * レコード（セクタ）を読み込む
	 * @param {number} descriptor デバイス名
	 * @param {number} record 読み込むレコード
	 * @returns {{
	 * 		result:number,		// 処理結果
	 * 		value:Uint8Array	// 読み込んだデータ
	 * }} 処理結果
	 */
	ReadRecord(descriptor, record)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].ReadRecord(record);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}
	/**
	 * レコード（セクタ）を書き込む
	 * @param {number} descriptor デバイス名
	 * @param {number} record 書き込むレコード
	 * @param {Uint8Array} data 書き込むデータ
	 * @returns {{
	 * 		result:number		// 処理結果
	 * }} 処理結果
	 */
	WriteRecord(descriptor, record, data)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].WriteRecord(record, data);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * ライトプロテクトを設定する
	 * @param {number} descriptor デバイス名
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	SetWriteProtected(descriptor, dirRecord, Filename, Extension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].SetWriteProtected(dirRecord, Filename, Extension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}
	/**
	 * ライトプロテクトを解除する
	 * @param {number} descriptor デバイス名
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	ResetWriteProtected(descriptor, dirRecord, Filename, Extension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].ResetWriteProtected(dirRecord, Filename, Extension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * ファイルを削除する
	 * @param {number} descriptor デバイス名
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	Kill(descriptor, dirRecord, Filename, Extension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].Kill(dirRecord, Filename, Extension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	/**
	 * ファイル名を変更する
	 * @param {number} descriptor デバイス名
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} newFilename 新しいファイル名
	 * @param {Uint8Array} newExtension 新しい拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	Rename(descriptor, dirRecord, Filename, Extension, newFilename, newExtension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].Rename(dirRecord, Filename, Extension, newFilename, newExtension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}

	//
	// その他
	//

	/**
	 * ビープ音を再生する
	 */
	BELL()
	{
		this.sndMan.bell();
	}
}
