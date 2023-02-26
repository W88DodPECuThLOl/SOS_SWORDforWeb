"use strict";

// @todo キーコード、まとめること
const KeyCode_BackSpace = 0x0008; // BS
const KeyCode_CR = 0x000D; // Enterキー
const KeyCode_BRK = 0x001B; // Breakキー
const KeyCode_DEL = 'Delete'; // DELキー
const KeyCode_Home = 'Home'; // Homeキー
const KeyCode_End = 'End'; // Endキー
const KeyCode_ArrowLeft = 'ArrowLeft'; // 左カーソルキー
const KeyCode_ArrowRight = 'ArrowRight'; // 右カーソルキー
const KeyCode_ArrowUp = 'ArrowUp'; // 上カーソルキー
const KeyCode_ArrowDown = 'ArrowDown'; // 下カーソルキー

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

	#lineCommit(ctx)
	{
		// カーソルのある行の文字列を取得して、バッファへ積む
		this.inputBuffer = [];
		for(let ch of ctx.catTextScreen.getLineWithDecode()) {
			if(this.inputBuffer.length >= this.#maxInput) { break; }
			this.inputBuffer.push(ch);
		}
		this.inputBuffer.push(0);
		// 改行しておく
		ctx.catTextScreen.putch32(KeyCode_CR);
		// 終了状態へ
		this.changeState(this.#state_end);
		// カーソル非表示
		ctx.setDisplayCursor(false);
	}

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
			// カーソル表示
			ctx.setDisplayCursor(true);
		};
		this.#state[this.#state_wait] = (ctx)=>{
			//
			// バッチ処理
			//
			try {
				let res = ctx.batchManager.get();
				while(!res.cy) {
					if(res.character == KeyCode_CR) {
						// Enterキー、入力完了
						this.#lineCommit(ctx);
						return;
					}
					// 画面に表示
					ctx.catTextScreen.putch32(res.character);
					res = ctx.batchManager.get();
				}
			} catch(e) {
				if(e instanceof SOSBatchUserInput) {
					// 「\0」の処理
					ctx.BELL(0); // ベルを鳴らして、ユーザー入力へ
				} else {
					throw e;
				}
			}

			// ユーザからの入力
			const keyCode = ctx.keyMan.dequeueKeyBuffer();
			if(keyCode > 0) {
				if(keyCode == KeyCode_BRK) {
					// Breakキーが押された
					this.inputBuffer = [KeyCode_BRK, 0];
					this.changeState(this.#state_end);
					// カーソル非表示
					ctx.setDisplayCursor(false);
					return;
				} else if(keyCode == KeyCode_BackSpace) {
					// 1文字削除
					ctx.catTextScreen.putch32(0x0008); // BS
					return;
				} else if(keyCode == KeyCode_CR) {
					// Enterキー、入力完了
					this.#lineCommit(ctx);
					return;
				}
				ctx.catTextScreen.putch32(keyCode);
			} else if(keyCode == KeyCode_DEL
					|| keyCode == KeyCode_Home
					|| keyCode == KeyCode_End
					|| keyCode == KeyCode_ArrowLeft
					|| keyCode == KeyCode_ArrowRight
					|| keyCode == KeyCode_ArrowUp
					|| keyCode == KeyCode_ArrowDown) {
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
	 * @param {TaskContext} ctx 
	 */
	update(ctx) { this.#state[this.#stateNo](ctx); }

	/**
	 * 開始する
	 * @param {TaskContext} ctx 
	 */
	start(ctx) { this.changeState(this.#state_start); }

	/**
	 * 終了する
	 * @param {TaskContext} ctx
	 */
	end(ctx)
	{
		// 入力バッファをクリア
		this.inputBuffer = new Array();
		// キーバッファをクリア
		ctx.keyMan.keyBufferClear();
		// カーソル非表示
		ctx.setDisplayCursor(false);
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
	 * 		resultCode:number,	// 処理結果
	 * 		result:number[],	// 入力された文字列（S-OS基準の文字コード）
	 * }}
	 */
	getResult() { return {resultCode:0, result: this.inputBuffer}; }
	/**
	 * 状態遷移する
	 * @param {number} stateNo 遷移する状態
	 */
	changeState(stateNo) { this.#stateNo = stateNo; }
}
