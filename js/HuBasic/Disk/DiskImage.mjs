"use strict";

import DataController from './DataController.mjs';
import SectorData from './SectorData.mjs';
import Stream from '../Utils/Stream.mjs';
import { LogType } from '../Utils/LogType.mjs';

//
// メモ）
// ディスクイメージファイルのフォーマット
// https://github.com/jpzm/wii88/blob/master/document/FORMAT.TXT
//

// DiskImage
export default class {
	/**
	 * D88のヘッダサイズ
	 * @type {number}
	 */
	#D88HeaderSize = 0x2b0;

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
	 * D88のヘッダ部分に記録されているディスクの名前
	 * 
	 * 17バイト  
	 * 未加工の生のママのデータ
	 * @type {Uint8Array}
	 */
	DiskName = new Uint8Array(17);
	/**
	 * ライトプロテクト
	 * @type {boolean}
	 */
	IsWriteProtect = false;

	/**
	 * ディスクの種類
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
	 * 生データかどうか（ヘッダがない）
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
		// ディスクタイプ
		this.DiskType = Setting.DiskType;
		// ログ
		this.Log = Context.Log;
		// 生データかどうか（ヘッダがない）
		this.PlainFormat = this.DiskType.GetPlainFormat();
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
		this.TrackPerSector = tf.GetTrackPerSector();
		this.#TrackFormat(tf.GetTrackMax(), tf.GetTrackPerSector(), this.#DefaultSectorSize);
		this.CurrentHeaderSize = 0;
	}

	/**
	 * フォーマットする
	 * @param {number} TrackMax ディスクの最大トラック数
	 * @param {number} TrackPerSector １トラックのセクタ数
	 * @param {number} SectorSize １セクタのバイト数
	 */
	#TrackFormat(TrackMax, TrackPerSector, SectorSize) {
		this.Sectors = new Array();
		let Position = this.PlainFormat ? 0x0 : this.#D88HeaderSize;
		for (let t = 0; t < TrackMax; t++) {
			this.TrackAddress[t] = Position;
			for (let s = 0; s < TrackPerSector; s++) {
				const Sector = new SectorData();
				Sector.Format(t, s, TrackPerSector, SectorSize, Position);
				this.Sectors.push(Sector);
				Position += SectorSize;
			}
		}
	}

	/**
	 * ディスクイメージを読み込む
	 * @param {Stream} fs
	 * @returns {boolean}
	 */
	Read(fs) {
		if (!this.PlainFormat) {
			// D88のヘッダ部分を読み込む
			if(!this.#ReadHeader(fs)) {
				return false; // ヘッダ部分、読み込めなかった
			}
		}
		this.TrackPerSector = this.DiskType.GetTrackPerSector();
		return this.#ReadSectors(fs);
	}

	/**
	 * イメージを出力する
	 * @param {Stream} fs
	 */
	Write(fs) {
		/*
		const RebuildImage = this.#IsRebuildRequired();
		this.Log.Verbose("RebuildImage:" + RebuildImage);
		if (!this.PlainFormat) {
			if (RebuildImage) this.#WriteHeader(fs);
		}
		this.#WriteSectors(fs, RebuildImage);
		*/
		const RebuildImage = true;
		if (!this.PlainFormat) {
			this.#WriteHeader(fs);
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
			if (s.IsDirty) MaxDirtyTrack = s.Cylinder;
		}

		for (let i = 0; i < this.#MaxTrack; i++) {
			if (this.TrackAddress[i] == 0x0) break;
			LastTrack = i;
		}

		// プレーンフォーマットでなく、ヘッダが異なる場合は再構築
		if (!this.PlainFormat && this.CurrentHeaderSize != this.#D88HeaderSize) return true;
		if (LastTrack < MaxDirtyTrack) return true;

		return false;
	}

	/**
	 * ヘッダ出力
	 * @param {Stream} fs 
	 */
	#WriteHeader(fs) {
		this.ImageSize = this.#D88HeaderSize;
		let t = 0;
		for(let s of this.Sectors) {
			if (s.Sector == 0x01) this.TrackAddress[t++] = this.ImageSize;
			this.ImageSize += s.GetLength();
		}

		let header = new Uint8Array(this.#D88HeaderSize);
		const dc = new DataController(header);
		dc.SetCopy(0, this.DiskName);
		dc.SetByte(0x1a, this.IsWriteProtect ? 0x10 : 0x00);
		dc.SetByte(0x1b, this.DiskType.ImageTypeByte());
		dc.SetLong(0x1c, this.ImageSize);

		// トラック分のアドレスを出力する
		for (let i = 0; i < this.#MaxTrack; i++) {
			const a = this.TrackAddress[i];
			if (a === undefined || a == 0) break;
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
	 * D88のヘッダ部分を読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @return {boolean} 処理結果 読み込めたら true を返す
	 */
	#ReadHeader(fs) {
		let rc = true;

		// ヘッダ部分読み込み
		let header = new Uint8Array(this.#D88HeaderSize);
		if(fs.Read(header, 0, header.length) != this.#D88HeaderSize) {
			this.Log.Error("ディスクイメージサイズが不正です。ヘッダ部分を読み込めませんでした。" + fs.GetSize());
			return false;
		}

		let dc = new DataController(header);
		// ディスクの名前(ASCII + '\0')
		this.DiskName = dc.Copy(0, 17);
		// ライトプロテクト 0x00 なし、0x10 あり
		this.IsWriteProtect = dc.GetByte(0x1a) != 0x00;
		// ディスクの種類 0x00 2D、 0x10 2DD、 0x20 2HD
		const diskType = dc.GetByte(0x1b);
		this.DiskType.SetImageTypeFromHeader(diskType); // ディスクの種類から色々設定する
		// ディスクのサイズ(4バイト)
		this.ImageSize = dc.GetLong(0x1c);

		// デバッグ
		this.Log.AddLog(LogType.Debug, "ディスクの名前:" + this.DiskName);
		this.Log.AddLog(LogType.Debug, "ライトプロテクト:" + dc.GetByte(0x1a));
		this.Log.AddLog(LogType.Debug, "ディスクの種類:" + this.DiskType.GetTypeName() + "(diskType:" + diskType + ")");
		this.Log.AddLog(LogType.Debug, "ディスクのサイズ:" + this.ImageSize);

		// --------------------
		// ヘッダ部分のチェック
		// --------------------
		if(this.DiskName[16] != 0) {
			this.Log.Error("ディスクの名前が不正です");
		}
		if(dc.GetByte(0x1a) != 0x00 && dc.GetByte(0x1a) != 0x10) {
			this.Log.Error("ライトプロテクトの値が不正です。0か16の値を想定しています。header[0x1a]:" + dc.GetByte(0x1a));
			rc = false;
		}
		if(diskType != 0x00 && diskType != 0x10 && diskType != 0x20) {
			if(diskType == 0x30 || diskType == 0x40) {
				this.Log.Error("未対応のディスクの種類(1D、1DD)です。header[0x1b]:" + diskType);
			} else {
				this.Log.Error("ディスクの種類が不正です。0x00か0x10か0x20の値を想定しています。header[0x1b]:" + diskType);
			}
			rc = false;
		}
		if(this.ImageSize < fs.GetSize()) {
			this.Log.Error("ディスクのサイズが不正です。header[0x1c]:" + this.ImageSize + " ディスクイメージのサイズ:" + fs.GetSize());
			rc = false;
		}

		// トラック部のオフセット
		this.CurrentHeaderSize = 0;
		if(this.#MaxTrack > 0) {
			for (let i = 0; i < this.#MaxTrack; i++) {
				this.TrackAddress[i] = dc.GetLong(0x20 + (i * 4));
				// デバッグ
				//this.Log.AddLog(LogType.Debug, "トラック部のオフセット:0x" + (this.TrackAddress[i]).toString(16));
			}
			this.CurrentHeaderSize = this.TrackAddress[0];
		}
		return rc;
	}

	/**
	 * D88のセクタ部分を読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @return {boolean} 正常に読み込めたかどうか
	 */
	#ReadSectors(fs) {
		let Track = 0; // トラックは0オリジン
		let SectorCount = 1; // セクタは1オリジン
		let Address = this.PlainFormat ? 0x00 : this.TrackAddress[Track];
		if (!this.PlainFormat && Address < this.#D88HeaderSize) {
			this.Log.Error("トラック部分のアドレスが不正です。 Track:" + Track + " トラック部分のアドレス:0x" + (Address).toString(16));
			return false;
		}
		fs.Seek(Address);
		this.Sectors = new Array();

		if(!this.PlainFormat) {
			// 各トラックで読み込む
			for(let track=0; track < this.#MaxTrack; ++track) {
				// @todo ここの扱いが不明。トラック＝クラスタではなく、２トラックで１クラスタとなっているっぽい？
				//       表、裏で1クラスタになっているっぽい
				const Cylinder = track / 2 | 0; // シリンダ

				const Address = this.TrackAddress[track];
				this.Log.AddLog(LogType.Debug, track + ": トラック部のオフセット:0x" + (Address).toString(16));
				if(Address == 0) {
					// トラックが無いので、スキップ
					continue;
				}
				if (Address < this.#D88HeaderSize) {
					this.Log.Error("トラック部分のアドレスが不正です。 Track:" + track + " トラック部分のアドレス:0x" + (Address).toString(16));
					return false;
				}

				// 頭出し
				fs.Seek(Address);

				// １個目のセクタ読み込み
				let Sector = new SectorData();
				if (!Sector.Read(this.PlainFormat, fs)) {
					// 読み込み失敗
					this.Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:トラック最初のセクタ");
					return false;
				}
				if(Cylinder != Sector.Cylinder) {
					this.Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:トラック最初のセクタ クラスタ番号とセクタヘッダ部分のクラスタ番号が不一致 セクタヘッダ部分のクラスタ:" + Sector.Cylinder);
					return false;
				}
				this.Sectors.push(Sector);

				// デバッグ 読み込んだセクタのヘッダ部分をログに出力
				// Sector.Description();

				// ２個目以降のセクタ読み込み
				const sectorsInTrack = Sector.SectorsInTrack; // 最初のセクタの情報で、トラック内のセクタを読み込むようにしてみる
				for(let i = 1; i < sectorsInTrack; ++i) {
					Sector = new SectorData();
					if (!Sector.Read(this.PlainFormat, fs)) {
						// 読み込み失敗
						this.Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ");
					}
					// デバッグ 読み込んだセクタのヘッダ部分をログに出力
					//Sector.Description();
					if(sectorsInTrack != Sector.SectorsInTrack) {
						// セクタヘッダの不一致 トラック中のセクタ数が違う
						this.Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ セクタヘッダの不一致、トラック中のセクタ数が違う。 sectorsInTrack:" + sectorsInTrack + " " + Sector.SectorsInTrack);
						return false;
					}
					if(Cylinder != Sector.Cylinder) {
						this.Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ トラック番号とセクタヘッダ部分のクラスタ番号が不一致 セクタヘッダ部分のクラスタ:" + Sector.Cylinder);
						return false;
					}
					this.Sectors.push(Sector);
				}
			}
			return true;
		} else {
			// 生のイメージ

			// 各トラックで読み込む
			const maxTrackSize = this.DiskType.GetMaxTrackSize(); // 最大トラック数
			const trackPerSector = this.DiskType.GetTrackPerSector(); // １トラックあたりのセクタ数
			const density = this.DiskType.GetDensity(); // 記録密度
			const sectorSize = this.DiskType.GetSectorSize(); // セクタサイズ(N)
			for(let track=0; track < maxTrackSize; ++track) {
				// @todo ここの扱いが不明。トラック＝クラスタではなく、２トラックで１クラスタとなっているっぽい？
				//       表、裏で1クラスタになっているっぽい
				const Cylinder = track / 2 | 0; // クラスタ

				// ディスクイメージ中のトラックの位置
				Address = fs.GetPosition();
				this.TrackAddress[track] = Address;

				for(let i = 1; i <= trackPerSector; ++i) {
					// セクタ読み込み
					let Sector = new SectorData();
					if (!Sector.Read(this.PlainFormat, fs)) {
						this.Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ");
						return false;
					}
					Sector.Cylinder = Cylinder;
					Sector.Side = track & 1;
					Sector.Sector = i; // トラック内のセクタ番号。1オリジン
					Sector.SectorSize = sectorSize; // セクタサイズ(N)
					Sector.SectorsInTrack = trackPerSector;
					Sector.Density = density;
					Sector.IsDelete = 0x00;
					Sector.Status = 0x00;
					this.Sectors.push(Sector);
				}
			}
			return true;
		}

		/*
		while (true) {
			Address = fs.GetPosition();

			// セクタ読み込み
			let Sector = new SectorData();
			if (!Sector.Read(this.PlainFormat, fs)) {
				break;
			}

			// デバッグ 読み込んだセクタのヘッダ部分をログに出力
			Sector.Description();

			if (!this.PlainFormat) {
				SectorCount = Sector.Sector;
			}
			if (SectorCount == 0x01) {
				if (this.PlainFormat) {
					this.TrackAddress[Track] = Address;
				}
				this.Log.Verbose("Track:" + Track + " Pos:" + (Address).toString(16) + " Address:" + (this.TrackAddress[Track]).toString(16));
				Track++;
			}
			this.Sectors.push(Sector);
			SectorCount++;
			if (SectorCount > this.TrackPerSector) SectorCount = 1;
		}
		return true;
		*/
	}
}
