/**
 * サウンドチップのベース
 */
class SoundChip {
	/**
	 * Wasm
	 */
	wasm;
	/**
	 * Wasmのメモリ
	 */
	memory;
	/**
	 * チップのコンテキスト
	 */
	ctx;
	/**
	 * サウンドバッファ
	 * @type {Array}
	 */
	buffer;
	/**
	 * 同期用のチック
	 * 
	 * ・外部のチックと内部のチックの差で、サウンドを生成するときに使用している  
	 *   例）外部が100で、同期用のチックが20だったら、80だけサウンドを生成する
	 * @type {number}
	 */
	tick;
	/**
	 * OPMに供給されているクロック周波数
	 * @type {number}
	 */
	clock;

	/**
	 * 小さいほうを返す
	 * 
	 * @param {number} x 
	 * @param {number} y 
	 * @returns {number} 小さいほう
	 */
	min(x,y) { return (x < y) ? x : y; }

	/**
	 * サウンドを生成し、サウンドバッファへ格納する
	 * @param {number} samples 生成するサンプル数
	 */
	generateCore(samples) {}

	/**
	 * コンストラクタ
	 * 
	 * @param {*} wasm 
	 * @param {*} memory 
	 * @param {*} ctx チップのコンテキスト
	 * @param {number} clock チップに供給されているクロックの周波数(Hz)
	 * @param {number} sampleRate サンプリングレート(Hz)
	 */
	constructor(wasm, memory, ctx, clock, sampleRate)
	{
		this.wasm = wasm;
		this.memory = memory;
		this.ctx = ctx;
		this.buffer = new Array();
		this.tick = 0;
		this.clock = clock;
	}

	/**
	 * デストラクタ
	 */
	destructor()
	{
	}

	/**
	 * 同期用のチックをリセットする
	 * 
	 * @param {number} tick リセットする値
	 */
	reset(tick)
	{
		this.tick = tick;
	}

	/**
	 * サウンドバッファをクリアする
	 */
	clearBuffer()
	{
		this.reset(0);
		this.buffer.length = 0;
	}

	/**
	 * サウンドを生成しサウンドバッファへ格納する
	 * 
	 * ・内部用のチックと外部チックの差分だけサウンドを生成する  
	 * ・生成後、内部用のチックを進める
	 * @param {number} targetTick 外部のチック
	 */
	generate(targetTick)
	{
		while(this.tick < targetTick) {
			const diff = targetTick - this.tick; // clock(Hz)
			const sec = (diff / this.clock); // sec(秒)
			const samples = sec * this.sampleRate; // サンプル数
			// 生成
			this.generateCore(samples);
			// 内部クロックを進める
			this.tick += diff;
		}
	}
}

/**
 * OPMのサウンドチップ
 */
class OPM extends SoundChip {
	/**
	 * サウンドを生成し、サウンドバッファへ格納する
	 * @param {number} samples 生成するサンプル数
	 */
	generateCore(samples)
	{
		const wave = new Int32Array(this.memory.buffer, this.wasm.OPM_generate(this.ctx, samples), samples * 2);
		for(let i = 0; i < samples; ++i) {
			this.buffer.push(wave[i * 2 + 0]);
			this.buffer.push(wave[i * 2 + 1]);
		}
	}

	/**
	 * コンストラクタ
	 * 
	 * @param {*} wasm 
	 * @param {*} memory 
	 * @param {number} clock チップに供給されているクロックの周波数(Hz)
	 * @param {number} sampleRate サンプリングレート(Hz)
	 */
	constructor(wasm, memory, clock, sampleRate)
	{
		const ctx = wasm.OPM_new(clock, sampleRate);
		super(wasm, memory, ctx, clock, sampleRate);
	}

	/**
	 * デストラクタ
	 */
	destructor()
	{
		if(this.ctx) {
			this.wasm.OPM_delete(this.ctx);
			this.ctx = null;
		}
	}

	/**
	 * レジスタに書き込む
	 * 
	 * @param {number} registerNo 書き込むレジスタ番号
	 * @param {number} value 書き込む値
	 */
	writeRegister(registerNo, value)
	{
		this.wasm.OPM_SetReg(this.ctx, registerNo, value);
	}	

	/**
	 * サウンドを出力する
	 * @param {*} output 
	 */
	writeOutput(output)
	{
		const s = (1.0/32768.0) * (1 / 4.0);

		// まずは、バッファにあるものから
		let remain = output[0].length;
		let pos = 0;
		if(this.buffer.length > 0) {
			const size = this.min(remain, this.buffer.length / 2);
			for(let i = 0; i < size; ++i) {
				for (let channel = 0; channel < output.length; ++channel) {
					output[channel][pos] += this.buffer.shift() * s;
				}
				pos++;
			}
			remain -= size;
		}

		// 不足していたら、生成して出力する
		if(remain > 0) {
			const buffer = this.wasm.OPM_generate(this.ctx, remain);
			const wave = new Int32Array(this.memory.buffer, buffer, remain * 2);
			for(let i = 0; i < remain; ++i) {
				for (let channel = 0; channel < output.length; ++channel) {
					output[channel][pos] += wave[i * 2 + channel] * s;
				}
				pos++;
			}
		}

		// 内部のバッファに溜まりすぎていたら、安全のためクリアする
		if(this.buffer.length > output[0].length * 4) {
			this.buffer.length = 0;
		}
	}
}

/**
 * PSGのサウンドチップ
 */
class PSG extends SoundChip {
	/**
	 * サウンドを生成し、サウンドバッファへ格納する
	 * @param {number} samples 生成するサンプル数
	 */
	generateCore(samples)
	{
		for(let i = 0; i < samples; ++i) {
			this.buffer.push(this.wasm.PSG_calc(this.ctx));
		}
	}

	/**
	 * コンストラクタ
	 * 
	 * @param {*} wasm 
	 * @param {*} memory 
	 * @param {number} clock チップに供給されているクロックの周波数(Hz)
	 * @param {number} sampleRate サンプリングレート(Hz)
	 */
	constructor(wasm, memory, clock, sampleRate)
	{
		const ctx = wasm.PSG_new(clock, sampleRate);
		wasm.PSG_setVolumeMode(ctx, 2);
		wasm.PSG_reset(ctx);
		super(wasm, memory, ctx, clock, sampleRate);
	}

	/**
	 * デストラクタ
	 */
	destructor()
	{
		if(this.ctx) {
			this.wasm.PSG_delete(this.ctx);
			this.ctx = null;
		}
	}

	/**
	 * レジスタに書き込む
	 * 
	 * @param {number} registerNo 書き込むレジスタ番号
	 * @param {number} value 書き込む値
	 */
	writeRegister(registerNo, value)
	{
		this.wasm.PSG_writeReg(this.ctx, registerNo, value);
	}

	/**
	 * サウンドを出力する
	 * @param {*} output 
	 */
	writeOutput(output)
	{
		const s = (1.0/32768.0) * (1 / 4.0);

		// まずは、バッファにあるものから
		let remain = output[0].length;
		let pos = 0;
		if(this.buffer.length > 0) {
			const size = this.min(remain, this.buffer.length);
			for(let i = 0; i < size; ++i) {
				const v = device.buffer.shift() * s;
				for (let channel = 0; channel < output.length; ++channel) {
					output[channel][pos] = v;
				}
				pos++;
			}
			remain -= size;
		}

		// 不足していたら、生成して出力する
		if(remain > 0) {
			for(let i = 0; i < remain; ++i) {
				const v = this.wasm.PSG_calc(this.ctx) * s;
				for (let channel = 0; channel < output.length; ++channel) {
					output[channel][pos] = v;
				}
				pos++;
			}
		}

		// 内部のバッファに溜まりすぎていたら、安全のためクリアする
		if(this.buffer.length > output[0].length * 4) {
			this.buffer.length = 0;
		}
	}
}


class GainProcessor extends AudioWorkletProcessor {
	/**
	 * 使用するヒープサイズ(64KiBの倍数であること)
	 */
	#heapSize = 16*1024*1024; // 16MiB

	/**
	 * Wasmのメモリ
	 */
	#memory;

	/**
	 * PSGに供給されているクロック周波数
	 * @type {number}
	 */
	#PSG_CLOCK = 2000000;
	/**
	 * OPMに供給されているクロック周波数
	 * @type {number}
	 */
	#OPM_CLOCK = 4000000;

	/**
	 * サウンドのデバイス
	 * @type {Array}
	 */
	#devices = new Array(3);

	/**
	 * 有効かどうか
	 * 
	 * 初期化が終わって使えるようになると true になる
	 * @type {boolean}
	 */
	#enable = false;

	/**
	 * コンストラクタ
	 * @param {*} wasmBinary 
	 */
	constructor(wasmBinary) {
		super();

		// メモリ確保
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });
		// WASM作成
		const importObject = {
			env: {memory: this.#memory},
			js: {
				sin:(x)=>{ return Math.sin(x); },
				pow:(x, y)=>{ return Math.pow(x, y); },
				log:(x)=>{ return Math.log(x); },
				floor:(x)=>{ return Math.floor(x); },
				rand:()=>{ return Math.random() * 32767; }
			}
		};
		const module = new WebAssembly.Module(wasmBinary.processorOptions.wasmBinary);
		const instance = new WebAssembly.Instance(module, importObject);
		this.wasm = instance.exports;

		// 初期化
		const sampleRate = wasmBinary.processorOptions.sampleRate; // サンプリングレート
		this.wasm.soundSystemInitialize(this.wasm.__heap_base, this.#heapSize - this.wasm.__heap_base);
		// PSG初期化
		this.wasm.PSG_initialize();
		this.#devices[0] = new PSG(this.wasm, this.#memory, this.#PSG_CLOCK, sampleRate);
		// OPM初期化
		this.wasm.OPM_initialize();
		this.#devices[1] = new OPM(this.wasm, this.#memory, this.#OPM_CLOCK, sampleRate);
		this.#devices[2] = new OPM(this.wasm, this.#memory, this.#OPM_CLOCK, sampleRate);
		// メッセージ受け取りの登録
		this.port.onmessage = (event)=>{
			if(this.#enable) {
				const message = event.data;
				switch(message.message){
					// 内部のチックをリセットして、CPU側と同期する
					case 'reset':
						this.#devices.forEach((device) => device.reset(message.executedClock));
						break;
					// 先行して作成していたサウンドバッファをクリアする
					case 'clearBuffer':
						this.#devices.forEach((device) => device.clearBuffer());
						break;
					// レジスタ書き込み
					// ・進んでる分だけ、サウンドを生成してバッファに溜めておく
					case 'writeRegister':
						{
							const device = this.#devices[message.no];
							const targetTick = message.executedClock;
							device.generate(targetTick); // 進んでいる分のサウンドを生成
							device.writeRegister(message.reg, message.value);
						}
						break;
				}
			}
		}
		// 準備完了
		this.#enable = true;
	}

	/**
	 * デストラクタ
	 */
	destructor()
	{
		this.#enable = false;
		this.#devices.forEach(device => device.destructor());
		this.#devices.length = 0;
		this.wasm.OPM_terminate();
		this.wasm.PSG_terminate();
		this.wasm.soundSystemTerminate();
	}

	process(inputs, outputs, parameters) {
		if(this.#enable) {
			const output = outputs[0];
			this.#devices.forEach(device => device.writeOutput(output));
		}
		return true;
	}

	static get parameterDescriptors() {
		return [{
			name: "customGain",
			defaultValue: 1,
			minValue: 0,
			maxValue: 1,
			automationRate: "a-rate"
		}];
	}
}
registerProcessor('catAudioWorkletProcessor', GainProcessor);
