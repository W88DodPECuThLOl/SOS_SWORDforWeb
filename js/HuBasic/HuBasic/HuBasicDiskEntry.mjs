"use strict";

import Stream from '../Utils/Stream.mjs';
import { DiskImage } from '../Disk/DiskImage.mjs';
import { HuFileEntry } from './HuFileEntry.mjs';
import { OpenEntryResult } from './OpenEntryResult.mjs';
import { DiskTypeEnum } from "../Disk/DiskTypeEnum.mjs";

class AsciiData {
	/**
	 * @type {Uint8Array}
	 */
	Data;
	/**
	 * @type {boolean}
	 */
	Eof;

	constructor(Data, Eof) {
		this.Data = Data;
		this.Eof = Eof;
	}
};

// HuBasicDiskEntry
export default class {
	/**
	 * @type {number}
	 */
	#EntryEnd = 0xFF;
	/**
	 * @type {number}
	 */
	EntryDelete = 0x00;

	/**
	 * @type {number}
	 */
	FileEntrySize = 0x20;

	/**
	 * @type {number}
	 */
	EntriesInSector = 8;

	/**
	 * @type {number}
	 */
	DefaultSectorBytes = 256;

	/**
	 * @type {DiskParameter}
	 */
	DiskParameter;

	/**
	 * @type {number}
	 */
	CurrentEntrySector;

	/**
	 * FATの開始セクタ番号を取得する
	 * @returns {number} FATの開始セクタ番号
	 */
	GetAllocationTableStart() { return this.DiskParameter.GetAllocationTableStart(); }

	/**
	 * 最大クラスタ数を取得する
	 * @returns {number} 最大クラスタ数
	 */
	GetMaxCluster() { return this.DiskParameter.GetMaxCluster(); }

	/**
	 * クラスタあたりのセクタ数を取得する
	 * @returns {number} クラスタあたりのセクタ数
	 */
	GetClusterPerSector() { return this.DiskParameter.GetClusterPerSector(); }

	/**
	 * @type {DataController[]}
	 */
	#AllocationController;

	/**
	 * @type {DiskImage}
	 */
	DiskImage;
	/**
	 * @type {Setting}
	 */
	Setting;
	/**
	 * @type {DiskType}
	 */
	//DiskType;
	/**
	 * @type {DiskTypeEnum}
	 */
	ImageType;
	/**
	 * @type {Log}
	 */
	Log;

	/**
	 * @param {Context}  Context
	 */
	constructor(Context) {
		this.DiskImage = new DiskImage(Context);
		this.Setting = Context.Setting;
		this.ImageType = this.Setting.DiskType.GetImageType();

		this.Log = Context.Log;
		if (this.Setting.FormatImage) {
			this.FormatDisk();
		} else {
//			this.ReadOrFormat(fs);
		}
	}

	/**
	 * ライトプロテクトかどうか
	 * @returns {boolean} ライトプロテクトなら true を返す
	 */
	GetWriteProtect() { return this.DiskImage.GetWriteProtect(); }

	/**
	 * ディスクイメージの書き込み
	 * @param {Stream} fs
	 */
	WriteImage(fs) {
		const isPlainFormat = false;
		this.DiskImage.Write(fs, isPlainFormat);
	}

	/**
	 * ディスクイメージの読み込み、または、フォーマットする
	 * @param {Stream} fs
	 */
	ReadOrFormat(fs) {
		const isPlainFormat = false;
		if (!this.DiskImage.Read(fs, isPlainFormat)) {
			this.FormatDisk();
			return;
		}

		this.#SetParameter(false);
	}
	/**
	 * ディスクイメージの読み込み
	 * @param {Stream} fs
	 * @param {boolean} isPlainFormat ヘッダ無しかどうか
	 */
	Read(fs, isPlainFormat) {
		if (!this.DiskImage.Read(fs, isPlainFormat)) {
			return false;
		}

		this.#SetParameter(false);
		return true;
	}

	/**
	 * フォーマットする
	 */
	FormatDisk() {
		this.DiskImage.Format();
		this.#SetParameter(true);
	}

	/**
	 * @param {boolean} FillAllocation
	 */
	#SetParameter(FillAllocation) {
		this.#SetDiskParameter();
		if (FillAllocation) this.#FillAllocationTable();
		this.#SetAllocateController();
	}

	#SetDiskParameter() {
		this.DiskParameter = this.GetDiskType().DiskParameter;
		this.CurrentEntrySector = this.GetDiskType().DiskParameter.GetEntrySectorStart();
	}

	/**
	 * @param {number} entrySector ディレクトリのセクタ番号
	 * @returns {HuFileEntry[]}
	 */
	GetEntriesAt(entrySector) { return this.#GetEntriesFromSector(entrySector); }
	/**
	 * @returns {HuFileEntry[]}
	 */
	GetEntries() { return this.GetEntriesAt(this.CurrentEntrySector); }

	/**
	 * 空きクラスタを数える
	 * @returns {number} 空いているクラスタ数
	 */
	CountFreeClusters() {
		let Result = 0;
		for (let i = 0; i < this.GetMaxCluster(); i++) {
			if(!this.#IsEndCluster(i)) {
				if(this.#GetClusterValue(i) == 0x00) {
					Result++;
				}
			}
		}
		return Result;
	}

	/**
	 * ファイル展開
	 * @param {Stream} fs ファイルストリーム
	 * @param {HuFileEntry} fe ファイルエントリ
	 */
	ExtractFile(fs, fe) {
		let cluster = fe.GetStartCluster(); // 開始クラスタ
		let LeftSize = fe.GetSize();        // ファイルのサイズ（バイト単位）
		const AsciiMode = fe.IsAscii();     // 属性がアスキーファイルかどうか
		const SectorWriteMode = fe.GetSize() == 0; // ファイルサイズが0の時は、全セクタ読み込み
		//let totalOutputBytes = 0;
		while(true) {
			//
			// FAT情報から使用しているセクタ数や次のクラスタを取得
			//
			const end         = this.#IsEndCluster(cluster);	// このクラスタで終了かどうか
			const nextCluster = this.#GetClusterValue(cluster);	// 次のクラスタ、または、使用しているクラスタ数
			// 値をチェック
			if(end) {
				if((nextCluster < 0x80) || (0x8F < nextCluster)) {
					// 終了フラグが立っている時の値は、0x80～0x8Fでなければならない
					this.Log.Warning("WARNING: Wrong cluster chain!!");
					break;
				}
			} else {
				if (nextCluster == 0x00) {
					// 未使用のクラスタを指しているのでおかしい
					this.Log.Warning("WARNING: Wrong cluster chain!!");
					break;
				}
				if(nextCluster >= this.GetMaxCluster()) {
					// 最大クラスタをオーバーしている
					this.Log.Warning("WARNING: Wrong cluster chain!!");
					break;
				}
			}
			const SectorCount = end ? (nextCluster - 0x7F) : this.GetClusterPerSector(); // 使用しているセクタ数

			//
			//
			//
			for (let i = 0; i < SectorCount; i++) {
				const CurrentSector = (cluster * this.GetClusterPerSector()) + i; // クラスタからセクタ番号へ
				this.Log.Verbose("Cluster:" + cluster + " Sector:" + CurrentSector);

				// セクタデータ取得
				const Sector = this.DiskImage.GetSector(CurrentSector);
				let Data = Sector.GetDataForRead();

				let Eof = false;
				if (AsciiMode) {
					// アスキーファイルでは、ファイルサイズがあてにならないらしいので、ファイルが終わったかどうかを終端文字を調べる
					// メモ）
					// ASCII files may have an incorrect size — loading continues until the character 0x0D
					// is followed by character 0x1A.
					// https://www.z88dk.org/tools/x1/XBrowser_User_Guide.pdf
					const AsciiData = this.#ConvertAscii(Data);
					Eof = AsciiData.Eof;
					Data = AsciiData.Data;
				}

				let OutputBytes = Data.length;

				if (!SectorWriteMode) {
					// ファイルサイズが有効の場合、使用する
					OutputBytes = Math.min(LeftSize, OutputBytes) | 0;
					LeftSize -= OutputBytes;
					if(LeftSize <= 0) {
						Eof = true; // 全部読み込んだので終わり
					}
				}

				fs.Write(Data, 0, OutputBytes);
				// totalOutputBytes += OutputBytes;

				if (Eof) {
					break;
				}
			}
			if (end) {
				// 終了フラグが立っていたので終了
				break;
			}
			// 次のクラスタへ
			cluster = nextCluster;
		}
	}

	/**
	 * @param {Uint8Array} Data セクタのデータ
	 * @returns {AsciiData}
	 */
	#ConvertAscii(Data) {
		let Eof = false;
		const Result = new Array();
		for(const b of Data) {
			if (b == 0x1a) {
				Eof = true;
				break;
			}
			Result.push(b);
		}
		return new AsciiData(Uint8Array.from(Result), Eof);
	}

	/**
	 * FATを初期化する。エントリも初期化する
	 */
	#FillAllocationTable() {
		switch (this.ImageType) {
			case DiskTypeEnum.Disk2D:
			case DiskTypeEnum.Disk2DD:
			case DiskTypeEnum.Disk2HD:
			case DiskTypeEnum.Disk1D: // @todo
			case DiskTypeEnum.Disk1DD: // @todo
				{
					// 最大クラスタ数分FATのエントリが必要
					let fat = this.GetAllocationTableStart(); // FATの開始クラスタ番号
					let remainCluster = this.GetMaxCluster(); // 最大クラスタ数
					while(remainCluster > 0) {
						const dc = this.DiskImage.GetDataControllerForWrite(fat++);
						dc.Fill(0);
						if(remainCluster < 0x80) {
							for (let i = remainCluster; i < 0x80; i++) {
								dc.SetByte(i, 0x8f);
							}
							remainCluster = 0;
						} else {
							remainCluster -= 0x80;
						}
					}
					// 予約部分
					{
						fat = this.GetAllocationTableStart();
						const dc = this.DiskImage.GetDataControllerForWrite(fat);
						if(this.ImageType == DiskTypeEnum.Disk2D || this.ImageType == DiskTypeEnum.Disk2DD) {
							// 2D, 2DD
							// 2クラスタ予約
							dc.SetByte(0, 0x01);
							dc.SetByte(1, 0x8f);
						} else {
							// 2HD
							// 3クラスタ予約  @todo あってる？
							dc.SetByte(0, 0x01);
							dc.SetByte(1, 0x8f);
							dc.SetByte(2, 0x8f);
						}
					}
				}
				break;
		}

		// ディレクトリエントリのフォーマット（初期化）
		this.#FormatEntry(this.CurrentEntrySector);
	}

	/**
	 * ディレクトリエントリのフォーマット（初期化）
	 * @param {number} Sector 初期化するセクタ番号（クラスタでは無いので注意）
	 */
	#FormatEntry(Sector) {
		// Sectorから1クラスタ分、0xFF(ディレクトリのエンドマーク)で埋める
		for (let i = 0; i < this.GetClusterPerSector(); i++) {
			const dc = this.DiskImage.GetDataControllerForWrite(Sector + i);
			dc.Fill(0xff);
		}
	}

	/**
	 * ファイルの削除
	 * @param {HuFileEntry} fe 
	 */
	Delete(fe) {
		fe.SetDelete();
		this.WriteFileEntry(fe);
		this.RemoveAllocation(fe.GetStartCluster());
	}

	/**
	 * 
	 * @param {DataController} dc 
	 * @param {number} sector 
	 * @param {number} pos 
	 * @returns {HuFileEntry}
	 */
	GetEntry(dc, sector, pos) {
		const fe = new HuFileEntry();
		fe.SetEntryFromSector(dc, sector, pos);
		return fe;
	}


	/**
	 * 有効なファイルエントリを取得する
	 * 
	 * @param {number} entrySector ディレクトリのセクタ番号
	 * @returns {HuFileEntry[]} 有効なファイルエントリ
	 */
	#GetEntriesFromSector(entrySector) {
		const FileList = new Array();
		for (let i = 0; i < this.GetClusterPerSector(); i++, entrySector++) {
			const dc = this.DiskImage.GetDataControllerForRead(entrySector);
			for (let j = 0; j < this.EntriesInSector; j++) {
				const pos = (j * this.FileEntrySize);
				const mode = dc.GetByte(pos);
				if (mode == this.#EntryEnd) { return FileList; }
				if (mode == this.EntryDelete) { continue; }
				FileList.push(this.GetEntry(dc, entrySector, pos));
			}
		}
		return FileList;
	}

	/**
	 * ファイルエントリ書き出し
	 * @param {HuFileEntry} fe 
	 */
	WriteFileEntry(fe) {
		fe.FileEntryNormalize();
		const dc = this.DiskImage.GetDataControllerForWrite(fe.EntrySector);
		fe.writeIB(dc, fe.EntryPosition);
	}

	/**
	 * 
	 * @param {number} Sector 
	 * @returns {HuFileEntry}
	 */
	#GetNewFileEntry(Sector) {
		for (let i = 0; i < this.GetClusterPerSector(); i++) {
			const dc = this.DiskImage.GetDataControllerForRead(Sector + i);
			for (let j = 0; j < this.EntriesInSector; j++) {
				const pos = (j * this.FileEntrySize);
				const mode = dc.GetByte(pos);
				if (mode != this.#EntryEnd && mode != this.EntryDelete) continue;

				const newFileEntry = new HuFileEntry();
				newFileEntry.EntrySector = Sector + i;
				newFileEntry.EntryPosition = pos;
				return newFileEntry;
			}
		}
		return null;
	}

	/**
	 * @param {Stream} fs
	 * @param {number} StartCluster
	 * @returns {boolean} 処理結果
	 */
	WriteStream(fs, StartCluster)
	{
		let RemainSize = fs.GetSize();
		let c = StartCluster;
		while (true) {
			let s = c * this.GetClusterPerSector();
			let LastSector = 0;
			for (let sc = 0; sc < this.GetClusterPerSector(); sc++, s++) {
				const Length = (RemainSize < this.DefaultSectorBytes) ? RemainSize : this.DefaultSectorBytes;
				this.DiskImage.GetSector(s).Fill(0x00);
				if (RemainSize == 0) continue;

				const SectorBuffer = this.DiskImage.GetSectorDataForWrite(s);
				fs.Read(SectorBuffer, 0, Length);
				RemainSize -= Length;
				if (Length > 0) LastSector = sc;
			}
			if (RemainSize <= 0) {
				if (this.Setting.X1SMode && LastSector > 0) {
					LastSector--;
					if ((Filesize & 0xff) == 0) LastSector++;
				}
				this.#SetClusterValue(c, LastSector, true);
				break;
			}
			const next = this.#GetNextFreeCluster(2);
			if (next < 0) {
				this.Log.Error("Too big filesize!: LastClaster=" + c);
				this.#SetClusterValue(c, LastSector, true);
				return false;
			}
			this.#SetClusterValue(c, next);
			c = next;
		}

		return true;
	}

	/**
	 * @param {HuFileEntry} fe
	 * @returns {number}
	 */
	GetFreeCluster(fe) {
		/*if (this.Setting.IplMode) {
			const Cluster = (fe.GetSize() / (this.GetClusterPerSector() * this.DefaultSectorBytes)) + 1;
			return this.#GetNextFreeSerialCluster(Cluster);
		} else*/
		{
			return this.#GetNextFreeCluster();
		}
	}

	/**
	 * FAT領域をキャッシュする
	 */
	#SetAllocateController() {
		const fat = this.GetAllocationTableStart(); // FATの開始セクタ番号
		const FATSectorSize = (this.GetMaxCluster() / 0x80 | 0) + 1; // 必要なセクタ数
		this.#AllocationController = new Array(FATSectorSize);
		for(let i = 0; i < FATSectorSize; ++i) {
			this.#AllocationController[i] = this.DiskImage.GetDataControllerForWrite(fat + i);
		}
	}

	/**
	 * @param {number} Step
	 * @return {number}
	 */
	#GetNextFreeCluster(Step = 1) {
		for (let i = 0; i < this.GetMaxCluster(); i++) {
			const end = this.#IsEndCluster(i);
			const ptr = this.#GetClusterValue(i);
			if (!end && ptr == 0x00) {
				Step--;
				if (Step == 0) return i;
			}
		}
		return -1;
	}

	/**
	 * @param {number} Clusters
	 * @return {number}
	 */
	#GetNextFreeSerialCluster(Clusters) {
		let FreeCount = 0;
		let FreeStart = 0;
		for (let i = 0; i < this.GetMaxCluster(); i++) {
			const end = this.#IsEndCluster(i);
			const ptr = this.#GetClusterValue(i);
			if (!end && ptr == 0x00) {
				if (FreeCount == 0) {
					FreeStart = i;
				}
				FreeCount++;
				if (FreeCount == Clusters) return FreeStart;
			} else {
				FreeCount = 0;
			}
		}
		return -1;
	}

	/**
	 * アロケーションテーブルの開放
	 * @param {number} StartCluster
	 */
	RemoveAllocation(StartCluster) {
		let c = StartCluster;
		while (true) {
			// FAT
			const end = this.#IsEndCluster(c);
			const next = this.#GetClusterValue(c);
			// 0x00 = 既に解放済み
			if (next == 0x00) break;
			this.#SetClusterValue(c, 0x00); // 空きクラスタにする
			const FillLength = end ? ((next & 0x0f) + 1) : this.GetClusterPerSector();
			// ファイルの中身をクリア
			for (let i = 0; i < FillLength; i++) {
				this.DiskImage.GetDataControllerForWrite((c * this.GetClusterPerSector()) + i).Fill(0);
			}
			// 0x8x = 最後のクラスタ
			if (end) break;
			c = next;
		}
	}

	/**
	 * @param {number} pos
	 * @param {number} value
	 * @param {boolean} end
	 */
	#SetClusterValue(pos, value, end = false) {
		const offset = pos / 0x80 | 0;
		pos &= 0x7f;

		// 下位ビット
		let low = (value & 0x7f);
		low |= end ? 0x80 : 0x00;
		this.#AllocationController[offset].SetByte(pos, low);
		// 上位ビット
		if(!end) {
			this.#AllocationController[offset].SetByte(pos + 0x80, (value >> 7) & 0x7F);
		} else {
			// 終了フラグが立っていたら0
			this.#AllocationController[offset].SetByte(pos + 0x80, 0);
		}
	}

	/**
	 * @param {number} pos
	 * @retutns {number}
	 * 
	 * メモ）posが0x80～なら次のセクタのデータを参照
	 */
	#GetClusterValue(pos) {
		// FATのセクタ 0～3
		//  0  : 2D
		//  0-1: 2DD, 2HD
		//  0-3: ハードディスク?
		const offset = pos / 0x80 | 0;
		// FATのセクタ内での位置 0～127
		pos &= 0x7f;
		let result = this.#AllocationController[offset].GetByte(pos);

		const end = this.#IsEndCluster(pos);
		if(end) {
			// 終了フラグが立っていたらそのまま返す
			return result; // 0x80～0x8F
		} else {
			if(this.#is2BytesFAT()) {
				// 128バイト目からの上位ビットも考慮する
				// メモ）2Dで、上位ビットが0で無いものがあるので、判定して取得している
				result |= (this.#AllocationController[offset].GetByte(pos + 0x80) << 7);
			}
			return result;
		}
	}

	/**
	 * 
	 * @param {number} pos
	 * @returns {boolean}
	 */
	#IsEndCluster(pos) {
		// FATのセクタ 0～3
		//  0  : 2D
		//  0-1: 2DD, 2HD
		//  0-3: ハードディスク?
		const offset = pos / 0x80 | 0;
		// FATのセクタ内での位置 0～127
		pos &= 0x7f;
		return (this.#AllocationController[offset].GetByte(pos) & 0x80) != 0x00;
	}

	// -------------------------------------------------------------------------------------------
	// -------------------------------------------------------------------------------------------

	/**
	 * 
	 * @param {number} descriptor 
	 * @param {number} record 
	 * @returns {{
	 * 		result:number,
	 * 		value:Uint8Array
	 * }}
	 */
	ReadRecord(record)
	{
		// チェック
		if(!this.DiskParameter) {
			return {
				result: 1, // DeviceIOError 入出力時にエラーが発生した
				value: new Uint8Array()
			};
		}
		const maxSector = this.GetMaxCluster() * this.GetClusterPerSector();
		if((record < 0) || (record >= maxSector)) {
			return {
				result: 5, // BadRecord レコードナンバーに間違いがある
				value: new Uint8Array()
			};
		}

		const dc = this.DiskImage.GetDataControllerForRead(record);
		return {
			result: 0,
			value: dc.Copy(0, this.DefaultSectorBytes)
		};
	}
	/**
	 * 
	 * @param {number} record 
	 * @param {Uint8Array} data 
	 * @returns {{
	 * 		result:number
	 * }}
	 */
	WriteRecord(record, data)
	{
		// チェック
		if(!this.DiskParameter) {
			return {
				result: 1, // DeviceIOError 入出力時にエラーが発生した
				value: new Uint8Array()
			};
		}
		const maxSector = this.GetMaxCluster() * this.GetClusterPerSector();
		if((record < 0) || (record >= maxSector)) {
			return {
				result: 5, // BadRecord レコードナンバーに間違いがある
				value: new Uint8Array()
			};
		}
		if(data.length != this.DefaultSectorBytes) {
			return {
				result: 14, // BadData 正しい引き数ではない
				value: new Uint8Array()
			};
		}

		const dc = this.DiskImage.GetDataControllerForWrite(record);
		dc.SetCopy(0, data, this.DefaultSectorBytes);
		return {
			result: 0
		};
	}


	/**
	 * 
	 * @param {number} DirRecord 
	 * @param {Uint8Array} Name 
	 * @param {Uint8Array} Extension 
	 * @returns {HuFileEntry}
	 */
	#GetFileEntry2(DirRecord, Name, Extension) {
		let Sector = DirRecord;
		for (let i = 0; i < this.GetClusterPerSector(); i++, Sector++) {
			const dc = this.DiskImage.GetDataControllerForRead(Sector);
			for (let j = 0; j < this.EntriesInSector; j++) {
				const pos = (j * this.FileEntrySize);
				const fe = this.GetEntry(dc, Sector, pos);
				if(fe.IsEntryEnd()) { return null; }
				if(fe.IsDelete()) { continue; }
				if(!fe.isEqualFilename(Name, Extension)) { continue; }
				return fe;
			}
		}
		return null;
	}

	/**
	 * @param {number} DirRecord 
	 * @param {Uint8Array} Name 
	 * @param {Uint8Array} Extension 
	 * @returns {HuFileEntry}
	 */
	GetWritableEntry2(DirRecord, Name, Extension) {
		let fe = this.#GetFileEntry2(DirRecord, Name, Extension);
		if (fe != null) {
			// エントリに確保されていたクラスタを解放する
			this.RemoveAllocation(fe.GetStartCluster());
		} else {
			// 新しい空きエントリを取得する
			fe = this.#GetNewFileEntry(DirRecord);
		}
		return fe;
	}

	/**
	 * FATが2バイト必要かどうか
	 * @returns {boolean} 2バイト必要ならtrueを返す
	 */
	#is2BytesFAT()
	{
		// 管理しているクラスタ数が128個以上なら必要
		return this.GetMaxCluster() >= 0x80;
	}

	/**
	 * ディスクの種類を取得する
	 * @returns {DiskType} ディスクの種類
	 */
	GetDiskType() { return this.DiskImage.GetDiskType(); }

	GetDiskImageFileSize(IsPlainFormat)
	{
		return this.DiskImage.GetDiskImageFileSize(IsPlainFormat);
	}
};
