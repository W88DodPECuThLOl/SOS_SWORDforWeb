"use strict";

class Z80Emu {
	/**
	 * Wasmのエクスポート部分
	 */
	wasm;

	/**
	 * 使用するヒープサイズ(64KiBの倍数であること)
	 */
	#heapSize = 256*1024*1024; // 256MiB

	/**
	 * Wasmのメモリ
	 */
	#memory;

	/**
	 * Z80レジスタ
	 * @type {Uint8Array}
	 */
	#Z80Regs;

	/**
	 * メインメモリ
	 * @type {Uint8Array}
	 */
	#RAM8;

	/**
	 * IOポート
	 * @type {Uint8Array}
	 */
	#IO8;

	/**
	 * 外部とのアクセス用
	 */
	#ctx;

	/**
	 * SOSのサブルーチン
	 * @type {SOS}
	 */
	#sos;

	#audio;

	/**
	 * WASMのセットアップ
	 * 
	 * 読み込みと初期化
	 * @returns 
	 */
	setup()
	{
		const importObject = {
			// メモリ
			env: { memory: this.#memory },
			// S-OSのサブルーチン群
			sos: {
				cold  :()=>{ return this.#sos.sos_cold  (this.#ctx); },
				hot   :()=>{ return this.#sos.sos_hot   (this.#ctx); },
				ver   :()=>{ return this.#sos.sos_ver   (this.#ctx); },
				print :()=>{ return this.#sos.sos_print (this.#ctx); },
				prnts :()=>{ return this.#sos.sos_prints(this.#ctx); },
				ltnl  :()=>{ return this.#sos.sos_ltnl  (this.#ctx); },
				nl    :()=>{ return this.#sos.sos_nl    (this.#ctx); },
				msg   :()=>{ return this.#sos.sos_msg   (this.#ctx); },
				msx   :()=>{ return this.#sos.sos_msx   (this.#ctx); },
				mprnt :()=>{ return this.#sos.sos_mprnt (this.#ctx); },
				tab   :()=>{ return this.#sos.sos_tab   (this.#ctx); },
				lprnt :()=>{ return this.#sos.sos_lprnt (this.#ctx); },
				lpton :()=>{ return this.#sos.sos_lpton (this.#ctx); },
				lptof :()=>{ return this.#sos.sos_lptof (this.#ctx); },
				getl  :()=>{ return this.#sos.sos_getl  (this.#ctx); },
				getky :()=>{ return this.#sos.sos_getky (this.#ctx); },
				brkey :()=>{ return this.#sos.sos_brkey (this.#ctx); },
				inkey :()=>{ return this.#sos.sos_inkey (this.#ctx); },
				pause :()=>{ return this.#sos.sos_pause (this.#ctx); },
				bell  :()=>{ return this.#sos.sos_bell  (this.#ctx); },
				prthx :()=>{ return this.#sos.sos_prthx (this.#ctx); },
				prthl :()=>{ return this.#sos.sos_prthl (this.#ctx); },
				asc   :()=>{ return this.#sos.sos_asc   (this.#ctx); },
				hex   :()=>{ return this.#sos.sos_hex   (this.#ctx); },
				_2hex :()=>{ return this.#sos.sos__2hex (this.#ctx); },
				hlhex :()=>{ return this.#sos.sos_hlhex (this.#ctx); },
				wopen :()=>{ return this.#sos.sos_wopen (this.#ctx); },
				wrd   :()=>{ return this.#sos.sos_wrd   (this.#ctx); },
				fcb   :()=>{ return this.#sos.sos_fcb   (this.#ctx); },
				rdd   :()=>{ return this.#sos.sos_rdd   (this.#ctx); },
				file  :()=>{ return this.#sos.sos_file  (this.#ctx); },
				fsame :()=>{ return this.#sos.sos_fsame (this.#ctx); },
				fprnt :()=>{ return this.#sos.sos_fprnt (this.#ctx); },
				poke  :()=>{ return this.#sos.sos_poke  (this.#ctx); },
				poke_ :()=>{ return this.#sos.sos_poke_ (this.#ctx); },
				peek  :()=>{ return this.#sos.sos_peek  (this.#ctx); },
				peek_ :()=>{ return this.#sos.sos_peek_ (this.#ctx); },
				mon   :()=>{ return this.#sos.sos_mon   (this.#ctx); },
				//_hl_  :()=>{ return this.#sos.sos__hl_  (this.#ctx); }, // メモ)Z80のコードで直接書く
				//getpc :()=>{ return this.#sos.sos_getpc (this.#ctx); }, // メモ)Z80のコードで直接書く
				drdsb :()=>{ return this.#sos.sos_drdsb (this.#ctx); },
				dwtsb :()=>{ return this.#sos.sos_dwtsb (this.#ctx); },
				dir   :()=>{ return this.#sos.sos_dir   (this.#ctx); },
				ropen :()=>{ return this.#sos.sos_ropen (this.#ctx); },
				set   :()=>{ return this.#sos.sos_set   (this.#ctx); },
				reset :()=>{ return this.#sos.sos_reset (this.#ctx); },
				name  :()=>{ return this.#sos.sos_name  (this.#ctx); },
				kill  :()=>{ return this.#sos.sos_kill  (this.#ctx); },
				csr   :()=>{ return this.#sos.sos_csr   (this.#ctx); },
				scrn  :()=>{ return this.#sos.sos_scrn  (this.#ctx); },
				loc   :()=>{ return this.#sos.sos_loc   (this.#ctx); },
				flget :()=>{ return this.#sos.sos_flget (this.#ctx); },
				rdvsw :()=>{ return this.#sos.sos_rdvsw (this.#ctx); },
				sdvsw :()=>{ return this.#sos.sos_sdvsw (this.#ctx); },
				inp   :()=>{ return this.#sos.sos_inp   (this.#ctx); },
				out   :()=>{ return this.#sos.sos_out   (this.#ctx); },
				widch :()=>{ return this.#sos.sos_widch (this.#ctx); },
				error :()=>{ return this.#sos.sos_error (this.#ctx); },
				// DOSモジュール
				rdi   :()=>{ return this.#sos.sos_rdi   (this.#ctx); },
				tropn :()=>{ return this.#sos.sos_tropn (this.#ctx); },
				wri   :()=>{ return this.#sos.sos_wri   (this.#ctx); },
				twrd  :()=>{ return this.#sos.sos_twrd  (this.#ctx); },
				trdd  :()=>{ return this.#sos.sos_trdd  (this.#ctx); },
				tdir  :()=>{ return this.#sos.sos_tdir  (this.#ctx); },
				p_fnam:()=>{ return this.#sos.sos_p_fnam(this.#ctx); },
				devchk:()=>{ return this.#sos.sos_devchk(this.#ctx); },
				tpchk :()=>{ return this.#sos.sos_tpchk (this.#ctx); },
				parsc :()=>{ return this.#sos.sos_parsc (this.#ctx); },
				parcs :()=>{ return this.#sos.sos_parcs (this.#ctx); },
				// ディスクI/O
				dread :()=>{ return this.#sos.sos_dread (this.#ctx); },
				dwrite:()=>{ return this.#sos.sos_dwrite(this.#ctx); },
			},
			// IO
			io: {
				writePSG:(executedClock, reg, value)=>{ this.#audio.writePSG(executedClock, reg, value); }
			}
		};
		return WebAssembly.instantiateStreaming(fetch("sos.wasm"), importObject).then(
			(obj) => {
				// WASM側から提供されている関数や変数など
				this.wasm = obj.instance.exports;
				// 初期化
				this.wasm.initialize(this.wasm.__heap_base, this.#heapSize - this.wasm.__heap_base);
				return this;
			}
		);
	}

	/**
	 * コンストラクタ
	 */
	constructor(audio)
	{
		// メモリ確保
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });
		// SOSのサブルーチン
		this.#sos = new SOS(this);
		// オーディオ
		this.#audio = audio;
	}

	/**
	 * リセットする
	 */
	reset() {
		// リセット
		this.wasm.z80Reset();
		// 各種アドレスをキャッシュしておく
		const memPtrRegs = this.wasm.getZ80Regs();
		const memPtrRAM  = this.wasm.getRAM();
		const memPtrIO   = this.wasm.getIO();
		this.#Z80Regs    = new Uint8Array(this.#memory.buffer, memPtrRegs, this.wasm.getZ80RegsSize());
		this.#RAM8       = new Uint8Array(this.#memory.buffer, memPtrRAM, 0x10000);
		this.#IO8        = new Uint8Array(this.#memory.buffer, memPtrIO, 0x10000);
	}

	/**
	 * 更新処理
	 * @param {*} ctx 
	 * @returns {number} 実際に実行されたクロック数
	 */
	update(ctx) {
		this.#ctx = ctx;
		return this.wasm.exeute(4000000 / 60 | 0); // 4Mzの60FPS
	}

	/**
	 * X1形式のVRAMをcanvasに描画
	 * 
	 * IOの0x4000～0xFFFFをX1形式のVRAMとして変換し、キャンバスへ描画している。  
	 * メモ）canvasのイメージデータはrgbaの順番で、各0x00～0xFFの値
	 * @param {*} canvasCtx 
	 */
	getVRAMImage(canvasCtx) {
		if(this.wasm.isVRAMDirty()) {
			// 変換されたイメージを取得して
			const imagePtr = this.wasm.getVRAMImage(); // メモ）内部で、VRAMDirtyフラグリセットしている
			let src = new Uint8Array(this.#memory.buffer, imagePtr, 640*200*4);
			// キャンバスのイメージデータを作成し
			const dstImageData = canvasCtx.createImageData(640, 200);
			let dst = dstImageData.data;
			// コピー
			for(let i = 0; i < 640*200*4; ++i) { dst[i] = src[i]; }
			// 描画
			canvasCtx.putImageData(dstImageData, 0, 0);
		}
	}

	/**
	 * モニタのJコマンドでの飛び先を設定する
	 * 
	 * Z80側でのcallするアドレスを書き換えている
	 * 
	 * jp   #COLD   ; COLDにジャンプ  
	 * call xxxx    ; USRを呼び出す  
	 * call yyyy    ; Jコマンドの飛び先を呼び出す  
	 * jp   3
	 * @param {number} address ジャンプするアドレス
	 */
	monitorCommandJump(address)
	{
		let dst = 0x7;
		this.memWriteU8(dst++, address);
		this.memWriteU8(dst++, address >> 8);
	}

	// -------------------------------------------------------------------------------------------------
	//  メモリアクセス
	// -------------------------------------------------------------------------------------------------

	/**
	 * 2バイトメモリへ書き込む
	 * @param {number} addr		メモリアドレス
	 * @param {number} value	値
	 */
	memWriteU16(addr, value) { this.#RAM8[addr & 0xFFFF] = value; this.#RAM8[(addr + 1) & 0xFFFF] = value >> 8; }

	/**
	 * 1バイトメモリへ書き込む
	 * @param {number} addr		メモリアドレス
	 * @param {number} value	値
	 */
	memWriteU8(addr, value) { this.#RAM8[addr & 0xFFFF] = value; }

	/**
	 * 2バイトメモリから読み込む
	 * @param {number} addr メモリアドレス
	 * @returns {number} 値
	 */
	memReadU16(addr) { return this.#RAM8[addr & 0xFFFF] | (this.#RAM8[(addr + 1) & 0xFFFF] << 8); }

	/**
	 * 1バイトメモリから読み込む
	 * @param {number} addr メモリアドレス
	 * @returns {number} 値
	 */
	memReadU8(addr) { return this.#RAM8[addr & 0xFFFF]; }

	/**
	 * 1バイトIOへ書き込む
	 * @param {number} addr		IOアドレス
	 * @param {number} value	値
	 */
	ioWrite(addr, value) { this.#IO8[addr & 0xFFFF] = value; }
	
	// -------------------------------------------------------------------------------------------------
	//  Z80レジスタアクセス
	// -------------------------------------------------------------------------------------------------
	
	setA(A) { this.#Z80Regs[0] = A; }
	getA() { return this.#Z80Regs[0]; }
	setF(F) { this.#Z80Regs[1] = F; }
	setCY() { this.#Z80Regs[1] |= 1; }
	clearCY() { this.#Z80Regs[1] &= ~1; }
	setZ() { this.#Z80Regs[1] |= 0x40; }
	clearZ() { this.#Z80Regs[1] &= ~0x40; }
	getF() { return this.#Z80Regs[1]; }
	setB(B) { this.#Z80Regs[2] = B; }
	getB() { return this.#Z80Regs[2]; }
	setC(C) { this.#Z80Regs[3] = C; }
	getC() { return this.#Z80Regs[3]; }
	setD(D) { this.#Z80Regs[4] = D; }
	getD() { return this.#Z80Regs[4]; }
	setE(E) { this.#Z80Regs[5] = E; }
	getE() { return this.#Z80Regs[5]; }
	setH(H) { this.#Z80Regs[6] = H; }
	getH() { return this.#Z80Regs[6]; }
	setL(L) { this.#Z80Regs[7] = L; }
	getL() { return this.#Z80Regs[7]; }

	setAF(AF) { this.#Z80Regs[0] = AF >> 8; this.#Z80Regs[1] = AF; }
	getAF() { return (this.#Z80Regs[0] << 8) | this.#Z80Regs[1]; }
	setBC(BC) { this.#Z80Regs[2] = BC >> 8; this.#Z80Regs[3] = BC; }
	getBC() { return (this.#Z80Regs[2] << 8) | this.#Z80Regs[3]; }
	setDE(DE) { this.#Z80Regs[4] = DE >> 8; this.#Z80Regs[5] = DE; }
	getDE() { return (this.#Z80Regs[4] << 8) | this.#Z80Regs[5]; }
	setHL(HL) { this.#Z80Regs[6] = HL >> 8; this.#Z80Regs[7] = HL; }
	getHL() { return (this.#Z80Regs[6] << 8) | this.#Z80Regs[7]; }
	setPC(PC) { this.#Z80Regs[16] = PC; this.#Z80Regs[17] = PC >> 8; }
	getPC() { return (this.#Z80Regs[17] << 8) | this.#Z80Regs[16]; }
	setSP(SP) { this.#Z80Regs[18] = SP; this.#Z80Regs[19] = SP >> 8; }
	getSP() { return this.#Z80Regs[18] | (this.#Z80Regs[19] << 8); }
	setIX(IX) { this.#Z80Regs[20] = IX; this.#Z80Regs[21] = IX >> 8; }
	setIY(IY) { this.#Z80Regs[22] = IY; this.#Z80Regs[22] = IY >> 8; }
}
