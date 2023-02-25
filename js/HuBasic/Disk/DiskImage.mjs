"use strict";

import { DataController } from './DataController.mjs';
import { SectorData } from './SectorData.mjs';
import Stream from '../Utils/Stream.mjs';
import {DiskImageReaderD88} from './D88/DiskImageReaderD88.mjs';
import {DiskImageWriterD88} from './D88/DiskImageWriterD88.mjs';
import {DiskImageReaderRaw} from './Raw/DiskImageReaderRaw.mjs';
import {DiskImageWriterRaw} from './Raw/DiskImageWriterRaw.mjs';

//
// メモ）
// ディスクイメージファイルのフォーマット
// https://github.com/jpzm/wii88/blob/master/document/FORMAT.TXT
//

export class DiskImage {
	/**
	 * ディスクイメージの名前
	 * @type {string}
	 */
	#DiskName = "";

	/**
	 * ライトプロテクトかどうか
	 * 
	 * 	true: ライトプロテクト
	 * @type {boolean}
	 */
	#IsWriteProtect = false;

	/**
	 * ディスクの種類
	 * @type {DiskType}
	 */
	DiskType;

	/**
	 * ログ管理
	 * @type {Log}
	 */
	Log;

	/**
	 * セクタ
	 * @type {SectorData[]}
	 */
	#Sectors = new Array();

	/**
	 * フォーマットする
	 * @param {number} TrackMax ディスクの最大トラック数
	 * @param {number} TrackPerSector １トラックのセクタ数
	 * @param {number} SectorSize １セクタのバイト数
	 */
	#TrackFormat(TrackMax, TrackPerSector, SectorSize) {
		this.#Sectors.length = 0;
		for (let t = 0; t < TrackMax; t++) {
			for (let s = 0; s < TrackPerSector; s++) {
				const sector = new SectorData();
				sector.Format(t, s, TrackPerSector, SectorSize);
				this.#Sectors.push(sector);
			}
		}
	}

	/**
	 * ディスク読み込みを作成する
	 * @param {boolean} isPlainFormat 生かどうか
	 * @returns {*} ディスク読み込み
	 */
	#createDiskImageReader(isPlainFormat)
	{
		if (!isPlainFormat) {
			// D88形式
			return new DiskImageReaderD88();
		} else {
			// なま形式
			return new DiskImageReaderRaw();
		}
	}

	/**
	 * ディスク書き込みを作成する
	 * @param {boolean} isPlainFormat 生かどうか
	 * @returns {*} ディスク書き込み
	 */
	#createDiskImageWriter(isPlainFormat)
	{
		if (!isPlainFormat) {
			// D88形式
			return new DiskImageWriterD88();
		} else {
			// なま形式
			return new DiskImageWriterRaw();
		}
	}

	// =======================================================
	// =======================================================

	/**
	 * コンストラクタ
	 * @param {Context} Context
	 */
	constructor(Context) {
		// ディスクタイプ
		this.DiskType = Context.Setting.DiskType;
		// ログ
		this.Log = Context.Log;
	}

	/**
	 * ディスクの名前を取得する
	 * @returns {string}
	 */
	GetDiskName() { return this.#DiskName; }
	/**
	 * ディスクの名前を設定する
	 * @param	{string} ディスクの名前
	 */
	SetDiskName(diskName) { this.#DiskName = diskName; }
	/**
	 * ライトプロテクトかどうか
	 * @returns {boolean} ライトプロテクトなら true を返す
	 */
	GetWriteProtect() { return this.#IsWriteProtect; }
	/**
	 * ライトプロテクトかどうかを設定する
	 * @param {boolean} isWriteProtect ライトプロテクトかどうか
	 * 		true:	ライトプロテクト
	 * 		false:	ライトプロテクトじゃない
	 */
	SetWriteProtect(isWriteProtect) { this.#IsWriteProtect = isWriteProtect; }
	/**
	 * ディスクの種類を取得する
	 * @returns {DiskType} ディスクの種類
	 */
	GetDiskType() { return this.DiskType; }

	/**
	 * セクタを取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {SectorData} セクタデータ
	 */
	GetSector(Sector) { return this.#Sectors[Sector]; }

	/**
	 * セクタを取得する
	 * @returns {SectorData[]} セクタの配列
	 */
	GetSectors() { return this.#Sectors; }

	/**
	 * ログ管理を取得する
	 * @returns {Log} ログ管理
	 */
	GetLog() { return this.Log; }

	// =======================================================
	// =======================================================

	/**
	 * 書き込み用としてセクタのデータ部分をデータコントローラで取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {DataController} データコントローラ
	 */
	GetDataControllerForWrite(Sector) {
		return new DataController(this.#Sectors[Sector].GetDataForWrite());
	}

	/**
	 * 読み込み用としてセクタのデータ部分をデータコントローラで取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {DataController} データコントローラ
	 */
	GetDataControllerForRead(Sector) {
		return new DataController(this.#Sectors[Sector].GetDataForRead());
	}

	/**
	 * 書き込み用としてセクタのデータ部分を取得する
	 * @param {number} Sector 取得するセクタ
	 * @returns {Uint8Array} セクタのデータ部分
	 */
	GetSectorDataForWrite(Sector) {
		return this.#Sectors[Sector].GetDataForWrite();
	}

	/**
	 * ディスクイメージを読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {boolean} isPlainFormat 
	 * @returns {boolean} 処理結果
	 */
	Read(fs, isPlainFormat) {
		// イメージ読み込む
		let diskImageReader = this.#createDiskImageReader(isPlainFormat);
		return diskImageReader.read(fs, this);
	}

	/**
	 * イメージを出力する
	 * @param {Stream} fs ファイルストリーム
	 * @param {boolean} isPlainFormat 
	 * @returns {boolean} 処理結果
	 */
	Write(fs, isPlainFormat) {
		// イメージ書き込む
		const diskImageWriter = this.#createDiskImageWriter(isPlainFormat);
		diskImageWriter.write(fs, this);
	}

	/**
	 * 物理フォーマット
	 */
	Format() {
		this.#TrackFormat(this.DiskType.GetMaxTrackSize(), this.DiskType.GetTrackPerSector(), this.DiskType.GetDataSize());
	}

	/**
	 * 書き出したときのファイルサイズを取得する
	 * @param {boolean} isPlainFormat 
	 * @returns {number} 書き出したときのファイルサイズ
	 */
	GetDiskImageFileSize(isPlainFormat)
	{
		const diskImageWriter = this.#createDiskImageWriter(isPlainFormat);
		return diskImageWriter.getDiskImageFileSize(this.DiskType);
	}
}
