"use strict";

import DataController from './DataController.mjs';

// SectorData
export default class {
	// -----------------------------
	// セクタヘッダ部分
	// -----------------------------

	/**
	 * シリンダ(C)
	 * 
	 * 0オリジン
	 * @type {number}
	 */
	Cylinder;
	/**
	 * サイド(H)
	 * 
	 * 0:表面 1:裏面
	 * @type {number}
	 */
	Side;
	/**
	 * セクタ(R)
	 * 
	 * 1オリジン
	 * @type {number}
	 */
	Sector;
	/**
	 * セクタサイズ(N)
	 * 
	 * 0:128bytes  
	 * 1:256bytes  
	 * 2:512bytes  
	 * 4:1024bytes
	 * @type {number}
	 */
	SectorSize;
	/**
	 * トラック中のセクタ数
	 * @type {number}
	 */
	SectorsInTrack;

	/**
	 * 記録密度
	 * 
	 * 0x00 倍密度  
	 * 0x40 単密度    
	 * 0x01 高密度
	 * @type {number}
	 */
	Density;
	/**
	 * 削除マーク
	 * 
	 * 0x00 ノーマル  
	 * 0x10 DELETED
	 * @type {boolean}
	 */
	IsDelete;
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
	Status;

	/**
	 * セクタのデータ部分のサイズ
	 * @type {number}
	 */
	DataSize;

	// -----------------------------
	// -----------------------------

	/**
	 * ディスクイメージ上での位置
	 * @type {number}
	 */
	Position;

	/**
	 * セクタのデータ部分
	 * @type {Uint8Array}
	 */
	#Data;
	/**
	 * セクタのヘッダ部分
	 * @type {Uint8Array}
	 */
	#Header;



	
	/**
	 * セクタを作成したときのデータの初期値。0～255の値(byte)
	 * @type {number}
	 */
	#FillValue;
	/**
	 * データが変更されているかどうか
	 * @type {boolean}
	 */
	IsDirty;
	/**
	 * デフォルトのセクタサイズ
	 * @type {number}
	 */
	#DefaultSectorSize = 256;

	/**
	 * コンストラクタ
	 * @param {number} FillValue セクタを作成したときのデータの初期値。0～255の値(byte)
	 */
	constructor(FillValue = 0xe5) {
		this.#FillValue = FillValue & 0xFF;
	}

	/**
	 * セクタをフォーマットする
	 * @param {number} t 
	 * @param {number} s 
	 * @param {number} TrackPerSector 
	 * @param {number} SectorSize セクタサイズ(バイト単位)
	 * @param {number} Position ディスク内でのオフセット位置
	 */
	Format(t, s, TrackPerSector, SectorSize, Position) {
		const cylinder = t >> 1;
		const side     = t & 1;
		const sector   = s + 1;
		this.#Make(cylinder, side, sector, SectorSize, TrackPerSector, 0, false, 0);
		this.Position = Position;
	}
	/**
	 * セクタを作成する
	 * @param {number} Cylinder シリンダ(C)(0～)
	 * @param {number} Side サイド(H)(0:表面 1:裏面)
	 * @param {number} Sector セクタ(R)(1～)
	 * @param {number} SectorSize セクタサイズ（バイト単位）
	 * @param {number} SectorsInTrack 
	 * @param {number} Density 記録密度(0x00:倍密度 0x40:単密度 0x01:高密度)
	 * @param {boolean} Delete 削除マーク
	 * @param {number} Status ステータス
	 */
	#Make(Cylinder, Side, Sector, SectorsInTrack, Density, Delete, Status, SectorSize) {
		this.#Header = new Uint8Array(0x10);
		const dc = new DataController(Header);

		this.Cylinder = Cylinder;
		this.Side = Side;
		this.Sector = Sector;
		this.SectorSize = SectorSize >> 8; // 128:0 256:1 512:2 1024:4
		this.SectorsInTrack = SectorsInTrack;
		this.Density = Density;
		this.IsDelete = !!Delete;
		this.Status = Status;
		this.DataSize = SectorSize;
		this.IsDirty = true;

		dc.SetByte(0, Cylinder);
		dc.SetByte(1, Side);
		dc.SetByte(2, Sector);
		dc.SetByte(3, SectorSize);
		dc.SetWord(4, SectorsInTrack);
		dc.SetByte(6, Density);
		dc.SetByte(7, this.IsDelete ? 0x10 : 0x00);
		dc.SetByte(8, Status);
		dc.SetWord(0x0e, DataSize);

		this.#Data = new Uint8Array(DataSize);
		dc.SetBuffer(this.#Data);
		dc.Fill(this.#FillValue);
	}

	/**
	 * セクタのヘッダ部分とデータ部分を結合した部分を取得する
	 * @returns {Uint8Array} セクタのヘッダ部分とデータ部分を結合した部分もの
	 */
	GetBytes() {
		let result = new Uint8Array(this.#Header.length + this.#Data.length);
		result.set(this.#Header);
		result.set(this.#Data, this.#Header.length);
		return result;
	}

	/**
	 * セクタのヘッダ部分とデータ部分の合計サイズ
	 * @returns {number} セクタのヘッダ部分とデータ部分の合計サイズ
	 */
	GetLength() {
		return this.#Header.length + this.#Data.length;
	}

	/**
	 * セクタ部分を読み込む
	 * @param {boolean} IsPlain プレーンなセクタかどうか（ヘッダが無い場合true）
	 * @param {Stream} fs ファイルストリーム
	 * @returns {boolean} 読み込めたかどうか
	 */
	Read(IsPlain, fs) {
		// ディスクイメージ上での位置
		this.Position = fs.GetPosition();
		// セクタデータサイズ
		this.DataSize = this.#DefaultSectorSize;
		// ヘッダ部分を読み込む
		if(!IsPlain && !this.#ReadSectorHeader(fs)) {
			return false; // エラー
		}
		// セクタのデータ部分を読み込む
		this.#Data = new Uint8Array(this.DataSize);
		return fs.Read(this.#Data, 0, this.DataSize) == this.DataSize;
	}

	/**
	 * セクタのヘッダ部分を読み込む
	 * @param {FileStream} fs ファイルストリーム
	 * @returns {boolean} 読み込めたかどうか
	 */
	#ReadSectorHeader(fs) {
		this.#Header = new Uint8Array(0x10);
		const s = fs.Read(this.#Header, 0, 0x10);
		if (s != 0x10) { return false; }

		const dc = new DataController(this.#Header);
		this.Cylinder = dc.GetByte(0);
		this.Side = dc.GetByte(1);
		this.Sector = dc.GetByte(2);
		this.SectorSize = dc.GetByte(3);
		this.SectorsInTrack = dc.GetWord(4);
		this.Density = dc.GetByte(6);
		this.IsDelete = dc.GetByte(7) != 0x00;
		this.Status = dc.GetByte(8);
		this.DataSize = dc.GetWord(0x0e);
		return true;
	}

	/**
	 * セクタのヘッダ部分をログに出力する
	 * デバッグ用
	 */
	Description() {
		console.log("C:" + this.Cylinder + " H:" + this.Side + " R:" + this.Sector + " N:" + this.SectorSize
			+ " SectorsInTrack:" + this.SectorsInTrack +" Density:" + this.Density
			+ " DeleteFlag:"+ this.IsDelete + " Status:" + this.Status + " DataSize:" + this.DataSize);
	}


	/**
	 * 書き込み用としてデータ部分を取得する
	 * @returns {Uint8Array} データ部分
	 */
	GetDataForWrite() {
		this.IsDirty = true; // データが変更されているフラグ立てる
		return this.#Data;
	}

	/**
	 * 読み込み用としてデータ部分を取得する
	 * @returns {Uint8Array} データ部分
	 */
	GetDataForRead() {
		return this.#Data;
	}

	/**
	 * データ部分全体を指定された値で埋める
	 * @param {number} Value 埋める値
	 */
	Fill(Value) {
		this.GetDataForWrite().fill(Value);
	}
}
