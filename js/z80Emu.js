"use strict";

class Z80Emu {
	/**
	 * Wasmのエクスポート部分
	 */
	wasm;

	/**
	 * 使用するヒープサイズ(64KiBの倍数であること)
	 */
	//#heapSize = 256*1024*1024; // 256MiB
	#heapSize = 16*1024*1024; // 16MiB

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
	 * ゲームパッド
	 */
	#gamePad;

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
				cold  :()=>{ this.#sos.sos_cold  (this.#ctx); },
				hot   :()=>{ this.#sos.sos_hot   (this.#ctx); },
				ver   :()=>{ this.#sos.sos_ver   (this.#ctx); },
				print :()=>{ this.#sos.sos_print (this.#ctx); },
				prnts :()=>{ this.#sos.sos_prints(this.#ctx); },
				ltnl  :()=>{ this.#sos.sos_ltnl  (this.#ctx); },
				nl    :()=>{ this.#sos.sos_nl    (this.#ctx); },
				msg   :()=>{ this.#sos.sos_msg   (this.#ctx); },
				msx   :()=>{ this.#sos.sos_msx   (this.#ctx); },
				mprnt :()=>{ this.#sos.sos_mprnt (this.#ctx); },
				tab   :()=>{ this.#sos.sos_tab   (this.#ctx); },
				lprnt :()=>{ this.#sos.sos_lprnt (this.#ctx); },
				lpton :()=>{ this.#sos.sos_lpton (this.#ctx); },
				lptof :()=>{ this.#sos.sos_lptof (this.#ctx); },
				getl  :()=>{ this.#sos.sos_getl  (this.#ctx); },
				getky :()=>{ this.#sos.sos_getky (this.#ctx); },
				brkey :()=>{ this.#sos.sos_brkey (this.#ctx); },
				inkey :()=>{ this.#sos.sos_inkey (this.#ctx); },
				pause :()=>{ this.#sos.sos_pause (this.#ctx); },
				bell  :()=>{ this.#sos.sos_bell  (this.#ctx); },
				prthx :()=>{ this.#sos.sos_prthx (this.#ctx); },
				prthl :()=>{ this.#sos.sos_prthl (this.#ctx); },
				asc   :()=>{ this.#sos.sos_asc   (this.#ctx); },
				hex   :()=>{ this.#sos.sos_hex   (this.#ctx); },
				_2hex :()=>{ this.#sos.sos__2hex (this.#ctx); },
				hlhex :()=>{ this.#sos.sos_hlhex (this.#ctx); },
				wopen :()=>{ this.#sos.sos_wopen (this.#ctx); },
				wrd   :()=>{ this.#sos.sos_wrd   (this.#ctx); },
				fcb   :()=>{ this.#sos.sos_fcb   (this.#ctx); },
				rdd   :()=>{ this.#sos.sos_rdd   (this.#ctx); },
				file  :()=>{ this.#sos.sos_file  (this.#ctx); },
				fsame :()=>{ this.#sos.sos_fsame (this.#ctx); },
				fprnt :()=>{ this.#sos.sos_fprnt (this.#ctx); },
				poke  :()=>{ this.#sos.sos_poke  (this.#ctx); },
				poke_ :()=>{ this.#sos.sos_poke_ (this.#ctx); },
				peek  :()=>{ this.#sos.sos_peek  (this.#ctx); },
				peek_ :()=>{ this.#sos.sos_peek_ (this.#ctx); },
				mon   :()=>{ this.#sos.sos_mon   (this.#ctx); },
				//_hl_  :()=>{ this.#sos.sos__hl_  (this.#ctx); }, // メモ)Z80のコードで直接書く
				//getpc :()=>{ this.#sos.sos_getpc (this.#ctx); }, // メモ)Z80のコードで直接書く
				drdsb :()=>{ this.#sos.sos_drdsb (this.#ctx); },
				dwtsb :()=>{ this.#sos.sos_dwtsb (this.#ctx); },
				dir   :()=>{ this.#sos.sos_dir   (this.#ctx); },
				ropen :()=>{ this.#sos.sos_ropen (this.#ctx); },
				set   :()=>{ this.#sos.sos_set   (this.#ctx); },
				reset :()=>{ this.#sos.sos_reset (this.#ctx); },
				name  :()=>{ this.#sos.sos_name  (this.#ctx); },
				kill  :()=>{ this.#sos.sos_kill  (this.#ctx); },
				csr   :()=>{ this.#sos.sos_csr   (this.#ctx); },
				scrn  :()=>{ this.#sos.sos_scrn  (this.#ctx); },
				loc   :()=>{ this.#sos.sos_loc   (this.#ctx); },
				flget :()=>{ this.#sos.sos_flget (this.#ctx); },
				rdvsw :()=>{ this.#sos.sos_rdvsw (this.#ctx); },
				sdvsw :()=>{ this.#sos.sos_sdvsw (this.#ctx); },
				inp   :()=>{ this.#sos.sos_inp   (this.#ctx); },
				out   :()=>{ this.#sos.sos_out   (this.#ctx); },
				widch :()=>{ this.#sos.sos_widch (this.#ctx); },
				error :()=>{ this.#sos.sos_error (this.#ctx); },
				// 隠しサブルーチン？
				command :()=>{ this.#sos.sos_command(this.#ctx); },
				// DOSモジュール
				rdi   :()=>{ this.#sos.sos_rdi   (this.#ctx); },
				tropn :()=>{ this.#sos.sos_tropn (this.#ctx); },
				wri   :()=>{ this.#sos.sos_wri   (this.#ctx); },
				twrd  :()=>{ this.#sos.sos_twrd  (this.#ctx); },
				trdd  :()=>{ this.#sos.sos_trdd  (this.#ctx); },
				tdir  :()=>{ this.#sos.sos_tdir  (this.#ctx); },
				p_fnam:()=>{ this.#sos.sos_p_fnam(this.#ctx); },
				devchk:()=>{ this.#sos.sos_devchk(this.#ctx); },
				tpchk :()=>{ this.#sos.sos_tpchk (this.#ctx); },
				parsc :()=>{ this.#sos.sos_parsc (this.#ctx); },
				parcs :()=>{ this.#sos.sos_parcs (this.#ctx); },
				// ディスクI/O
				dread :()=>{ this.#sos.disk_dread (this.#ctx); },
				dwrite:()=>{ this.#sos.disk_dwrite(this.#ctx); },
			},
			// IO
			io: {
				writeSoundRegister:(executedClock, no, reg, value)=>{ this.#audio.writeRegister(executedClock, no, reg, value); },
				readGamePad:(index)=>{
					// 負論理
					if(index == 0) {
						return(this.#gamePad.buttons[this.#gamePad.BUTTON_VUP_INDEX].current ? 0 : 0x01)
						| (this.#gamePad.buttons[this.#gamePad.BUTTON_VDOWN_INDEX].current ? 0 : 0x02)
						| (this.#gamePad.buttons[this.#gamePad.BUTTON_VLEFT_INDEX].current ? 0 : 0x04)
						| (this.#gamePad.buttons[this.#gamePad.BUTTON_VRIGHT_INDEX].current ? 0 : 0x08)
						| 0x10
						  // トリガー１と２ @todo 位置関係が不明
						| (this.#gamePad.buttons[this.#gamePad.BUTTON_B_INDEX].current ? 0 : 0x20) // トリガー1
						| (this.#gamePad.buttons[this.#gamePad.BUTTON_A_INDEX].current ? 0 : 0x40) // トリガー2
						| 0x80
						;
					} else {
						return 0xFF;
					}
				}
			},
			log: {
				logHex02: (value)=> {
					console.log(ToStringHex2(value));
				},
				logHex04: (value)=> {
					console.log(ToStringHex4(value));
				}
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
	constructor(audio, gamePad)
	{
		// メモリ確保
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });
		// SOSのサブルーチン
		this.#sos = new SOS(this);
		// オーディオ
		this.#audio = audio;
		// ゲームパッド
		this.#gamePad = gamePad;

		this.#Z80Regs = null;
		this.#RAM8    = null;
		this.#IO8     = null;
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
	 * @param {number} clock 実行するクロック数
	 * @returns {number} 実際に実行されたクロック数
	 */
	update(ctx, clock) {
		this.#ctx = ctx;
		this.#audio.reset(); // 音の生成側と同期
		this.wasm.exeute(-1);
		return this.wasm.exeute(clock | 0);
	}

	/**
	 * VRAMをcanvasに描画
	 * 
	 * canvasのイメージデータはrgbaの順番で、各0x00～0xFFの値
	 * @param {*} canvasCtx 
	 */
	getVRAMImage(canvasCtx) {
		if(this.wasm.isVRAMDirty()) {
			// 変換されたイメージを取得して
			const imagePtr = this.wasm.getVRAMImage(); // メモ）内部で、VRAMDirtyフラグリセットしている
			const src = new Uint8Array(this.#memory.buffer, imagePtr, 640*200*4);
			// キャンバスのイメージデータを作成し
			const dstImageData = canvasCtx.createImageData(640, 200);
			const dst = dstImageData.data;
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
	 * 0000 c3 cold jp   #COLD   ; COLDにジャンプ  
	 * 0003 cd xxxx call xxxx    ; USRを呼び出す  
	 * 0006 cd yyyy call yyyy    ; Jコマンドの飛び先を呼び出す  
	 * 0009 c3 0003 jp   3
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
	ioWrite(addr, value) { 
		if(this.#IO8) {
			this.wasm.writeIO(addr, value);
		}
	}
	ioRead(addr) { 
		if(this.#IO8) {
			return this.wasm.readIO(addr);
		}
		return 0;
	}
	setPCG(codePoint, data)
	{
		const scratchMemory   = this.wasm.getScratchMemory();
		const pcgMemory = new Uint8Array(this.#memory.buffer, scratchMemory, 24);
		for(let i = 0; i < 24; ++i) {
			pcgMemory[i] = data[i];
		}
		this.wasm.writePlatformPCG(codePoint + 0x100, scratchMemory);
	}
	
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
	getCY() { return (this.#Z80Regs[1] & 1) ? true : false; }
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
