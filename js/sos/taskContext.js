// import { ToStringHex4 } from './util.mjs';

"use strict";

class FunctionKey {
	#functionKeys = new Map();
	constructor()
	{
		this.#functionKeys.set("F1",  "DA:\x0d");
		this.#functionKeys.set("F2",  "DB:\x0d");
		this.#functionKeys.set("F3",  "DE:\x0d");
		this.#functionKeys.set("F4",  "#L   \x0d");
		this.#functionKeys.set("F5",  "#    \x0d");
		this.#functionKeys.set("F6",  " DIR:");
		this.#functionKeys.set("F7",  " TYPE:");
		this.#functionKeys.set("F8",  " STAT:");
		this.#functionKeys.set("F9",  " NAME:");
		this.#functionKeys.set("F10", " COPY:");
	}
	getFunctionKeyText(keyCode)
	{
		return this.#functionKeys.get(keyCode);
	}

	getDisplayText(ctx, isWidth80)
	{
		let cnt = 0;
		if(isWidth80) {
			for(let func of this.#functionKeys.values()) {
				let temp = func.replace("\x0d", "\uF00d").padEnd(7," ");
				ctx.printNativeTagMsg(temp, '<span class="function_key">', '</span>');
				if(cnt == 4) {
					ctx.printNativeMsg("|");
				} else {
					ctx.printNativeMsg(" ");
				}
				cnt++;
			}
		} else {
			for(let func of this.#functionKeys.values()) {
				let temp = func.replace("\x0d", "\uF00d").padEnd(7," ");
				ctx.printNativeTagMsg(temp, '<span class="function_key">', '</span>');
				if(cnt == 4) {
					break;
				} else {
					ctx.printNativeMsg(" ");
				}
				cnt++;
			}
		}
	}
}

/**
 * 
 */
class FunctionLine25 {

}


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

	/**
	 * ゲームパッド
	 * @type {CatGamePad}
	 */
	gamePad;

	/**
	 * バッチ管理
	 * @type {SOSBatchManager}
	 */
	batchManager;

	/**
	 * ディスクの情報
	 */
	#deviceInfo = new Array(32);

	#functionKey = new FunctionKey();

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
	constructor(z80Emu, keyMan, catTextScreen, taskLineInput, taskMonitor, taskPlatformMonitor, diskManager, sndMan, gamePad)
	{
		this.z80Emu = z80Emu;
		this.keyMan = keyMan;
		this.catTextScreen = catTextScreen;
		this.taskLineInput = taskLineInput;
		this.taskMonitor = taskMonitor;
		this.taskPlatformMonitor = taskPlatformMonitor;
		this.diskManager = diskManager;
		this.sndMan = sndMan;
		this.gamePad = gamePad;
		this.batchManager = new SOSBatchManager();
		// ディスクの情報の初期化
		this.#initializeDisk();
		// PCGの初期化
		this.#initializeSvgPCG();
	}

	/**
	 * S-OSから独立して動いている状態かどうか
	 * @returns {boolean} S-OSから独立して動いている状態なら trueを返す
	 */
	isStandAloneMode()
	{
		return false; // todo実装すること
	}

	/**
	 * リセットする
	 * @param {number} platformID
	 */
	reset(platformID) { this.z80Emu.reset(this, platformID); }

	debugLayer = 0;

	/**
	 * 起動時のメッセージを表示する
	 */
	initialMsg()
	{
		// 描画範囲を設定
		this.setFunctionMode(0);
		// 初期画面のメッセージ表示
		this.catTextScreen.clearScreen();
		this.printNativeMsg("<<<<< S-OS  SWORD >>>>>\n");
		this.printNativeMsg("Version 0.00.03 ");
		this.printNativeTagMsg("猫大名 ねこ猫", '<a href="https://twitter.com/W88DodPECuThLOl" target="_blank" rel="noopener noreferrer">', '</a>');
		this.printNativeMsg("\n");

		// デバッグレイヤ
		//this.catTextScreen.clearScreen(this.debugLayer);
		//this.catTextScreen.setDisplayCursor(false, this.debugLayer);
	}
	printNativeTagMsg(msg, startTag, endTag)
	{
		const tag = {
			start: startTag,
			end: endTag
		};
		this.catTextScreen.setAttr({ tag: tag });
		this.printNativeMsg(msg);
		this.catTextScreen.setAttr({tag: null});
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
	 * 画面のスケーリング
	 * @type {{x: number, y: number}}
	 */
	screenScale = {x: 1.0, y: 1.0};

	/**
	 * 実験
	 */
	#isWindowMode = 0;
	#kanjiMode = false;




	/**
	 * 画面サイズを変更する
	 * @param {number} width 横幅のサイズ
	 * @param {number} height 高さのサイズ
	 */
	changeScreenSize(width, height) {
		this.catTextScreen.changeScreenSize(width, height);
		// スタイルを変更して、スケーリング
		const elem = document.getElementById("sos_output");
		elem.style.transform = "scale("
			+ 40 * this.screenScale.x / width + ","
			+ 25 * this.screenScale.y / height + ")";
		// CTRC設定
		this.z80Emu.ioWrite(0x1800, 1);
		this.z80Emu.ioWrite(0x1801, width);
		// 画面範囲を再設定する
		if(this.#isWindowMode) {
			this.setFunctionMode(this.#isWindowMode);
		}
	}

	/**
	 * 画面範囲を設定する
	 * @param {number} isWindowMode 行数
	 */
	setFunctionMode(isWindowMode)
	{
		this.#isWindowMode = isWindowMode;
		if(isWindowMode) {
			// ファンクションの表示
			this.printFunction();
		} else {
			// 漢字モードOFF
			this.#kanjiMode = false;
			// ファンクションの表示
			this.printFunction();
		}
		const screenWidth = this.catTextScreen.getScreenWidth();
		const screenHeight = this.catTextScreen.getScreenHeight();
		this.setWindowRange({
			top: 0, left: 0,
			bottom: screenHeight - this.#isWindowMode, right: screenWidth
		});
	}

	/**
	 * 画面範囲を切り替える
	 */
	changeFunction()
	{
		if(this.#isWindowMode) {
			// 25行モード
			this.setFunctionMode(0);
		} else {
			// 24行モード
			this.setFunctionMode(1);
		}
	}

	/**
	 * 理論画面範囲を設定する
	 * @param {*} range 
	 */
	setWindowRange(range)
	{
		if(range === undefined) {
			const screenWidth = this.catTextScreen.getScreenWidth();
			const screenHeight = this.catTextScreen.getScreenHeight();
			range = {
				top: 0, left: 0,
				bottom: screenHeight, right: screenWidth
			};
		}
		this.catTextScreen.setWindowRange(range);
	}

	// 漢字モード　トグル
	toggleKanjiMode()
	{
		if(!this.#isWindowMode) {
			return;
		}
		this.#kanjiMode = !this.#kanjiMode;
		this.printFunction();
	}

	getFunctionKeyText(keyCode)
	{
		return this.#functionKey.getFunctionKeyText(keyCode);
	}

	/**
	 * ファンクションの表示
	 */
	printFunction()
	{
		if(!this.#isWindowMode) {
			return;
		}

		const screenWidth = this.catTextScreen.getScreenWidth();
		const screenHeight = this.catTextScreen.getScreenHeight();
		const saveLocation = this.getScreenLocate();
		// 25行目をクリア
		this.setWindowRange({
			top: screenHeight - 1, left: 0,
			bottom: screenHeight, right: screenWidth
		});
		this.catTextScreen.clearScreen();
		// 一旦、全面にする
		this.setWindowRange();
		this.setScreenLocate({x:0, y:screenHeight - 1});

		const isWidth80 = screenWidth > 40;
		if(this.#kanjiMode) {
			// FEP
			this.catTextScreen.setColor(0xFF00FFFF);
			this.printNativeMsg("[テキスト入力]");
			this.catTextScreen.setColor(0xFFFFFFFF);
			this.printNativeTagMsg(" ", `<span><input type="text" class="kanji_input" onChange="onChangeKanjiInput(this)" onInput="onInputKanjiInput(this)">`, '</input></span>');
		} else {
			// ファンクションキーの表示
			this.#functionKey.getDisplayText(this, isWidth80);
		}

		// 24行に
		this.setWindowRange({
			top: 0, left: 0,
			bottom: screenHeight - 1, right: screenWidth
		});
		this.setScreenLocate(saveLocation);
	}


	/**
	 * 画面のスケーリングを設定する
	 * @param {number} w 画面のスケーリングの横幅の倍率
	 * @param {number} h 画面のスケーリングの高さの倍率
	 */
	setScreenScale(w,h)
	{
		this.screenScale = {x: w, y: h};
		this.changeScreenSize(this.catTextScreen.getScreenWidth(), this.catTextScreen.getScreenHeight());
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
			if(code == SOSKeyCode.CLS) {
				this.catTextScreen.clearScreen();
			} else if(code == SOSKeyCode.CR) {
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
	DEBUG_PRINT(code)
	{
		this.catTextScreen.putch32(code, 0);
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
	debugNativeMsg(text)
	{
		for(let ch of text) {
			if(ch != '\n') {
				this.DEBUG_PRINT(ch.codePointAt(0));
			} else {
				this.DEBUG_PRINT(0x0D); // 改行コード
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
		if(errorCode < 0 || errorCode > 14) {
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

	// SMILEBASIC.ttf用の文字変換テーブル デフォルト
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

	/**
	 * ASCIIコードと１対１対応の文字マップ
	 * @type {Uin8Array}
	 */
	tblMojiEncode_Unit = [
		/* 00 */ 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
		/* 08 */ 0x0008, 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x000E, 0x000F,
		/* 10 */ 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016, 0x0017,
		/* 18 */ 0x0018, 0x0019, 0x001A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
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
		/* 78 */ 0x0078, 0x0079, 0x007A, 0x007B, 0x007C, 0x007D, 0x007E, 0x007F,
		/* 80 */ 0x0080, 0x0081, 0x0082, 0x0083, 0x0084, 0x0085, 0x0086, 0x0087,
		/* 88 */ 0x0088, 0x0089, 0x008A, 0x008B, 0x008C, 0x008D, 0x008E, 0x008F,
		/* 90 */ 0x0090, 0x0091, 0x0092, 0x0093, 0x0094, 0x0095, 0x0096, 0x0097,
		/* 98 */ 0x0098, 0x0099, 0x009A, 0x009B, 0x009C, 0x009D, 0x009E, 0x009F, 
		/* A0 */ 0x00A0, 0x00A1, 0x00A2, 0x00A3, 0x00A4, 0x00A5, 0x00A6, 0x00A7,
		/* A8 */ 0x00A8, 0x00A9, 0x00AA, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x00AF, 
		/* B0 */ 0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B4, 0x00B5, 0x00B6, 0x00B7,
		/* B8 */ 0x00B8, 0x00B9, 0x00BA, 0x00BB, 0x00BC, 0x00BD, 0x00BE, 0x00BF, 
		/* C0 */ 0x00C0, 0x00C1, 0x00C2, 0x00C3, 0x00C4, 0x00C5, 0x00C6, 0x00C7,
		/* C8 */ 0x00C8, 0x00C9, 0x00CA, 0x00CB, 0x00CC, 0x00CD, 0x00CE, 0x00CF,
		/* D0 */ 0x00D0, 0x00D1, 0x00D2, 0x00D3, 0x00D4, 0x00D5, 0x00D6, 0x00D7,
		/* D8 */ 0x00D8, 0x00D9, 0x00DA, 0x00DB, 0x00DC, 0x00DD, 0x00DE, 0x00DF,
		/* E0 */ 0x00E0, 0x00E1, 0x00E2, 0x00E3, 0x00E4, 0x00E5, 0x00E6, 0x00E7,
		/* E8 */ 0x00E8, 0x00E9, 0x00EA, 0x00EB, 0x00EC, 0x00ED, 0x00EE, 0x00EF,
		/* F0 */ 0x00F0, 0x00F1, 0x00F2, 0x00F3, 0x00F4, 0x00F5, 0x00F6, 0x00F7,
		/* F8 */ 0x00F8, 0x00F9, 0x00FA, 0x00FB, 0x00FC, 0x00FD, 0x00FE, 0x00FF
	];
	/**
	 * PC8001用
	 * 
	 * 0x7B {    => ■  0xE2A8, 0xE2FF
	 * 0x7D }    => メッシュの■  
	 * 0x7F => π U+03C0
	 * @type {Uin8Array}
	 */
	tblMojiEncode_PC8001 = [
		/* 00 */ 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
		/* 08 */ 0x0008, 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x000E, 0x000F,
		/* 10 */ 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016, 0x0017,
		/* 18 */ 0x0018, 0x0019, 0x001A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
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
		/* 78 */ 0x0078, 0x0079, 0x007A, 0xE2A8, 0x007C, 0xE2FF, 0x007E, 0x03C0,
		/* 80 */ 0x0080, 0x0081, 0x0082, 0x0083, 0x0084, 0x0085, 0x0086, 0x0087,
		/* 88 */ 0x0088, 0x0089, 0x008A, 0x008B, 0x008C, 0x008D, 0x008E, 0x008F,
		/* 90 */ 0x0090, 0x0091, 0x0092, 0x0093, 0x0094, 0x0095, 0x0096, 0x0097,
		/* 98 */ 0x0098, 0x0099, 0x009A, 0x009B, 0x009C, 0x009D, 0x009E, 0x009F, 
		/* A0 */ 0x00A0, 0x00A1, 0x00A2, 0x00A3, 0x00A4, 0x00A5, 0x00A6, 0x00A7,
		/* A8 */ 0x00A8, 0x00A9, 0x00AA, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x00AF, 
		/* B0 */ 0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B4, 0x00B5, 0x00B6, 0x00B7,
		/* B8 */ 0x00B8, 0x00B9, 0x00BA, 0x00BB, 0x00BC, 0x00BD, 0x00BE, 0x00BF, 
		/* C0 */ 0x00C0, 0x00C1, 0x00C2, 0x00C3, 0x00C4, 0x00C5, 0x00C6, 0x00C7,
		/* C8 */ 0x00C8, 0x00C9, 0x00CA, 0x00CB, 0x00CC, 0x00CD, 0x00CE, 0x00CF,
		/* D0 */ 0x00D0, 0x00D1, 0x00D2, 0x00D3, 0x00D4, 0x00D5, 0x00D6, 0x00D7,
		/* D8 */ 0x00D8, 0x00D9, 0x00DA, 0x00DB, 0x00DC, 0x00DD, 0x00DE, 0x00DF,
		/* E0 */ 0x00E0, 0x00E1, 0x00E2, 0x00E3, 0x00E4, 0x00E5, 0x00E6, 0x00E7,
		/* E8 */ 0x00E8, 0x00E9, 0x00EA, 0x00EB, 0x00EC, 0x00ED, 0x00EE, 0x00EF,
		/* F0 */ 0x00F0, 0x00F1, 0x00F2, 0x00F3, 0x00F4, 0x00F5, 0x00F6, 0x00F7,
		/* F8 */ 0x00F8, 0x00F9, 0x00FA, 0x00FB, 0x00FC, 0x00FD, 0x00FE, 0x00FF
	];
	/**
	 * X1用
	 * 
	 * 0x7B {    => ■の塗りつぶし 0xE2A8  
	 * 0x7D }    => メッシュの■  0xE2FF
	 * @type {Uin8Array}
	 */
	tblMojiEncode_X1 = [
		/* 00 */ 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
		/* 08 */ 0x0008, 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x000E, 0x000F,
		/* 10 */ 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016, 0x0017,
		/* 18 */ 0x0018, 0x0019, 0x001A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
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
		/* 78 */ 0x0078, 0x0079, 0x007A, 0xE2A8, 0x007C, 0xE2FF, 0x007E, 0x007F,
		/* 80 */ 0x0080, 0x0081, 0x0082, 0x0083, 0x0084, 0x0085, 0x0086, 0x0087,
		/* 88 */ 0x0088, 0x0089, 0x008A, 0x008B, 0x008C, 0x008D, 0x008E, 0x008F,
		/* 90 */ 0x0090, 0x0091, 0x0092, 0x0093, 0x0094, 0x0095, 0x0096, 0x0097,
		/* 98 */ 0x0098, 0x0099, 0x009A, 0x009B, 0x009C, 0x009D, 0x009E, 0x009F,
		/* A0 */ 0x00A0, 0x00A1, 0x00A2, 0x00A3, 0x00A4, 0x00A5, 0x00A6, 0x00A7,
		/* A8 */ 0x00A8, 0x00A9, 0x00AA, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x00AF,
		/* B0 */ 0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B4, 0x00B5, 0x00B6, 0x00B7,
		/* B8 */ 0x00B8, 0x00B9, 0x00BA, 0x00BB, 0x00BC, 0x00BD, 0x00BE, 0x00BF,
		/* C0 */ 0x00C0, 0x00C1, 0x00C2, 0x00C3, 0x00C4, 0x00C5, 0x00C6, 0x00C7,
		/* C8 */ 0x00C8, 0x00C9, 0x00CA, 0x00CB, 0x00CC, 0x00CD, 0x00CE, 0x00CF,
		/* D0 */ 0x00D0, 0x00D1, 0x00D2, 0x00D3, 0x00D4, 0x00D5, 0x00D6, 0x00D7,
		/* D8 */ 0x00D8, 0x00D9, 0x00DA, 0x00DB, 0x00DC, 0x00DD, 0x00DE, 0x00DF,
		/* E0 */ 0x00E0, 0x00E1, 0x00E2, 0x00E3, 0x00E4, 0x00E5, 0x00E6, 0x00E7,
		/* E8 */ 0x00E8, 0x00E9, 0x00EA, 0x00EB, 0x00EC, 0x00ED, 0x00EE, 0x00EF,
		/* F0 */ 0x00F0, 0x00F1, 0x00F2, 0x00F3, 0x00F4, 0x00F5, 0x00F6, 0x00F7,
		/* F8 */ 0x00F8, 0x00F9, 0x00FA, 0x00FB, 0x00FC, 0x00FD, 0x00FE, 0x00FF
	];
	tblMojiEncode_MZ = [
		/* 00 */ 0xF000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
		/* 08 */ 0x0008, 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x000E, 0x000F,
		/* 10 */ 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016, 0x0017,
		/* 18 */ 0x0018, 0x0019, 0x001A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
		/* 20 */ 0xF000, 0xF061, 0xF062, 0xF063, 0xF064, 0xF065, 0xF066, 0xF067,
		/* 28 */ 0xF068, 0xF069, 0xF06B, 0xF06A, 0xF02F, 0xF02A, 0xF02E, 0xF02D,
		/* 30 */ 0xF020, 0xF021, 0xF022, 0xF023, 0xF024, 0xF025, 0xF026, 0xF027,
		/* 38 */ 0xF028, 0xF029, 0xF04F, 0xF02C, 0xF051, 0xF02B, 0xF057, 0xF049,
		/* 40 */ 0xF055, 0xF001, 0xF002, 0xF003, 0xF004, 0xF005, 0xF006, 0xF007,
		/* 48 */ 0xF008, 0xF009, 0xF00A, 0xF00B, 0xF00C, 0xF00D, 0xF00E, 0xF00F,
		/* 50 */ 0xF010, 0xF011, 0xF012, 0xF013, 0xF014, 0xF015, 0xF016, 0xF017,

		/* 58 */ 0xF018, 0xF019, 0xF01A, 0xF052, 0x005C, 0xF054, 0x005E, 0x005F,

		/* 60 */ 0x0060, 0xF101, 0xF102, 0xF103, 0xF104, 0xF105, 0xF106, 0xF107,
		/* 68 */ 0xF108, 0xF109, 0xF10A, 0xF10B, 0xF10C, 0xF10D, 0xF10E, 0xF10F,
		/* 70 */ 0xF110, 0xF111, 0xF112, 0xF113, 0xF114, 0xF115, 0xF116, 0xF117,
		/* 78 */ 0xF118, 0xF119, 0xF11A, 0x007B, 0x007C, 0x007D, 0x007E, 0x007F,
		/* 80 */ 0x0080, 0x0081, 0x0082, 0x0083, 0x0084, 0x0085, 0x0086, 0x0087,
		/* 88 */ 0x0088, 0x0089, 0x008A, 0x008B, 0x008C, 0x008D, 0x008E, 0x008F,
		/* 90 */ 0x0090, 0x0091, 0x0092, 0x0093, 0x0094, 0x0095, 0x0096, 0x0097,
		/* 98 */ 0x0098, 0x0099, 0x009A, 0x009B, 0x009C, 0x009D, 0x009E, 0x009F, 
		/* A0 */ 0x00A0, 0x00A1, 0x00A2, 0x00A3, 0x00A4, 0x00A5, 0x00A6, 0x00A7,
		/* A8 */ 0x00A8, 0x00A9, 0x00AA, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x00AF, 
		/* B0 */ 0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B4, 0x00B5, 0x00B6, 0x00B7,
		/* B8 */ 0x00B8, 0x00B9, 0x00BA, 0x00BB, 0x00BC, 0x00BD, 0x00BE, 0x00BF, 
		/* C0 */ 0x00C0, 0x00C1, 0x00C2, 0x00C3, 0x00C4, 0x00C5, 0x00C6, 0x00C7,
		/* C8 */ 0x00C8, 0x00C9, 0x00CA, 0x00CB, 0x00CC, 0x00CD, 0x00CE, 0x00CF,
		/* D0 */ 0x00D0, 0x00D1, 0x00D2, 0x00D3, 0x00D4, 0x00D5, 0x00D6, 0x00D7,
		/* D8 */ 0x00D8, 0x00D9, 0x00DA, 0x00DB, 0x00DC, 0x00DD, 0x00DE, 0x00DF,
		/* E0 */ 0x00E0, 0x00E1, 0x00E2, 0x00E3, 0x00E4, 0x00E5, 0x00E6, 0x00E7,
		/* E8 */ 0x00E8, 0x00E9, 0x00EA, 0x00EB, 0x00EC, 0x00ED, 0x00EE, 0x00EF,
		/* F0 */ 0x00F0, 0x00F1, 0x00F2, 0x00F3, 0x00F4, 0x00F5, 0x00F6, 0x00F7,
		/* F8 */ 0x00F8, 0x00F9, 0x00FA, 0x00FB, 0x00FC, 0x00FD, 0x00FE, 0x00FF
	];

	strcmp(lhs, rhs) {
		let l = 0;
		let r = 0;
		if((typeof lhs) == "string") {
			return lhs == rhs ? 0 : -1;
		} else {
			while(true) {
				const ch = (r < rhs.length) ? rhs[r++].codePointAt(0) : 0;
				let rc = lhs[l] - ch;
				if ((rc != 0) || !lhs[l++]) {
					return rc;
				}
			}
		}
	}

	#svg_PCG = [];

	/**
	 * タグ
	 * 
	 * 実験中
	 */
	#tagStart;
	#tagEnd;
	setStartTag(tagStart) { this.#tagStart = tagStart; }
	setEndTag(tagEnd) { this.#tagEnd = tagEnd; }

	#initializeSvgPCG()
	{
		// 16だと駄目なので14に
		const initPattern = `<svg width=8 height=14 viewBox="0 0 80 80" preserveAspectRatio="none" style="border:0;margin:0;padding:0;">
		<rect x="0"  y="0"  width="10" height="10" fill="#f00"/><rect x="20" y="0"  width="10" height="10" fill="#f00"/><rect x="40" y="0"  width="10" height="10" fill="#f00"/><rect x="60" y="0"  width="10" height="10" fill="#f00"/>
		<rect x="10" y="10" width="10" height="10" fill="#ff0"/><rect x="30" y="10" width="10" height="10" fill="#f0f"/><rect x="50" y="10" width="10" height="10" fill="#f00"/><rect x="70" y="10" width="10" height="10" fill="#0f0"/>
		<rect x="0"  y="20" width="10" height="10" fill="#0f0"/><rect x="20" y="20" width="10" height="10" fill="#f00"/><rect x="40" y="20" width="10" height="10" fill="#f00"/><rect x="60" y="20" width="10" height="10" fill="#f00"/>
		<rect x="10" y="30" width="10" height="10" fill="#ff0"/><rect x="30" y="30" width="10" height="10" fill="#f0f"/><rect x="50" y="30" width="10" height="10" fill="#f00"/><rect x="70" y="30" width="10" height="10" fill="#0f0"/>
		<rect x="0"  y="40" width="10" height="10" fill="#f00"/><rect x="20" y="40" width="10" height="10" fill="#f00"/><rect x="40" y="40" width="10" height="10" fill="#f00"/><rect x="60" y="40" width="10" height="10" fill="#f00"/>
		<rect x="10" y="50" width="10" height="10" fill="#ff0"/><rect x="30" y="50" width="10" height="10" fill="#f0f"/><rect x="50" y="50" width="10" height="10" fill="#f00"/><rect x="70" y="50" width="10" height="10" fill="#0f0"/>
		<rect x="0"  y="60" width="10" height="10" fill="#f00"/><rect x="20" y="60" width="10" height="10" fill="#f00"/><rect x="40" y="60" width="10" height="10" fill="#f00"/><rect x="60" y="60" width="10" height="10" fill="#f00"/>
		<rect x="10" y="70" width="10" height="10" fill="#ff0"/><rect x="30" y="70" width="10" height="10" fill="#fff"/><rect x="50" y="70" width="10" height="10" fill="#f00"/><rect x="70" y="70" width="10" height="10" fill="#ff0"/>
		<rect x="0" y="70" width="80" height="10" fill="#fff"/>
		</svg>`;
		this.#svg_PCG = [];
		for(let i = 0; i <= 0xFF; ++i) {
			this.#svg_PCG.push(initPattern);
		}
	}

	/**
	 * レトロPCフォント用の文字描画 X1
	 * 
	 * @param {number} codePoint 文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 * @param {boolean} cursor カーソルを描画するかどうか
	 * @returns {string} １文字文描画するテキスト
	 */
	#customDrawLetter_RetoroPC_X1(x, y, width, codePoint, color, attr, cursor) {
		// test
		/*
		{
			// Z80側から取得して描画する
			attr = this.z80Emu.ioRead(0x2000 + x + y * width);
			const isPCG = ((attr & 0x20) != 0);
			if(isPCG) {
				//this.z80Emu.ioWrite(0x3000 + x + y * width, codePoint);
			} else {
				const ch = this.z80Emu.ioRead(0x3000 + x + y * width);
				if(ch) {
					codePoint = ch;
					color = ((attr & 0x7) == 0) ? 0xFF0000FF : 0xFFFFFF00;
				}
			}
		}*/
		const paletteIndex = attr & 0x07;
		const isPCG = ((attr & 0x20) != 0);

		// test
		if(codePoint >= 0x100) {
			// 0x0100～は、半分のサイズにして描画
			const moji = String.fromCodePoint(codePoint);
			if(cursor) {
				if(color == 0xFFFFFFFF) {
					// デフォルトが白なので、色設定不要
					return '<span class="cursor letterHalf">' + moji + '</span>';
				} else {
					return '<font class="cursor letterHalf" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
				}
			} else {
				if(color == 0xFFFFFFFF) {
					// デフォルトが白なので、色設定不要
					return '<span class="letterHalf">' + moji + '</span>';
				} else {
					return '<font class="letterHalf" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
				}
			}
		}
		if(isPCG) {
			// PCG
			return this.#svg_PCG[codePoint];
		}
		// 文字コードを調整
		// 0x020～0x7Aはそのまま メモ）なるべくコピペできるようにそのままに
		// 0x01～0x1F、0x7B～0xFFを0xF001～0xF01F、0xF07B～F0FFにマップ
		if((0x01 <= codePoint && codePoint <= 0x1F) || (0x7A < codePoint)) {
			codePoint += 0xF000;
		}

		// 文字生成
		// ・必要ならエスケープしておく
		let moji;
		switch(codePoint) {
			case 0x00:
			case 0x20: moji = '&nbsp;'; break; // 半角スペース
			case 0x26: moji = '&amp;'; break; // &
			case 0x3C: moji = '&lt;'; break; // <
			case 0x3E: moji = '&gt;'; break; // >
			default:
				moji = String.fromCodePoint(codePoint);
				break;
		}

		// HTMLの文字列生成
		if(cursor) {
			if(color == 0xFFFFFFFF) {
				// デフォルトが白なので、色設定不要
				// カーソルだけ設定する
				return '<span class="cursor">' + moji + '</span>';
			} else {
				return '<font class="cursor" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
			}
		} else {
			if(color == 0xFFFFFFFF) {
				// デフォルトが白なので、色設定不要
				return moji;
			} else {
				return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
			}
		}
	};

	/**
	 * レトロPCフォント用の文字描画
	 * 
	 * @param {number} codePoint 文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 * @param {boolean} cursor カーソルを描画するかどうか
	 * @returns {string} １文字文描画するテキスト
	 */
	#customDrawLetter_RetoroPC(x, y, width, codePoint, color, attr, cursor) {
		if(codePoint >= 0x100) {
			// 0x0100～は、半分のサイズにして描画
			const moji = String.fromCodePoint(codePoint);
			if(cursor) {
				if(color == 0xFFFFFFFF) {
					// デフォルトが白なので、色設定不要
					return '<span class="cursor letterHalf">' + moji + '</span>';
				} else {
					return '<font class="cursor letterHalf" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
				}
			} else {
				if(color == 0xFFFFFFFF) {
					// デフォルトが白なので、色設定不要
					return '<span class="letterHalf">' + moji + '</span>';
				} else {
					return '<font class="letterHalf" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
				}
			}
		}

		// 文字コードを調整
		// 0x020～0x7Aはそのまま メモ）なるべくコピペできるようにそのままに
		// 0x01～0x1F、0x7B～0xFFを0xF001～0xF01F、0xF07B～F0FFにマップ
		if((0x01 <= codePoint && codePoint <= 0x1F) || (0x7A < codePoint)) {
			codePoint += 0xF000;
		}

		// 文字生成
		// ・必要ならエスケープしておく
		let moji;
		switch(codePoint) {
			case 0x00:
			case 0x20: moji = '&nbsp;'; break; // 半角スペース
			case 0x26: moji = '&amp;'; break; // &
			case 0x3C: moji = '&lt;'; break; // <
			case 0x3E: moji = '&gt;'; break; // >
			default:
				moji = String.fromCodePoint(codePoint);
				break;
		}

		// HTMLの文字列生成
		if(cursor) {
			if(color == 0xFFFFFFFF) {
				// デフォルトが白なので、色設定不要
				// カーソルだけ設定する
				return '<span class="cursor">' + moji + '</span>';
			} else {
				return '<font class="cursor" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
			}
		} else {
			if(color == 0xFFFFFFFF) {
				// デフォルトが白なので、色設定不要
				return moji;
			} else {
				return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
			}
		}
	};


	#currentTag = null;

	/**
	 * フォントを変更する
	 * @param {Uint8Array|string} fontName 機種名
	 * @param {string[]} fontUrls フォントのURL
	 */
	async changeFont(fontName, fontUrls) {
		this.catTextScreen.setHalf(true);
		if(this.strcmp(fontName, "SOS") == 0) {
			// S-OS
			this.tblMojiEncode = this.tblMojiEncode_SOS;
			fontUrls = [];
			this.setScreenScale(1.0, 1.0);
			this.catTextScreen.setSpaceFull(true); // スペースを全角で描画する
			this.catTextScreen.setHalf(false);
			this.catTextScreen.setCustomDrawLetter(null);
		} else if(this.strcmp(fontName, "X1") == 0) {
			// X1風 S-OS
			this.tblMojiEncode = this.tblMojiEncode_X1;
			fontUrls = ["./fonts/X1/X1-FONT-PUA.ttf"];
			this.setScreenScale(2.0, 1.0);
			this.catTextScreen.setCustomDrawLetter( (x, y, width, codePoint, color, attr, cursor) => {
				if(x == 0 && y == 0) {
					this.#currentTag = null;
				}
				let text = "";
				if(this.#currentTag !== attr.tag) {
					if(this.#currentTag) {
						text += this.#currentTag.end;
					}
					this.#currentTag = attr.tag;
					if(this.#currentTag) {
						text += this.#currentTag.start;
					}
				}
				text += this.#customDrawLetter_RetoroPC_X1(x, y, width, codePoint, color, attr, cursor );
				return text;
			});
		} else if(this.strcmp(fontName, "X1p") == 0) {
			// X1風
			this.tblMojiEncode = this.tblMojiEncode_Unit;
			fontUrls = ["./fonts/X1/X1-FONT-PUA.ttf"];
			this.setScreenScale(2.0, 1.0);
			this.catTextScreen.setCustomDrawLetter( (x, y, width, codePoint, color, attr, cursor) => {
				if(x == 0 && y == 0) {
					this.#currentTag = null;
				}
				let text = "";
				if(this.#currentTag !== attr.tag) {
					if(this.#currentTag && this.#currentTag.end) {
						text += this.#currentTag.end;
					}
					this.#currentTag = attr.tag;
					if(this.#currentTag && this.#currentTag.start) {
						text += this.#currentTag.start;
					}
				}
				text += this.#customDrawLetter_RetoroPC_X1(x, y, width, codePoint, color, 0, cursor );
				return text;
			});
		} else if(this.strcmp(fontName, "PC8001") == 0 || this.strcmp(fontName, "PC8") == 0) {
			// PC8001風(Original) S-OS
			this.tblMojiEncode = this.tblMojiEncode_PC8001;
			fontUrls = ["./fonts/N-Font/N-Font_Original.TTF", "./fonts/X1/X1-FONT-PUA.ttf"];
			this.setScreenScale(2.0, 1.0);
			this.catTextScreen.setCustomDrawLetter(this.#customDrawLetter_RetoroPC);
		} else if(this.strcmp(fontName, "PC8001p") == 0 || this.strcmp(fontName, "PC8p") == 0) {
			// PC8001風(Original)
			this.tblMojiEncode = this.tblMojiEncode_Unit;
			fontUrls = ["./fonts/N-Font/N-Font_Original.TTF", "./fonts/X1/X1-FONT-PUA.ttf"];
			this.setScreenScale(2.0, 1.0);
			this.catTextScreen.setCustomDrawLetter(this.#customDrawLetter_RetoroPC);
		} else if(this.strcmp(fontName, "PC8001r") == 0 || this.strcmp(fontName, "PC8r") == 0) {
			// PC8001風(Refine)
			this.tblMojiEncode = this.tblMojiEncode_Unit;
			fontUrls = ["./fonts/N-Font/N-Font_Refine.TTF", "./fonts/X1/X1-FONT-PUA.ttf"];
			this.setScreenScale(2.0, 1.0);
			this.catTextScreen.setCustomDrawLetter(this.#customDrawLetter_RetoroPC);
		} else {
			this.printNativeMsg("Unknown FONT map.\n");
			return;
		}

		const elem = document.getElementById("sos_output");
		if(fontUrls) {
			// FontFaceオブジェクト生成と読み込み
			let results = [];
			let i = 0;
			let fontFamily = "";
			for(const fontUrl of fontUrls) {
				fontFamily += '"CatTextScreenFont' + i + '",'; // フォント設定するときの文字列
				const fontFace = new FontFace('CatTextScreenFont' + i++, 'url(' + fontUrl + ')');
				results.push(fontFace.load());
			}
			fontFamily += '"defaultFont"';
			await Promise.all(results);
			// 登録
			for(const loadedFace of results) {
				loadedFace.then(function(loadedFace){
					// フォント読み込み成功
					document.fonts.add(loadedFace);
					if(this && this.z80Emu) {
						const cnv = new CatFont2Img();
						const canvas = document.getElementById('canvasFont');
						for(let ch = 0x00; ch <= 0xFF; ++ch) {
							let pcgData = cnv.cnv(canvas, fontFamily, ch + 0xF000);
							this.z80Emu.setPCG(ch, pcgData);
							this.z80Emu.setPCG(ch + 0x100, pcgData);
						}
					}
				}).catch(function(e){
					// フォント読み込み失敗
					console.error('フォントの読み込みに失敗しました');
				});
			}
			// フォント設定
			elem.style.fontFamily = fontFamily;
		} else {
			elem.style.fontFamily = '"defaultFont"';
		}

		// フォントの文字のマッピング
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
	 * ディスクの情報の初期化
	 */
	#initializeDisk()
	{
		this.#deviceInfo = new Array(32);
		for(let i = 0; i < this.#deviceInfo.length; ++i) {
			this.#deviceInfo[i] = {
				/**
				 * ディスクの種類
				 * - 0x00 : 2D
				 * - 0x10 : 2DD
				 * - 0x20 : 2HD
				 * - 0x30 : 1D
				 * - 0x40 : 1DD
				 * @type {number} DiskTypeEnum
				 */
				imageType: 0x00,
				/**
				 * ディレクトリエントリのあるレコード(セクタ)番号
				 * @type {number}
				 */
				DIRPS: 16, // 2Dのデフォルトに設定
			};
		}
	}

	/**
	 * ディスクデバイスかどうか
	 * 
	 * メモ)'A'～'D'がディスク
	 * メモ)'E'がRAMディスク
	 * @param {number} descriptor デバイスを示す文字（'A'～）
	 * @return {boolean} ディスクデバイスなら true を返す
	 */
	#checkDiskDescriptor(descriptor)
	{
		return 0x41 <= descriptor && descriptor <= 0x45; // A～E
	}

	/**
	 * ディスクの種類を取得する
	 * @param {number} descriptor デバイスを示す文字（'A'～）
	 */
	GetDiskType(descriptor)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].GetDiskType();
		} else {
			return nullptr;
		}
	}

	/**
	 * ディレクトリエントリのあるレコード番号を取得する
	 * @param {number} descriptor デバイスを示す文字（'A'～）
	 */
	GetDIRPS(descriptor)
	{
		// @todo 2DD,2HD対応
		if(this.#checkDiskDescriptor(descriptor)) {
			const no = descriptor - 0x41;
			return this.#deviceInfo[no].DIRPS;
		} else {
			return this.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
		}
	}

	/**
	 * ディスクのイベント処理
	 * @param {number} no デバイスの番号(0～)
	 * @param {string} event イベント名
	 * @param {*} info 情報
	 */
	diskEvent(no, event, info)
	{
		let logText = "[DiskEvent] devive:" + no + " event:" + event;
		if(!this.#checkDiskDescriptor(0x41 + no)) {
			return; // 未対応のドライブ
		}
		if(event == "Unmount") {
			// アンマウントされた
			this.#deviceInfo[no].imageType = 0x00; // 2D
			this.#deviceInfo[no].DIRPS = 16; // 2Dのデフォルトに設定
		} else if(event == "Mount") {
			// マウントされた
			const diskType = info.diskType;
			if(diskType) {
				this.#deviceInfo[no].imageType = diskType.GetImageType();
				this.#deviceInfo[no].DIRPS = diskType.GetEntrySectorStart();
				logText += " imageType:" + diskType.GetImageTypeName();
				logText += " DefaultDirectoryEntry:" + diskType.GetEntrySectorStart();
			} else {
				this.#deviceInfo[no].imageType = 0x00; // 2D
				this.#deviceInfo[no].DIRPS = 16; // 2Dのデフォルトに設定
			}
		}
		console.log(logText);
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
		this.printNativeMsg("$" + ToStringHex2(result.freeClusters) + " Clusters Free\n");
		for(let entry of result.entries) {
			// 属性とライトプロテクト
			this.PrintFileAttribute(entry.attribute);
			// デバイス名
			let text = "";
			text += String.fromCodePoint(result.deviceName) + ":";
			// ファイル名
			for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
				text += String.fromCodePoint([entry.filename[i]]);
			}
			text += ".";
			for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
				text += String.fromCodePoint([entry.extension[i]]);
			}
			this.printNativeTagMsg(text, '<a href="javascript:void(0)" onclick="onFileObjectClick(\'' + text + '\', event); return false;">', '</a>');
			//this.printNativeMsg(text);
			// 読み込みアドレス
			text = ":" + ToStringHex4(entry.loadAddress);
			// 終了アドレス
			text += ":" + ToStringHex4(entry.loadAddress + entry.size - 1);
			// 実行アドレス
			text += ":" + ToStringHex4(entry.executeAddress);
			this.printNativeMsg(text + "\n");
		}
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

	/**
	 * データをメモリにコピーする
	 * @param {Uint8Array} data データ
	 * @param {number} address コピー先のアドレス
	 */
	memoryWrite(data, address)
	{
		for(let i = 0; i < data.length; ++i) {
			this.z80Emu.memWriteU8(address + i, data[i]);
		}
	}

	/**
	 * 強制的に実行するアドレスを設定する
	 * @param {number} execAddress 実行するアドレス
	 */
	execCommand(execAddress)
	{
		if(this.taskMonitor.isActive()) {
			// S-OS標準モニタ実行中
			this.taskMonitor.forceJump(this, execAddress);
			return;
		} else {
			// モニタ起動中出なければ、無理やりアドレスを変更してみる……
			// 飛び先設定
			this.monitorCommandJump(execAddress);
			// CALL execAddressしてるところにPCを無理やり設定
			this.z80Emu.setPC(0x0006);
			// スタックも初期化
			this.z80Emu.setSP(this.z80Emu.memReadU16(SOSWorkAddr.STKAD));
			// カーソル非表示にしてジャンプする
			this.setDisplayCursor(false);
		}
	}

	/**
	 * 文字を16進数として扱い変換する
	 * @param {number} value 文字
	 * @returns {number}	変換された値(0～0xF)  
	 * 						-1の時は失敗
	 */
	hex(value){
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
	 * カーソルが先頭になければ改行
	 */
	NL()
	{
		if(this.getScreenLocate().x != 0) { this.PRINT(SOSKeyCode.CR); }
	}

	/**
	 * "AUTOEXEC.BAT"を実行する
	 */
	setAutoExecBat()
	{
		this.batchManager.setAutoExecBat();
	}
}
