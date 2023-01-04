"use strict";

// DataController
export default class {
	/**
	 * バッファ
	 * @type {Uint8Array}
	 */
	#Buffer;

	/**
	 * コンストラクタ
	 * @param {Uint8Array} buffer バッファ 
	 */
	constructor(buffer) {
		this.SetBuffer(buffer);
	}

	/**
	 * バッファを設定する
	 * @param {Uint8Array} buffer バッファ
	 */
	SetBuffer(buffer) {
		this.#Buffer = buffer;
	}

	/**
	 * バッファから指定部分をコピーする
	 * @param {number} pos コピー開始位置
	 * @param {number} len コピーサイズ(バイト単位)
	 * @returns {Uint8Array} 複製コピーされたバッファ
	 */
	Copy(pos, len) {
		return this.#Buffer.slice(pos, pos + len);
	}

	/**
	 * バッファを取得する
	 * @returns {Uint8Array} バッファ
	 */
	GetData() {
		return this.#Buffer;
	}

	/**
	 * 32bit整数を取得する
	 * @param {number} pos 取得位置
	 * @returns {number} 32bit整数値
	 */
	GetLong(pos) {
		let result = this.#Buffer[pos];
		result |= (this.#Buffer[pos + 1] << 8);
		result |= (this.#Buffer[pos + 2] << 16);
		result |= (this.#Buffer[pos + 3] << 24);
		return result & 0xFFFFFFFF;
	}

	/**
	 * 16bit整数を取得する
	 * @param {number} pos 取得位置
	 * @returns {number} 16bit整数値
	 */
	GetWord(pos) {
		let result = this.#Buffer[pos];
		result |= (this.#Buffer[pos + 1] << 8);
		return result & 0xFFFF;
	}

	/**
	 * 8bit整数を取得する
	 * @param {number} pos 取得位置
	 * @returns {number} 8bit整数値
	 */
	GetByte(pos) {
		return this.#Buffer[pos];
	}

	/**
	 * 32bit整数を設定する
	 * @param {number} pos 設定位置
	 * @param {number} value 設定する値
	 */
	SetLong(pos, value) {
		this.#Buffer[pos    ] =  value        & 0xff;
		this.#Buffer[pos + 1] = (value >> 8)  & 0xff;
		this.#Buffer[pos + 2] = (value >> 16) & 0xff;
		this.#Buffer[pos + 3] = (value >> 24) & 0xff;
	}

	/**
	 * 16bit整数を設定する
	 * @param {number} pos 設定位置
	 * @param {number} value 設定する値
	 */
	SetWord(pos, value) {
		this.#Buffer[pos    ] =  value        & 0xff;
		this.#Buffer[pos + 1] = (value >> 8)  & 0xff;
	}

	/**
	 * 8bit整数を設定する
	 * @param {number} pos 設定位置
	 * @param {number} value 設定する値
	 */
	SetByte(pos, value) {
		this.#Buffer[pos] = value & 0xff;
	}

	/**
	 * コピーする
	 * @param {number} pos コピー先の位置
	 * @param {Uint8Array} data コピー元のデータ
	 * @param {number} length コピーするサイズ
	 */
	SetCopy(pos, data, length = -1) {
		if (length < 0) {
			length = data.Length - pos;
		}
		for (let i = 0; i < length; i++) { this.#Buffer[pos + i] = data[i]; }
	}
	/**
	 * 指定された値で埋める
	 * @param {number} value 値
	 * @param {number} pos 位置
	 * @param {number} length サイズ
	 */
	Fill(value, pos = 0, length = -1) {
		if(length < 0) { length = this.#Buffer.length - pos; }
		// for (let i = 0; i < length; i++) this.#Buffer[pos + i] = value;
		this.#Buffer.fill(value, pos, pos + length);
	}

	//internal void SetByte(int v, object imageTypeByte) {
	//	throw new NotImplementedException();
	//}
}