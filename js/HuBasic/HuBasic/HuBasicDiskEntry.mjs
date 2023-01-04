"use strict";

import Stream from '../Utils/Stream.mjs';
import DiskImage from '../Disk/DiskImage.mjs';
import HuFileEntry from './HuFileEntry.mjs';
import { OpenEntryResult } from './OpenEntryResult.mjs';

// メモ）X1のディレクトリの区切りは スラッシュ
const directoryDelimiter = 0x2f; // slash
const extensionDelimiter = 0x2e; // '.'

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
	EntryEnd = 0xFF;
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

	AllocationTableStart() { return this.DiskParameter.AllocationTableStart; }
	/**
	 * @returns {number}
	 */
	MaxCluster() { return this.DiskParameter.MaxCluster; }
	/**
	 * @returns {number}
	 */
	ClusterPerSector() { return this.DiskParameter.ClusterPerSector; }

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
	DiskType;
	/**
	 * @type {DiskTypeEnum}
	 */
	ImageType;
	/**
	 * @type {Encoding}
	 */
	TextEncoding;
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

		this.DiskType = this.Setting.DiskType;
		this.ImageType = this.Setting.DiskType.GetImageType();
		this.TextEncoding = Context.TextEncoding;

		this.Log = Context.Log;
		if (this.Setting.FormatImage) {
			this.FormatDisk();
		} else {
//			this.ReadOrFormat(fs);
		}
	}

	WriteImage(fs) {
		this.DiskImage.Write(fs);
	}

	/**
	 * ディスクイメージの読み込み、または、フォーマットする
	 * @param {Stream} fs
	 */
	ReadOrFormat(fs) {
		if (!this.DiskImage.Read(fs)) {
			this.FormatDisk();
			return;
		}

		this.#SetParameter(false);
	}
	Read(fs) {
		if (!this.DiskImage.Read(fs)) {
			return false;
		}

		this.#SetParameter(false);
		return true;
	}
	FormatDisk() {
		this.DiskImage.Format();
		this.SetParameter(true);
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
		this.DiskParameter = this.DiskType.DiskParameter;
		this.CurrentEntrySector = this.DiskType.DiskParameter.EntrySectorStart;
	}

	/**
	 * @param {OpenEntryResult} result
	 * @return {boolean}
	 */
	IsOk(result) { return result == OpenEntryResult.Ok; }

	/**
	 * @param {number} entrySector ディレクトリの場所
	 * @returns {HuFileEntry[]}
	 */
	GetEntriesAt(entrySector) { return this.GetEntriesFromSector(entrySector); }
	/**
	 * @returns {HuFileEntry[]}
	 */
	GetEntries() { return this.GetEntriesAt(this.CurrentEntrySector); }

	/**
	 * @param {number} FreeCluster
	 * @returns {number}
	 */
	GetFreeBytes(FreeCluster) { return FreeCluster * this.ClusterPerSector() * this.DefaultSectorBytes; }

	/**
	 * 空きクラスタを数える
	 * @returns {number} 空いているクラスタ数
	 */
	CountFreeClusters() {
		let Result = 0;
		for (let i = 0; i < this.MaxCluster(); i++) {
			const end = this.#IsEndCluster(i);
			const ptr = this.#GetClusterValue(i);
			if (!end && ptr == 0x00) Result++;
		}
		return Result;
	}



	/**
	 * ファイル展開
	 * @param {Stream} fs 
	 * @param {HuFileEntry} fe 
	 */
	ExtractFile(fs, fe) {
		const StartCluster = fe.StartCluster;
		const Size = fe.Size;

		let AsciiMode = fe.IsAscii(); // bool

		// 開始クラスタ
		let c = StartCluster;
		let LeftSize = Size;

		let TotalOutputBytes = 0;

		const SectorWriteMode = Size == 0; // bool

		if (this.Setting.ForceAsciiMode) AsciiMode = true;
		if (this.Setting.ForceBinaryMode) AsciiMode = false;

		while (true) {
			const end = this.#IsEndCluster(c);
			const next = this.#GetClusterValue(c);
			if (next == 0x00) {
				this.Log.Warning("WARNING: Wrong cluster chain!!");
				break;
			}
			// セクタ数
			const SectorCount = end ? (next - 0x7F) : this.ClusterPerSector();

			for (let i = 0; i < SectorCount; i++) {
				const CurrentSector = (c * this.ClusterPerSector()) + i;
				const Sector = this.DiskImage.GetSector(CurrentSector);
				
				let Data = Sector.GetDataForRead();
				let Eof = false;
				if (AsciiMode) {
					// メモ
					// ASCII files may have an incorrect size — loading continues until the character 0x0D
					// is followed by character 0x1A.
					// https://www.z88dk.org/tools/x1/XBrowser_User_Guide.pdf
					const AsciiData = this.#ConvertAscii(Data);
					Eof = AsciiData.Eof;
					Data = AsciiData.Data;
				}

				this.Log.Verbose("Cluster:" + c + " Sector:" + CurrentSector + " Position:0x" + Sector.Position .toString(16));

				let OutputBytes = Data.length;

				// セクタ書き込みモード
				if (!SectorWriteMode) {
					// セクタサイズか残りのバイト数を書き出す
					if (LeftSize < OutputBytes) OutputBytes = LeftSize;
					LeftSize -= OutputBytes;
				}

				fs.Write(Data, 0, OutputBytes);
				TotalOutputBytes += OutputBytes;

				// 次のクラスタに進む
				if (Eof) break;
			}
			if (end) break;
			c = next;
		}
	}

	/**
	 * @param {Uint8Array} Data セクタのデータ
	 * @returns {AsciiData}
	 */
	#ConvertAscii(Data) {
		let Eof = false;
		const Result = new Array(); // List<byte>(Data.length * 2);
		for(const b of Data) {
			if (b == 0x1a) {
				Eof = true;
				break;
			}
			Result.push(b);
//			if (b == 0x0d) {
//				Result.push(0x0a);
//			}
		}
		return new AsciiData(Uint8Array.from(Result), Eof);
	}

	#FillAllocationTable() {
		const dc = this.DiskImage.GetDataControllerForWrite(this.AllocationTableStart());
		dc.Fill(0);
		dc.SetByte(0, 0x01);
		dc.SetByte(1, 0x8f);

		switch (this.ImageType) {
			case DiskTypeEnum.Disk2D:
				for (let i = 0x50; i < 0x80; i++) dc.SetByte(i, 0x8f);
				break;
			case DiskTypeEnum.Disk2DD:
				dc.SetBuffer(this.DiskImage.GetSectorDataForWrite(this.AllocationTableStart() + 1));
				dc.Fill(0);
				for (let i = 0x20; i < 0x80; i++) dc.SetByte(i, 0x8f);
				break;
			case DiskTypeEnum.Disk2HD:
				dc.SetByte(2, 0x8f);
				dc.SetBuffer(this.DiskImage.GetSectorDataForWrite(this.AllocationTableStart() + 1));
				dc.Fill(0);
				for (let i = 0x7a; i < 0x80; i++) dc.SetByte(i, 0x8f);
				break;
		}
		this.#FormatEntry(this.CurrentEntrySector);
	}

	/**
	 * ファイルの削除
	 * @param {HuFileEntry} fe 
	 */
	Delete(fe) {
		fe.SetDelete();
		this.WriteFileEntry(fe);
		this.RemoveAllocation(fe.StartCluster);
	}

	/**
	 * @param {number} Sector 
	 */
	#FormatEntry(Sector) {
		for (let i = 0; i < this.ClusterPerSector(); i++) {
			const dc = this.DiskImage.GetDataControllerForWrite(Sector + i);
			dc.Fill(0xff);
		}
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
		const Name = dc.Copy(pos + 0x01, HuFileEntry.MaxNameLength);
		const Extension = dc.Copy(pos + 0x0e, HuFileEntry.MaxExtensionLength);
		fe.SetEntryFromSector(dc, sector, pos, Name, Extension);
		return fe;
	}


	/**
	 * 
	 * @param {int} Sector 
	 * @returns {HuFileEntry[]}
	 */
	GetEntriesFromSector(Sector) {
		const FileList = new Array();
		for (let i = 0; i < this.ClusterPerSector(); i++, Sector++) {
			const dc = this.DiskImage.GetDataControllerForRead(Sector);
			for (let j = 0; j < 8; j++) {
				const pos = (j * 0x20);
				const mode = dc.GetByte(pos);
				if (mode == this.EntryEnd) return FileList;
				if (mode == this.EntryDelete) continue;
				FileList.push(this.GetEntry(dc, Sector, pos));
			}
		}
		return FileList;
	}

	/**
	 * ファイルエントリ書き出し
	 * @param {HuFileEntry} fe 
	 */
	WriteFileEntry(fe) {
		this.#FileEntryNormalize(fe);
		const dc = this.DiskImage.GetDataControllerForWrite(fe.EntrySector);
		this.#WriteEntry(dc, fe, fe.EntryPosition, fe.StartCluster, false);

		if (fe.IsIplEntry) this.WriteIplEntry(fe);
	}


	/**
	 * 
	 * @param {HuFileEntry} fe 
	 */
	#FileEntryNormalize(fe) {
		if (fe.Name.length > fe.MaxNameLength) {
			fe.Name = fe.Name.slice(0, HuFileEntry.MaxNameLength);
		}
		if (fe.Extension.length > 0 && fe.Extension[0] == extensionDelimiter) {
			fe.Extension = fe.Extension.slice(1);
		}
		if (fe.Extension.length > fe.MaxExtensionLength) {
			fe.Extension = fe.Extension.slice(0, fe.MaxExtensionLength);
		}
	}

	// IPLエントリ書き出し
	/**
	 * 
	 * @param {HuFileEntry} fe 
	 */
	WriteIplEntry(fe) {
		const dc = this.DiskImage.GetDataControllerForWrite(0);
		this.#WriteEntry(dc, fe, 0x00, fe.StartCluster * this.ClusterPerSector(), true);
	}


	/**
	 * 
	 * @param {DataController} dc 
	 * @param {HuFileEntry} fe 
	 * @param {number} pos 
	 * @param {number} start 
	 * @param {boolean} ipl 
	 */
	#WriteEntry(dc, fe, pos, start, ipl) {
		if (ipl) {
			dc.Fill(0x20, pos + 0x01, HuFileEntry.MaxNameLength);
			dc.Fill(0x20, pos + 0x0e, HuFileEntry.MaxExtensionLength);
			this.#WriteIplName(dc, pos);
		} else {
			this.#WriteEntryName(dc, fe, pos);
		}
		dc.SetByte(pos + 0x11, fe.Password);

		dc.SetWord(pos + 0x12, fe.Size);
		dc.SetWord(pos + 0x14, fe.LoadAddress);
		dc.SetWord(pos + 0x16, fe.ExecuteAddress);
		dc.SetCopy(pos + 0x18, fe.DateTimeData);

		// 最上位は未調査
		dc.SetByte(pos + 0x1d, (start >> 14) & 0x7f);
		dc.SetByte(pos + 0x1e, start & 0x7f);
		dc.SetByte(pos + 0x1f, (start >> 7) & 0x7f);
	}

	/**
	 * 
	 * @param {DataController} dc 
	 * @param {HuFileEntry} fe 
	 * @param {number} pos 
	 */
	#WriteEntryName(dc, fe, pos) {
		dc.SetByte(pos, fe.FileMode);
		for(let i = 0; i < HuFileEntry.MaxNameLength; ++i) {
			if(i < fe.Name.length) {
				dc.SetByte(pos + 0x01 + i, fe.Name[i]);
			} else {
				dc.SetByte(pos + 0x01 + i, 0x20);
			}
		}
		for(let i = 0; i < HuFileEntry.MaxExtensionLength; ++i) {
			if(i < fe.Extension.length) {
				dc.SetByte(pos + 0x0e + i, fe.Extension[i]);
			} else {
				dc.SetByte(pos + 0x0e + i, 0x20);
			}
		}
	}

	/**
	 * 
	 * @param {DataController} dc 
	 * @param {number} pos 
	 */
	#WriteIplName(dc, pos) {
		dc.SetByte(pos, 0x01);
		//dc.SetCopy(pos + 0x01, this.TextEncoding.GetBytes(Setting.IplName));
		//dc.SetCopy(pos + 0x0e, this.TextEncoding.GetBytes("Sys"));
		dc.SetCopy(pos + 0x01, Setting.IplName);
		const extension = new Uint8Array(3);
		extension[0] = 0x53; // 'S'
		extension[1] = 0x79; // 'y'
		extension[2] = 0x73; // 's'
		dc.SetCopy(pos + 0x0e, extension);
	}

	/**
	 * 
	 * @param {Uint8Array} Filename ファイル名(ファイル名()+"."+ 拡張子)
	 * @param {number} EntrySector 
	 * @returns {HuFileEntry}
	 */
	#GetFileEntry(Filename, EntrySector) {
		let Sector = EntrySector;
		Filename = this.#toUpperCase(Filename);
		// 名前
		let Name = HuFileEntry.GetFileNameWithoutExtension(Filename);
		// 拡張子
		let Extension = HuFileEntry.GetExtension(Filename);

		for (let i = 0; i < this.ClusterPerSector(); i++, Sector++) {
			const dc = this.DiskImage.GetDataControllerForRead(Sector);

			for (let j = 0; j < this.EntriesInSector; j++) {

				const pos = (j * this.FileEntrySize);
				const mode = dc.GetByte(pos);
				if (mode == this.EntryEnd) return null;

				const EntryName = dc.Copy(pos + 0x01, HuFileEntry.MaxNameLength);
				const EntryExtension = dc.Copy(pos + 0x0e, HuFileEntry.MaxExtensionLength);

				if (!this.#IsEqual(Name, EntryName) || !this.#IsEqual(Extension, EntryExtension)) continue;

				return this.GetEntry(dc, Sector, pos);
			}
		}
		return null;
	}

	/**
	 * 大文字に変換する
	 * @param {Uint8Array} Filename 変換する文字列
	 * @returns {Uint8Array} 大文字に変換された文字列
	 */
	#toUpperCase(Filename)
	{
		let result = new Uint8Array(Filename.length);
		for(let i = 0; i < Filename.length; ++i) {
			let ch = Filename[i];
			if(0x61 <= ch && ch <= 0x7A) {
				ch -= 0x20;
			}
			result[i] = ch;
		}
		return result;
	}

	/**
	 * ２つの配列の中身が同じかどうか
	 * @param {Uint8Array} a 
	 * @param {Uint8Array} b 
	 * @returns 同じならtrueを返す
	 */
	#IsEqual(a, b)
	{
		if(a.length != b.length) { return false; }
		for(let i = 0; i < a.length; ++i) {
			if(a[i] != b[i]) { return false; }
		}
		return true;
	}

	/**
	 * 
	 * @param {number} Sector 
	 * @returns {HuFileEntry}
	 */
	#GetNewFileEntry(Sector) {
		for (let i = 0; i < this.ClusterPerSector(); i++) {
			const dc = this.DiskImage.GetDataControllerForRead(Sector + i);
			for (let j = 0; j < this.EntriesInSector; j++) {
				const pos = (j * this.FileEntrySize);
				const mode = dc.GetByte(pos);
				if (mode != this.EntryEnd && mode != this.EntryDelete) continue;

				const newFileEntry = new HuFileEntry();
				newFileEntry.EntrySector = Sector + i;
				newFileEntry.EntryPosition = pos;
				return newFileEntry;
			}
		}
		return null;
	}

	/**
	 * イメージのディレクトリを開く
	 * @param {Uint8Array} Name ファイル名(ファイル名()+"."+ 拡張子)
	 * @return {number} OpenEntryResult
	 */
	OpenEntryDirectory(Name) {
		let fe = this.#GetFileEntry(Name, this.CurrentEntrySector);
		if (fe != null) {
			if (!fe.IsDirectory) {
				this.Log.Error("ERROR: " + Name + " is not directory!");
				return OpenEntryResult.NotDirectory;
			}

			// エントリセクタを変更
			this.CurrentEntrySector = (fe.StartCluster * this.ClusterPerSector());
			return OpenEntryResult.Ok;
		}

		fe = this.#GetNewFileEntry(this.CurrentEntrySector);
		if (fe == null) {
			this.Log.Error("ERROR:No entry space!");
			return OpenEntryResult.NotDirectory;
		}

		fe.SetNewDirectoryEntry(Name);

		const fc = this.#GetNextFreeCluster();
		if (fc < 0) {
			this.Log.Error("ERROR:No free cluster!");
			return OpenEntryResult.NoFreeCluster;
		}

		fe.StartCluster = fc;
		this.WriteFileEntry(fe);
		this.CurrentEntrySector = fc * this.ClusterPerSector();
		this.#FormatEntry(this.CurrentEntrySector);
		this.#SetClusterValue(fc, 0x0f, true);
		return OpenEntryResult.Ok;
	}


	/**
	 * @param {Stream} fs
	 * @param {number} StartCluster
	 * @returns {boolean}
	 */
	WriteStream(fs, StartCluster)
	{
		this.Log.Info("StartCluster:" + StartCluster .toString());

		let Size = fs.GetSize();
		let c = StartCluster;
		while (true) {
			let s = c * this.ClusterPerSector();
			let LastSector = 0;
			for (let sc = 0; sc < this.ClusterPerSector(); sc++, s++) {
				const Length = Size < this.DefaultSectorBytes ? Size : this.DefaultSectorBytes;
				this.DiskImage.GetSector(s).Fill(0x00);
				if (Size == 0) continue;

				const SectorBuffer = this.DiskImage.GetSectorDataForWrite(s);
				fs.Read(SectorBuffer, 0, Length);
				Size -= Length;
				if (Length > 0) LastSector = sc;
			}
			if (Size == 0) {
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
		if (this.Setting.IplMode) {
			const Cluster = (fe.Size / (this.ClusterPerSector() * this.DefaultSectorBytes)) + 1;
			return this.#GetNextFreeSerialCluster(Cluster);
		} else {
			return this.#GetNextFreeCluster();
		}
	}

	/**
	 * @param {Uint8Array} Filename ファイル名(ファイル名()+"."+ 拡張子)
	 * @returns {HuFileEntry}
	 */
	GetWritableEntry(Filename) {
		const fe = this.#GetFileEntry(Filename, this.CurrentEntrySector);
		// エントリに確保されていたクラスタを解放する
		if (fe != null) {
			this.RemoveAllocation(fe.StartCluster);
		} else {
			fe = this.#GetNewFileEntry(this.CurrentEntrySector);
		}

		return fe;
	}

	#SetAllocateController() {
		this.#AllocationController = new Array(2); // new DataController[2];
		this.#AllocationController[0] = this.DiskImage.GetDataControllerForWrite(this.AllocationTableStart());
		//if (this.DiskType.IsNot2D()) {
			// @todo フォーマットに関係なく、次のセクタも含めてみる。本来は、やってはいけない。
			//       ちゃんと調べること
			this.#AllocationController[1] = this.DiskImage.GetDataControllerForWrite(this.AllocationTableStart() + 1);
		//}
	}


	/**
	 * @param {number} Step
	 * @return {number}
	 */
	#GetNextFreeCluster(Step = 1) {
		for (let i = 0; i < this.MaxCluster(); i++) {
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
		for (let i = 0; i < this.MaxCluster(); i++) {
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
			const next = this.#GetClusterValue(c);
			const end = this.#IsEndCluster(c);
			// 0x00 = 既に解放済み
			if (next == 0x00) break;
			this.#SetClusterValue(c, 0x00);
			const FillLength = end ? (next & 0x0f) + 1 : this.ClusterPerSector();

			for (let i = 0; i < FillLength; i++) {
				this.DiskImage.GetDataControllerForWrite((c * this.ClusterPerSector()) + i).Fill(0);
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
		let low = (value & 0x7f);
		low |= end ? 0x80 : 0x00;
		const offset = pos / 0x80 | 0;
		pos &= 0x7f;
		this.#AllocationController[offset].SetByte(pos, low);
		this.#AllocationController[offset].SetByte(pos + 0x80, (value) >> 7);
	}

	/**
	 * @param {number} pos
	 * @retutns {number}
	 * 
	 * メモ）
	 * posが0x80～0xFFなら次のセクタのデータを参照
	 * 
	 * FAT
	 * 0x00～0x7F セクタの下位7ビット分  MSBは終了フラグ
	 * 0x80～0xFF セクタの上位8ビット分　系15ビット
	 */
	#GetClusterValue(pos) {
		const offset = pos / 0x80 | 0;
		pos &= 0x7f;
		let Result = this.#AllocationController[offset].GetByte(pos);
		Result |= (this.#AllocationController[offset].GetByte(pos + 0x80) << 7);
		return Result;
	}

	/**
	 * 
	 * @param {number} pos
	 * @returns {boolean}
	 */
	#IsEndCluster(pos) {
		const offset = pos / 0x80 | 0;
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
		const maxSector = this.DiskParameter.MaxCluster * this.DiskParameter.ClusterPerSector;
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
		const maxSector = this.DiskParameter.MaxCluster * this.DiskParameter.ClusterPerSector;
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
	 * @param {Uint8Array} Filename ファイル名(ファイル名()+"."+ 拡張子)
	 * @param {number} EntrySector 
	 * @returns {HuFileEntry}
	 */
	#GetFileEntry2(Filename, Extension, EntrySector) {
		let Sector = EntrySector;
		for (let i = 0; i < this.ClusterPerSector(); i++, Sector++) {
			const dc = this.DiskImage.GetDataControllerForRead(Sector);

			for (let j = 0; j < this.EntriesInSector; j++) {

				const pos = (j * this.FileEntrySize);
				const mode = dc.GetByte(pos);
				if (mode == this.EntryEnd) return null;

				const EntryName = dc.Copy(pos + 0x01, HuFileEntry.MaxNameLength);
				const EntryExtension = dc.Copy(pos + 0x0e, HuFileEntry.MaxExtensionLength);

				if (!this.#IsEqual(Filename, EntryName) || !this.#IsEqual(Extension, EntryExtension)) continue;

				return this.GetEntry(dc, Sector, pos);
			}
		}
		return null;
	}

	/**
	 * @param {Uint8Array} Filename ファイル名(ファイル名()+"."+ 拡張子)
	 * @returns {HuFileEntry}
	 */
	GetWritableEntry2(DirRecord, Filename, Extension) {
		let fe = this.#GetFileEntry2(Filename, Extension, DirRecord);
		// エントリに確保されていたクラスタを解放する
		if (fe != null) {
			this.RemoveAllocation(fe.StartCluster);
		} else {
			fe = this.#GetNewFileEntry(DirRecord);
		}
		return fe;
	}
};
