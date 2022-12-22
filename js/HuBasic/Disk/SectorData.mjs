import DataController from './DataController.mjs';

// SectorData
export default class {
	/**
	 * @type {number}
	 */
	Track;
	/**
	 * @type {number}
	 */
	Side;
	/**
	 * @type {number}
	 */
	Sector;
	/**
	 * @type {number}
	 */
	NumOfSector;
	/**
	 * @type {number}
	 */
	SectorsInTrack;

	/**
	 * @type {number}
	 */
	Density;

	/**
	 * @type {boolean}
	 */
	IsDelete;
	/**
	 * @type {number}
	 */
	Status;

	/**
	 * long
	 * @type {number}
	 */
	Position;

	/**
	 * データ部分のサイズ
	 * @type {number}
	 */
	DataSize;

	/**
	 * セクタのデータ部分
	 * @type {Uint8Array}
	 */
	#Data;
	/**
	 * セクタのヘッダ部分
	 * @type {Uint8Array}
	 */
	#Header;

	/**
	 * セクタを作成したときのデータの初期値。0～255の値(byte)
	 * @type {number}
	 */
	#FillValue;
	/**
	 * データが変更されているかどうか
	 * @type {boolean}
	 */
	IsDirty;
	/**
	 * デフォルトのセクタサイズ int
	 * @type {number}
	 */
	#DefaultSectorSize = 256;

	/**
	 * コンストラクタ
	 * @param {number} FillValue セクタを作成したときのデータの初期値。0～255の値(byte)
	 */
	constructor(FillValue = 0xe5) {
		this.#FillValue = FillValue & 0xFF;
	}

	/**
	 * セクタをフォーマットする
	 * @param {number} t 
	 * @param {number} s 
	 * @param {number} TrackPerSector 
	 * @param {number} SectorSize セクタサイズ(バイト単位)
	 * @param {number} Position ディスク内でのオフセット位置
	 */
	Format(t, s, TrackPerSector, SectorSize, Position) {
		this.#Make(t >> 1, t & 1, s + 1, 1, TrackPerSector, 0, false, 0, SectorSize);
		this.Position = Position;
	}

	/**
	 * セクタを作成する
	 * @param {number} Track 
	 * @param {number} Side 
	 * @param {number} Sector 
	 * @param {number} NumOfSector 
	 * @param {number} SectorsInTrack 
	 * @param {number} Density 
	 * @param {boolean} Delete 
	 * @param {number} Status 
	 * @param {number} DataSize データサイズ（バイト単位）
	 */
	#Make(Track, Side, Sector, NumOfSector, SectorsInTrack, Density, Delete, Status, DataSize) {
		this.#Header = new Uint8Array(0x10);
		const dc = new DataController(Header);

		this.Track = Track;
		this.Side = Side;
		this.Sector = Sector;
		this.NumOfSector = NumOfSector;
		this.SectorsInTrack = SectorsInTrack;
		this.Density = Density;
		this.IsDelete = !!Delete;
		this.Status = Status;
		this.DataSize = DataSize;
		this.IsDirty = true;

		dc.SetByte(0, Track);
		dc.SetByte(1, Side);
		dc.SetByte(2, Sector);
		dc.SetByte(3, NumOfSector);
		dc.SetWord(4, SectorsInTrack);
		dc.SetByte(6, Density);
		dc.SetByte(7, this.IsDelete ? 0x10 : 0x00);
		dc.SetByte(8, Status);
		dc.SetWord(0x0e, DataSize);

		this.#Data = new Uint8Array(DataSize);
		dc.SetBuffer(this.#Data);
		dc.Fill(this.#FillValue);
	}

	/**
	 * セクタのヘッダ部分とデータ部分を結合した部分を取得する
	 * @returns {Uint8Array} セクタのヘッダ部分とデータ部分を結合した部分もの
	 */
	GetBytes() {
		let result = new Uint8Array(this.#Header.length + this.#Data.length);
		result.set(this.#Header);
		result.set(this.#Data, this.#Header.length);
		return result;
	}

	/**
	 * セクタのヘッダ部分とデータ部分の合計サイズ
	 * @returns {number} セクタのヘッダ部分とデータ部分の合計サイズ
	 */
	GetLength() {
		return this.#Header.length + this.#Data.length;
	}

	/**
	 * セクタへデータを設定する
	 * @param {boolean} IsPlain プレーンなセクタかどうか（ヘッダが無い場合true）
	 * @param {Stream} fs ファイルストリーム
	 * @returns {boolean} 読み込めたかどうか
	 */
	Read(IsPlain, fs) {
		this.Position = fs.GetPosition();
		this.DataSize = this.#DefaultSectorSize;
		if (!IsPlain && !this.#ReadSectorHeader(fs)) return false;
		this.#Data = new Uint8Array(this.DataSize);
		return (fs.Read(this.#Data, 0, this.DataSize) == this.DataSize);
	}

	/**
	 * セクタのヘッダ部分を読み込む
	 * @param {FileStream} fs ファイルストリーム
	 * @returns {boolean} 読み込めたかどうか
	 */
	#ReadSectorHeader(fs) {
		this.#Header = new Uint8Array(0x10);
		const s = fs.Read(this.#Header, 0, 0x10);
		if (s < 0x10) return false;
		const dc = new DataController(this.#Header);
		this.Track = dc.GetByte(0);
		this.Side = dc.GetByte(1);
		this.Sector = dc.GetByte(2);
		this.NumOfSector = dc.GetByte(3);
		this.SectorsInTrack = dc.GetWord(4);
		this.Density = dc.GetByte(6);
		this.IsDelete = dc.GetByte(7) != 0x00;
		this.Status = dc.GetByte(8);
		this.DataSize = dc.GetWord(0x0e);
		return true;
	}


	/**
	 * 中身をログに出力する
	 */
	Description() {
		console.log("C:" + this.Track + " H:" + this.Side + " R:" + this.Sector + " N:" + this.NumOfSector
			+ " SectorsInTrack:" + this.SectorsInTrack +" Density:" + this.Density
			+ " DeleteFlag:"+ this.IsDelete + " Status:" + this.Status + " DataSize:" + this.DataSize);
	}


	/**
	 * 書き込み用としてデータ部分を取得する
	 * @returns {Uint8Array} データ部分
	 */
	GetDataForWrite() {
		this.IsDirty = true; // データが変更されているフラグ立てる
		return this.#Data;
	}

	/**
	 * 読み込み用としてデータ部分を取得する
	 * @returns {Uint8Array} データ部分
	 */
	GetDataForRead() {
		return this.#Data;
	}

	/**
	 * データ部分全体を指定された値で埋める
	 * @param {number} Value 埋める値
	 */
	Fill(Value) {
		this.GetDataForWrite().fill(Value);
	}
}
