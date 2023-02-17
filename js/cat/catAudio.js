class CatAudio {
	#audioCtx = null;
	gainWorkletNode;

	constructor()
	{
	}

	async init(wasmBinary)
	{
		this.term();

		this.#audioCtx = new AudioContext();
		await this.#audioCtx.audioWorklet.addModule('./js/cat/catAudioWorkletProcessor.js');
		this.gainWorkletNode = new AudioWorkletNode(this.#audioCtx, 'catAudioWorkletProcessor',  {
			outputChannelCount: [2],
			processorOptions: {
				wasmBinary: wasmBinary,
				sampleRate: this.#audioCtx.sampleRate
			}
		});
		const vol = new GainNode(this.#audioCtx, { gain: 1.0 });
		this.gainWorkletNode.connect(vol).connect(this.#audioCtx.destination);
	}

	term()
	{
		if(this.#audioCtx) {
			this.#audioCtx.close();
			this.#audioCtx = null;
		}
	}

	resume()
	{
		this.#audioCtx.resume().then(() => {
			console.log('Playback resumed successfully');
		});
	}

	writeReg(executedClock, reg, value)
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage(
				{
					message: 'writeReg',
					executedClock: executedClock,
					reg: reg,
					value: value
				}
			);
		}
	}
	writeOPM1Reg(executedClock, reg, value)
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage(
				{
					message: 'writeOPM1Reg',
					executedClock: executedClock,
					reg: reg,
					value: value
				}
			);
		}
	}
	writeOPM2Reg(executedClock, reg, value)
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage(
				{
					message: 'writeOPM2Reg',
					executedClock: executedClock,
					reg: reg,
					value: value
				}
			);
		}
	}
	
}

