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
		this.printNativeMsg("Version 0.00.00 猫大名 ねこ猫\n");
		this.printNativeMsg(" M command is not implemented.\n");
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
			let text = "";
			// 属性
			if(entry.attribute & 0x80) {
				text = "Dir";
			} else if(entry.attribute & 0x01) {
				text = "Bin";
			} else if(entry.attribute & 0x02) {
				text = "Bas";
			} else if(entry.attribute & 0x04) {
				text = "Asc";
			} else {
				text = "???";
			}
			// ライトプロテクト
			text += (entry.attribute & 0x40) ? "* " : "  ";
			// デバイス名
			text += String.fromCodePoint(result.deviceName) + ":";
			this.printNativeMsg(text);
			// ファイル名
			for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) { this.PRINT(entry.filename[i]); }
			this.PRINT(0x2E); // "."
			for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) { this.PRINT(entry.extension[i]); }
			// 読み込みアドレス
			text = ":" + (entry.loadAddress).toString(16).padStart(4, 0).toUpperCase();
			// 終了アドレス
			text += ":" + (entry.loadAddress + entry.size - 1).toString(16).padStart(4, 0).toUpperCase();
			// 実行アドレス
			text += ":" + (entry.executeAddress).toString(16).padStart(4, 0).toUpperCase();
			this.printNativeMsg(text + "\n");
		}
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
