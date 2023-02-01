"use strict";

import HuBasicDiskImage from './HuBasicDiskImage.mjs';

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

	/**
	 * 編集
	 * @returns {boolean}
	 */
	Edit() {
		// イメージ内のディレクトリを設定する
		if (!this.SetEntryDirectory(this.#Context.Setting.EntryDirectory)) {
			this.Log.Error("Directory open error!");
			return false;
		}

		var Files = this.#Context.Files;
		var EntryName = this.#Context.Setting.EntryName;

		switch (this.#Context.RunMode) {

			case RunModeTypeEnum.Extract:
				this.Log.Info("Extract files:");
				this.#Extract();
				return true;

			case RunModeTypeEnum.Add:
				this.Log.Info("Add files:");
				if (!AddFile(Files, EntryName)) return false;
				break;

			case RunModeTypeEnum.List:
				this.Log.Info("List files:");
				ListFiles();
				break;

			case RunModeTypeEnum.Delete:
				this.Log.Info("Delete files:");
				// ファイル未指定ではすべて削除
				this.#DeleteFile(Files);

				break;
		}

		DisplayFreeSpace();
		return true;
	}

	/**
	 * 
	 * @param {string[]} Files
	 * @param {string}  EntryName
	 * @return {boolean}
	 */
	AddFile(Files, EntryName) {
		if (Files.length == 1) {
			this.Log.Info("No files to add.");
			//@todo
			//this.Image.WriteImage();
			return true;
		}
		return this.Image.AddFile(Files.slice(1), EntryName);

	}

	/**
	 * 
	 * @param {string[]} Files
	 */
	#DeleteFile(Files) {
		if (Files.length == 1) {
			this.Image.DeleteAll();
		} else {
			this.Image.DeleteFile(Files.slice(1));
		}
	}

	#Extract() {
		const Files = this.Context.Files;
		if (Files.length == 1) return;

		for (let i = 1; i < Files.Count; i++) {
			const Filename = Files[i];
			this.Image.Extract(Filename);
		}
	}

	/**
	 * イメージ内のエントリを設定
	 * @param {string} EntryDirectory
	 * @returns {boolean}
	 */
	SetEntryDirectory(EntryDirectory) {
		if (EntryDirectory.length == 0) return true;
		this.Log.Info("EntryDirectory:" + EntryDirectory);

		// パス区切りは「\」と「/」を使用できる
		EntryDirectory = EntryDirectory.replaceAll('\\', '/');
		for (let Name of EntryDirectory.split('/')) {
			if (Name.length == 0) continue;
			const Result = this.Image.OpenEntryDirectory(Name);
			if (!this.Image.IsOk(Result)) return false;
		}
		return true;
	}

	/**
	 * ファイル一覧の表示
	 */
	ListFiles() {
		const Files = this.Image.GetEntries();
		for (let f of Files) {
			this.Log.Info(f.Description(this.#Context.TextEncoding));
		}
	}

	DisplayFreeSpace() {
		const fc = this.Image.CountFreeClusters();
		const fb = this.Image.GetFreeBytes(fc);
		this.Log.Info("Free:" + fb + " byte(s) / " + fc + " cluster(s)");
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
	 * ディスクイメージの書き出し
	 * 
	 * @param {boolean} IsPlainFormat ヘッダ無しかどうか
	 * @returns {Uint8Array}
	 */
	SaveDisk(IsPlainFormat)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
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
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.Files(dirRecord);
	}

	/**
	 * ファイル読み込み
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {number} dirRecord ディレクトリのレコード
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
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.ReadFile(DirRecord, Filename, Extension);
	}
	/**
	 * ファイル書き込み
	 * 
	 * resultは、0:成功
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
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
   	WriteFile(dirRecord, Filename, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.WriteFile(dirRecord, Filename, Extension, Data, SaveAddress, EndAddress, ExecAddress, FileMode);
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
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.ReadRecord(record);
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
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.WriteRecord(record, data);
	}

	/**
	 * インフォメーションブロックを取得する
	 * 
	 * resultは、0:成功、8:File not Found。
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
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
	GetInfomationBlock(DirRecord, Filename, Extension)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.GetInfomationBlock(DirRecord, Filename, Extension);
	}

	/**
	 * ライトプロテクトを設定する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
    SetWriteProtected(DirRecord, Filename, Extension)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.SetWriteProtected(DirRecord, Filename, Extension);
	}

	/**
	 * ライトプロテクトを解除する
	 * @param {number} DirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	ResetWriteProtected(DirRecord, Filename, Extension)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.ResetWriteProtected(DirRecord, Filename, Extension);
	}

	/**
	 * ファイルを削除する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	Kill(DirRecord, Filename, Extension)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.Kill(DirRecord, Filename, Extension);
	}

	/**
	 * ファイル名を変更する
	 * @param {number} dirRecord ディレクトリのレコード
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {Uint8Array} NewFilename 新しいファイル名
	 * @param {Uint8Array} NewExtension 新しい拡張子
	 * @returns {{
	 * 		result:number // 処理結果
	 * }} 処理結果
	 */
	Rename(DirRecord, Filename, Extension, NewFilename, NewExtension)
	{
		if(this.#onDriveStateChange) {
			this.#onDriveStateChange(this.isMount(), true);
		}
		return this.Image.Rename(DirRecord, Filename, Extension, NewFilename, NewExtension);
	}

	isMount()
	{
		return this.Image.isMount();
	}
}
