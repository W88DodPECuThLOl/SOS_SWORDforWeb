"use strict";

import { DataController } from './DataController.mjs';

/**
 * セクタ
 */
export class SectorData {
	// =======================================================
	// セクタヘッダ部分
	// =======================================================

	/**
	 * シリンダ(C)
	 * 
	 * 0オリジン
	 * @type {number}
	 */
	#Cylinder;
	/**
	 * サイド(H)
	 * 
	 * 0:表面 1:裏面
	 * @type {number}
	 */
	#Side;
	/**
	 * セクタ(R)
	 * 
	 * 1オリジン
	 * @type {number}
	 */
	#Sector;
	/**
	 * セクタサイズ(N)
	 * 
	 * 0:128bytes  
	 * 1:256bytes  
	 * 2:512bytes  
	 * 3:1024bytes
	 * @type {number}
	 */
	#SectorSize;
	/**
	 * トラック中のセクタ数(このトラック内に存在するセクタの数）
	 * @type {number}
	 */
	#SectorsInTrack;
	/**
	 * 記録密度
	 * 
	 * 0x00 倍密度  
	 * 0x40 単密度    
	 * 0x01 高密度
	 * @type {number}
	 */
	#Density;
	/**
	 * 削除マーク
	 * 
	 * 0x00 ノーマル  
	 * 0x10 DELETED
	 * @type {boolean}
	 */
	#IsDelete;
	/**
	 * ステータス
	 * 
	 * 0x00:	正常  
	 * 0x10:	正常(DELETED DATA)  
	 * 0xa0:	ID CRC エラー  
	 * 0xb0:	データ CRC エラー  
	 * 0xe0:	アドレスマークなし  
	 * 0xf0:	データマークなし
	 * @type {number}
	 */
	#Status;

	/**
	 * セクタのデータ部分のサイズ
	 * @type {number}
	 */
	#DataSize;

	// =======================================================
	// =======================================================

	/**
	 * セクタのデータ部分
	 * @type {Uint8Array}
	 */
	#Data;

	/**
	 * セクタを作成したときのデータの初期値。0～255の値(byte)
	 * @type {number}
	 */
	#FillValue;
	/**
	 * データが変更されているかどうか
	 * todo セクタ単位で必要？
	 * @type {boolean}
	 */
	#IsDirty;

	// =======================================================
	// =======================================================

	/**
	 * コンストラクタ
	 * @param {number} FillValue セクタを作成したときのデータの初期値。0～255の値(byte)
	 */
	constructor(FillValue = 0xe5) {
		this.#FillValue = FillValue & 0xFF;
	}

	/**
	 * シリンダ(C)を取得する
	 * @returns {number} シリンダ(C) 0～
	 */
	GetCylinder() { return this.#Cylinder; }

	/**
	 * サイド(H)を取得する
	 * @returns {number} サイド(H) 0:表面 1:裏面
	 */
	GetSide() { return this.#Side; }

	/**
	 * セクタ(R)を取得する
	 * @returns {number} セクタ(R) 1～
	 */
	GetSector() { return this.#Sector; }

	/**
	 * セクタサイズ(N)を取得する
	 * @returns {number} セクタサイズ(N)  
	 * 		0: 128bytes  
	 * 		1: 256bytes  
	 * 		2: 512bytes  
	 * 		3: 1024bytes
	 */
	GetSectorSize() { return this.#SectorSize; }

	/**
	 * トラック中のセクタ数(このトラック内に存在するセクタの数）を取得する
	 * @returns {number} トラック中のセクタ数
	 */
	GetSectorsInTrack() { return this.#SectorsInTrack; }

	/**
	 * 記録密度を取得する
	 * @returns {number} 記録密度  
	 * 		0x00: 倍密度  
	 * 		0x40: 単密度    
	 * 		0x01: 高密度
	 */
	GetDensity() { return this.#Density; }

	/**
	 * 削除マークを取得する
	 * @returns {boolean} 削除マーク
	 * 		0x00 ノーマル  
	 * 		0x10 DELETED
	 */
	GetDelete() { return this.#IsDelete ? 0x10 : 0x00; }

	/**
	 * ステータスを取得する
	 * @returns {number} ステータス
	 * 		0x00: 正常  
	 * 		0x10: 正常(DELETED DATA)  
	 * 		0xa0: ID CRC エラー  
	 * 		0xb0: データ CRC エラー  
	 * 		0xe0: アドレスマークなし  
	 * 		0xf0: データマークなし
	 */
	GetStatus() { return this.#Status; }

	/**
	 * セクタのデータ部分のサイズを取得する
	 * @returns {number} セクタのデータ部分のサイズ
	 */
	GetDataSize() { return this.#DataSize; }

	// =======================================================
	// =======================================================

	/**
	 * セクタを作成する
	 * @param {number} Cylinder シリンダ(C)(0～)
	 * @param {number} Side サイド(H)(0:表面 1:裏面)
	 * @param {number} Sector セクタ(R)(1～) ※注意 １オリジン
	 * @param {number} SectorSize セクタサイズ(N)
	 * @param {number} SectorsInTrack このトラック内に存在するセクタの数
	 * @param {number} Density 記録密度(0x00:倍密度 0x40:単密度 0x01:高密度)
	 * @param {boolean} Delete 削除マーク
	 * @param {number} Status ステータス
	 * @param {number} DataSize データサイズ（バイト単位）
	 */
	#Make(Cylinder, Side, Sector, SectorSize, SectorsInTrack, Density, Delete, Status, DataSize) {
		// ヘッダ部分
		this.#setSectorHeader(Cylinder, Side, Sector, SectorSize, SectorsInTrack, Density, Delete, Status, DataSize);
		// セクタデータ
		this.#Data = new Uint8Array(DataSize);
		const dc = new DataController(this.#Data);
		dc.Fill(this.#FillValue); // 初期化
	}

	/**
	 * セクタのヘッダを設定する
	 * @param {number} Cylinder シリンダ(C)(0～)
	 * @param {number} Side サイド(H)(0:表面 1:裏面)
	 * @param {number} Sector セクタ(R)(1～) ※注意 １オリジン
	 * @param {number} SectorSize セクタサイズ(N)
	 * @param {number} SectorsInTrack このトラック内に存在するセクタの数
	 * @param {number} Density 記録密度(0x00:倍密度 0x40:単密度 0x01:高密度)
	 * @param {boolean} Delete 削除マーク
	 * @param {number} Status ステータス
	 * @param {number} DataSize データサイズ（バイト単位）
	 */
	#setSectorHeader(Cylinder, Side, Sector, SectorSize, SectorsInTrack, Density, Delete, Status, DataSize)
	{
		this.#Cylinder = Cylinder;
		this.#Side = Side;
		this.#Sector = Sector;
		this.#SectorSize = SectorSize; // 128:0 256:1 512:2 1024:3
		this.#SectorsInTrack = SectorsInTrack;
		this.#Density = Density;
		this.#IsDelete = !!Delete;
		this.#Status = Status;
		this.#DataSize = DataSize;
		this.#IsDirty = true;
	}

	// =======================================================
	// =======================================================

	/**
	 * セクタのヘッダ部分をログに出力する  
	 * デバッグ用
	 */
	Description() {
		console.log("C:" + this.GetCylinder() + " H:" + this.#Side + " R:" + this.GetSector() + " N:" + this.#SectorSize
			+ " SectorsInTrack:" + this.GetSectorsInTrack() +" Density:" + this.#Density
			+ " DeleteFlag:"+ this.#IsDelete + " Status:" + this.#Status + " DataSize:" + this.#DataSize);
	}

	/**
	 * 書き込み用としてデータ部分を取得する
	 * @returns {Uint8Array} データ部分
	 */
	GetDataForWrite() {
		this.#IsDirty = true; // データが変更されているフラグ立てる
		return this.#Data;
	}

	/**
	 * 読み込み用としてデータ部分を取得する
	 * @returns {Uint8Array} データ部分
	 */
	GetDataForRead() { return this.#Data; }

	/**
	 * データ部分全体を指定された値で埋める
	 * @param {number} Value 埋める値
	 */
	Fill(Value) {
		this.GetDataForWrite().fill(Value);
	}

	/**
	 * 倍密度でセクタをフォーマットする
	 * @param {number} t 
	 * @param {number} Sector セクタ(0～) ※注意 0オリジン
	 * @param {number} SectorsInTrack このトラック内に存在するセクタの数
	 * @param {number} DataSize セクタサイズ(バイト単位)
	 */
	Format(t, Sector, SectorsInTrack, DataSize) {
		const cylinder = t >> 1; // シリンダ(C)(0～)
		const side     = t & 1; // サイド(H)(0:表面 1:裏面)
		const sector   = Sector + 1; // セクタ(R)(1～)
		const density  = 0x00; // 記録密度 0x00:倍密度
		this.#Make(
			cylinder,		// シリンダ(C)(0～)
			side,			// サイド(H)(0:表面 1:裏面)
			sector,			// セクタ(R)(1～)
			DataSize >> 8,	// セクタサイズ(N)
			SectorsInTrack,	// このトラック内に存在するセクタの数
			density,		// 記録密度(0x00:倍密度 0x40:単密度 0x01:高密度)
			false,			// 削除マーク
			0,				// ステータス
			DataSize		// データサイズ（バイト単位）
		);
	}

	/**
	 * 生のセクタを読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {number} Cylinder シリンダ(C)(0～)
	 * @param {number} Side サイド(H)(0:表面 1:裏面)
	 * @param {number} Sector セクタ(R)(1～) ※注意 １オリジン
	 * @param {number} SectorSize セクタサイズ(N)
	 * @param {number} SectorsInTrack このトラック内に存在するセクタの数
	 * @param {number} Density 記録密度(0x00:倍密度 0x40:単密度 0x01:高密度)
	 * @param {boolean} Delete 削除マーク
	 * @param {number} Status ステータス
	 * @param {number} DataSize データサイズ（バイト単位）
	 * @returns {boolean} 読み込めたかどうか
	 */
	ReadRaw(fs, Cylinder, Side, Sector, SectorSize, SectorsInTrack, Density, Delete, Status, DataSize) {
		// ヘッダ部分設定
		this.#setSectorHeader(Cylinder, Side, Sector, SectorSize, SectorsInTrack, Density, Delete, Status, DataSize);
		// セクタのデータ部分を読み込む
		this.#Data = new Uint8Array(DataSize);
		return fs.Read(this.#Data, 0, DataSize) == DataSize;
	}
}
