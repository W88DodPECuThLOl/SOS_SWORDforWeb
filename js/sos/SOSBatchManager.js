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

	constructor()
	{
		this.#runningBatch = false;
		this.#batchBuffer = new Array();
	}

	clear()
	{
		this.#batchBuffer.length = 0;
		this.#runningBatch = false;
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
	 */
	start(batchText) {
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
