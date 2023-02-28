"use strict";

import HuBasicDiskImage from './HuBasicDiskImage.mjs';

class D88Checker {
	/**
	 * 2Dの生イメージかどうか
	 * @param {string} filename 
	 * @param {Uint8Array} data 
	 * @returns {boolean}
	 */
	is2dImage(filename, data)
	{
		// 2Dフォーマット時の標準的なファイルサイズで、判定
		if(data.length != 327680) { return false; }
		// イメージファイル名が2Dではないので違う
		if(!filename.toUpperCase().endsWith(".2D")) { return false; }
		// OK
		return true;
	}
	/**
	 * 2DDの生イメージかどうか
	 * @param {string} filename 
	 * @param {Uint8Array} data 
	 * @returns {boolean}
	 */
	is2ddImage(filename, data)
	{
		// 2DDフォーマット時の標準的なファイルサイズで、判定
		//if(data.length != 327680) { return false; }
		// イメージファイル名が2Dではないので違う
		if(!filename.toUpperCase().endsWith(".2DD")) { return false; }
		// OK
		return true;
	}
	/**
	 * 2HDの生イメージかどうか
	 * @param {string} filename 
	 * @param {Uint8Array} data 
	 * @returns {boolean}
	 */
	is2hdImage(filename, data)
	{
		// 2DDフォーマット時の標準的なファイルサイズで、判定
		//if(data.length != 327680) { return false; }
		// イメージファイル名が2Dではないので違う
		if(!filename.toUpperCase().endsWith(".2HD")) { return false; }
		// OK
		return true;
	}
}




// HuBasicDisk
export default class {
	/**
	 * @type {Context}
	 */
	#Context;
	/**
	 * @type {Log}
	 */
	Log;
	/**
	 * ディスクイメージ
	 * @type {HuBasicDiskImage}
	 */
	Image;

	#onDriveStateChange;

	/**
	 * コンストラクタ
	 * 
	 * @param {Context} Context 
	 */
	constructor(Context) {
		this.#Context = Context;
		this.Log = this.#Context.Log;
		this.Image = new HuBasicDiskImage(Context);

		this.#onDriveStateChange = Context.onDriveStateChange;

		if(Context.Setting.FormatImage) {
			this.Image.Mount();
		}
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
	mount(Filename, RawDiskImage, IsPlainFormat)
	{
		return this.Image.SetDisk(Filename, RawDiskImage, IsPlainFormat);
	}
	unmount()
	{
		return this.Image.Unmount();
	}

	/**
	 * ディスクの種類を取得する
	 * @returns {DiskType} ディスクの種類
	 */
	GetDiskType() { return this.Image.GetDiskType(); }

	/**
	 * ディスクイメージの書き出し
	 * 
	 * @param {boolean} IsPlainFormat ヘッダ無しかどうか
	 * @returns {Uint8Array}
	 */
	SaveDisk(IsPlainFormat)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"SaveDisk",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: false,
					info: {
						/**
						 * 保存の形式
						 *   raw: 生のイメージ
						 *   D88: D88形式
						 * @type {string}
						 */
						format: (IsPlainFormat ? "raw" : "D88")
					}
				})
		}
		return this.Image.WriteImage(IsPlainFormat);
	}

	/**
	 * ディレクトリ内のエントリを取得する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @returns {{
	 * 		result: number,				// 処理結果
	 * 		entries:{
	 * 			attribute: number,		// ファイル属性
	 * 			filename: Uint8Array,	// ファイル名
	 * 			extension: Uint8Array,	// 拡張子
	 * 			password: number,		// パスワード
	 * 			size: number,			// ファイルサイズ
	 * 			loadAddress: number,	// 読み込みアドレス
	 * 			executeAddress: number,	// 日付データ
	 * 			startCluster: number	// 開始クラスタ
	 * 		}[],
	 * 		freeClusters: number		// 空きクラスタ数
	 * }}
	 */
	Files(dirRecord) {
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"Files", 
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: false,
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord
					}
				}
			);
		}
		return this.Image.Files(dirRecord);
	}

	/**
	 * ファイル読み込み
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {number} dirRecord ディレクトリのレコード
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
	ReadFile(dirRecord, Name, Extension)
	{
		if((dirRecord === undefined) || (dirRecord < 0)) {
			// デフォルトのディレクトリエントリで
			dirRecord = this.GetDiskType().GetEntrySectorStart();
		}
		const result = this.Image.ReadFile(dirRecord, Name, Extension);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"ReadFile",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: false,
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}
	/**
	 * ファイル書き込み
	 * 
	 * resultは、0:成功
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension ファイルの拡張子
	 * @param {Uint8Array} Data 書き込むデータ
	 * @param {number} SaveAddress セーブアドレス
	 * @param {number} EndAddress 終了アドレス
	 * @param {number} ExecAddress 実行アドレス
	 * @param {number} FileMode 属性(ファイルモード)
	 * @returns {{
	 *		result: number			// 処理結果
	 * }} 処理結果
	 */
   	WriteFile(dirRecord, Name, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode)
	{
		if((dirRecord === undefined) || (dirRecord < 0)) {
			// デフォルトのディレクトリエントリで
			dirRecord = this.GetDiskType().GetEntrySectorStart();
		}
		const result = this.Image.WriteFile(dirRecord, Name, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"WriteFile",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: (result.result == 0), // 正常終了時のみ保存する必要がある
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 書き込むデータ
						 * @type {Uint8Array}
						 */
						Data: Data,
						/**
						 * セーブアドレス
						 * @type {number}
						 */
						SaveAddress: SaveAddress,
						/**
						 * 終了アドレス
						 * @type {number}
						 */
						EndAddress: EndAddress,
						/**
						 * 実行アドレス
						 * @type {number}
						 */
						ExecAddress: ExecAddress,
						/**
						 * 属性(ファイルモード)
						 * @type {number}
						 */
						FileMode: FileMode,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}
	/**
	 * レコード（セクタ）を読み込む
	 * @param {number} record 読み込むレコード
	 * @returns {{
	 * 		result:number,		// 処理結果
	 *		value:Uint8Array	// 読み込んだデータ
	 * }} 処理結果
	 */
	ReadRecord(record)
	{
		const result = this.Image.ReadRecord(record);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"ReadRecord",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: false,
					info: {
						/**
						 * 読み込むレコード
						 * @type {number}
						 */
						record: record,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}
   /**
	 * レコード（セクタ）を書き込む
	 * @param {number} record 書き込むレコード
	 * @param {Uint8Array} data 書き込むデータ
	 * @returns {{
	 * 		result:number		// 処理結果
	 * }} 処理結果
	 */
	WriteRecord(record, data)
	{
		const result = this.Image.WriteRecord(record, data);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"WriteRecord",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: (result.result == 0), // 正常終了時のみ保存する必要がある
					info: {
						/**
						 * 書き込むレコード
						 * @type {number}
						 */
						record: record,
						/**
						 * 書き込むデータ
						 * @type {Uint8Array}
						 */
						data: data,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}

	/**
	 * インフォメーションブロックを取得する
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 *		result: number,			// 処理結果
	 *		fileMode: number,		// ファイルモード
	 *		loadAddress: number,	// 読み込みアドレス
	 *		execAddress: number,	// 実行アドレス
	 *		fileSize: number,		// ファイルサイズ
	 *		IB: Uint8Array			// IB
	 *	}} インフォメーションブロックの情報
	 */
	GetInfomationBlock(dirRecord, Name, Extension)
	{
		const result = this.Image.GetInfomationBlock(dirRecord, Name, Extension);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"GetInfomationBlock",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: false,
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}

	/**
	 * ライトプロテクトを設定する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
    SetWriteProtected(dirRecord, Name, Extension)
	{
		const result = this.Image.SetWriteProtected(dirRecord, Name, Extension);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"SetWriteProtected",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: (result.result == 0), // 正常終了時のみ保存する必要がある
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}

	/**
	 * ライトプロテクトを解除する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	ResetWriteProtected(dirRecord, Name, Extension)
	{
		const result = this.Image.ResetWriteProtected(dirRecord, Name, Extension);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"ResetWriteProtected",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: (result.result == 0), // 正常終了時のみ保存する必要がある
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}

	/**
	 * ファイルを削除する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	Kill(dirRecord, Name, Extension)
	{
		const result = this.Image.Kill(dirRecord, Name, Extension);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"Kill",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: (result.result == 0), // 正常終了時のみ保存する必要がある
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}

	/**
	 * ファイル名を変更する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} NewName 新しいファイル名
	 * @param {Uint8Array} NewExtension 新しい拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	Rename(dirRecord, Name, Extension, NewName, NewExtension)
	{
		const result = this.Image.Rename(dirRecord, Name, Extension, NewName, NewExtension);
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(
				"Rename",
				{
					isMount: this.isMount(),
					isAccess: true,
					isNeedSave: (result.result == 0), // 正常終了時のみ保存する必要がある
					info: {
						/**
						 * ディレクトリのレコード
						 * @type {number}
						 */
						dirRecord: dirRecord,
						/**
						 * ファイル名
						 * @type {Uint8Array}
						 */
						Name: Name,
						/**
						 * ファイルの拡張子
						 * @type {Uint8Array}
						 */
						Extension: Extension,
						/**
						 * 新しいファイル名
						 * @type {Uint8Array}
						 */
						NewName: NewName,
						/**
						 * 新しいファイルの拡張子
						 * @type {Uint8Array}
						 */
						NewExtension: NewExtension,
						/**
						 * 処理結果
						 * @type {*}
						 */
						result: result
					}
				}
			);
		}
		return result;
	}

	/**
	 * ディスクがマウントされているかどうか
	 * @returns {boolean} マウントされてたら true を返す
	 */
	isMount() { return this.Image.isMount(); }
}
