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

	/**
	 * トランジェント機能
	 * @type {SOSTransient}
	 */
	#transient = new SOSTransient();

	/**
	 * コマンドで入力された１行
	 * @type {Array}
	 */
	#commandBuffer;

	/**
	 * プロンプトで表示する文字(アスキーコード)
	 * @type {number}
	 */
	#PromptCharacter = 0x23; // #

	/**
	 * RUNコマンドで実行されたかどうかのフラグ
	 * 
	 * RUNコマンド(スペース)で、バイナリファイルを実行した場合に、trueに設定。  
	 * S-OS #HOTで実行が完了したときに、このフラグをみて、戻り値でエラーを表示するかどうかを判定している。
	 * @type {boolean}
	 */
	#isRunCommand = false;

	/**
	 * Z80のメモリへデータを転送する
	 * @param {TaskContext} ctx 
	 * @param {number} z80DestinationAddress 転送先のアドレス
	 * @param {number[]} source 転送するデータ
	 */
	#copyToZ80Memory(ctx, z80DestinationAddress, source)
	{
		for(let i = 0; i < source.length; ++i) {
			ctx.z80Emu.memWriteU8(z80DestinationAddress + i, source[i]);
		}
	}

	/**
	 * ディレクトリのセクタ番号を取得する
	 * 
	 * @param {TaskContext} ctx 
	 * @param {number} deviceName デバイス(A～)
	 * @returns {number} ディレクトリのセクタ番号
	 */
	#getDirRecord(ctx, deviceName)
	{
		return ctx.GetDIRPS(deviceName);
	}

	/**
	 * 画面サイズを変更する
	 * @param {TaskContext} ctx 
	 */
	changeScreenSize(ctx, screenWidth, screenHeight)
	{
		ctx.z80Emu.memWriteU8(SOSWorkAddr.WIDTH, screenWidth);
		ctx.z80Emu.memWriteU8(SOSWorkAddr.MAXLIN, screenHeight);
		ctx.changeScreenSize(screenWidth, screenHeight);
	}

	/**
	 * 
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 */
	C_Command(ctx, commandLine)
	{
		ctx.changeFunction();
	}

	/**
	 * 桁数変更コマンド
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 */
	Width_Command(ctx, commandLine)
	{
		const width = ctx.z80Emu.memReadU8(SOSWorkAddr.WIDTH);
		const maxlin = ctx.z80Emu.memReadU8(SOSWorkAddr.MAXLIN);
		if(width <= 40) {
			this.changeScreenSize(ctx, 80, maxlin);
		} else {
			this.changeScreenSize(ctx, 40, maxlin);
		}
	}

	/**
	 * ブートコマンド
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 */
	Boot_Command(ctx, commandLine)
	{
		// 飛び先設定
		ctx.monitorCommandJump(0x0000); // #COLD
	}

	/**
	 * ジャンプコマンド
	 * 
	 * J <アドレス>	指定アドレス (16進数4桁) のコール
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 * @throws 変換に失敗した場合は、SOSErrorの例外を投げる。
	 */
	Jump_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// ジャンプ先取得
		try {
			const address = ParseHex4(commandLine); // 16進数4桁読み込み。失敗したら例外投げる。
			// 飛び先設定
			ctx.monitorCommandJump(address);
			// カーソル非表示にしてジャンプする
			ctx.setDisplayCursor(false);
		} catch(e) {
			if(e instanceof SOSError) {
				throw new SOSError(SOSErrorCode.SyntaxError);
			} else {
				throw e;
			}
		}
	}

	/**
	 * ロードコマンド
	 * 
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 * @throws 変換に失敗した場合は、SOSErrorの例外を投げる。
	 */
	Load_Command(ctx, commandLine)
	{
		/*
		LOAD
			ld	a,1
			call	_FILE
			ld	a,(de)
			or	a
			ld	(LDWORK+2),a
			jr	z,LOAD1
			inc	de
			call	_HLHEX
			jr	c,SNERR
			ld	(LDWORK),hl
		;
		LOAD1
			call	_ROPEN
			ret	c
			call	nz,SKPRT
			jr	nz,LOAD1
			call	_MPRNT
			db	"Loading ",00h
			call	_FPRNT
			call	_NL

			ld	a,(LDWORK+2)
			or	a
			jr	z,LOAD3
			ld	hl,(LDWORK)
			ld	(_DTADR),hl
		LOAD3
			jp	_RDD

		LDWORK	ds	3

		SKPRT
			push	af
			call	_MPRNT
			db	"Found   ",00h
			call	_FPRNT
			call	_NL
			pop	af
			ret
		*/
		// ファイル名
		const filename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		// ロードアドレス
		let isSetLoadAddress = false;
		let loadAddress;
		if(commandLine[0] == 0x3A) { // ':'
			commandLine.shift();
			try {
				loadAddress = ParseHex4(commandLine); // 16進数4桁読み込み。失敗したら例外投げる。
			} catch(e) {
				if(e instanceof SOSError) {
					throw new SOSError(SOSErrorCode.SyntaxError);
				} else {
					throw e;
				}
			}
			isSetLoadAddress = true;
		}
		// ディレクトリのレコード
		const dirRecord = this.#getDirRecord(ctx, filename.deviceName);
		// 読み込む
		const data = ctx.ReadFile(filename.deviceName, dirRecord, filename.filename, filename.extension);
		if(data.result != 0) {
			throw new SOSError(data.result);
		}
		ctx.printNativeMsg("Loading ");
		filename.filename.forEach(ch => ctx.PRINT(ch));
		ctx.PRINT(0x2E); // "."
		filename.extension.forEach(ch => ctx.PRINT(ch));
		ctx.PRINT(SOSKeyCode.CR);
		// メモリにコピー
		if(data.value != null) {
			const address = isSetLoadAddress ? loadAddress : data.loadAddress;
			for(let i = 0; i < data.value.length; ++i) {
				ctx.z80Emu.memWriteU8(address + i, data.value[i]);
			}
		}
	}

	/**
	 * 削除コマンド
	 * 
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 * @throws 変換に失敗した場合は、SOSErrorの例外を投げる。
	 */
	Kill_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// ファイル名
		const filename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		// ディレクトリのレコード
		const dirRecord = this.#getDirRecord(ctx, filename.deviceName);
		// ファイル削除
		const result = ctx.Kill(filename.deviceName, dirRecord, filename.filename, filename.extension);
		if(result.result != 0) {
			throw new SOSError(result.result);
		}
	}

	Name_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// ファイル名
		const oldFilename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		// コロン
		if(commandLine[0] != 0x3A) { // ':'
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
		commandLine.shift();
		// 新しいファイル名
		const newFilename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		// ディレクトリのレコード
		const dirRecord = this.#getDirRecord(ctx, oldFilename.deviceName);
		// リネーム
		const result = ctx.Rename(oldFilename.deviceName, dirRecord,
			oldFilename.filename, oldFilename.extension,
			newFilename.filename, newFilename.extension
		);
		if(result.result != 0) {
			throw new SOSError(result.result);
		}
	}

	/**
	 * モニタコマンド
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 */
	Monitor_Command(ctx, commandLine)
	{
		// キーバッファをクリア
		ctx.keyMan.keyBufferClear();
		// プラットフォームモニタ開始
		ctx.taskPlatformMonitor.start(ctx);
	}

	Set_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// ファイル名
		const filename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		if(commandLine[0] != 0x3A) { // ':'
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
		commandLine.shift();
		// 空白スキップ
		SpCut(commandLine);
		if(commandLine[0] == 0x50) { // 'P'
			// ディレクトリのレコード
			const dirRecord = this.#getDirRecord(ctx, filename.deviceName);
			// ライトプロテクト設定
			const result = ctx.SetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
			if(result.result != 0) {
				throw new SOSError(result.result);
			}
		} else if(commandLine[0] == 0x52) { // 'R'
			// ディレクトリのレコード
			const dirRecord = this.#getDirRecord(ctx, filename.deviceName);
			// ライトプロテクト解除
			const result = ctx.ResetWriteProtected(filename.deviceName, dirRecord, filename.filename, filename.extension);
			if(result.result != 0) {
				throw new SOSError(result.result);
			}
		} else {
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
	}

	Save_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// ファイル名
		const filename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		// コロン
		if(commandLine[0] != 0x3A) { // ':'
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
		commandLine.shift();
		// 開始アドレス
		let startAddress;
		try {
			startAddress = ParseHex4(commandLine); // 16進数4桁読み込み。失敗したら例外投げる。
		} catch(e) {
			if(e instanceof SOSError) {
				throw new SOSError(SOSErrorCode.SyntaxError);
			} else {
				throw e;
			}
		}
		let execAddress = startAddress;
		if(commandLine[0] == 0) {
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
		commandLine.shift();
		// 終了アドレス
		let endAddress;
		try {
			endAddress = ParseHex4(commandLine);
		} catch(e) {
			if(e instanceof SOSError) {
				throw new SOSError(SOSErrorCode.SyntaxError);
			} else {
				throw e;
			}
		}
		// セーブ範囲のチェック
		if(startAddress > endAddress) {
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
		const dataSize = endAddress - startAddress + 1;
		if(dataSize > 0xFFFF) {
			// @todo 64KiBのセーブができないのでエラーにしておく
			throw new SOSError(SOSErrorCode.BadData);
		}
		if(commandLine[0] != 0) {
			commandLine.shift();
			try {
				execAddress = ParseHex4(commandLine);
			} catch(e) {
				if(e instanceof SOSError) {
					// ここのエラーは無視する
				} else {
					throw e;
				}
			}
		}
		// データを準備する
		const data = new Uint8Array(dataSize);
		for(let i = 0; i < dataSize; ++i) {
			data[i] = ctx.z80Emu.memReadU8(startAddress + i);
		}
		// ディレクトリのレコード
		const dirRecord = this.#getDirRecord(ctx, filename.deviceName);
		// 属性
		const fileMode = 0x01; // BIN
		// セーブ
		const result = ctx.WriteFile(filename.deviceName, dirRecord,
			filename.filename, filename.extension, data,
			startAddress, endAddress, execAddress,
			fileMode
		);
		if(result.result != 0) {
			throw new SOSError(result.result);
		}
		ctx.printNativeMsg("Complete !\n");
	}

	DevSet_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// デバイス名
		if(commandLine[0] == 0) {
			throw new SOSError(SOSErrorCode.SyntaxError);
		}
		const deviceName = ToUpperCase(commandLine[0]);
		commandLine.shift();
		// デバイスチェック
		this.#devchk(deviceName); // 駄目だった場合、SOSErrorの例外を投げる。
		// 設定
		ctx.z80Emu.memWriteU8(SOSWorkAddr.DSK, deviceName);
	}

	Dir_Command(ctx, commandLine)
	{
		// 先頭の空白を取り除く
		SpCut(commandLine);
		// デバイス取得
		const deviceName = this.#getdev(ctx, commandLine);
		// ディレクトリのレコード
		const dirRecord = this.#getDirRecord(ctx, deviceName);
		const result = ctx.Files(deviceName, dirRecord);
		if(result.result != 0) {
			throw new SOSError(result.result);
		}
		ctx.PrintFiles(result);
	}

	
	Run_Command(ctx, commandLine, originalCommandLine)
	{
		SpCut(commandLine);	// 空白スキップ
		// ファイル名
		const filename = this.#parseFilename(ctx, commandLine); // 失敗した場合は、SOSErrorの例外を投げる。
		// 入力バッファへコマンドラインを反映させる
		this.#copyToKeyBuffer(ctx, originalCommandLine);
		// DEレジスタに、ファイル名の後の「:」の次のアドレスを設定する
		if(commandLine[0] != 0) { commandLine.shift(); }
		const pos = originalCommandLine.length - commandLine.length; // 元々のから現在のを引いて、位置を出す
		ctx.z80Emu.setDE(ctx.z80Emu.memReadU16(SOSWorkAddr.KBFAD) + pos);
		// ファイルを読み込む
		const dirRecord = this.#getDirRecord(ctx, filename.deviceName); // ディレクトリのレコード
		const result = ctx.ReadFile(filename.deviceName, dirRecord, filename.filename, filename.extension);
		if(result.result != 0) {
			throw new SOSError(result.result); // エラーなのでSOSErrorの例外を投げる。
		}
		// 読み込んだファイルの属性で処理をわける
		if(SOSInfomationBlock.isBinaryFile(result.attribute)) {
			// バイナリファイル
			// トランジェントへ退避
			this.#transient.save(ctx, result.loadAddress, result.value.length);
			// 読み込んだデータをZ80のメモリにコピー
			this.#copyToZ80Memory(ctx, result.loadAddress, result.value);
			// 飛び先設定
			ctx.monitorCommandJump(result.execAddress);
			// スタック設定
			// ctx.z80Emu.setSP(ctx.z80Emu.memReadU16(SOSWorkAddr.STKAD));
			//
			this.#isRunCommand = true;
			return 0x1;
		} else if(SOSInfomationBlock.isAsciiFile(result.attribute)) {
			// アスキーファイル
			ctx.batchManager.start(result.value, commandLine);
			return 0x4;
		} else {
			throw new SOSError(SOSErrorCode.BadFileMode); // エラーなのでSOSErrorの例外を投げる。
		}
	}



	/**
	 * ポーズコマンド
	 * 
	 * @param {TaskContext} ctx 
	 * @param {Array} commandLine コマンド
	 * @throws 変換に失敗した場合は、SOSError(SOSErrorCode.BadData)の例外を投げる。
	 */
	Pause_Command(ctx, commandLine)
	{
		// 止まったよメッセージ表示
		ctx.printNativeMsg("HIT KEY\n");
		// キーバッファをクリア
		ctx.keyMan.keyBufferClear();
	}


	#getdev(ctx, text)
	{
		// 空白をスキップ
		SpCut(text);
		// デバイス名
		if((text.length >= 2) && (text[1] == 0x3A)) { // ":"
			const deviceName = ToUpperCase(text[0]);
			text.shift();
			text.shift();
			return deviceName;
		} else {
			return ctx.z80Emu.memReadU8(SOSWorkAddr.DSK);
		}
	}

	/**
	 * デバイス名をチェックする
	 * @param {number} deviceName デバイス名の文字
	 * @throws 駄目だった場合、SOSErrorの例外を投げる。
	 */
	#devchk(deviceName)
	{
		// デバイスチェック
		if(0x41 <= deviceName && deviceName <= 0x45) { // A～E
			// OK
		} else if(0x46 <= deviceName && deviceName <= 0x4C) { // F～L
			throw new SOSError(SOSErrorCode.ReservedFeature);
		} else if(0x51 == deviceName || 0x53 == deviceName || 0x54 == deviceName) { // Q S T
			// 未対応
			throw new SOSError(SOSErrorCode.ReservedFeature);
		} else {
			// 不正
			throw new SOSError(SOSErrorCode.BadAllocationTable);
		}
	}

	/**
	 * ファイル名をパースして、分解する
	 * @param {TaskContext} ctx 
	 * @param {Array} text ファイル名
	 * @returns {{
	 * 		deviceName: number,		// デバイス名
	 * 		filename: Uint8Array,	// ファイル名
	 * 		extension: Uint8Array,	// 拡張子
	 * }}
	 * @throws 失敗した場合は、SOSErrorの例外を投げる。
	 */
	#parseFilename(ctx, text)
	{
		// ファイル名
		const filename = new Uint8Array(SOSInfomationBlock.filename_size);
		filename.fill(0x20);
		// 拡張子
		const extension = new Uint8Array(SOSInfomationBlock.extension_size);
		extension.fill(0x20);
		// デバイス名
		const deviceName = this.#getdev(ctx, text);
		// デバイスチェック
		this.#devchk(deviceName); // 駄目だった場合、SOSErrorの例外を投げる。
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
		return {deviceName: deviceName, filename: filename, extension: extension};
	}

	/**
	 * キーボードバッファへ配列をコピーする
	 * @param {Array} text コピーする配列
	 */
	#copyToKeyBuffer(ctx, text)
	{
		let commandAddress = ctx.z80Emu.memReadU16(SOSWorkAddr.KBFAD);
		text.forEach(element => { ctx.z80Emu.memWriteU8(commandAddress++, element); });
	}


	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#state = new Array();
		this.#state[this.#state_idle] = (ctx)=>{};
		this.#state[this.#state_start] = (ctx)=>{
			// =========================================================================
			// トランジェント
			// =========================================================================
			this.#transient.load(ctx); // トランジェントで保存された物があれば復帰する
			this.#transient.clear(ctx); // トランジェントをクリア

			// =========================================================================
			// RUNコマンド
			// =========================================================================
			ctx.NL(); // カーソルが先頭になければ改行
			// RUNコマンドで実行されていたコマンドから戻ってきたときのエラー処理
			if(ctx.batchManager.isActive() && this.#isRunCommand) {
				if(ctx.z80Emu.getCY()) {
					// キャリーフラグが立ってたらエラー
					ctx.ERROR(ctx.z80Emu.getA());
					ctx.PRINT(SOSKeyCode.CR);
					// エラーが発生したのでバッチ処理を停止する
					ctx.batchManager.stop();
				}
			}
			this.#isRunCommand = false;

			// =========================================================================
			// バッチ処理
			// =========================================================================
			// メモ）ライン入力で処理されるので、不要

			// =========================================================================
			// 通常処理
			// =========================================================================
			// プロンプト表示して
			ctx.PRINT(this.#PromptCharacter);
			// ライン入力開始して
			ctx.startLineInput();
			// ライン入力待ちへ遷移
			this.changeState(this.#state_input_wait);
		};

		// ライン入力待ち
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

		// @todo commandと纏めること！
		this.#state[this.#state_command] = (ctx)=>{
			// 後々使用するのでコマンドラインを複製しておく
			const originalCommandLine = [...this.#commandBuffer];
			// コマンドプロンプトがあるかチェック
			if((this.#commandBuffer.length <= 0) || (this.#commandBuffer[0] != this.#PromptCharacter)) {
				// なかったら処理しない
				this.changeState(this.#state_start);
				return;
			}
			this.#commandBuffer.shift();
			// 各種コマンド処理
			try {
				switch(this.#commandBuffer.shift()) {
					case 0x00: // コマンドプロンプトだけだった
					case 0x3B: // ; REM COMMAND
						this.changeState(this.#state_start);
						return;
					case 0x21: // !	ブート
						this.Boot_Command(ctx, this.#commandBuffer);
						// モニタ終了
						this.changeState(this.#state_end);
						return;
					case 0x4A: // J <アドレス>	指定アドレス (16進数4桁) のコール
						this.Jump_Command(ctx, this.#commandBuffer);
						// 入力バッファへコマンドラインを反映させる
						this.#copyToKeyBuffer(ctx, originalCommandLine);
						// DEレジスタに、<アドレス>の次のアドレスを設定する
						// 例) "#J3000:hogehoge"だったら、「:」のアドレス
						{
							const pos = originalCommandLine.length - this.#commandBuffer.length;
							const commandAddress = ctx.z80Emu.memReadU16(SOSWorkAddr.KBFAD);
							ctx.z80Emu.setDE(commandAddress + pos);
						}
						// モニタ終了
						this.changeState(this.#state_end);
						return;
					case 0x4C: // L <ファイル名>[:<アドレス>]		ファイルロード
						this.Load_Command(ctx, this.#commandBuffer);
						return;
					case 0x4B: // K <ファイル名>					ファイル消去
						this.Kill_Command(ctx, this.#commandBuffer);
						return;
					case 0x4E: // N <ファイル名1>:<ファイル名2>	ファイル名変更
						this.Name_Command(ctx, this.#commandBuffer);
						return;
					case 0x4D: // M	各機種のモニタ
						this.Monitor_Command(ctx, this.#commandBuffer);
						// 完了待ちへ遷移
						this.changeState(this.#state_platform_monitor_wait);
						return;
					case 0x57: // W	桁数変更
						this.Width_Command(ctx, this.#commandBuffer);
						return;
					case 0x53: // S,ST
						if(ToUpperCase(this.#commandBuffer[0]) == 0x54) {
							this.#commandBuffer.shift();
							// ST <ファイル名>:P または :R	ライトプロテクトのON/OFF
							this.Set_Command(ctx, this.#commandBuffer);
						} else {
							// S <ファイル名>:<開始アドレス>:<終了アドレス>[:<実行アドレス>]	ファイルセーブ
							this.Save_Command(ctx, this.#commandBuffer);
						}
						return;
					case 0x44: // D,DV
						if(ToUpperCase(this.#commandBuffer[0]) == 0x56) {
							this.#commandBuffer.shift();
							// DV <デバイス名>:					デフォルトデバイス変更 (ディスクからの起動時はA、テープからの起動時はS)
							this.DevSet_Command(ctx, this.#commandBuffer);
						} else {
							// D [<デバイス名>:]				ディレクトリ表示
							this.Dir_Command(ctx, this.#commandBuffer);
						}
						return;
					case 0x20: // RUN COMMAND
						//  <ファイル名>	空白+ファイル名で、そのファイルをロードして実行します。
						//  テキストファイルの場合はバッチファイルと見なされます (テープは256バイトまで)。
						if(this.Run_Command(ctx, this.#commandBuffer, originalCommandLine) == 0x01) {
							// バイナリファイルを実行したので、モニタを終了する
							this.changeState(this.#state_end);
						} else {
							// アスキーファイルを実行したので、入力に遷移する
							this.changeState(this.#state_start);
						}
						return;
					case 0x50: // P	ポーズ
						this.Pause_Command(ctx, this.#commandBuffer);
						// 解除待ちへ遷移
						this.changeState(this.#state_pause_wait);
						return;
					case 0x43: // Cコマンド
						this.C_Command(ctx, this.#commandBuffer);
						this.changeState(this.#state_start);
						return;
					default:
						throw new SOSError(SOSErrorCode.SyntaxError); // シンタックスエラー
				}
			} catch(e) {
				if(e instanceof SOSError) {
					// S-OSのエラー
					// エラーを表示
					ctx.ERROR(e.GetSOSErrorCode());
					ctx.PRINT(SOSKeyCode.CR);
				} else {
					// その他のエラー
					ctx.printNativeMsg(e.name + ': ' + e.message + '\n' + e.stack);
				}
				// 入力に遷移
				this.changeState(this.#state_start);
			}
		};
		this.#state[this.#state_pause_wait] = (ctx)=>{
			// PAUSE待ち処理
			let key = Number(ctx.keyMan.inKey());
			if(isNaN(key)) { key = 0; }
			if(key) {
				// 何か押された
				this.changeState(this.#state_start);
				if(key == SOSKeyCode.BRK) {
					// ブレイクキー押された
					// バッチ処理を停止する
					ctx.batchManager.stop();
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

		this.#isRunCommand = false;
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
		ctx.batchManager.clear();
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
	 * コマンドを実行する
	 * @param {*} ctx 
	 * @param {number[]} commandBuffer
	 */
	executeCommand(ctx, commandBuffer)
	{
		// 後々使用するのでコマンドラインを複製しておく
		const originalCommandLine = [...commandBuffer];
		// コマンドプロンプトがあるかチェック
		if(commandBuffer.length <= 0 || commandBuffer[0] != this.#PromptCharacter) {
			return;
		}
		commandBuffer.shift(); // '#'

		switch(commandBuffer.shift()) {
			case 0x00: // コマンドプロンプトだけだった
			case 0x3B: // ; REM COMMAND
				//this.changeState(this.#state_start);
				return;
			case 0x21: // !	ブート
				this.Boot_Command(ctx, this.#commandBuffer);
				// モニタ終了
				//this.changeState(this.#state_end);
				return;
			case 0x4A: // J <アドレス>	指定アドレス (16進数4桁) のコール
				this.Jump_Command(ctx, this.#commandBuffer);
				// 入力バッファへコマンドラインを反映させる
				this.#copyToKeyBuffer(ctx, originalCommandLine);
				// DEレジスタに、<アドレス>の次のアドレスを設定する
				// 例) "#J3000:hogehoge"だったら、「:」のアドレス
				{
					const pos = originalCommandLine.length - this.#commandBuffer.length;
					const commandAddress = ctx.z80Emu.memReadU16(SOSWorkAddr.KBFAD);
					ctx.z80Emu.setDE(commandAddress + pos);
				}
				// モニタ終了
				//this.changeState(this.#state_end);
				return;
			case 0x4C: // L <ファイル名>[:<アドレス>]		ファイルロード
				this.Load_Command(ctx, this.#commandBuffer);
				return;
			case 0x4B: // K <ファイル名>					ファイル消去
				this.Kill_Command(ctx, this.#commandBuffer);
				return;
			case 0x4E: // N <ファイル名1>:<ファイル名2>	ファイル名変更
				this.Name_Command(ctx, this.#commandBuffer);
				return;
			case 0x4D: // M	各機種のモニタ
				this.Monitor_Command(ctx, this.#commandBuffer);
				// 完了待ちへ遷移
				//this.changeState(this.#state_platform_monitor_wait);
				return;
			case 0x57: // W	桁数変更
				this.Width_Command(ctx, this.#commandBuffer);
				return;
			case 0x53: // S,ST
				if(ToUpperCase(this.#commandBuffer[0]) == 0x54) {
					this.#commandBuffer.shift();
					// ST <ファイル名>:P または :R	ライトプロテクトのON/OFF
					this.Set_Command(ctx, this.#commandBuffer);
				} else {
					// S <ファイル名>:<開始アドレス>:<終了アドレス>[:<実行アドレス>]	ファイルセーブ
					this.Save_Command(ctx, this.#commandBuffer);
				}
				return;
			case 0x44: // D,DV
				if(ToUpperCase(this.#commandBuffer[0]) == 0x56) {
					this.#commandBuffer.shift();
					// DV <デバイス名>:					デフォルトデバイス変更 (ディスクからの起動時はA、テープからの起動時はS)
					this.DevSet_Command(ctx, this.#commandBuffer);
				} else {
					// D [<デバイス名>:]				ディレクトリ表示
					this.Dir_Command(ctx, this.#commandBuffer);
				}
				return;
			case 0x20: // RUN COMMAND
				//  <ファイル名>	空白+ファイル名で、そのファイルをロードして実行します。
				//  テキストファイルの場合はバッチファイルと見なされます (テープは256バイトまで)。
				if(this.Run_Command(ctx, this.#commandBuffer, originalCommandLine) == 0x01) {
					// バイナリファイルを実行したので、モニタを終了する
					//this.changeState(this.#state_end);
				} else {
					// アスキーファイルを実行したので、入力に遷移する
					//this.changeState(this.#state_start);
				}
				return;
			case 0x50: // P	ポーズ
				this.Pause_Command(ctx, this.#commandBuffer);
				// 解除待ちへ遷移
				//this.changeState(this.#state_pause_wait);
				return;
			default:
				throw new SOSError(SOSErrorCode.SyntaxError); // シンタックスエラー
		}
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