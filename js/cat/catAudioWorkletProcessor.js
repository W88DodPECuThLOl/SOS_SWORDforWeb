class GainProcessor extends AudioWorkletProcessor {
	/**
	 * 使用するヒープサイズ(64KiBの倍数であること)
	 */
	#heapSize = 256*1024*1024; // 256MiB

	/**
	 * Wasmのメモリ
	 */
	#memory;

	psg;
	ctx;
	#tick;
	enable = false;
	#PSG_CLOCK = 2000000;
	#sampleRate;
	buffer;

	constructor(wasmBinary) {
		super();

		// メモリ確保
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });

		const importObject = {env: {memory: this.#memory}};
		const module = new WebAssembly.Module(wasmBinary.processorOptions.wasmBinary);
		const instance = new WebAssembly.Instance(module, importObject);
		this.psg = instance.exports;
		// 初期化
		this.psg.PSG_initialize(this.psg.__heap_base, this.#heapSize - this.psg.__heap_base);

		this.#sampleRate = wasmBinary.processorOptions.sampleRate;
		this.ctx = this.psg.PSG_new(this.#PSG_CLOCK, wasmBinary.processorOptions.sampleRate);
		this.psg.PSG_setVolumeMode(this.ctx, 2);
		this.psg.PSG_reset(this.ctx);

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
								this.buffer.push(this.psg.PSG_calc(this.ctx) * (1.0/32768.0));
								this.#tick += this.#PSG_CLOCK / this.#sampleRate;
							}
							this.psg.PSG_writeReg(this.ctx, message.reg, message.value);
						}
						break;
					case 'flush':
						this.#tick = 0;
						this.buffer.length = 0;
						break;
				}
			}
		}
		this.enable = true;
	}

	process(inputs, outputs, parameters) {
		if(this.enable) {
			let output = outputs[0];
			//const wavePtr = this.psg.PSG_generate(this.ctx, output[0].length);
			//const wave = new Float32Array(this.#memory.buffer, wavePtr, 64*1024);
			//for (let channel = 0; channel < output.length; ++channel) {
			//	for(let i = 0; i < output[0].length; ++i) {
			//		output[channel][i] = wave[i];
			//	}
			//}
			for(let i = 0; i < output[0].length; ++i) {
				const v = (this.buffer.length > 0) ? this.buffer.shift() : this.psg.PSG_calc(this.ctx) * (1.0/32768.0);
				for (let channel = 0; channel < output.length; ++channel) {
					output[channel][i] = v;
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
