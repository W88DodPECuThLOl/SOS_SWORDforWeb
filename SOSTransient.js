"use strict";

/**
 * トランジェント管理
 */
class SOSTransient {
	/**
	 * トランジェントのバックアップメモリ
	 * @type {Uint8Array}
	 */
	#transientMemory;

	/**
	 * トランジェント用のバックアップメモリのサイズ(バイト単位)
	 * @type {number}
	 */
	#transientMemoryAddress = 0x3000;

	/**
	 * トランジェント用のバックアップメモリのサイズ(バイト単位)
	 * @type {number}
	 */
	#transientMemorySize = 0x1C00;

	#logEnable = false;

	/**
	 * デバッグ用のログ出力
	 * @param {*} text テキスト
	 */
	#Log(text)
	{
		if(this.#logEnable) {
			console.log("[transient]" + text);
		}
	}

	/**
	 * トランジェント中かどうかのフラグを設定する
	 * @param {*} ctx 
	 * @param {boolean} flag トランジェント中ならtrueを指定する
	 */
	#setFlag(ctx, flag)
	{
		ctx.z80Emu.memWriteU8(SOSWorkAddr.COMF, flag ? 1 : 0);
	}

	/**
	 * トランジェント中かどうかのフラグを取得する
	 * @param {*} ctx 
	 * @returns {boolean}	トランジェント中かどうかのフラグ  
	 * 						トランジェント中ならtrueを返す
	 */
	#getFlag(ctx)
	{
		return ctx.z80Emu.memReadU8(SOSWorkAddr.COMF) != 0;
	}

	/**
	 * トランジェントできるかどうかの判定
	 * @param {number} address アドレス
	 * @param {number} size サイズ（バイト単位）
	 * @returns {boolean} トランジェントできるかどうか。trueなら出来る。
	 */
	#canTransient(address, size)
	{
		// for debug
		if(address != this.#transientMemoryAddress) {
			this.#Log("canTransient : address != " + this.#transientMemoryAddress);
		}
		if(address != this.#transientMemoryAddress) {
			this.#Log("canTransient : size > " + this.#transientMemorySize);
		}

		return (address == this.#transientMemoryAddress) && (size <= this.#transientMemorySize);
	}

	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#transientMemory = null;
	}

	/**
	 * トランジェントのバックアップメモリへ退避する
	 * 
	 * 保存できなかった場合、トランジェントのバックアップメモリは消去される
	 * @param {*} ctx 
	 * @param {number} address 保存するアドレス
	 * @param {number} size 保存するサイズ(バイト単位)
	 */
	save(ctx, address, size)
	{
		this.#Log("save( address:" + address + ", size:" + size + ")");
		if(this.#canTransient(address, size)) {
			this.#Log("saved");
			this.#transientMemory = new Uint8Array(this.#transientMemorySize);
			for(let i = 0; i < this.#transientMemorySize; ++i) {
				this.#transientMemory[i] = ctx.z80Emu.memReadU8(this.#transientMemoryAddress + i);
			}
			this.#setFlag(ctx, true); // Z80側のメモリにも反映しておく
		} else {
			this.clear(ctx);
		}
	}

	/**
	 * トランジェントのバックアップメモリから復帰する
	 * 
	 * トランジェントのバックアップメモリが空の時は何もしない
	 * @param {*} ctx 
	 */
	load(ctx)
	{
		if(this.#transientMemory && this.#getFlag(ctx)) {
			this.#Log("restored");
			for(let i = 0; i < this.#transientMemorySize; ++i) {
				ctx.z80Emu.memWriteU8(this.#transientMemoryAddress + i, this.#transientMemory[i]);
			}
		}
	}

	/**
	 * トランジェントをクリアする
	 * @param {*} ctx 
	 */
	clear(ctx)
	{
		this.#Log("clear()");
		this.#transientMemory = null;
		this.#setFlag(ctx, false); // Z80側のメモリにも反映しておく
	}
}
