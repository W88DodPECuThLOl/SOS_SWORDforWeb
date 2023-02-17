class GainProcessor extends AudioWorkletProcessor {
	/**
	 * 使用するヒープサイズ(64KiBの倍数であること)
	 */
	#heapSize = 16*1024*1024; // 16MiB

	/**
	 * Wasmのメモリ
	 */
	#memory;

	psg;
	opm1;
	opm2;
	#tick;
	enable = false;
	#PSG_CLOCK = 2000000;
	#OPM_CLOCK = 4000000;
	#sampleRate;
	buffer;

	constructor(wasmBinary) {
		super();

		// メモリ確保
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });

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
		this.wasm.PSG_initialize(this.wasm.__heap_base, this.#heapSize - this.wasm.__heap_base);
		this.wasm.OPM_initialize(this.wasm.__heap_base, this.#heapSize - this.wasm.__heap_base);
		
		// PSG初期化
		this.#sampleRate = wasmBinary.processorOptions.sampleRate;
		this.psg = this.wasm.PSG_new(this.#PSG_CLOCK, wasmBinary.processorOptions.sampleRate);
		this.wasm.PSG_setVolumeMode(this.psg, 2);
		this.wasm.PSG_reset(this.psg);
		// OPM初期化
		this.opm1 = this.wasm.OPM_new(this.#OPM_CLOCK, this.#sampleRate);
		this.opm2 = this.wasm.OPM_new(this.#OPM_CLOCK, this.#sampleRate);

		this.#tick = 0;
		this.buffer = new Array();

		this.port.onmessage = (event)=>{
			if(this.enable) {
				const message = event.data;
				switch(message.message){
					case 'writeReg':
						{
							const now = message.executedClock;
							while(this.#tick < now) {
								this.buffer.push(this.wasm.PSG_calc(this.psg) * (1.0/32768.0));
								this.#tick += this.#PSG_CLOCK / this.#sampleRate;
							}
							this.wasm.PSG_writeReg(this.psg, message.reg, message.value);
						}
						break;
					case 'flush':
						this.#tick = 0;
						this.buffer.length = 0;
						break;

					case 'writeOPM1Reg':
						this.wasm.OPM_SetReg(this.opm1, message.reg, message.value);
						break;
					case 'writeOPM2Reg':
						this.wasm.OPM_SetReg(this.opm2, message.reg, message.value);
						break;
				}
			}
		}
		this.enable = true;
	}

	process(inputs, outputs, parameters) {
		if(this.enable) {
			let output = outputs[0];
			//const wavePtr = this.wasm.PSG_generate(this.psg, output[0].length);
			//const wave = new Float32Array(this.#memory.buffer, wavePtr, 64*1024);
			//for (let channel = 0; channel < output.length; ++channel) {
			//	for(let i = 0; i < output[0].length; ++i) {
			//		output[channel][i] = wave[i];
			//	}
			//}
			const s = 1 / 4.0;
			for(let i = 0; i < output[0].length; ++i) {
				const v = (this.buffer.length > 0) ? this.buffer.shift() : this.wasm.PSG_calc(this.psg) * (1.0/32768.0);
				for (let channel = 0; channel < output.length; ++channel) {
					output[channel][i] = v * s;
				}
			}

			{
				const buffer = this.wasm.OPM_generate(this.opm1, output[0].length);
				const wave = new Int32Array(this.#memory.buffer, buffer, 64*1024);
				for(let i = 0; i < output[0].length; ++i) {
					for (let channel = 0; channel < output.length; ++channel) {
						output[channel][i] += wave[i * 2 + channel] * (1.0/32768.0) * s;
					}
				}
			}
			{
				const buffer = this.wasm.OPM_generate(this.opm2, output[0].length);
				const wave = new Int32Array(this.#memory.buffer, buffer, 64*1024);
				for(let i = 0; i < output[0].length; ++i) {
					for (let channel = 0; channel < output.length; ++channel) {
						output[channel][i] += wave[i * 2 + channel] * (1.0/32768.0) * s;
					}
				}
			}
		}
		return true;
	}

	static get parameterDescriptors() {
		return [
			{
				name: "customGain",
				defaultValue: 1,
				minValue: 0,
				maxValue: 1,
				automationRate: "a-rate",
			}
		];
	}

}
registerProcessor('catAudioWorkletProcessor', GainProcessor);
