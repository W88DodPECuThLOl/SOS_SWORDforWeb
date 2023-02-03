"use strict";

/**
 * S-OSプラットフォームモニタのタスク
 */
class TaskPlatformMonitor {
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
	 * 完了状態
	 * @type {number}
	 */
	#state_end = 5;
	/**
	 * メモリ書き換えの入力待ち
	 * @type {number}
	 */
	#state_memory_write_wait = 6;
	#state_memory_write_exec = 7;

	#dumpAddress = 0x0000;

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
	 * 16進4桁を整数値に変換する
	 * @param {Array} text 変換する値
	 * @returns {{
	 * 		result: number	// エラーコード
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
	 * ヘルプを表示する
	 * 
	 * @param {TaskContext} ctx 
	 */
	#printHelpMessage(ctx) {
		ctx.printNativeMsg(` ?          help
 Q          quit
 D [xxxx]   Dump memory from $xxxx
 S xxxx     Edit memory at $xxxx
 W          Width change
 FNT <FMAP> Font change
    ex.) FNT PC8001
         FNT PC8001p
         FNT X1
         FNT X1p
         FNT SOS
`);
	}

	/**
	 * メモリ内容を表示する
	 * 
	 * @param {TaskContext} ctx 
	 * @param {number} dumpAddress メモリの開始アドレス
	 * @returns {number} 次に表示するメモリのアドレス
	 */
	#dumpMemory(ctx, dumpAddress)
	{
		const width = ctx.z80Emu.memReadU8(SOSWorkAddr.WIDTH);
		let startAddress = dumpAddress;
		dumpAddress = (dumpAddress + ((width <= 40) ? 0x80 : 0x100)) & 0xFFFF;
		let endAddress = startAddress + ((width <= 40) ? 0x80 : 0x100);
		let address = startAddress & 0xFFF0;
		while(address < endAddress) {
			ctx.printNativeMsg((address & 0xFFFF).toString(16).padStart(4, 0).toUpperCase() + ":");
			for(let i = 0; i < ((width <= 40) ? 8 : 16); ++i) {
				if(startAddress <= address && address < endAddress) {
					ctx.printNativeMsg((ctx.z80Emu.memReadU8(address & 0xFFFF)).toString(16).padStart(2, 0).toUpperCase());
				} else {
					ctx.printNativeMsg("  ");
				}
				if((width > 40) && i == 7) {
					ctx.printNativeMsg("-");
				} else {
					ctx.printNativeMsg(" ");
				}
				address++;
			}
			ctx.PRINT(0x0D);
		}
		return dumpAddress;
	}

	#writeMemory(ctx, address)
	{
		const mem = ctx.z80Emu.memReadU8(address & 0xFFFF);
		ctx.printNativeMsg(
			"+" + (address & 0xFFFF).toString(16).padStart(4, 0).toUpperCase() + ":"
			 + (mem).toString(16).padStart(2, 0).toUpperCase() + " -> ");
		// ライン入力開始へ
		ctx.startLineInput();
		this.#dumpAddress = mem;
		this.changeState(this.#state_memory_write_wait);
	}
		
	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#state = new Array();
		this.#state[this.#state_idle] = (ctx)=>{};
		this.#state[this.#state_start] = (ctx)=>{
			// プロンプト表示して
			ctx.PRINT(0x3E); // >
			// ライン入力開始へ
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
				|| this.#commandBuffer[0] != 0x3E // >
				|| this.#commandBuffer[0] == 0) {
				this.changeState(this.#state_start);
				return;
			}
			this.#commandBuffer.shift(); // '>'
			// コマンド
			switch(this.#commandBuffer.shift()) {
				case 0x00:
					this.changeState(this.#state_start);
					return;
				case 0x3F: // '?'
					this.#printHelpMessage(ctx);
					this.changeState(this.#state_start);
					return;
				case 0x51: // 'Q'
				case 0x71:
					this.changeState(this.#state_end);
					return;
				case 0x44: // 'D'
				case 0x64:
					{
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
						if(this.#commandBuffer[0] != 0x00) {
							const result = this.#parseHex4(this.#commandBuffer);
							if(!this.#checkResult(ctx, result)) { return; }
							this.#dumpAddress = result.value & 0xFFFF;
						}
						this.#dumpAddress = this.#dumpMemory(ctx, this.#dumpAddress);
						return;
					}
				case 0x53: // 'S'
				case 0x73:
					{
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
						if(this.#commandBuffer[0] != 0x00) {
							const result = this.#parseHex4(this.#commandBuffer);
							if(!this.#checkResult(ctx, result)) { return; }
							this.#dumpAddress = result.value & 0xFFFF;
						} else {
							this.#doError(ctx, SOSErrorCode.SyntaxError);
							return;
						}
						ctx.printNativeMsg("memory edit [break(ESC) key: exit]\n");
						this.#writeMemory(ctx, this.#dumpAddress);
						return;
					}

				case 0x57: // W	桁数変更
				case 0x77:
					// スクリーンサイズ変更
					ctx.taskMonitor.W_Command(ctx);
					this.changeState(this.#state_start);
					return;
				case 0x46: // FNT フォント切り替え
				case 0x66:
					if(this.#commandBuffer.length >= 2
						&& (this.#commandBuffer[0] == 0x4E || this.#commandBuffer[0] == 0x6E)
						&& (this.#commandBuffer[1] == 0x54 || this.#commandBuffer[1] == 0x74)) {
						this.#commandBuffer.shift();
						this.#commandBuffer.shift();
						while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
						ctx.changeFont(this.#commandBuffer);
					}
					this.changeState(this.#state_start);
					return;
			}
			ctx.ERROR(SOSErrorCode.SyntaxError);
			ctx.PRINT(this.#keyCodeCR);
			this.changeState(this.#state_start);
		};
		this.#state[this.#state_end] = (ctx)=>{};
		this.#state[this.#state_memory_write_wait] = (ctx)=>{
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
			// メモリ書き換え
			this.changeState(this.#state_memory_write_exec);
		};
		this.#state[this.#state_memory_write_exec] = (ctx)=>{
			let address = this.#dumpAddress & 0xFFFF;
			if(!this.#commandBuffer) {
				this.#writeMemory(ctx, address);
				return;
			}
			if(this.#commandBuffer[0] == this.#keyCodeBRK) {
				ctx.PRINT(0xD);
				this.changeState(this.#state_start);
				return;
			}
			if(this.#commandBuffer.length <= 11
				|| this.#commandBuffer[0] != 0x2B // +
				|| this.#commandBuffer[0] == 0) {
				ctx.PRINT(0xD);
				this.#writeMemory(ctx, address);
				return;
			}
			this.#commandBuffer.shift();
			// アドレス取得
			while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
			if(this.#commandBuffer[0] == 0x00) {
				ctx.PRINT(0xD);
				this.#writeMemory(ctx, address);
				return;
			}
			let result = this.#parseHex4(this.#commandBuffer);
			if(!this.#checkResult(ctx, result)) {
				ctx.PRINT(0xD);
				this.#writeMemory(ctx, address);
				return;
			}
			// 残りの文字チェック
			if(this.#commandBuffer.length <= 6
				|| this.#commandBuffer[0] != 0x3A // :
				|| this.#commandBuffer[3] != 0x20 // ' '
				|| this.#commandBuffer[4] != 0x2D // -
				|| this.#commandBuffer[5] != 0x3E // >
			) {
				ctx.PRINT(0xD);
				this.#writeMemory(ctx, address);
				return;
			}
			address = result.value & 0xFFFF;
			this.#commandBuffer.shift();
			this.#commandBuffer.shift();
			this.#commandBuffer.shift();
			this.#commandBuffer.shift();
			this.#commandBuffer.shift();
			this.#commandBuffer.shift();
			while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
			if(this.#commandBuffer[0] == 0) {
				this.#writeMemory(ctx, address + 1); // スキップ
				return;
			}
			for(;this.#commandBuffer[0] != 0;) {
				// 書き込む数値を取得
				result = this.#parseHex4(this.#commandBuffer);
				if(!this.#checkResult(ctx, result)) {
					ctx.PRINT(0xD);
					this.#writeMemory(ctx, address);
					return;
				}
				let value = result.value;
				// 書き込む
				if(value >= 0x100) {
					ctx.z80Emu.memWriteU8(address, value & 0xFF);
					ctx.z80Emu.memWriteU8(address + 1, value >> 8);
					address += 2;
				} else {
					ctx.z80Emu.memWriteU8(address, value);
					address += 1;
				}
				while(this.#commandBuffer[0] == 0x20) { this.#commandBuffer.shift(); } // 空白スキップ
			}
			this.#writeMemory(ctx, address);
			return;
		}



		this.#stateNo = this.#state_idle;
		this.#commandBuffer = [];

		this.#dumpAddress = 0x0000;
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
	start(ctx) {
		ctx.printNativeMsg("*** Platform monitor ***\n? help command\n");
		this.changeState(this.#state_start);
	}
	/**
	 * 終了する
	 * @param {TaskContext} ctx
	 */
	end(ctx) { this.changeState(this.#state_idle); }
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