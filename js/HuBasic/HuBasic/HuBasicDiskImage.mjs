"use strict";

import HuBasicDiskEntry from './HuBasicDiskEntry.mjs';
import { HuFileEntry, HuDateTime } from './HuFileEntry.mjs';
import Stream from '../Utils/Stream.mjs';

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

		this.#Log = this.#Context.Log;
		this.#DiskEntry = new HuBasicDiskEntry(this.#Context);

		this.#deviceOnline = false;
	}

	/**
	 * 空きクラスタ数を取得する
	 * @returns {number} 空きクラスタ数
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

	// -------------------------------------------------------------------------------------------
	// -------------------------------------------------------------------------------------------

	/**
	 * ディスクを設定する
	 * @param {string} Filename ディスクイメージのファイル名
	 * @param {Uint8Array} RawDiskImage 生のディスクイメージデータ
	 * @param {boolean} IsPlainFormat ヘッダ無しかどうか
	 * @returns {boolean} セットに成功したら true を返す
	 */
	SetDisk(Filename, RawDiskImage, IsPlainFormat)
	{
		const fs = new Stream();
		fs.SetupRead(Filename, RawDiskImage);
		const result = this.#DiskEntry.Read(fs, IsPlainFormat);
		if(result) {
			this.Mount(); // 読み込みに成功したらマウント
		} else {
			this.Unmount(); // 失敗したらアンマウント
		}
		return result;
	}

	/**
	 * ディスクの種類を取得する
	 * @returns {DiskType} ディスクの種類
	 */
	GetDiskType() { return this.#DiskEntry.GetDiskType(); }

	/**
	 * イメージの書き出し
	 * 
	 * @param {boolean} IsPlainFormat ヘッダ無しかどうか
	 * @returns {Uint8Array}
	 */
	WriteImage(IsPlainFormat) {
		const fs = new Stream();
		const Filename = "";
		const FileSize = this.#DiskEntry.GetDiskImageFileSize(IsPlainFormat);
		fs.SetupWrite(Filename, FileSize);
		this.#DiskEntry.WriteImage(fs);
		return fs.GetBuffer();
	}

	/**
	 * マウント
	 */
	Mount()
	{
		if(this.#Context.onDriveStateChange) {
			this.#Context.onDriveStateChange(
				"Mount",
				{
					isMount: true,
					isAccess: false,
					isNeedSave: true,
					info: {
						/**
						 * ディスクの種類
						 * @type{DiskType}
						 */
						diskType: this.GetDiskType(),
						/**
						 * アンマウントからマウントになったときに true
						 * @type{boolean}
						 */
						trigger: (this.#deviceOnline != true)
					}
				}
			);
		}
		this.#deviceOnline = true;
	}

	/**
	 * アンマウント
	 */
	Unmount()
	{
		if(this.#Context.onDriveStateChange) {
			this.#Context.onDriveStateChange(
				"Unmount",
				{
					isMount: false,
					isAccess: false,
					isNeedSave: false,
					info: {
						/**
						 * マウントからアンマウントになったときに true
						 * @type{boolean}
						 */
						trigger: (this.#deviceOnline != false)
					}
				}
			);
		}
		this.#deviceOnline = false;
	}

	/**
	 * マウントされているかどうか
	 * @returns {boolean} マウントされていれば true を返す
	 */
	isMount()
	{
		return this.#deviceOnline;
	}

	/**
	 * ディレクトリ内のエントリを取得する
	 * @param {number} DirRecord ディレクトリのレコード
	 * @returns {{
	 * 		result:number,				// 処理結果
	 * 		entries:{
	 * 			attribute:number,		// ファイル属性
	 * 			filename:Uint8Array,	// ファイル名
	 * 			extension:Uint8Array,	// 拡張子
	 * 			password:number,		// パスワード
	 * 			size:number,			// ファイルサイズ
	 * 			loadAddress:number,		// 読み込みアドレス
	 *			executeAddress:number,	// 実行アドレス
	 * 			date:{},				// 日付データ
	 * 			startCluster:number		// 開始クラスタ
	 * 		}[],
	 * 		freeClusters:number			// 空きクラスタ数
	 * }}
	 */
	Files(DirRecord) {
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return { result: 2 }; // Device Offline 
		}
		const freeClusters = this.CountFreeClusters();
		let ib = new Array();
		const Files = this.GetEntriesAt(DirRecord);
		for (let fe of Files) {
			ib.push({
				attribute: fe.GetFileMode(),			// ファイル属性
				filename: fe.GetName(),					// ファイル名
				extension: fe.GetExtension(),			// 拡張子
				password: fe.GetPassword(),				// パスワード
				size: fe.GetSize(),						// ファイルサイズ
				loadAddress: fe.GetLoadAddress(),		// 読み込みアドレス
				executeAddress: fe.GetExecuteAddress(),	// 実行アドレス
				date: fe.DateTimeData,					// 日付データ
				startCluster: fe.GetStartCluster()		// 開始クラスタ
			});
		}
		return {result:0, entries:ib, freeClusters:freeClusters};
	}

	/**
	 * ファイルエントリを検索する
	 * 
	 * @param {number} EntrySector エントリのセクタ番号
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {HuFileEntry} ファイルエントリ  
	 * 		見つからなかった場合は、nullを返す
	 */
	#findFileEntry(EntrySector, Name, Extension)
	{
		const Files = this.#DiskEntry.GetEntriesAt(EntrySector);
		for(let fe of Files) {
			if(fe.isEqualFilename(Name, Extension)) {
				return fe; // 見つかった
			}
		}
		return null; // 見つからなかった
	}

	/**
	 * インフォメーションブロックを取得する
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {Uint8Array} Name ファイル名
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
    GetInfomationBlock(EntrySector, Name, Extension)
	{
		if(!this.isMount()) {
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
		const fe = this.#findFileEntry(EntrySector, Name, Extension);
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
			result: 0,								// 処理結果 Success
			fileMode: fe.GetFileMode(),				// ファイルモード
			loadAddress: fe.GetLoadAddress(),		// 読み込みアドレス
			execAddress: fe.GetExecuteAddress(),	// 実行アドレス
			fileSize: fe.GetSize(),					// ファイルサイズ
			IB: fe.GetIB()							// IB
		};
	}

	/**
	 * ファイルを読み込む
	 * 
	 * resultは、0:成功、2:Device Offline、8:File not Found。
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name 読み込むファイル名
	 * @param {Uint8Array} Extension 読み込むファイルの拡張子
	 * @returns {{
	 *		result: number,			// 処理結果
	 *		attribute: number,		// ファイル属性
	 * 		value: Uint8Array,		// 読み込んだデータ
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 * }}
	 */
	ReadFile(DirRecord, Name, Extension)
	{
		if(!this.isMount()) {
			return {
				result: 2, // Device Offline デバイスがつながっていない
				attribute: 0,
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000,
			};
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Name, Extension);
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
		fs.SetupWrite("", 0);
		this.#DiskEntry.ExtractFile(fs, fe);
		return {
			result: 0,							// 処理結果 Success
			attribute: fe.GetFileMode(),		// ファイル属性
			value: fs.GetBuffer(),				// 読み込んだデータ
			loadAddress: fe.GetLoadAddress(),	// 読み込みアドレス
			execAddress: fe.GetExecuteAddress()	// 実行アドレス
		};
	}

	/**
	 * @param {number} DirRecord 
	 * @param {Uint8Array} Name  ファイル名
	 * @param {Uint8Array} Extension  拡張子
	 * @param {Uint8Array} Data
	 * @param {number} SaveAddress 
	 * @param {number} ExecAddress 
	 * @param {HuDateTime} FileDate ファイルの日付
	 * @param {number} FileMode 属性（ファイルモード）
	 * @returns {HuFileEntry}
	 */
	#MakeFileEntry2(DirRecord, Name, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode) {
		const fe = this.#DiskEntry.GetWritableEntry2(DirRecord, Name, Extension);
		if(!fe) { return null; }
		fe.Set(Name, Extension, Data.length, SaveAddress, ExecAddress, FileDate, FileMode);
		return fe;
	}

	/**
	 * 
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} Data 書き込むデータ
	 * @param {number} SaveAddress 開始アドレス
	 * @param {number} ExecAddress 実行アドレス
	 * @param {HuDateTime} FileDate ファイルの日付
	 * @param {number} FileMode 属性（ファイルモード）
	 * @returns 
	 */
	#AddEntry2(DirRecord, Name, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode) {
		const fe = this.#MakeFileEntry2(DirRecord, Name, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode);
		if (fe == null) {
			// BadAllocationTable ファットエラー
			return { result: 7, value: fe };
		}
		// 空きクラスタ取得
		const freeCluster = this.#DiskEntry.GetFreeCluster(fe);
		if (freeCluster < 0) {
			// 空きクラスタが無いので、ディスクいっぱい
			return { result: 9, value: fe }; // DeviceFull ディスクが一杯
		}
		//
		fe.StartCluster = freeCluster;
		this.#DiskEntry.WriteFileEntry(fe);
		return {result: 0, value: fe};
	}
	
	/**
	 * ファイルを書き込む
	 * 
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} Data 書き込むデータ
	 * @param {number} SaveAddress 開始アドレス
	 * @param {number} EndAddress 終了アドレス（未使用）
	 * @param {number} ExecAddress 実行アドレス
	 * @param {number} FileMode 属性（ファイルモード）
	 * @returns 
	 */
	WriteFile(DirRecord, Name, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode)
	{
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return {
				result: 2, // Device Offline
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000,
			};
		}
		if(this.#DiskEntry.GetWriteProtect()) {
			// ディスクが書き込み禁止なのでエラー
			return {
				result: 4, // Write Protected
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000,
			};
		}

		// @todo 上書きの場合の空き容量の計算
		const freeClusters = this.CountFreeClusters();
		if(freeClusters * 256 * 16 < Data.length) {
			// 空き容量不足
			return {
				result: 9, // DeviceFull ディスクが一杯
				value: new Uint8Array(),
				loadAddress: 0x0000,
				execAddress: 0x0000,
			};
		}

		const FileDate = new HuDateTime();
		const fe = this.#AddEntry2(DirRecord, Name, Extension, Data, SaveAddress, ExecAddress, FileDate, FileMode);
		if(fe.result != 0) {
			// ファイルエントリ追加失敗
			return { result: fe.result };
		}
		// データ書き込み
		const fs = new Stream();
		fs.SetupRead("", Data);
		if(!this.#DiskEntry.WriteStream(fs, fe.value.GetStartCluster())) {
			// 入出力時にエラーが発生した
			return { result: 1 }; // Device IO Error 
		}
		// 正常終了
		return { result: 0 }; // 処理結果 Success
	}

	/**
	 * レコードを読み込む
	 * 
	 * @param {number} Record レコード
	 * @returns {{
	 * 		result:number,		// 処理結果
	 * 		value:Uint8Array	// 読み込んだデータ
	 * }}
	 */
	ReadRecord(Record)
	{
		if(!this.isMount()) {
			return {
				result: 2, // Device Offline デバイスがつなかっていない
				value: new Uint8Array()
			};
		}
		return this.#DiskEntry.ReadRecord(Record);
	}

	/**
	 * レコードを書き込む
	 * 
	 * @param {number} Record レコード
	 * @param {Uint8Array} Data 書き込むレコードのデータ
	 * @returns {{
	 * 		result:number	// 処理結果
	 * }}
	 */
	WriteRecord(Record, Data)
	{
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return { result: 2 }; // Device Offline
		}
		if(this.#DiskEntry.GetWriteProtect()) {
			// ディスクが書き込み禁止なのでエラー
			return { result: 4 }; // Write Protected
		}
		return this.#DiskEntry.WriteRecord(Record, Data);
	}

	/**
	 * ライトプロテクトを設定する
	 * 
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	SetWriteProtected(DirRecord, Name, Extension)
	{
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return { result: 2 }; // Device Offline
		}
		if(this.#DiskEntry.GetWriteProtect()) {
			// ディスクが書き込み禁止なのでエラー
			return { result: 4 }; // Write Protected
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Name, Extension);
		if(!fe) {
			// 見つからなかった
			return { result: 8 }; // File not Found
		}
		if(fe.IsReadOnly()) {
			// 既に読み出し専用だった
			return { result: 0 }; // 処理結果 Success
		}
		// 読み込み専用にして
		fe.SetReadOnly();
		// 書き出す
		this.#DiskEntry.WriteFileEntry(fe);
		// 正常終了
		return { result: 0 }; // 処理結果 Success
	}

	/**
	 * ライトプロテクトを解除する
	 * 
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	ResetWriteProtected(DirRecord, Name, Extension)
	{
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return { result: 2 }; // Device Offline
		}
		if(this.#DiskEntry.GetWriteProtect()) {
			// ディスクが書き込み禁止なのでエラー
			return { result: 4 }; // Write Protected
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Name, Extension);
		if(!fe) {
			// 見つからなかった
			return { result: 8 };  // File not Found
		}
		if(!fe.IsReadOnly()) {
			// 読み出し専用では無かった
			return { result: 0 }; // 処理結果 Success
		}
		// 読み書きできるようにして
		fe.ResetReadOnly();
		// 書き出す
		this.#DiskEntry.WriteFileEntry(fe);
		// 正常終了
		return { result: 0 }; // 処理結果 Success
	}

	/**
	 * ファイルを削除する
	 * 
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	Kill(DirRecord, Name, Extension)
	{
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return { result: 2 }; // Device Offline
		}
		if(this.#DiskEntry.GetWriteProtect()) {
			// ディスクが書き込み禁止なのでエラー
			return { result: 4 }; // Write Protected
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Name, Extension);
		if(!fe) {
			// 見つからなかった
			return { result: 8 }; // File not Found
		}
		if(fe.IsReadOnly()) {
			// 読み出し専用だったので、削除できない
			return { result: 4 }; // Write Protected
		}
		// 削除する
		this.#DiskEntry.Delete(fe);
		// 正常終了
		return { result: 0 }; // Success
	}

	/**
	 * ファイル名を変更する
	 * 
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} NewName 新しいファイル名
	 * @param {Uint8Array} NewExtension 新しい拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }}
	 */
	Rename(DirRecord, Name, Extension, NewName, NewExtension)
	{
		if(!this.isMount()) {
			// デバイスがつなかっていない
			return { result: 2 }; // Device Offline
		}
		if(this.#DiskEntry.GetWriteProtect()) {
			// ディスクが書き込み禁止なのでエラー
			return { result: 4 }; // Write Protected
		}

		// ファイルエントリ検索
		const fe = this.#findFileEntry(DirRecord, Name, Extension);
		if(!fe) {
			// 見つからなかった
			return { result: 8 }; // File not Found
		}
		if(fe.IsReadOnly()) {
			// 読み出し専用だったので、変更できなかった
			return { result: 4 }; // Write Protected
		}
		const newFe = this.#findFileEntry(DirRecord, NewName, NewExtension);
		if(newFe) {
			// 新しいファイル名が既に存在する
			return { result: 10 }; // File Aready Exists
		}

		// 新しいファイル名を設定する
		fe.SetFilename(NewName, NewExtension);
		// 書き出す
		this.#DiskEntry.WriteFileEntry(fe);
		// 正常終了
		return { result: 0 }; // Success
	}
}
