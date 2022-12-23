/**
 * キー入力
 * @author 猫大名 ねこ猫
 */
export default class {
	// CatKey

	/**
	 * デフォルトのキー変換関数
	 * 
	 * 数値の場合はUTF-32。文字列の場合は、制御コード。
	 * 制御コードとは、カーソルキー、Home、Endなど画面を操作するもので、Unicodeで存在しないもの。
	 * @param {KeyEvent} e キーイベント
	 * @returns {number|string} 変換したキーコード
	 */
	#defaultKeyConverter(e)
	{
		let keyCode = 0;
		const index = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'.indexOf(e.key);
		if(index >= 0) {
			// Unicode
			keyCode = index + 0x20;
		} else {
			switch (e.key) {
				case 'Backspace':  keyCode = 0x08; break; // BS
				case 'Tab':        keyCode = 0x09; break; // HT
				case 'Enter':      keyCode = 0x0D; break; // CR
				case 'Pause':
				case 'Escape':     keyCode = 0x1B; break; // ESC

				// 制御コード
				case 'Delete':
				case 'ArrowRight':	// カーソル移動
				case 'ArrowLeft':
				case 'ArrowUp':
				case 'ArrowDown':
				case 'Home':	// Homeキー 行頭へ移動
				case 'End':		// Endキー	行末へ移動
					keyCode = e.key;
					break;
			}
		}
		return keyCode;
	}

	/**
	 * キー変換関数
	 * 
	 * KeyEventからキーコードを生成する
	 * @type {function}
	 */
	#keyCodeConverter;

	/**
	 * キーに入力バッファ
	 * 
	 * 入力されたキーが一旦蓄えられる
	 * dequeueKeyBuffer()で取得する。
	 * @type {number|string[]}
	 */
	#keyBuffer;

	/**
	 * キーバッファの最大サイズ
	 * @type {number}
	 */
	#keyBufferSize;

	/**
	 * キーの押下状態
	 * 
	 * 押されていればtrue。
	 * @type {Map}
	 */
	#keyDown;

	/**
	 * 最後に押下されたキーコード
	 * @type {number|string}
	 */
	#lastKeyCode;

	/**
	 * キー押下時に呼び出される
	 * @param {CatKey} self CatKey
	 * @param {KeyEvent} e キーイベント
	 */
	#keyDownHandler(self, e) {
		// キー入力
		const keyCode = self.#keyCodeConverter(e);
		if(keyCode) {
			// バッファに積む
			self.enqueueKeyBuffer(keyCode);
		}
	}

	/**
	 * キーアップ時に呼び出される
	 * @param {CatKey} self CatKey
	 * @param {KeyEvent} e キーイベント
	 */
	#keyUpHandler(self, e) {
		const keyCode = self.#keyCodeConverter(e);
		if(keyCode) {
			self.#keyUp(keyCode);
		}
	}

	/**
	 * 
	 * @param {number|string} keyCode キーコード
	 */
	#keyUp(keyCode)
	{
		this.#keyDown.set(keyCode, false);
	}

	/**
	 * コンストラクタ
	 * @param {*} document ドキュメント
	 * @param {function} keyCodeConverter (keyイベント)=>{return UTF-32 or 文字列}
	 */
	constructor(document, keyCodeConverter)
	{
		this.#keyDown = new Map();
		this.#keyCodeConverter = keyCodeConverter ? keyCodeConverter : this.#defaultKeyConverter;
		this.#keyBuffer = [];
		this.#keyBufferSize = 16;
		this.#lastKeyCode = '';
		document.addEventListener('keydown', (e)=>this.#keyDownHandler(this, e), false);
		document.addEventListener('keyup', (e)=>this.#keyUpHandler(this, e), false);
	}

	/**
	 * キーバッファに入れる
	 * @param {number|string} keyCode キーコード
	 * @returns {boolean} キューに入れれたら true
	 */
	enqueueKeyBuffer(keyCode) {
		this.#keyDown.set(keyCode, true);
		// 最後に入力されたキーコードを覚えておく
		this.#lastKeyCode = keyCode;
		// キューに積む
		if(this.#keyBuffer.length < this.#keyBufferSize) {
			this.#keyBuffer.unshift(keyCode);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * キーバッファから取得する
	 * @returns {number|string} キーコード。キーバッファが空なら、0を返す
	 */
	dequeueKeyBuffer() {
		if(this.#keyBuffer.length > 0) {
			return this.#keyBuffer.pop();
		} else {
			return 0;
		}
	}

	/**
	 * キーバッファをクリアする
	 */
	keyBufferClear() {
		this.#keyBuffer.length = 0;
		this.#keyDown = new Map();
		this.#lastKeyCode = 0;
	}

	/**
	 * キーが押下されているかどうか
	 * @param {number|string} keyCode 調べるキーコード
	 * @returns {boolean} 押下されていたら true を返す
	 */
	isKeyDown(keyCode)
	{
		if(keyCode && this.#keyDown.has(keyCode)) {
			return !!this.#keyDown.get(keyCode);
		}
		return false;
	}

	/**
	 * 最後に入力されたキーが押下されているかどうか
	 * @returns {number|string} キーコード。押下されていなかったら0を返す。
	 */
	inKey() {
		if(this.#lastKeyCode
			&& this.#keyDown.has(this.#lastKeyCode)
			&& this.#keyDown.get(this.#lastKeyCode)) {
			return this.#lastKeyCode;
		}
		return 0;
	}
}