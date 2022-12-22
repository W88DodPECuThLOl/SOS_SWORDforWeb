import DataController from './DataController.mjs';
import SectorData from './SectorData.mjs';
import Stream from '../Utils/Stream.mjs';

// DiskImage
export default class {
	/**
	 * D88のヘッダサイズ
	 * @type {number}
	 */
	#DefaultHeaderSize = 0x2b0;

	/**
	 * @type {number}
	 */
	#DefaultSectorSize = 256;

	/**
	 * D88の最大トラック数
	 * @type {number}
	 */
	#MaxTrack = 164;

	/**
	 * @type {number}
	 */
	TrackPerSector = 0;


	/**
	 * D88のヘッダ部分に記録されているディスク名
	 * 
	 * 未加工の生のママのデータ
	 * @type {Uint8Array}
	 */
	DiskName;
	/**
	 * @type {boolean}
	 */
	IsWriteProtect;

	/**
	 * @type {DiskType}
	 */
	DiskType;
	/**
	 * @type {Log}
	 */
	Log;

	/**
	 * @type {number}
	 */
	ImageSize;
	/**
	 * private readonly string ImageFile;
	 * @type {string}
	 */
	#ImageFile;

	/**
	 * 
	 * @type {boolean}
	 */
	PlainFormat;

	/**
	 * long[] 符号付き 64 ビット整数
	 * @type {number[]}
	 */
	TrackAddress = new Array(this.#MaxTrack);

	/**
	 * @type {number}
	 */
	CurrentHeaderSize = 0;

	/**
	 * @type {SectorData[]}
	 */
	Sectors = new Array();

	/**
	 * 
	 * @type {boolean}
	 */
	Verbose;

	/**
	 * 
	 * @type {string}
	 */
	EntryName;

	/**
	 * @type {Encoding}
	 */
	TextEncoding;

	/**
	 * @param {Context} Context
	 */
	constructor(Context) {
		this.TextEncoding = Context.TextEncoding;

		const Setting = Context.Setting;
		this.#ImageFile = Setting.ImageFile;
		this.PlainFormat = Setting.DiskType.PlainFormat;

		this.DiskName = "";
		this.IsWriteProtect = false;
		this.DiskType = Setting.DiskType;
		this.Log = Context.Log;
	}


	/**
	 * 書き込み用としてセクタのデータ部分をデータコントローラで取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {DataController} データコントローラ
	 */
	GetDataControllerForWrite(Sector) {
		return new DataController(this.Sectors[Sector].GetDataForWrite());
	}
	/**
	 * 読み込み用としてセクタのデータ部分をデータコントローラで取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {DataController} データコントローラ
	 */
	GetDataControllerForRead(Sector) {
		return new DataController(this.Sectors[Sector].GetDataForRead());
	}

	/**
	 * 書き込み用としてセクタのデータ部分を取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {Uint8Array} セクタのデータ部分
	 */
	GetSectorDataForWrite(Sector) {
		return this.Sectors[Sector].GetDataForWrite();
	}

	/**
	 * セクタを取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {SectorData} セクタデータ
	 */
	GetSector(Sector) { return this.Sectors[Sector]; }

	/**
	 * フォーマット
	 */
	Format() {
		const tf = this.DiskType.CurrentTrackFormat;
		this.TrackPerSector = tf.TrackPerSector;
		this.#TrackFormat(tf.TrackMax, tf.TrackPerSector);
		this.CurrentHeaderSize = 0;
	}

	/**
	 * フォーマットする
	 * @param {number} TrackMax ディスクの最大トラック数
	 * @param {number} TrackPerSector １トラックのセクタ数
	 */
	#TrackFormat(TrackMax, TrackPerSector) {
		this.Sectors = new Array();
		let Position = this.PlainFormat ? 0x0 : this.#DefaultHeaderSize;
		for (let t = 0; t < TrackMax; t++) {
			this.TrackAddress[t] = Position;
			for (let s = 0; s < TrackPerSector; s++) {
				const Sector = new SectorData();
				Sector.Format(t, s, TrackPerSector, this.#DefaultSectorSize, Position);

				this.Sectors.push(Sector);
				Position += this.#DefaultSectorSize;
			}
		}
	}

	/**
	 * @param {Stream} fs
	 * @returns {boolean}
	 */
	Read(fs) {
		//if (!File.Exists(this.#ImageFile)) return false;
		//var fs = new FileStream(ImageFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
		if (!this.PlainFormat) {
			this.#ReadHeader(fs);
		}

		this.TrackPerSector = this.DiskType.GetTrackPerSector();
		this.#ReadSectors(fs);
		return true;
	}



	/**
	 * イメージを出力する
	 * @param {Stream} fs
	 */
	Write(fs) {
		/*
		let fs = new FileStream(this.#ImageFile,
			FileMode.OpenOrCreate,
			FileAccess.Write,
			FileShare.ReadWrite);
		*/

		const RebuildImage = this.#IsRebuildRequired();
		this.Log.Verbose("RebuildImage:" + RebuildImage);
		if (!this.PlainFormat) {
			if (RebuildImage) this.#WriteHeader(fs);
		}
		this.#WriteSectors(fs, RebuildImage);
	}

	/**
	 * 再構築が必要か
	 * @returns {boolean}
	 */
	#IsRebuildRequired() {
		let LastTrack = -1;
		let MaxDirtyTrack = 0;
		for(s of this.Sectors) {
			if (s.IsDirty) MaxDirtyTrack = s.Track;
		}

		for (let i = 0; i < this.#MaxTrack; i++) {
			if (this.TrackAddress[i] == 0x0) break;
			LastTrack = i;
		}

		// プレーンフォーマットでなく、ヘッダが異なる場合は再構築
		if (!this.PlainFormat && this.CurrentHeaderSize != this.#DefaultHeaderSize) return true;
		if (LastTrack < MaxDirtyTrack) return true;

		return false;
	}

	/**
	 * ヘッダ出力
	 * @param {Stream} fs 
	 */
	#WriteHeader(fs) {
		let header = new Uint8Array(this.#DefaultHeaderSize);
		this.ImageSize = header.length;
		let t = 0;
		for(let s of this.Sectors) {
			if (s.Sector == 0x01) this.TrackAddress[t++] = this.ImageSize;
			this.ImageSize += s.GetLength();
		}

		const dc = new DataController(header);
		dc.SetCopy(0, this.TextEncoding.GetBytes(this.DiskName), 0x10);
		dc.SetByte(0x1a, this.IsWriteProtect ? 0x10 : 0x00);
		dc.SetByte(0x1b, this.DiskType.ImageTypeByte);
		dc.SetLong(0x1c, this.ImageSize);

		// トラック分のアドレスを出力する
		for (let i = 0; i < this.#MaxTrack; i++) {
			const a = this.TrackAddress[i];
			if (a == 0x00) break;
			dc.SetLong(0x20 + (i * 4), a);
		}
		fs.Write(header, 0, header.length);
	}

	/**
	 * 
	 * @param {Stream} fs 
	 * @param {bool} isRebuild 
	 */
	#WriteSectors(fs, isRebuild) {
		let Length = fs.GetSize();
		let Position = this.TrackAddress[0];
		let Skip = true;

		for(let s of this.Sectors) {
			if (!isRebuild) {
				// 変更セクタまでスキップする
				if (Position < Length && !s.IsDirty) {
					Position += s.GetLength();
					Skip = true;
					continue;
				}
				if (Skip) {
					fs.Position = Position;
					Skip = false;
				}
				Position += s.GetLength();
			}
			const d = this.PlainFormat ? s.GetDataForRead() : s.GetBytes();
			fs.Write(d, 0, d.length);
		}
	}



	/**
	 * ヘッダ部分を読み込む
	 * @param {Stream} fs 
	 * @return {boolean} 処理結果 読み込めたら true を返す
	 */
	#ReadHeader(fs) {
		let header = new Uint8Array(this.#DefaultHeaderSize);
		if(fs.Read(header, 0, header.length) != this.#DefaultHeaderSize) {
			return false;
		}

		let dc = new DataController(header);
		this.DiskName = dc.Copy(0, 17);
		this.IsWriteProtect = dc.GetByte(0x1a) != 0x00;
		const diskType = dc.GetByte(0x1b); // diskType
		this.DiskType.SetImageTypeFromHeader(diskType);
		this.ImageSize = dc.GetLong(0x1c); // disk size
		// トラック部のオフセット
		this.CurrentHeaderSize = 0;
		if(this.#MaxTrack > 0) {
			for (let i = 0; i < this.#MaxTrack; i++) {
				this.TrackAddress[i] = dc.GetLong(0x20 + (i * 4));
			}
			this.CurrentHeaderSize = this.TrackAddress[0];
		}
		return true;
	}

	/**
	 * セクタを読み出す
	 * @param {Stream} fs 
	 */
	#ReadSectors(fs) {
		let Track = 0;
		let SectorCount = 1;
		let Address = this.PlainFormat ? 0x00 : this.TrackAddress[Track];
		if (!this.PlainFormat && Address == 0x00) return;
		fs.Seek(Address);

		this.Sectors = new Array();
		while (true) {
			Address = fs.GetPosition();
			let Sector = new SectorData();
			if (!Sector.Read(this.PlainFormat, fs)) break;
			if (!this.PlainFormat) {
				SectorCount = Sector.Sector;
			}
			if (SectorCount == 0x01) {
				if (this.PlainFormat) this.TrackAddress[Track] = Address;
				this.Log.Verbose("Track:" + Track + " Pos:" + Address .toString(16) + " Address:" + this.TrackAddress[Track] .toString(16));
				Track++;
			}
			this.Sectors.push(Sector);
			SectorCount++;
			if (SectorCount > this.TrackPerSector) SectorCount = 1;
		}
	}
}
