"use strict";

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

	/**
	 * コマンドで入力された１行
	 * @type {Array}
	 */
	#commandBuffer;

	/**
	 * バッチファイル実行中かどうか
	 * @type {boolean}
	 */
	#runningBatch = false;
	/**
	 * バッチファイルの中身
	 * @type {Array}
	 */
	#batchBuffer = new Array();

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
	 * コマンド入力待ち状態
	 * @type {number}
	 */
	#state_input_wait = 2;
	/**
	 * コマンド処理状態
	 * @type {number}
	 */
	#state_command = 3;
	/**
	 * ポーズ待ち状態
	 * @type {number}
	 */
	#state_pause_wait = 4;
	/**
	 * プラットフォームモニタ完了待ち
	 * @type {number}
	 */
	#state_platform_monitor_wait = 5;
	/**
	 * 完了状態
	 * @type {number}
	 */
	#state_end = 6;

	#keyCodeBRK = 0x1B; // Breakキー
	#keyCodeCR = 0x0D; // Enterキー

	/**
	 * エラーコードを表示して、コマンド入力状態に遷移する
	 * @param {TaskContext} ctx 
	 * @param {number} errorCode エラーコード
	 * @returns {boolean} エラーなのでfalseを返す。
	 */
	#doError(ctx, errorCode)
	{
		// エラーコードを表示
		ctx.ERROR(errorCode);
		ctx.PRINT(this.#keyCodeCR);
		// コマンド入力状態に遷移
		this.changeState(this.#state_start);
		// エラーなので常にfalseを返す
		return false;
	}
	/**
	 * 色々な結果を評価して、エラーならエラー処理をする  
	 * エラーの時は、コマンド入力状態に遷移する。
	 * @param {TaskContext} ctx 
	 * @param {*} res 色々な処理結果
	 * @returns {boolean} エラーなら false を返す
	 */
	#checkResult(ctx, res)
	{
		if(res.result != 0) { return this.#doError(ctx, res.result); }
		return true;
	}

	/**
	 * 桁数変更コマンド
	 * @param {TaskContext} ctx 
	 */
	W_Command(ctx)
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
	 * 16進4桁を整数値に変換する
	 * @param {Array} text 変換する値
	 * @returns {{
	 * 		result: number,	// エラーコード
	 * 		value: number	// 変換された値
	 * }}
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
	 * 16進1桁を整数値に変換する
	 * @param {number} ch 変換する値
	 * @returns {number} 変換された値。エラーなら-1を返す
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
	 * ファイル名をパースして、分解する
	 * @param {TaskContext} ctx 
	 * @param {Array} text ファイル名
	 * @returns {{
	 * 		result: number,			// エラーコード
	 * 		deviceName: number,		// デバイス名
	 * 		filename: Uint8Array,	// ファイル名
	 * 		extension: Uint8Array,	// 拡張子
	 *      text: Array				// ファイル名の後のテキスト位置。「:」または終端文字(0x00)の位置
	 * }}
	 */
	#parseFilename(ctx, text)
	{
		// デバイス名
		let deviceName = ctx.z80Emu.memReadU8(SOSWorkAddr.DSK);
		// ファイル名
		const filename = new Uint8Array(SOSInfomationBlock.filename_size);
		filename.fill(0x20);
		// 拡張子
		const extension = new Uint8Array(SOSInfomationBlock.extension_size);
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
		for(let i = 0; i < SOSInfomationBlock.filename_size; ++i) {
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
			for(let i = 0; i < SOSInfomationBlock.extension_size; ++i) {
				const ch = text[0];
				if(ch == 0 || ch == 0x3A) { break; } // ":"
				if(ch != 0x0D) {
					extension[i] = ch;
				}
				text.shift();
			}
		}
		// スキップ
		while(text[0] != 0x3A && text[0] != 0) { // ":"
			text.shift();
		}
		return {result: 0, deviceName: deviceName, filename: filename, extension: extension, text:text};
	}

	/**
	 * 小さい方を返す
	 * @param {number} a 値
	 * @param {number} b 値
	 * @returns {number} 小さい方
	 */
	#min(a,b) { return (a < b) ? a : b; }

	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#state = new Array();
		this.#state[this.#state_idle] = (ctx)=>{};
		this.#state[this.#state_start] = (ctx)=>{
			if(this.#runningBatch) {
				// バッチ実行中
				if(this.#batchBuffer.length > 0) {
					// バッチから１行取得
					this.#commandBuffer.length = 0
					this.#commandBuffer.push(0x23); // #
					while(this.#batchBuffer.length > 0) {
						let ch = this.#batchBuffer.shift();
						if(ch == 0x00 || ch == this.#keyCodeCR) {
							break;
						}
						this.#commandBuffer.push(ch);
					}
					this.#commandBuffer.push(0);
					// コマンド処理へ
					this.changeState(this.#state_command);
					return;
				} else {
					// バッチが終わった
					this.#runningBatch = false;
				}
			}
			if(!this.#runningBatch) {
				// バッチ処理中出なければ
				// プロンプト表示して
				ctx.PRINT(0x23); // #
				// ライン入力開始へ
				ctx.startLineInput();
				this.changeState(this.#state_input_wait);
			}
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
						// カーソル非表示にしてジャンプする
						ctx.setDisplayCursor(false);
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
						const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
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
						const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
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
					
				case 0x4D: // M	各機種のモニタ
					{
						// キーバッファをクリア
						ctx.keyMan.keyBufferClear();
						// プラットフォームモニタ開始
						ctx.taskPlatformMonitor.start(ctx);
						// 完了待ちへ遷移
						this.changeState(this.#state_platform_monitor_wait);
						return;
					}
					
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
						const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
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
								const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
								// ライトプロテクト設定
								const result = ctx.SetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
								if(!this.#checkResult(ctx, result)) { return; }
							} else if(this.#commandBuffer[0] == 0x52) { // 'R'
								// ディレクトリのレコード
								const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
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
							const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
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
					this.W_Command(ctx);
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

					//  <ファイル名>	空白+ファイル名で、そのファイルをロードして実行します。
					//  テキストファイルの場合はバッチファイルと見なされます (テープは256バイトまで)。
				case 0x20:
					{
						// 空白スキップ
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); }
						// ファイル名
						const filename = this.#parseFilename(ctx, this.#commandBuffer);
						if(!this.#checkResult(ctx, filename)) { return; }

						// ディレクトリのレコード
						const dirRecord = ctx.z80Emu.memReadU16(SOSWorkAddr.DIRPS);
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
							// DEレジスタに、ファイル名の後の「:」の次のアドレスを設定する
							const commandAddress = ctx.z80Emu.memReadU16(SOSWorkAddr.KBFAD);
							ctx.z80Emu.memWriteU8(commandAddress, 0);
							if(filename.text.length > 0) {
								if(filename.text[0] == 0x3A) { // ':'
									filename.text.shift();
								}
								let i = 0;
								for(; i < this.#min(filename.text.length, 255); ++i) {
									ctx.z80Emu.memWriteU8(commandAddress + i, filename.text[i]);
								}
								ctx.z80Emu.memWriteU8(commandAddress + i, 0);
							}
							ctx.z80Emu.setDE(commandAddress);
							// モニタ終了
							this.changeState(this.#state_end);
						} else if(SOSInfomationBlock.isAsciiFile(result.attribute)) {
							// アスキーファイル
							if(!this.#runningBatch) {
								// 読み込んだデータをバッチバッファへ
								this.#batchBuffer.length = 0;
								for(let i = 0; i < result.value.length; ++i) {
									this.#batchBuffer.push(result.value[i]);
								}
								// バッチ開始
								this.#runningBatch = true;
								this.changeState(this.#state_start);
							} else {
								// バッチ中に、読み込んだ
								// @todo どうするんじゃろ？
								ctx.ERROR(SOSErrorCode.ReservedFeature); // 未実装...
								ctx.PRINT(this.#keyCodeCR);
								this.changeState(this.#state_start);
							}
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

					// T
				case 0x54: // for dev & debug & test
					{
						// this.#runningBatch = true;
						// this.changeState(this.#state_start);
						// return;
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
				if(key == this.#keyCodeBRK) {
					// ブレイクキー押された
					// @todo バッチ処理中断
					this.#runningBatch = false;
				}
				// 念のためキーバッファをクリアしておく
				ctx.keyMan.keyBufferClear();
				return;
			}
		};
		this.#state[this.#state_platform_monitor_wait] = (ctx)=>{
			// プラットフォームモニタ完了待ち
			if(ctx.taskPlatformMonitor.isFinished()) {
				// プラットフォームモニタ終わらせる
				ctx.taskPlatformMonitor.end();
				// 念のためキーバッファをクリアしておく
				ctx.keyMan.keyBufferClear();
				// S-OS標準モニタ開始
				this.changeState(this.#state_start);
			}
		};
		this.#state[this.#state_end] = (ctx)=>{};

		this.#stateNo = this.#state_idle;
		this.#commandBuffer = [];

		// バッチを初期化
		this.#runningBatch = false;
		this.#batchBuffer.length = 0;
	}

	/**
	 * 強制的に指定されたアドレスへジャンプする
	 * @param {number} execAddress ジャンプするアドレス
	 */
	forceJump(ctx, execAddress)
	{
		// ライン入力中なら終了させる
		if(ctx.taskLineInput.isActive()) {
			ctx.endLineInput();
		}
		// プラットフォームモニタ中なら終了させる
		if(ctx.taskPlatformMonitor.isActive()) {
			ctx.taskPlatformMonitor.end();
		}
		// 念のためキーバッファをクリアしておく
		ctx.keyMan.keyBufferClear();
		// バッチを初期化
		this.#runningBatch = false;
		this.#batchBuffer.length = 0;
		// 飛び先設定
		ctx.monitorCommandJump(execAddress);
		// DEレジスタに空の文字列へのポインタを設定する
		const commandAddress = ctx.z80Emu.memReadU16(SOSWorkAddr.KBFAD);
		ctx.z80Emu.memWriteU8(commandAddress, 0);
		ctx.z80Emu.setDE(commandAddress);
		// カーソル非表示にしてジャンプする
		ctx.setDisplayCursor(false);
		// モニタ終了
		this.changeState(this.#state_end);
	}

	/**
	 * 更新処理
	 * @param {TaskContext} ctx 
	 */
	update(ctx) { this.#state[this.#stateNo](ctx); }
	/**
	 * 開始する
	 * @param {TaskContext} ctx 
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