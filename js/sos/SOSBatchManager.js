"use strict";

/**
 * 例外用クラス - ユーザーから入力を促す
 * - 「\0」の処理
 */
class SOSBatchUserInput{}

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

	// パラメータ処理用
	#paraf = false;
	#param = null;
	#btpnt2 = 0;

	/**
	 * ログを出力するかどうか
	 * @type {boolean}
	 */
	#logEnable = true; // false;

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
				temp.push(0); // 終端文字追加
				this.#params.push(temp);
				return;
			} else if(ch == SOSKeyCode.SPACE) {
				// 次のパラメータへ
				temp.push(0); // 終端文字追加
				this.#params.push(temp);
				temp = [];
			} else {
				temp.push(ch);
			}
		}
	}

	/**
	 * バッチバッファからの１文字入力
	 * @returns {number} １文字
	 */
	#input()
	{
		if(this.#batchBuffer.length > 0) {
			return this.#batchBuffer.shift();
		} else {
			this.#Log("バッチバッファが無くなりました");
			return 0;
		}
	}

	/**
	 * パラメータの処理
	 * @returns {{character: number, cy: boolean}}
	 * @throws SOSBatchUserInput() ユーザーからの入力に遷移する
	 */
	#para()
	{
		let ch = this.#input();
		if((ch < 0x30) || (ch > 0x39)) {
			this.#Log("\\の後が0～9ではありませんでした");
			return { character: ch, cy: true }; // パラメータじゃなかったので、入力終了
		}
		if(ch == 0x30) {
			// \0
			// \0以降、行末まで捨てる
			while(this.#batchBuffer.length > 0) {
				let ch = this.#batchBuffer.shift();
				if(ch == SOSKeyCode.NUL || ch == SOSKeyCode.CR) {
					break;
				}
			}
			this.#Log("\\0の処理");
			throw new SOSBatchUserInput(); // ユーザーからの入力に遷移する
		} else {
			// \1 ～ \9
			this.#btpnt2 = 0;
			const paramIndex = ch - 0x30 - 1;
			if(paramIndex < this.#params.length) {
				this.#paraf = true;
				this.#param = this.#params[paramIndex];
			} else {
				// 該当するパラメータが無かった
				this.#Log("\\1～\\9の処理で、該当するパラメータが見つかりませんでした \\" + (paramIndex + 1));
				this.#paraf = false;
				this.#param = null;
			}
			return { character: 0, cy: false }; // パラメータからの入力で継続
		}
	}

	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#runningBatch = false;
		this.#batchBuffer = new Array();
		this.#params = new Array();

		this.#paraf = false;
		this.#param = null;
		this.#btpnt2 = 0;
	}

	/**
	 * バッチ処理をクリアする
	 */
	clear()
	{
		this.#batchBuffer.length = 0;
		this.#runningBatch = false;
		this.#params = new Array();
		// パラメータ処理用
		this.#paraf = false;
		this.#param = null;
		this.#btpnt2 = 0;
	}

	/**
	 * １文字入力
	 * @returns {{character: number, cy: boolean}} cyがtrueの場合ユーザからの入力を行う
	 * @throws SOSBatchUserInput() ユーザーからの入力に遷移する
	 */
	get()
	{
		if(!this.isActive()) {
			// バッチ処理中じゃない
			return {character: 0, cy: true};
		}
		let ch;
		while(true) {
			//
			// パラメータの処理
			//
			if(this.#paraf) {
				// パラメータから１文字取得
				ch = (this.#btpnt2 < this.#param.length) ? this.#param[this.#btpnt2] : 0;
				if(ch != 0) {
					this.#btpnt2++;
					return {character: ch, cy: false};
				}
				// パラメータからの入力終わり
				this.#paraf = false;
			}
			//
			// バッチバッファから１文字取得する
			//
			ch = this.#input();
			//
			// 文字で色々する
			//
			if(ch == 0) {
				// バッチ処理終了
				this.stop();
				return {character: 0, cy: true};
			} else if(ch != 0x5C) {
				// 円マーク以外
				return {character: ch, cy: false};
			} else {
				// 円マーク
				// パラメータの処理
				const res = this.#para();
				if(res.cy) {
					return {character: res.character, cy: false};
				}
			}
		}
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
			// テスト
			let i = 0;
			this.#params.forEach(element => {
				this.#Log("#" + i + ": Parameter[" + element + "]");
				i++;
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

	/**
	 * "A:AUTOEXEC.BAT"を実行させる
	 */
	setAutoExecBat()
	{
		const command = StringToArray(" A:AUTOEXEC.BAT\x0D");
		this.start(command, []);
	}
}
