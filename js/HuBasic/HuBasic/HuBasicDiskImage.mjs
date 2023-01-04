"use strict";

import HuBasicDiskEntry from './HuBasicDiskEntry.mjs';
import HuFileEntry from './HuFileEntry.mjs';
import Stream from '../Utils/Stream.mjs';
import { OpenEntryResult } from './OpenEntryResult.mjs';

// HuBasicDiskImage
export default class {
	/**
	 * @type {Context}
	 */
	#Context;
	/**
	 * @type {Log}
	 */
	#Log;
	/**
	 * @type {HuBasicDiskEntry}
	 */
	#DiskEntry;

	/**
	 * @type {Setting}
	 */
	#Setting;

	/**
	 * @type {Encoding}
	 */
	#TextEncoding;

	/**
	 * @type {boolean}
	 */
	IplEntry;

	/**
	 * @returns {string}
	 */
	IplModeText() { return this.IplEntry ? "IPL" : ""; }

	/**
	 * デバイスが繋がっているかどうか
	 * @type {boolean}
	 */
	#deviceOnline;

	/**
	 * @param {Context} context
	 */
	constructor(context) {
		this.#Context = context;
		this.#Setting = context.Setting;

		this.IplEntry = context.Setting.IplMode;
		this.#Log = this.#Context.Log;
		this.#DiskEntry = new HuBasicDiskEntry(this.#Context);
		this.#TextEncoding = this.#Context.TextEncoding;

		this.#deviceOnline = false;
	}

	/**
	 * ファイル追加
	 * @param {string[]} FilePathData 追加するファイルパス
	 * @param {string} EntryName 追加するエントリ名
	 * @returns {boolean}
	 */
	AddFile(FilePathData, EntryName = null) {

		for (let s of FilePathData) {
			if (!this.AddFile(s, EntryName)) return false;
		}

		this.WriteImage();
		return true;
	}

	/**
	 * ファイルの追加
	 * @param {Stream} fs
	 * @param {Uint8Array} EntryFilename ファイル名(X1キャラクタコード)
	 * @param {DateTime} FileDate ファイルの日付
	 * @returns {boolean} 成功でtrue
	 */
	AddFile4(fs, EntryFilename, FileDate) {
		const fe = this.#AddEntry(EntryFilename, fs.GetSize(), FileDate);
		if (fe == null) return false;
		return this.#WriteFileToImage(fs, fe.StartCluster);
	}

	/**
	 * 空きバイト数
	 * @param {number} FreeCluster
	 * @returns {number}
	 */
	GetFreeBytes(FreeCluster) { return this.#DiskEntry.GetFreeBytes(FreeCluster); }

	/**
	 * 空きクラスタ数
	 * @returns {number}
	 */
	CountFreeClusters() { return this.#DiskEntry.CountFreeClusters(); }

	/**
	 * ファイルエントリを取得
	 * @returns {HuFileEntry[]}
	 */
	GetEntries() {
		return this.#DiskEntry.GetEntries();
	}
	/**
	 * ファイルエントリを取得
	 * @param {number} entrySector ディレクトリの場所
	 * @returns {HuFileEntry[]}
	 */
	GetEntriesAt(entrySector) {
		return this.#DiskEntry.GetEntriesAt(entrySector);
	}

	/**
	 * イメージのディレクトリを開く
	 * @param {Uint8Array} name ディレクトリ名(X1キャラクタコード)
	 * @return {HuBasicDiskEntry.OpenEntryResult}
	 */
	OpenEntryDirectory(name) { return this.#DiskEntry.OpenEntryDirectory(name); }

	/**
	 * ステータスの確認
	 * @param {HuBasicDiskEntry.OpenEntryResult} Result 
	 * @return {boolean}
	 */
	IsOk(Result) { return this.#DiskEntry.IsOk(Result); }

	/**
	 * ファイル展開(パターン)
	 * @param {string} Pattern 
	 */
	Extract(Pattern) { this.#ExtractPattern(Pattern); }

	/**
	 * ファイル削除
	 * @param {string} Pattern 
	 */
	Delete_ParamString(Pattern) { this.#DeletePattern(Pattern); }

	/**
	 * ファイル削除。イメージにも書き込む。
	 * @param {string[]} Files
	 */
	DeleteFile(Files) {
		for (let Filename of Files) {
			this.Delete_ParamString(Filename);
		}
		this.WriteImage();
	}

	/**
	 * ファイル削除。イメージにも書き込む。
	 * @param {HuFileEntry[]} EntryData 
	 */
	Delete(EntryData) {
		for (let Entry of EntryData) {
			this.#DiskEntry.Delete(Entry);
		}
		this.WriteImage();
	}


	/// <summary>
	/// ファイルをすべて削除。イメージにも書き込む。
	/// </summary>
	DeleteAll() {
		this.Delete_ParamString("*");
		this.WriteImage();
	}


	/**
	 * イメージの書き出し
	 */
	WriteImage() {
		const fs = new Stream();
		const Filename = "";
		const FileSize = 0; // ?
		fs.SetupWrite(Filename, FileSize);
		this.#DiskEntry.WriteImage(fs);
	}

	/**
	 * ファイル展開
	 * @param {string} OutputFilename 出力するファイル名
	 * @param {HuFileEntry} fe 出力するファイルエントリ
	 * @return {Stream}
	 */
	#ExtractFile(OutputFilename, fe) {
		// 出力ストリーム選択
		const fs = this.#SelectOutputStream(OutputFilename, fe.Size);
		this.#DiskEntry.ExtractFile(fs, fe);
		return fs;
	}

	/**
	 * ファイルをディレクトリに展開する
	 * @param {string} Directory
	 * @param {HuFileEntry[]} Files
	 * @return {Stream[]}
	 */
	ExtractToDirectory(Directory, Files) {
		// 展開
		const result = new Array();
		for (let fe of Files) {
			const fileName = this.#TextEncoding.Decode(fe.GetFilename()); // X1キャラコードから文字列に変換
			const outputName = this.#PathCombine(Directory, fileName);
			result.push(this.#ExtractFile(outputName, fe));
		}
		return result;
	}

	/**
	 * 
	 * @param {string} Directory 
	 * @param {string} FileName 
	 * @returns {string}
	 */
	#PathCombine(Directory, FileName)
	{
		if(Directory.endsWith('/')) {
			return Directory + FileName;
		} else {
			return Directory + '/' + FileName;
		}
	}

	/// <summary>
	/// ファイルの追加
	/// </summary>
	/// <param name="FilePath">追加するファイルのパス</param>
	/// <param name="EntryName">エントリ名(設定したい場合)</param>
	/// <returns></returns>

	/**
	 * ファイルの追加
	 * @param {Uint8Array} FileData 追加するファイルのデータ
	 * @param {FileDate} FileDate 追加するファイルの日付
	 * @param {Uint8Array} EntryName (X1キャラクタコード)
	 * @return {boolean}
	 */
	AddFile(Filename, FileData, FileDate, EntryName = null) {
		//if (!File.Exists(FilePath)) return false;
		//var fi = new FileInfo(FilePath);

		// EntryFilename = エントリ上のファイル名
		//const EntryFilename = !string.IsNullOrEmpty(EntryName) ? EntryName : Path.GetFileName(FilePath);
		//var Size = (int)fi.Length;
		const Size = FileData.length;

		this.#Log.Info("Add:" + EntryName + " Size:" + Size + " " + this.IplModeText());


		//const FileDate = File.GetLastWriteTime(FilePath);
		const fs = new Stream(Filename, Size);

		return this.AddFile4(fs, EntryName, Size, FileDate);
	}


	/**
	 * @param {Uint8Array} EntryFilename (X1キャラクタコード)
	 * @param {number} Size ファイルサイズ
	 * @param {DateTime} FileDate ファイルの日付
	 * @return {HuFileEntry}
	 */
	#AddEntry(EntryFilename, Size, FileDate) {
		const fe = this.#MakeFileEntry(EntryFilename, Size, FileDate);
		if (fe == null) {
			this.Log.Error("ERROR:No entry space!");
			return null;
		}

		const fc = this.#DiskEntry.GetFreeCluster(fe);
		if (fc < 0) {
			this.Log.Error("ERROR:No free cluster!");
			return null;
		}
		fe.StartCluster = fc;
		fe.IsIplEntry = this.IplEntry;

		this.#DiskEntry.WriteFileEntry(fe);

		// ファイルをIPL設定する
		if (this.IplEntry) {
			this.Log.Info("IPL Name:" + this.#Setting.IplName);
			this.IplEntry = false;
		}

		return fe;
	}

	/**
	 * @param {Uint8Array} EntryFilename  ファイル名(ファイル名()+"."+ 拡張子)(X1キャラクタコード)
	 * @param {number} Size ファイルサイズ
	 * @param {DateTime} FileDate ファイルの日付
	 * @returns {HuFileEntry}
	 */
	#MakeFileEntry(EntryFilename, Size, FileDate) {
		const fe = this.#DiskEntry.GetWritableEntry(EntryFilename);
		fe.Set(EntryFilename, Size, FileDate, this.#Setting.ExecuteAddress, this.#Setting.LoadAddress);
		return fe;
	}

	/**
	 * @param {Stream} fs
	 * @param {number} StartCluster
	 * @returns {boolean}
	 */
	#WriteFileToImage(fs, StartCluster) {
		return this.#DiskEntry.WriteStream(fs, StartCluster);
	}

	/**
	 * @param {string} Name
	 */
	#ExtractPattern(Name) {
		const EntryName = this.#Setting.EntryName;
		const EntryPattern = !EntryName ? EntryName : Name;

		const MatchedFiles = this.GetMatchedFiles(EntryPattern);

		// 展開
		for (let fe of MatchedFiles) {
			this.Log.Info(fe.Description());
			const OutputName = !string.IsNullOrEmpty(EntryName) ? Name : fe.GetFilename();
			this.#ExtractFile(OutputName, fe);
		}
	}





	/**
	 * @param {string} Name
	 */
	#DeletePattern(Name) {
		const MatchedFiles = this.GetMatchedFiles(Name);

		for (let fe of MatchedFiles) {
			this.Log.Info(fe.Description(this.#TextEncoding));
			this.#DiskEntry.Delete(fe);
		}
	}

	/**
	 * パターンに一致したファイルエントリを取得する
	 * @param {string} EntryPattern パターン(グロブ)
	 * @return {HuFileEntry[]}
	 */
	GetMatchedFiles(EntryPattern) {
		const entrys = new Array();
		const re = new RegExp(this.#PatternToRegex(EntryPattern));
		const Files = this.#DiskEntry.GetEntries();
		for(let file of Files) {
			const filename = this.#TextEncoding.Decode(file.GetFilename());
			if(re.match(filename)) {
				entrys.push(file);
			}
		}
		return entrys;
		/*
		var r = new Regex(PatternToRegex(EntryPattern), RegexOptions.IgnoreCase);
		var Files = this.#DiskEntry.GetEntries();

		var MatchedFiles = Files.Where(x => r.IsMatch(x.GetFilename())).ToArray();
		return MatchedFiles;
		*/
	}

	/**
	 * 
	 * @param {string} Pattern 
	 * @returns {string}
	 */
	#PatternToRegex(Pattern)
	{
		//return "^" + Regex.Escape(Pattern).Replace(@"\*", ".*").Replace(@"\?", ".") + "$";
		Pattern = Pattern.replace("\\", "\\\\")
			.Pattern.replace("*", "\\*")
			.Pattern.replace("+", "\\+")
			.Pattern.replace("|", "\\|")
			.Pattern.replace("{", "\\{")
			.Pattern.replace("[", "\\[")
			.Pattern.replace("(", "\\(")
			.Pattern.replace(")", "\\)")
			.Pattern.replace("^", "\\^")
			.Pattern.replace("$", "\\$")
			.Pattern.replace(".", "\\.")
			.Pattern.replace("#", "\\#")
			.Pattern.replace(" ", "\\ ")
		;
		return "^" + Pattern.replace("\\*", ".*").replace("\\?", ".") + "$";
	}

	/**
	 * @param {string} OutputFile ファイル名
	 * @param {number} FileSize ファイルサイズ
	 * @return {Stream}
	 */
	#SelectOutputStream(OutputFile, FileSize) {
		const fileSize = FileSize ? FileSize : 0x10000;
		return new Stream(OutputFile, fileSize);
	}

	// -------------------------------------------------------------------------------------------
	// -------------------------------------------------------------------------------------------

	/**
	 * ディスクを設定する
	 * @param {string} Filename ディスクイメージのファイル名
	 * @param {Uint8Array} RawDiskImage 生のディスクイメージデータ
	 * @returns {boolean} セットに成功したら true を返す
	 */
	SetDisk(Filename, RawDiskImage)
	{
		const fs = new Stream();
		fs.SetupRead(Filename, RawDiskImage);
		const result = this.#DiskEntry.Read(fs);
		this.#deviceOnline = result;
		return result;
	}

	Unmount()
	{
		this.#deviceOnline = false;
	}

	/**
	 * ディレクトリ内のエントリを取得する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @returns {{
	* 		result:number,
	* 		entries:{
	* 			attribute:number,		// ファイル属性
	* 			filename:Uint8Array,	// ファイル名
	* 			extension:Uint8Array,	// 拡張子
	* 			password:number,		// パスワード
	* 			size:number,			// ファイルサイズ
	* 			loadAddress:number,		// 読み込みアドレス
	* 			executeAddress:number,	// 日付データ
	* 			startCluster:number		// 開始クラスタ
	* 		}[],
	* 		freeClusters:number
	* }}
	*/
	Files(dirRecord) {
		if(!this.#deviceOnline) {
			return {
				result: 2 // Device Offline デバイスがつなかっていない
			};
		}
		const freeClusters = this.CountFreeClusters();
		let ib = new Array();
		const Files = this.GetEntriesAt(dirRecord);
		for (let f of Files) {
			ib.push({
			attribute: f.FileMode,				// ファイル属性
			filename: f.Name,					// ファイル名
			extension: f.Extension,				// 拡張子
			password: f.Password,				// パスワード
			size: f.Size,						// ファイルサイズ
			loadAddress: f.LoadAddress,			// 読み込みアドレス
			executeAddress: f.ExecuteAddress,	// 実行アドレス
			date: f.DateTimeData,				// 日付データ
			startCluster: f.StartCluster		// 開始クラスタ
			//dummy_2       @todo ?
			});
		}
		return {result:0, entries:ib, freeClusters:freeClusters};
	}

	/**
	 * 
	 * @param {string} Filename ファイル名
	 * @returns {string} 調整されたファイル名
	 */
	#convertFilename(Filename)
	{
		const filenameEnd = Filename.lastIndexOf('.');
		let f;
		let e;
		if(filenameEnd >= 0) {
			f = Filename.slice(0, filenameEnd).padEnd(HuFileEntry.MaxNameLength, ' ');
			e = Filename.slice(filenameEnd + 1).padEnd(HuFileEntry.MaxExtensionLength, ' ');
		} else {
			f = Filename;
			e = "".padEnd(HuFileEntry.MaxNameLength, ' ');
		}
		f = f.slice(0, HuFileEntry.MaxNameLength);
		e = e.slice(0, HuFileEntry.MaxExtensionLength);
		return f + "." + e;
	}

	/**
	 * 
	 * @param {number} EntrySector 
	 * @param {Uint8Array} Filename 
	 * @param {Uint8Array} Extension 
	 * @returns {HuFileEntry}
	 */
	#findFileEntry(EntrySector, Filename, Extension)
	{
		const Files = this.#DiskEntry.GetEntriesAt(EntrySector);
		for(let fe of Files) {
			if(fe.isEqualFilename(Filename, Extension)) {
				return fe;
			}
		}
		return null;
	}

	/**
	 * インフォメーションブロックを取得する
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 *		result: number,			// 処理結果
	 *		fileMode: number,		// ファイルモード
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 *		fileSize: number,		// ファイルサイズ
	 *		IB: Uint8Array			// IB
	 *	}}
	 */
    GetInfomationBlock(EntrySector, Filename, Extension)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2, // Device Offline デバイスがつなかっていない
				fileMode: 0,
				loadAddress: 0x0000,
				execAddress: 0x0000,
				fileSize: 0,
				IB: new Uint8Array(32)
			};
		}
		// ファイルエントリ検索
		const fe = this.#findFileEntry(EntrySector, Filename, Extension);
		if(!fe) {
			// 見つからなかった
			return {
				result: 8, // File not Found
				fileMode: 0,
				loadAddress: 0x0000,
				execAddress: 0x0000,
				fileSize: 0,
				IB: new Uint8Array(32)
			};
		}
		return {
			result: 0,						// 処理結果 Success
			fileMode: fe.FileMode,			// ファイルモード
			loadAddress: fe.LoadAddress,	// 読み込みアドレス
			execAddress: fe.ExecuteAddress,	// 実行アドレス
			fileSize: fe.Size,				// ファイルサイズ
			IB: fe.IB						// IB
		};
	}

	/**
	 * ファイルを読み込む
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {Uint8Array} Filename 読み込むファイル名
	 * @param {Uint8Array} Extension 読み込むファイルの拡張子
	 * @returns {{
	 *		result: number,			// 処理結果
	 *		attribute: number,		// ファイル属性
	 * 		value: Uint8Array,		// 読み込んだデータ
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 * }}
	 */
	ReadFile(DirRecord, Filename, Extension)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2, // Device Offline デバイスがつながっていない
				attribute: 0,
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000,
			};
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Filename, Extension);
		if(!fe) {
			// 見つからなかった
			return {
				result: 8, // File not Found
				attribute: 0,
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000
			};
		}
		// 読み込み
		const fs = new Stream();
		fs.SetupWrite("", fe.Size);
		this.#DiskEntry.ExtractFile(fs, fe);
		return {
			result: 0,						// 処理結果 Success
			attribute: fe.FileMode,			// ファイル属性
			value: fs.GetBuffer(),			// 読み込んだデータ
			loadAddress: fe.LoadAddress,	// 読み込みアドレス
			execAddress: fe.ExecuteAddress	// 実行アドレス
		};
	}

	/**
	 * @param {Uint8Array} EntryFilename  ファイル名(ファイル名()+"."+ 拡張子)(X1キャラクタコード)
	 * @param {number} Size ファイルサイズ
	 * @param {DateTime} FileDate ファイルの日付
	 * @param {number} FileMode 属性（ファイルモード）
	 * @returns {HuFileEntry}
	 */
	#MakeFileEntry2(DirRecord, Filename, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode) {
		const fe = this.#DiskEntry.GetWritableEntry2(DirRecord, Filename, Extension);
		if(!fe) { return null; }
		fe.Set2(Filename, Extension, Data.length, SaveAddress, ExecAddress, FileDate, FileMode);
		return fe;
	}

	#AddEntry2(DirRecord, Filename, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode) {
		const fe = this.#MakeFileEntry2(DirRecord, Filename, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode);
		if (fe == null) {
			return {
				result: 7 // BadAllocationTable ファットエラー
			};
		}
		const fc = this.#DiskEntry.GetFreeCluster(fe);
		if (fc < 0) {
			return {
				result: 9 // DeviceFull ディスクが一杯
			};
		}
		fe.StartCluster = fc;
		this.#DiskEntry.WriteFileEntry(fe);
		return {result: 0, value: fe};
	}
	
	WriteFile(DirRecord, Filename, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2, // Device Offline デバイスがつなかっていない
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000,
			};
		}
		// @todo
		const date = new Date();
		const FileDate = {
			Year: date.getFullYear(),
			Month: date.getMonth(),
			DayOfWeek: date.getDay(),
			Day: date.getDate(),
			Hour: date.getHours(),
			Minute: date.getMinutes(),
			Second: date.getSeconds()
		};
/*
		DateTimeData[0] = this.ConvertToBCD(date.Year);
		DateTimeData[1] = (date.Month & 0x0f) << 4;
		DateTimeData[1] |= date.DayOfWeek & 0x0f;
		DateTimeData[2] = this.ConvertToBCD(date.Day);

		DateTimeData[3] = this.ConvertToBCD(date.Hour);
		DateTimeData[4] = this.ConvertToBCD(date.Minute);
		DateTimeData[5] = this.ConvertToBCD(date.Second);
*/
		const fe = this.#AddEntry2(DirRecord, Filename, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode);
		if(fe.result != 0) {
			return { result: fe.result };
		}
		const fs = new Stream();
		fs.SetupRead("", Data);
		if(!this.#WriteFileToImage(fs, fe.value.StartCluster)) {
			return {
				result: 1 // Device IO Error 入出力時にエラーが発生した
			};
		}
		return {result: 0};
	}

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
		if(!this.#deviceOnline) {
			return {
				result: 2, // Device Offline デバイスがつなかっていない
				value: new Uint8Array()
			};
		}
		return this.#DiskEntry.ReadRecord(record);
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
		if(!this.#deviceOnline) {
			return {
				result: 2 // Device Offline デバイスがつなかっていない
			};
		}
		return this.#DiskEntry.WriteRecord(record, data);
	}

	/**
	 * ライトプロテクトを設定する
	 * @param {string} Filename ファイル名
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	SetWriteProtected(DirRecord, Filename, Extension)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2 // Device Offline デバイスがつなかっていない
			};
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Filename, Extension);
		if(!fe) {
			// 見つからなかった
			return {
				result: 8 // File not Found
			};
		}
		if(fe.IsReadOnly()) {
			// 既に読み出し専用だった
			return {
				result: 0 // 処理結果 Success
			};
		}
		// 読み込み専用にして
		fe.SetReadOnly();
		// 書き出す
		this.#DiskEntry.WriteFileEntry(fe);
		// 正常終了
		return {
			result: 0 // 処理結果 Success
		};
	}

	/**
	 * ライトプロテクトを解除する
	 * @param {string} Filename ファイル名
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	ResetWriteProtected(DirRecord, Filename, Extension)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2 // Device Offline デバイスがつなかっていない
			};
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Filename, Extension);
		if(!fe) {
			// 見つからなかった
			return {
				result: 8 // File not Found
			};
		}
		if(!fe.IsReadOnly()) {
			// 読み出し専用では無かった
			return {
				result: 0 // 処理結果 Success
			};
		}
		// 読み書きできるようにして
		fe.ResetReadOnly();
		// 書き出す
		this.#DiskEntry.WriteFileEntry(fe);
		// 正常終了
		return {
			result: 0 // 処理結果 Success
		};
	}

	/**
	 * ファイルを削除する
	 * @param {string} Filename ファイル名
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	Kill(DirRecord, Filename, Extension)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2 // Device Offline デバイスがつなかっていない
			};
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Filename, Extension);
		if(!fe) {
			// 見つからなかった
			return {
				result: 8 // File not Found
			};
		}
		if(fe.IsReadOnly()) {
			// 読み出し専用だったので、削除できない
			return {
				result: 4 // Write Protected
			};
		}
		// 削除する
		this.#DiskEntry.Delete(fe);
		// 書き出す
		// this.WriteImage(); // @todo
		// 正常終了
		return {
			result: 0 // 処理結果 Success
		};
	}

	/**
	 * ファイル名を変更する
	 * @param {string} Filename		ファイル名
	 * @param {string} NewFilename	新しいファイル名
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	Rename(DirRecord, Filename, Extension, NewFilename, NewExtension)
	{
		if(!this.#deviceOnline) {
			return {
				result: 2 // Device Offline デバイスがつなかっていない
			};
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Filename, Extension);
		if(!fe) {
			// 見つからなかった
			return {
				result: 8 // File not Found
			};
		}
		if(fe.IsReadOnly()) {
			// 読み出し専用だったので、変更できなかった
			return {
				result: 4 // Write Protected
			};
		}
		const newFe = this.#findFileEntry(DirRecord, NewFilename, NewExtension);
		if(newFe) {
			// 新しいファイル名が既に存在する
			return {
				result: 10 // File Aready Exists
			};
		}

		// 新しいファイル名を設定する
		fe.SetFilename2(NewFilename, NewExtension);
		// 書き出す
		this.#DiskEntry.WriteFileEntry(fe);
		// 正常終了
		return {
			result: 0 // 処理結果 Success
		};
	}
}
