// Stream
export default class {
	/**
	 * ファイル名
	 * @type {string}
	 */
	#Filename;
	/**
	 * バッファ
	 * @type {Uint8Array} 
	 */
	#buffer;

	/**
	 * 位置
	 * @type {number}
	 */
	#position;

	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.#Filename = "";
		this.#buffer = new Uint8Array();
		this.#position = 0;
	}

	/**
	 * 書き込み用にセットアップする
	 * @param {string} Filename ファイル名
	 * @param {number} FileSize ファイルサイズ
	 */
	SetupWrite(Filename, FileSize)
	{
		this.#Filename = Filename;
		this.#buffer = new Uint8Array(FileSize);
		this.#position = 0;
	}

	/**
	 * 読み込み用にセットアップする
	 * @param {string} Filename ファイル名
	 * @param {Uint8Array} FileData ファイルのデータ
	 */
	SetupRead(Filename, FileData)
	{
		this.#Filename = Filename;
		this.#buffer = new Uint8Array(FileData.length);
		this.#buffer.set(FileData);
		this.#position = 0;
	}

	/**
	 * バッファサイズを取得する
	 * @returns {number} 現在のバッファのサイズ
	 */
	GetSize() {
		return this.#buffer.length;
	}

	/**
	 * バッファに値を書き込む
	 * @param {number} value 書き込む値(バイト)
	 * @returns {number} 書き込めたサイズ
	 */
	Write8(value)
	{
		if(this.#position >= this.#buffer.length) { return 0; }
		this.#buffer[this.#position++] = value;
		return 1;
	}

	/**
	 * バッファの値を読み込む
	 * @param {number} position 読む位置
	 * @returns {number} 値
	 */
	Read8()
	{
		if(this.#position >= this.#buffer.length) { return -1; }
		return this.#buffer[this.#position++];
	}

	Write(Buffer, Offset, Size)
	{
		for(let i = 0; i < Size; i++) {
			this.Write8(Buffer[Offset + i]);
		}
	}

	Read(Buffer, Offset, Size)
	{
		for(let i = 0; i < Size; i++) {
			const ch = this.Read8();
			if(ch < 0) {
				return i;
			}
			Buffer[Offset + i] = ch & 0xFF;
		}
		return Size;
	}

	Seek(Position)
	{
		this.#position = Position;
	}

	GetPosition()
	{
		return this.#position;
	}

	/**
	 * ファイル名を取得する
	 * @returns {string} ファイル名
	 */
	GetFilename() { return this.#Filename; }

	/**
	 * バッファを取得する
	 * @returns {Uint8Array} バッファ
	 */
	GetBuffer() { return this.#buffer; }
}
