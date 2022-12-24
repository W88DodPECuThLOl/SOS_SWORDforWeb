class TaskContext {
	z80Emu;
	keyMan;
	catTextScreen;
	taskLineInput;
	taskMonitor;
	/**
	 * ディスク管理
	 * @type {HuBasicDisk[]}
	 */
	diskManager;

	#keyCodeCLS = 0x0C; // CLS
	#keyCodeCR = 0x0D; // Enterキー
	#keyCodeBRK = 0x1B; // Breakキー
	#keyCodeBackSpace = 0x08; // BackSpaceキー
	#keyCodeDelete = 'Delete'; // DELキー

	#defaultTextScreen = 4;

	constructor(z80Emu, keyMan, catTextScreen, taskLineInput, taskMonitor, diskManager)
	{
		this.z80Emu = z80Emu;
		this.keyMan = keyMan;
		this.catTextScreen = catTextScreen;
		this.taskLineInput = taskLineInput;
		this.taskMonitor = taskMonitor;
		this.diskManager = diskManager;
	}

	/**
	 * リセットする
	 */
	reset()
	{
		this.z80Emu.reset();
	}

	/**
	 * 起動時のメッセージを表示する
	 */
	initialMsg()
	{
		this.catTextScreen.clearScreen();
		this.printNativeMsg("<<<<< S-OS  SWORD >>>>>\n");
		this.printNativeMsg("Version 0.00.00 猫大名 ねこ猫\n");
		this.printNativeMsg(" M and ! commands are not implemented.\n");
	}

	/**
	 * S-OS標準モニタのジャンプコマンドの飛び先を設定する
	 * 
	 * S-OS標準モニタが終了したときに、ここで設定したアドレスが呼び出される
	 * @param {number} address 飛び先
	 */
	monitorCommandJump(address)
	{
		this.z80Emu.monitorCommandJump(address);
	}

	// --------------------------------------------------------------------
	// 入力
	// --------------------------------------------------------------------

	// ライン入力開始
	startLineInput()
	{
		this.taskLineInput.start(this);
	}
	endLineInput()
	{
		this.taskLineInput.end(this);
	}
	isFinishLineInput()
	{
		return this.taskLineInput.isFinished();
	}
	getResultLineInput()
	{
		return this.taskLineInput.getResult();
	}

	// --------------------------------------------------------------------
	// 画面
	// --------------------------------------------------------------------

	/**
	 * 画面サイズを変更する
	 * @param {number} width 横幅のサイズ
	 * @param {number} height 高さのサイズ
	 */
	changeScreenSize(width, height)
	{
		this.catTextScreen.changeScreenSize(width, height);
	}

	getScreenLocate()
	{
		return this.catTextScreen.getCursor();
	}
	/**
	 * 
	 * @param {{x, y}} locate 
	 */
	setScreenLocate(locate)
	{
		this.catTextScreen.setCursor(locate.x, locate.y);
	}

	getCodePoint(x, y)
	{
		return this.catTextScreen.getCodePoint(x, y);
	}

	/**
	 * １文字出力する
	 * @param {number|string} code 文字コード
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
	 * @param {string} text 
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
			errorCode = 14; // "Bad Data"
		}
		this.printNativeMsg(errorMsg[errorCode]);
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
	 * 
	 * @param {number} descriptor 
	 * @param {number} dirRecord 
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
	 * }}
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
	 * 
	 * @param {*} result 
	 */
	PrintFiles(result)
	{
		// 空きクラスタサイズ
		this.printNativeMsg("$" + (result.freeClusters).toString(16) + " Clusters Free\n");
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
			for(let i = 0; i < 13; ++i) { this.PRINT(entry.filename[i]); }
			this.PRINT(0x2E); // "."
			for(let i = 0; i < 3; ++i) { this.PRINT(entry.extension[i]); }
			// 読み込みアドレス
			text = ":" + (entry.loadAddress).toString(16).padStart(4, 0);
			// 終了アドレス
			text += ":" + (entry.loadAddress + entry.size - 1).toString(16).padStart(4, 0);
			// 実行アドレス
			text += ":" + (entry.executeAddress).toString(16).padStart(4, 0);
			this.printNativeMsg(text + "\n");
		}
	}

	/**
	 * インフォメーションブロックを取得する
	 * @param {number} descriptor 
	 * @param {number} DirRecord
	 * @param {Uint8Array} Filename 
	 * @param {Uint8Array} Extension
	 * @returns {{
	 *		result: number,			// 処理結果
	 *		fileMode: number,		// ファイルモード
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 *		fileSize: number		// ファイルサイズ
	 *	}}
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
	 * }}
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
	 * 
	 * @param {number} descriptor 
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} Data 書き込むデータ
	 * @param {number} SaveAddress 
	 * @param {number} EndAddress 
	 * @param {number} ExecAddress 
	 * @param {number} FileMode 属性（ファイルモード）
	 * @returns 
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
	 * 
	 * @param {number} descriptor 
	 * @param {number} record 
	 * @returns {{
	 * 		result:number,
	 * 		value:Uint8Array
	 * }}
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
	 * 
	 * @param {number} descriptor 
	 * @param {number} record 
	 * @param {Uint8Array} data 
	 * @returns {{
	 * 		result:number
	 * }}
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
	 * @param {number} descriptor 
	 * @param {number} dirRecord
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
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
	 * @param {number} descriptor 
	 * @param {number} dirRecord
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
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
	 * @param {number} descriptor 
	 * @param {number} dirRecord
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
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
	 * リネームする
	 * @param {number} descriptor 
	 * @param {number} dirRecord
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} newFilename 新しいファイル名
	 * @param {Uint8Array} newExtension 新しい拡張子
	 * @returns 
	 */
	Rename(descriptor, dirRecord, Filename, Extension, newFilename, newExtension)
	{
		if(this.#checkDiskDescriptor(descriptor)) {
			return this.diskManager[descriptor - 0x41].Rename(dirRecord, Filename, Extension, newFilename, newExtension);
		} else {
			return { result: SOSErrorCode.BadFileDescripter };
		}
	}
}

/**
 * 一行入力をするタスク
 */
class TaskLineInput {
	/**
	 * 状態
	 * @type {function[]}
	 */
	#state;
	/**
	 * 現在の状態
	 * @type {number}
	 */
	#stateNo;
	/**
	 * 入力する最大文字数 - 1
	 * @type {number}
	 */
	#maxInput = 160 - 1;
	/**
	 * 入力された文字列
	 * @type {number[]}
	 */
	inputBuffer;

	// @todo キーコード、まとめること

	#keyCodeBackSpace = 0x0008; // BS
	#keyCodeCR = 0x000D; // Enterキー
	#keyCodeBRK = 0x001B; // Breakキー
	#keyCodeDEL = 'Delete'; // DELキー
	#keyCodeHome = 'Home'; // Homeキー
	#keyCodeEnd = 'End'; // Endキー
	#keyCodeArrowLeft = 'ArrowLeft'; // 左カーソルキー
	#keyCodeArrowRight = 'ArrowRight'; // 右カーソルキー
	#keyCodeArrowUp = 'ArrowUp'; // 上カーソルキー
	#keyCodeArrowDown = 'ArrowDown'; // 下カーソルキー

	/**
	 * 何もしてない状態
	 * @type {number}
	 */
	#state_idle = 0;
	/**
	 * 開始状態
	 * @type {number}
	 */
	#state_start = 1;
	/**
	 * 何か入力されるのを待って、入力されたら処理する状態
	 * @type {number}
	 */
	#state_wait = 2;
	/**
	 * 完了状態
	 * @type {number}
	 */
	#state_end = 3;

	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.inputBuffer = [];
		this.#state = new Array();
		this.#state[this.#state_idle] = (ctx)=>{};
		this.#state[this.#state_start] = (ctx)=>{
			// 入力バッファをクリア
			this.inputBuffer.length = 0;
			// キーバッファをクリア
			ctx.keyMan.keyBufferClear();
			// キー入力待ちへ
			this.changeState(this.#state_wait);
		};
		this.#state[this.#state_wait] = (ctx)=>{
			const keyCode = ctx.keyMan.dequeueKeyBuffer();
			if(keyCode > 0) {
				if(keyCode == this.#keyCodeBRK) {
					// Breakキーが押された
					this.inputBuffer = [this.#keyCodeBRK, 0];
					this.changeState(this.#state_end);
					return;
				} else if(keyCode == this.#keyCodeBackSpace) {
					// 1文字削除
					ctx.catTextScreen.putch32(0x0008); // BS
					return;
				} else if(keyCode == this.#keyCodeCR) {
					// Enterキー、入力完了
					// カーソルのある行の文字列を取得して、バッファへ積む
					this.inputBuffer = [];
					for(let ch of ctx.catTextScreen.getLineWithDecode()) {
						if(this.inputBuffer.length >= this.#maxInput) { break; }
						this.inputBuffer.push(ch);
					}
					this.inputBuffer.push(0);
					// 改行しておく
					ctx.catTextScreen.putch32(this.#keyCodeCR);
					// 終了状態へ
					this.changeState(this.#state_end);
					return;
				}
				ctx.catTextScreen.putch32(keyCode);
			} else if(keyCode == this.#keyCodeDEL
					|| keyCode == this.#keyCodeHome
					|| keyCode == this.#keyCodeEnd
					|| keyCode == this.#keyCodeArrowLeft
					|| keyCode == this.#keyCodeArrowRight
					|| keyCode == this.#keyCodeArrowUp
					|| keyCode == this.#keyCodeArrowDown) {
				// 制御キー
				// 行頭へ、行末へ、カーソル移動、DELキー
				ctx.catTextScreen.putch32(keyCode);
				return;
			}
		};
		this.#state[this.#state_end] = (ctx)=>{};

		// 初期状態を、何もしていない状態に設定
		this.#stateNo = this.#state_idle;
	}

	/**
	 * 更新処理
	 * @param {*} ctx 
	 */
	update(ctx) { this.#state[this.#stateNo](ctx); }

	/**
	 * 開始する
	 * @param {*} ctx 
	 */
	start(ctx) { this.changeState(this.#state_start); }

	/**
	 * 終了する
	 * @param {*} ctx
	 */
	end(ctx)
	{
		// 入力バッファをクリア
		this.inputBuffer = new Array();
		// キーバッファをクリア
		ctx.keyMan.keyBufferClear();
		// アイドル状態へ
		this.changeState(this.#state_idle);
	}

	/**
	 * 完了したかどうか
	 * @returns {boolean} 完了していたら true を返す
	 */
	isFinished() { return this.#stateNo == this.#state_end; }
	/**
	 * 動作中かどうか
	 * @returns {boolean} 動作中なら true を返す
	 */
	isActive() { return this.#stateNo != this.#state_idle; }
	/**
	 * 結果を取得する
	 * @returns {{
	 * 		resultCode:number, // 処理結果
	 * 		result:number[], // 入力された文字列
	 * }}
	 */
	getResult() { return {resultCode:0, result: this.inputBuffer}; }
	/**
	 * 状態遷移する
	 * @param {number} stateNo 遷移する状態
	 */
	changeState(stateNo) { this.#stateNo = stateNo; }
}

/**
 * S-OS標準モニタのタスク
 */
class TaskMonitor {
	/**
	 * 状態
	 * @type {function[]}
	 */
	#state;
	/**
	 * 現在の状態
	 * @type {number}
	 */
	#stateNo;

	#commandBuffer;

	#state_idle = 0;
	#state_start = 1;
	#state_input_wait = 2;
	#state_command = 3;
	#state_pause_wait = 4;
	#state_end = 5;

	#keyCodeBRK = 0x1B; // Breakキー
	#keyCodeCR = 0x0D; // Enterキー

	#doError(ctx, errorCode)
	{
		ctx.ERROR(errorCode);
		ctx.PRINT(this.#keyCodeCR);
		this.changeState(this.#state_start);
		return false;
	}
	#checkResult(ctx, res)
	{
		if(res.result != 0) { return this.#doError(ctx, res.result); }
		return true;
	}
	
	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#state = new Array();
		this.#state[this.#state_idle] = (ctx)=>{};
		this.#state[this.#state_start] = (ctx)=>{
			// プロンプト表示
			ctx.PRINT(0x23); // #
			// ライン入力開始
			ctx.startLineInput();
			this.changeState(this.#state_input_wait);
		};
		this.#state[this.#state_input_wait] = (ctx)=>{
			if(!ctx.isFinishLineInput()) {
				return; // ライン入力中...
			}
			const resultCode = ctx.getResultLineInput();
			if(resultCode.resultCode == 0) {
				this.#commandBuffer = resultCode.result;
			} else {
				this.#commandBuffer = [0];
			}
			// ライン入力終了
			ctx.endLineInput();
			// コマンド処理へ
			this.changeState(this.#state_command);
		};
		this.#state[this.#state_command] = (ctx)=>{
			if(this.#commandBuffer.length <= 0
				|| this.#commandBuffer[0] == this.#keyCodeBRK
				|| this.#commandBuffer[0] != 0x23
				|| this.#commandBuffer[0] == 0) {
				this.changeState(this.#state_start);
				return;
			}
			this.#commandBuffer.shift(); // '#'
			// コマンド
			switch(this.#commandBuffer.shift()) {
					// ;	行末までコメントと見なす
				case 0x3B:
				case 0x00:
					this.changeState(this.#state_start);
					return;
					// D [<デバイス名>:]				ディレクトリ表示
					// DV <デバイス名>:					デフォルトデバイス変更 (ディスクからの起動時はA、テープからの起動時はS)
				case 0x44: // 'D'
					{
						let flagCommandDV = false;
						if(this.#commandBuffer[0] == 0x56) { // 'V'
							// DV
							this.#commandBuffer.shift();
							flagCommandDV = true;
						}
						// 空白スキップ
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
						// デバイス名
						let deviceName = ctx.z80Emu.memReadU8(SOSWorkAddr.DSK);
						if(this.#commandBuffer[1] == 0x3A) {
							if(0x61 <= this.#commandBuffer[0] && this.#commandBuffer[0] <= 0x64) {
								deviceName = this.#commandBuffer[0] - 0x20; // 大文字に
							} else if(0x41 <= this.#commandBuffer[0] && this.#commandBuffer[0] <= 0x44) {
								deviceName = this.#commandBuffer[0];
							} else {
								this.#doError(ctx, SOSErrorCode.BadFileDescripter);
								return;
							}
						} else if(this.#commandBuffer[0] != 0) {
							this.#doError(ctx, SOSErrorCode.SyntaxError);
							return;
						}
						//
						if(flagCommandDV) {
							// DV
							ctx.z80Emu.memWriteU8(SOSWorkAddr.DSK, deviceName);
						} else {
							// D
							const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
							let result = ctx.Files(deviceName, dirRecord);
							if(result.result == 0) {
								ctx.PrintFiles(result);
							} else {
								ctx.ERROR(result.result);
								ctx.PRINT(this.#keyCodeCR);
							}
						}
						this.changeState(this.#state_start);
						return;
					}

				// J <アドレス>							指定アドレス (16進数4桁) のコール
				case 0x4A:
					{
						// 空白スキップ
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
						// ジャンプ先取得
						const address = this.#parseHex4(this.#commandBuffer);
						if(!this.#checkResult(ctx, address)) { return; }
						// 飛び先設定
						ctx.monitorCommandJump(address.value);
						// モニタ終了
						this.changeState(this.#state_end);
						return;
					}
					// K <ファイル名>					ファイル消去
				case 0x4B: // 'K'
					{
						// 空白スキップ
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
						// ファイル名
						const filename = this.#parseFilename(ctx, this.#commandBuffer);
						if(!this.#checkResult(ctx, filename)) { return; }
						// ディレクトリのレコード
						const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
						// ファイル削除
						let result = ctx.Kill(filename.deviceName, dirRecord, filename.filename, filename.extension);
						if(!this.#checkResult(ctx, result)) { return; }
						this.changeState(this.#state_start);
						return;
					}
				case 0x4C: // 'L'
					// L <ファイル名>[:<アドレス>]		ファイルロード
					{
						// 空白スキップ
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
						// ファイル名
						const filename = this.#parseFilename(ctx, this.#commandBuffer);
						if(!this.#checkResult(ctx, filename)) { return; }
						// ロードアドレス
						let isSetLoadAddress = false;
						let loadAddress;
						if(this.#commandBuffer[0] == 0x3A) { // ':'
							this.#commandBuffer.shift();
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							// 
							loadAddress = this.#parseHex4(this.#commandBuffer);
							if(!this.#checkResult(ctx, loadAddress)) { return; }
							isSetLoadAddress = true;
						}
						// ディレクトリのレコード
						const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
						// 読み込む
						let data = ctx.ReadFile(filename.deviceName, dirRecord, filename.filename, filename.extension);
						if(!this.#checkResult(ctx, data)) { return; }
						// メモリにコピー
						const address = isSetLoadAddress ? loadAddress.value : data.loadAddress;
						for(let i = 0; i < data.value.length; ++i) {
							ctx.z80Emu.memWriteU8(address + i, data.value[i]);
						}
						this.changeState(this.#state_start);
						return;
					}
					// M								各機種のモニタ
				case 0x4E: // N <ファイル名1>:<ファイル名2>	ファイル名変更
					{
						const oldFilename = this.#parseFilename(ctx, this.#commandBuffer);
						if(!this.#checkResult(ctx, oldFilename)) { return; }
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
						if(this.#commandBuffer[0] != 0x3A) { // ':'
							this.#doError(ctx, SOSErrorCode.SyntaxError);
							return;
						}
						this.#commandBuffer.shift();
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
						const newFilename = this.#parseFilename(ctx, this.#commandBuffer);
						if(!this.#checkResult(ctx, newFilename)) { return; }
						// ディレクトリのレコード
						const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
						// リネーム
						const result = ctx.Rename(oldFilename.deviceName, dirRecord,
							oldFilename.filename, oldFilename.extension,
							newFilename.filename, newFilename.extension
						);
						if(!this.#checkResult(ctx, result)) { return; }
						this.changeState(this.#state_start);
						return;
					}

					// S <ファイル名>:<開始アドレス>:<終了アドレス>[:<実行アドレス>]	ファイルセーブ
					// ST <ファイル名>:P または :R	ライトプロテクトのON/OFF
				case 0x53:
					{
						if(this.#commandBuffer[0] == 0x54) { // 'ST'
							this.#commandBuffer.shift();
							const filename = this.#parseFilename(ctx, this.#commandBuffer);
							if(!this.#checkResult(ctx, filename)) { return; }
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							if(this.#commandBuffer[0] != 0x3A) { // ':'
								this.#doError(ctx, SOSErrorCode.SyntaxError);
								return;
							}
							this.#commandBuffer.shift();
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							if(this.#commandBuffer[0] == 0x50) { // 'P'
								// ディレクトリのレコード
								const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
								// ライトプロテクト設定
								const result = ctx.SetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
								if(!this.#checkResult(ctx, result)) { return; }
							} else if(this.#commandBuffer[0] == 0x52) { // 'R'
								// ディレクトリのレコード
								const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
								// ライトプロテクト解除
								const result = ctx.ResetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
								if(!this.#checkResult(ctx, result)) { return; }
							} else {
								this.#doError(ctx, SOSErrorCode.SyntaxError);
								return;
							}
							this.changeState(this.#state_start);
							return;
						} else { // 'S'
							// ファイル名
							const filename = this.#parseFilename(ctx, this.#commandBuffer);
							if(!this.#checkResult(ctx, filename)) { return; }
							if(this.#commandBuffer[0] != 0x3A) { // ':'
								this.#doError(ctx, SOSErrorCode.SyntaxError);
								return;
							}
							this.#commandBuffer.shift();
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							const saveAddress = this.#parseHex4(this.#commandBuffer);
							if(!this.#checkResult(ctx, saveAddress)) { return; }
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							if(this.#commandBuffer[0] != 0x3A) { // ':'
								this.#doError(ctx, SOSErrorCode.SyntaxError);
								return;
							}
							this.#commandBuffer.shift();
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							const endAddress = this.#parseHex4(this.#commandBuffer);
							if(!this.#checkResult(ctx, endAddress)) { return; }
							// 空白スキップ
							while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
							let execAddress = saveAddress;
							if(this.#commandBuffer[0] == 0x3A) { // ':'
								this.#commandBuffer.shift();
								// 空白スキップ
								while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
								execAddress = this.#parseHex4(this.#commandBuffer);
								if(!this.#checkResult(ctx, execAddress)) { return; }
							}
							// 値をチェック
							if(saveAddress.value >= endAddress.value) {
								this.#doError(ctx, SOSErrorCode.SyntaxError);
								return;
							}
							if(saveAddress.value > execAddress.value || execAddress.value > endAddress.value) {
								this.#doError(ctx, SOSErrorCode.SyntaxError);
								return;
							}
							// データを準備する
							const dataSize = endAddress.value - saveAddress.value + 1;
							const data = new Uint8Array(dataSize);
							for(let i = 0; i < dataSize; ++i) {
								data[i] = ctx.z80Emu.memReadU8(saveAddress.value + i);
							}
							// ディレクトリのレコード
							const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
							// 属性
							const fileMode = 0x01; // BIN
							// セーブ
							const result = ctx.WriteFile(filename.deviceName, dirRecord,
								filename.filename, filename.extension, data,
								saveAddress.value, endAddress.value, execAddress.value,
								fileMode
							);
							if(!this.#checkResult(ctx, result)) { return; }
							this.changeState(this.#state_start);
							return;
						}
					}

					// W	桁数変更
				case 0x57:
					this.#W_Command(ctx);
					this.changeState(this.#state_start);
					return;

					// !	ブート
				case 0x21:
					{
						// 飛び先設定
						ctx.monitorCommandJump(0x0000); // #COLD
						// モニタ終了
						this.changeState(this.#state_end);
						return;
					}

					//  <ファイル名>	空白+ファイル名で、そのファイルをロードして実行します。テキストファイルの場合はバッチファイルと見なされます (テープは256バイトまで)。
				case 0x20:
					{
						// 空白スキップ
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
						// ファイル名
						const filename = this.#parseFilename(ctx, this.#commandBuffer);
						if(!this.#checkResult(ctx, filename)) { return; }

						// ディレクトリのレコード
						const dirRecord = ctx.z80Emu.memReadU8(SOSWorkAddr.DIRPS);
						// 読み込む
						let result = ctx.ReadFile(filename.deviceName, dirRecord, filename.filename, filename.extension);
						if(!this.#checkResult(ctx, result)) { return; }
						if(SOSInfomationBlock.isBinaryFile(result.attribute)) {
							// バイナリファイル
							// 読み込んだデータをメモリにコピー
							const address = result.loadAddress;
							for(let i = 0; i < result.value.length; ++i) {
								ctx.z80Emu.memWriteU8(address + i, result.value[i]);
							}
							// 飛び先設定
							ctx.monitorCommandJump(result.execAddress);
							// モニタ終了
							this.changeState(this.#state_end);
						} else {
							// @todo アスキーファイルの処理の実装
							ctx.ERROR(SOSErrorCode.ReservedFeature); // 未実装...
							ctx.PRINT(this.#keyCodeCR);
							this.changeState(this.#state_start);
						}
						return;
					}

					// P	ポーズ
				case 0x50:
					{
						// 止まったよメッセージ表示
						ctx.printNativeMsg("HIT KEY\n");
						// キーバッファをクリア
						ctx.keyMan.keyBufferClear();
						// 解除待ちへ遷移
						this.changeState(this.#state_pause_wait);
						return;
					}
			}
			ctx.ERROR(SOSErrorCode.SyntaxError);
			ctx.PRINT(this.#keyCodeCR);
			this.changeState(this.#state_start);
		};
		this.#state[this.#state_pause_wait] = (ctx)=>{
			// PAUSE待ち処理
			let key = Number(ctx.keyMan.inKey());
			if(isNaN(key)) { key = 0; }
			if(key) {
				// 何か押された
				this.changeState(this.#state_start);
				if(key == 0x1B) {
					// ブレイクキー押された
					// @todo バッチ処理中断
				}
				// 念のためキーバッファをクリアしておく
				ctx.keyMan.keyBufferClear();
				return;
			}
		};
		this.#state[this.#state_end] = (ctx)=>{};

		this.#stateNo = this.#state_idle;
		this.#commandBuffer = [];
	}

	/**
	 * 桁数変更コマンド
	 */
	#W_Command(ctx)
	{
		const width = ctx.z80Emu.memReadU8(SOSWorkAddr.WIDTH);
		const maxlin = ctx.z80Emu.memReadU8(SOSWorkAddr.MAXLIN);
		if(width <= 40) {
			ctx.z80Emu.memWriteU8(SOSWorkAddr.WIDTH, 80);
			ctx.changeScreenSize(80, maxlin);
		} else {
			ctx.z80Emu.memWriteU8(SOSWorkAddr.WIDTH, 40);
			ctx.changeScreenSize(40, maxlin);
		}
	}

	/**
	 * 
	 * @param {Array} text 
	 */
	#parseHex4(text)
	{
		if(text.length <= 0 || text[0] == 0 || text[0] == 0x20 || text[0] == 0x3A) {
			return {result: SOSErrorCode.SyntaxError, value: 0};
		}
		let value = 0;
		while(text.length > 0 && text[0] != 0 && text[0] != 0x20 && text[0] != 0x3A) {
			let num = this.#parseHex1(text.shift());
			if(num < 0) { return {result: SOSErrorCode.SyntaxError, value: 0}; }
			value <<= 4;
			value |= num; 
		}
		return {result: 0, value: value & 0xFFFF};
	}
	/**
	 * 
	 * @param {number} ch 
	 * @returns {number}
	 */
	#parseHex1(ch)
	{
		if(0x30 <= ch && ch <= 0x39) {
			return ch - 0x30; // 0-9
		} else if(0x41 <= ch && ch <= 0x46) {
			return ch - 0x41 + 10 // A-F
		} else if(0x61 <= ch && ch <= 0x66) {
			return ch - 0x61 + 10 // a-f
		}
		return -1;
	}

	/**
	 * 
	 * @param {Array} text 
	 */
	#parseFilename(ctx, text)
	{
		let deviceName = ctx.z80Emu.memReadU8(SOSWorkAddr.DSK);
		const filename = new Uint8Array(13);
		filename.fill(0x20);
		const extension = new Uint8Array(3);
		extension.fill(0x20);
		// 空白をスキップ
		while(text[0] == 0x20) { text.shift(); }
		// デバイス名（A～D）
		if(text[1] == 0x3A) { // ":"
			const device = text[0];
			if(0x61 <= device && device <= 0x64) { // a～d
				deviceName = device - 0x20;
				text.shift();
				text.shift();
			} else if(0x41 <= device && device <= 0x44) { // A～D
				deviceName = device;
				text.shift();
				text.shift();
			}
		}
		// ファイル名
		for(let i = 0; i < 13; ++i) {
			const ch = text[0];
			if(ch == 0 || ch == 0x2E || ch == 0x3A) { break; } // "." ":"
			if(ch != 0x0D) {
				filename[i] = ch;
			}
			text.shift();
		}
		// スキップ
		while(true) {
			const ch = text[0];
			if(ch == 0 || ch == 0x2E || ch == 0x3A) { // "." ":"
				break;
			}
			text.shift();
		}
		// 拡張子
		if(text[0] == 0x2E) { // "."
			text.shift();
			for(let i = 0; i < 3; ++i) {
				const ch = text[0];
				if(ch == 0 || ch == 0x3A) { break; } // ":"
				if(ch != 0x0D) {
					extension[i] = ch;
				}
				text.shift();
			}
		}
		// スキップ
		while(text[0] != 0x3A && text[0] != 0) {
			text.shift();
		}
		return {result: 0, deviceName: deviceName, filename: filename, extension: extension};
	}

	/**
	 * 更新処理
	 * @param {*} ctx 
	 */
	update(ctx) { this.#state[this.#stateNo](ctx); }
	/**
	 * 開始する
	 * @param {*} ctx 
	 */
	start() { this.changeState(this.#state_start); }
	/**
	 * 状態遷移する
	 * @param {number} stateNo 遷移する状態
	 */
	changeState(stateNo) { this.#stateNo = stateNo; }
	/**
	 * 動作中かどうか
	 * @returns {boolean} 動作中なら true を返す
	 */
	isActive() { return this.#stateNo != this.#state_idle; }
	/**
	 * 完了したかどうか
	 * @returns {boolean} 完了していたら true を返す
	 */
	isFinished() { return this.#stateNo == this.#state_end; }
}