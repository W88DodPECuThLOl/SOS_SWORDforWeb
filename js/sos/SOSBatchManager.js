"use strict";

/**
 * バッチ管理
 */
class SOSBatchManager {
	/**
	 * バッチファイル実行中かどうか
	 * @type {boolean}
	 */
	#runningBatch;

	/**
	 * バッチファイルの中身
	 * @type {Array}
	 */
	#batchBuffer;

	/**
	 * パラメータ
	 * @type {Array[Array]}
	 */
	#params;

	#logEnable = false;

	/**
	 * デバッグ用のログ出力
	 * @param {*} text テキスト
	 */
	#Log(text)
	{
		if(this.#logEnable) {
			console.log("[Batch]" + text);
		}
	}

	/**
	 * バッチのパラメータを解析
	 * 
	 * メモ）「# Hoge:AA BBB CCC」だったら「AA BBB CCC」の部分を渡す
	 * @param {Array} commandLine コマンドラインのパラメータ部分
	 */
	#analyzeCommandParameters(commandLine)
	{
		this.#params = new Array();
		const paramText = [...commandLine];
		// 必要なら":"をスキップする
		if(paramText[0] == SOSKeyCode.COLON) { // ":"
			paramText.shift();
		}
		// パラメータを取得
		// ・スペースがセパレータ
		// ・スペースが続くとその分パラメータを追加する
		//   ⇒ 連続したスペースを無視しない
		//     （オリジナルがそうなってるので）
		let temp = [];
		while(paramText.length > 0) {
			let ch = paramText.shift();
			if(ch == 0) {
				// 終わり
				if(temp.length > 0) {
					this.#params.push(temp);
				}
				return;
			} else if(ch == SOSKeyCode.SPACE) {
				// 次のパラメータへ
				this.#params.push(temp);
				temp = [];
			} else {
				temp.push(ch);
			}
		}
	}

	#escape(text)
	{
	}


	constructor()
	{
		this.#runningBatch = false;
		this.#batchBuffer = new Array();
		this.#params = new Array();
	}

	clear()
	{
		this.#batchBuffer.length = 0;
		this.#runningBatch = false;
		this.#params = new Array();
	}

	getLine()
	{
		const line = new Array();
		if(this.isActive()) {
			if(this.#batchBuffer.length > 0) {
				// バッチから１行取得
				while(this.#batchBuffer.length > 0) {
					let ch = this.#batchBuffer.shift();
					if(ch == 0x00 || ch == SOSKeyCode.CR) {
						break;
					}
					line.push(ch);
				}
			} else {
				// バッチが終わった
				this.#runningBatch = false;
			}
		}
		line.push(0);
		return line;
	}

	/**
	 * 開始する
	 * @param {array} batchText
	 * @param {array} commandLine
	 */
	start(batchText, commandLine) {
		// まずは、停止する
		this.stop();
		// バッチのパラメータを解析
		this.#analyzeCommandParameters(commandLine);
		if(this.#logEnable) {
			this.#params.forEach(element => {
				this.#Log("Parameter[" + element + "]");
			});
		}
		// 読み込んだデータをバッチバッファへ
		this.#batchBuffer.length = 0;
		for(let i = 0; i < batchText.length; ++i) {
			this.#batchBuffer.push(batchText[i]);
		}
		if(this.#batchBuffer.length > 0) {
			// バッチ開始
			this.#runningBatch = true;
		}
	}

	/**
	 * 停止する
	 */
	stop()
	{
		this.clear();
	}

	/**
	 * 動作中かどうか
	 * @returns {boolean} 動作中なら true を返す
	 */
	isActive() { return this.#runningBatch; }
};
