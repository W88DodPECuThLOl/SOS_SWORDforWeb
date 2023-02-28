class CatAudio {
	#audioCtx = null;
	#module = './js/cat/catAudioWorkletProcessor.js';
	#processorName = 'catAudioWorkletProcessor';
	gainWorkletNode;

	constructor()
	{
	}

	async init(wasmBinary)
	{
		this.term();

		this.#audioCtx = new AudioContext();
		await this.#audioCtx.audioWorklet.addModule(this.#module);
		this.gainWorkletNode = new AudioWorkletNode(this.#audioCtx, this.#processorName,  {
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

	/**
	 * Tickをリセットして、CPU側のクロックと同期させる
	 */
	reset()
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage({
				message: 'reset',
				executedClock: 0
			});
		}
	}
	
	/**
	 * 溜まっているサウンドデータをクリア
	 */
	clearBuffer()
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage({ message: 'clearBuffer' });
		}
	} 

	/**
	 * サウンドデバイスのレジスタに値を書き込む
	 * 
	 * executedClockは、同期用の値で、reset()が呼び出されてからどのくらいクロックが進んだのかを設定する。
	 * @param {number} executedClock 書き込まれた時の経過しているクロック
	 * @param {number} no サウンドデバイスの番号(0～)
	 * @param {number} reg 書き込むレジスタ番号
	 * @param {number} value 書き込む値
	 */
	writeRegister(executedClock, no, reg, value)
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage({
				message: 'writeRegister',
				executedClock: executedClock,
				no: no,
				reg: reg,
				value: value
			});
		}
	}

	/**
	 * ボリュームを設定する
	 * @param {number} no サウンドデバイスの番号(0～) -1だと全部に設定する
	 * @param {number} value 書き込む値
	 */
	setVolume(no, value)
	{
		if(this.#audioCtx && this.gainWorkletNode) {
			this.gainWorkletNode.port.postMessage({
				message: 'setVolume',
				no: no,
				value: value
			});
		}
	}
}
