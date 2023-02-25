"use strict";

import { DataController } from "../Disk/DataController.mjs";

const extensionDelimiter = 0x2e; // '.'

const HuFileEntry_InfomationBlock = {
	/**
	 * ファイル名の最大文字数
	 * @type {number}
	 */
	MaxNameLength: 13,

	/**
	 * 拡張子の最大文字数
	 * @type {number}
	 */
	MaxExtensionLength: 3
};

// ファイルモードの値 bit:機能
// 7:ディレクトリ 6:読み出しのみ 5:ベリファイ 4:隠しファイル 3:予約ビット 2:アスキー 1:BASIC 0:バイナリ
const FileModeByte = {
	BinaryFileModeByte: 0x01,
	BasicFileModeByte: 0x02,
	AsciiFileModeByte: 0x04,

	/**
	 * 隠しファイル
	 * @type {number}
	 */
	HiddenFileModeByte: 0x10,
	/**
	 * ベリファイ
	 * @type {number}
	 */
	VerifyFileModeByte: 0x20,
	/**
	 * 読み出し専用
	 * @type {number}
	 */
	ReadOnlyFileModeByte: 0x40,
	/**
	 * ディレクトリ
	 * @type {number}
	 */
	DirectoryFileModeByte: 0x80,

	TypeMask: 0x87,
};

/**
 * 日時
 */
export class HuDateTime {
	#Year;
	#Month;
	#DayOfWeek;
	#Day;
	#Hour;
	#Minute;

	/**
	 * 
	 * @param {number} val 
	 * @returns {number} 
	 */
	#ConvertFromBCD(val) {
		let r = ((val & 0xf0) >> 4) * 10;
		r += (val & 0x0f);
		return r;
	}

	/**
	 * 
	 * @param {number} num 
	 * @returns {number}
	 */
	#ConvertToBCD(num) {
		let r = num % 10;
		r |= ((num / 10 | 0) % 10) << 4;
		return r;
	}

	/**
	 * コンストラクタ
	 */
	constructor()
	{
		this.setNow();
	}

	/**
	 * 時間をIB形式で取得する
	 * @returns {Uint8Array}
	 */
	getTimeArray()
	{
		const dateTimeData = new Uint8Array(5);
		dateTimeData[0] = this.#ConvertToBCD(this.#Year);	// 00～99
		dateTimeData[1] = (this.#Month & 0x0f) << 4;		// 0x1～0xC
		dateTimeData[1] |= this.#DayOfWeek & 0x0f;			// 0～6
		dateTimeData[2] = this.#ConvertToBCD(this.#Day);	// 01～31
		dateTimeData[3] = this.#ConvertToBCD(this.#Hour);	// 00～23
		dateTimeData[4] = this.#ConvertToBCD(this.#Minute);	// 00～59
		return dateTimeData;
	}

	/**
	 * IB形式の時間で設定する
	 * @param {Uint8Array} dateTimeData IB形式の時間データ
	 */
	setTimeArray(dateTimeData)
	{
		this.#Year = this.#ConvertFromBCD(dateTimeData[0]);
		this.#Month = (dateTimeData[1] >> 4) & 0xF;
		this.#DayOfWeek = dateTimeData[1] & 0x0f;
		this.#Day = this.#ConvertFromBCD(dateTimeData[2]);
		this.#Hour = this.#ConvertFromBCD(dateTimeData[3]);
		this.#Minute = this.#ConvertFromBCD(dateTimeData[4]);
	}

	/**
	 * 現在時刻を取得する
	 */
	setNow()
	{
		// 現在時間取得
		const now = new Date();
		// 加工
		this.#Year = now.getFullYear() % 100; // 2桁にする
		this.#Month = now.getMonth() + 1; // 1～12
		this.#DayOfWeek = now.getDay(); // Sunday - Saturday : 0 - 6
		this.#Day = now.getDate(); // 1～31
		this.#Hour = now.getHours(); // 0～23
		this.#Minute = now.getMinutes(); // 0～59
	}

	/**
	 * @returns {string}
	 */
	toText() {
		let Year = this.#Year;
		Year = (Year < 80) ? (2000 + Year) : (1900 + Year);
		let r = String(Year) + "-" + String(this.#Month).padStart(2, "0") + "-" + String(this.#Day).padStart(2, "0");
		r += " " + String(this.#Hour).padStart(2, "0") + ":" + String(this.#Minute).padStart(2, "0");
		return r;
	}
}




/**
 * ファイルエントリ
 * 
 * - IB管理
 */
export class HuFileEntry {
	// =======================================================
	// IB
	// =======================================================

	/**
	 * ファイルモード
	 * 
	 * bit   説明  
	 * 0-2 : 1 : Bin  
	 *       2 : Bas  
	 *       4 : Asc  
	 * 3   : ---  
	 * 4   : 1:非表示 0:表示  
	 * 5   : 1:ベリファイ  
	 * 6   : 1:書き込み禁止  
	 * 7   : 下位ディレクトリ  
	 * @type {number}
	 */
	#FileMode;

	/**
	 * ファイル名（アスキーコード）
	 * 
	 * サイズがMaxNameLengthのUint8Array。
	 * ファイル名が短い場合、不足部分は0x20でパディングされる。
	 * @type {Uint8Array}
	 */
	#Name;

	/**
	 * 拡張子（アスキーコード）
	 * 
	 * サイズがMaxExtensionLengthのUint8Array。
	 * ファイル名が短い場合、不足部分は0x20でパディングされる。
	 * @type {Uint8Array}
	 */
	#Extension;

	/**
	 * パスワード
	 * 
	 * 0x20でなし
	 * @type {number}
	 */
	#Password;

	/**
	 * ファイルのサイズ（バイト単位）
	 * @type {number}
	 */
	#Size;

	/**
	 * 読み込みアドレス
	 * @type {number}
	 */
	#LoadAddress;

	/**
	 * 実行アドレス
	 * @type {number}
	 */
	#ExecuteAddress;

	/**
	 * 日付と時刻
	 * @type {HuDateTime}
	 */
	#DateTime = new HuDateTime();

	/**
	 * 開始クラスタ
	 * @type {number}
	 */
	StartCluster;

	// =======================================================
	// 
	// =======================================================

	/**
	 * エントリ位置
	 * @type {number}
	 */
	EntryPosition;

	/**
	 * エントリセクタ
	 * @type {number}
	 */
	EntrySector;

	// =======================================================
	// 
	// =======================================================

	/**
	 * 配列が同じかどうか
	 * @param {Uint8Array} mem1 配列
	 * @param {Uint8Array} mem2 配列
	 * @param {number} size サイズ
	 * @returns {boolean} 同じなら true を返す
	 */
	#memcmp(mem1, mem2, size)
	{
		for(let i = 0; i < size; ++i) {
			if(mem1[i] != mem2[i]) { return false; }
		}
		return true;
	}

	#PasswordNoUseByte = 0x20;

	/**
	 * パスワードを設定しない
	 * @param {boolean} NoPassword パスワードを設定しないとき true
	 */
	#SetNoPassword(NoPassword) { this.#Password = NoPassword ? this.#PasswordNoUseByte : 0x00; }

	/**
	 * 「ファイル名.拡張子」のファイル名を得る
	 * @returns {Uint8Array} 「ファイル名.拡張子」のファイル名（X1キャラクタコード）
	 */
	#GetNameAndExtension() {
		const filename = new Uint8Array(HuFileEntry_InfomationBlock.MaxNameLength + HuFileEntry_InfomationBlock.MaxExtensionLength + 1);
		filename.set(this.GetName());
		filename[HuFileEntry_InfomationBlock.MaxNameLength] = extensionDelimiter;
		filename.set(this.GetExtension(), HuFileEntry_InfomationBlock.MaxNameLength + 1);
		return filename;
	}

	/**
	 * 
	 * @param {number} val 
	 * @returns {number} 
	 */
	#ConvertFromBCD(val) {
		let r = ((val & 0xf0) >> 4) * 10;
		r += (val & 0x0f);
		return r;
	}

	/**
	 * 
	 * @param {number} num 
	 * @returns {number}
	 */
	#ConvertToBCD(num) {
		let r = num % 10;
		r |= ((num / 10 | 0) % 10) << 4;
		return r;
	}

	/**
	 * Uint8Arrayをリサイズする。
	 * 
	 * 短かった場合は、指定された値でパディングされる。
	 * 長かった場合は、後ろを切り詰める。
	 * @param {Uint8Array} array 調整されるUint8Array
	 * @param {number} length この長さに調整される
	 * @param {number} padding パディングするときの値
	 * @returns {Uint8Array} 長さが調整されたUint8Array
	 */
	static ResizeUint8Array(array, length, padding)
	{
		if(array.length > length) {
			return array.slice(0, length); // 後ろを削除
		} else if(array.length < length) {
			let result = new Uint8Array(length);
			result.fill(padding); // パディング
			result.set(array);
			return result;
		} else {
			return array; // そのまま
		}
	}

	/**
	 * ファイルタイプの属性を文字列で取得する
	 * @returns {string} ファイルタイプの属性の文字列
	 */
	#GetTypeText() {
		if (this.IsBinary()) return "BIN";
		if (this.IsBasic()) return "BAS";
		if (this.IsAscii()) return "ASC";
		if (this.IsDirectory()) return "DIR";
		return "FILE";
	}

	/**
	 * 日付を文字列形式で取得する
	 * @returns {string} 日付の文字列
	 */
	#GetDateText() {
		return this.GetDateTime().toText();
	}

	// =======================================================
	// アクセサ
	// =======================================================

	/**
	 * ファイルの属性（FileMode）を取得する
	 * @returns {number} ファイルの属性（FileMode）
	 */
	GetFileMode() { return this.#FileMode; }

	/**
	 * ファイル名を取得する
	 * @returns {Uint8Array} ファイル名
	 */
	GetName() { return this.#Name; }

	/**
	 * 拡張子を取得する
	 * @returns {Uint8Array} 拡張子
	 */
	GetExtension() { return this.#Extension; }

	/**
	 * パスワードを取得する
	 * @returns {number} パスワード
	 */
	GetPassword() { return this.#Password; }

	/**
	 * ファイルのサイズを取得する
	 * @returns {number} ファイルのサイズ（バイト単位）
	 */
	GetSize() { return this.#Size; }

	/**
	 * 読み込みアドレスを取得する
	 * @returns {number} 読み込みアドレス
	 */
	GetLoadAddress() { return this.#LoadAddress; }

	/**
	 * 実行アドレスを取得する
	 * @returns {number} 実行アドレス
	 */
	GetExecuteAddress() { return this.#ExecuteAddress; }

	/**
	 * 日付を取得する
	 * @returns {HuDateTime} 日付
	 */
	GetDateTime() { return this.#DateTime; }

	/**
	 * 開始クラスタを取得する
	 * @returns {number} 開始クラスタ
	 */
	GetStartCluster() { return this.StartCluster; }

	// =======================================================
	// 属性関連
	// =======================================================

	/**
	 * 削除済み（空き）かどうか
	 * @returns {boolean} 削除済み（空き）なら true を返す
	 */
	IsDelete() { return this.GetFileMode() == 0x00; }

	/**
	 * ファイル属性を削除済み（空き）にする
	 */
	SetDelete() { this.#FileMode = 0x00; }

	/**
	 * エントリの終了かどうか
	 * @returns {boolean} エントリの終了なら true を返す
	 */
	IsEntryEnd() { return this.GetFileMode() == 0xFF; }

	/**
	 * 属性がアスキーかどうか
	 * returns {boolean} アスキーファイルなら true を返す
	 */
	IsAscii() { return (this.GetFileMode() & FileModeByte.TypeMask) == FileModeByte.AsciiFileModeByte; }

	/**
	 * 属性がBASICファイルかどうか
	 * returns {boolean} BASICファイルなら true を返す
	 */
	IsBasic() { return (this.GetFileMode() & FileModeByte.TypeMask) == FileModeByte.BasicFileModeByte; }

	/**
	 * 属性がバイナリかどうか
	 * returns {boolean} バイナリファイルなら true を返す
	 */
	IsBinary() { return (this.GetFileMode() & FileModeByte.TypeMask) == FileModeByte.BinaryFileModeByte; }

	/**
	 * 属性がディレクトリかどうか
	 * returns {boolean} ディレクトリなら true を返す
	 */
	IsDirectory() { return (this.GetFileMode() & FileModeByte.TypeMask) == FileModeByte.DirectoryFileModeByte; }

	/**
	 * 読み出し専用かどうか
	 * returns {boolean}
	 */
	IsReadOnly() { return (this.GetFileMode() & FileModeByte.ReadOnlyFileModeByte) != 0x00; }

	/**
	 * 属性を読み出し専用にする
	 */
	SetReadOnly() { this.#FileMode |= FileModeByte.ReadOnlyFileModeByte; }

	/**
	 * 読み出し専用を解除する
	 */
	ResetReadOnly() { this.#FileMode &= ~FileModeByte.ReadOnlyFileModeByte; }

	// =======================================================
	// 
	// =======================================================

	/**
	 * デバッグ用
	 * ファイルエントリの内容を文字列で取得する
	 * 
	 * @returns {string} ファイルエントリの内容の文字列
	 */
	Description() {
		const TypeText = this.#GetTypeText();
		let LoadAddressText = this.GetLoadAddress().toString(16).padStart(4,'0').toUpperCase();
		let ExecuteAddressText = this.GetExecuteAddress().toString(16).padStart(4,'0').toUpperCase();
		let AddressText = "Load:" + LoadAddressText + " Exec:"  + ExecuteAddressText;
		const filename = this.#GetNameAndExtension();
		let BasicInfoText = filename + " Type:" + TypeText + " Date:" + this.#GetDateText() + " Size:" + this.GetSize();
		return BasicInfoText + " " + AddressText + " Start:" + this.GetStartCluster();
	}

	/**
	 * ディレクトリを作成する
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 */
	SetNewDirectoryEntry(Name, Extension) {
		this.#DateTime.setNow();
		this.#FileMode = FileModeByte.DirectoryFileModeByte;
		this.SetFilename2(Name, Extension);
		this.#SetNoPassword(true);
	}

	/**
	 * ファイル名と拡張子を設定する
	 * @param {Uint8Array} Filename ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 */
	SetFilename(Name, Extension) {
		this.#Name = new Uint8Array(HuFileEntry_InfomationBlock.MaxNameLength);
		for(let i = 0; i < this.#Name.length; ++i) {
			if(i < Name.length) {
				this.#Name[i] = Name[i];
			} else {
				this.#Name[i] = 0x20;
			}
		}
		this.#Extension = new Uint8Array(HuFileEntry_InfomationBlock.MaxExtensionLength);
		for(let i = 0; i < this.#Extension.length; ++i) {
			if(i < Extension.length) {
				this.#Extension[i] = Extension[i];
			} else {
				this.#Extension[i] = 0x20;
			}
		}
	}

	/**
	 * ディレクトリのIBからパラメータを設定する
	 * @param {DataController} dc ディレクトリのIB
	 * @param {number} sector ディレクトリのセクタ番号
	 * @param {number} pos セクタ内での位置(0x00,0x20, ... ,0xE0)
	 */
	SetEntryFromSector(dc, sector, pos) {
		this.EntrySector = sector;	// セクタ番号
		this.EntryPosition = pos;	// セクタ内での位置(0x00,0x20, ... ,0xE0)
									// メモ）ディレクトリのセクタへ書き戻すときに使用する

		this.#FileMode       = dc.GetByte(pos + 0x00);
		this.#Name           = dc.Copy(pos + 0x01, HuFileEntry_InfomationBlock.MaxNameLength);
		this.#Extension      = dc.Copy(pos + 0x0e, HuFileEntry_InfomationBlock.MaxExtensionLength);
		this.#Password       = dc.GetByte(pos + 0x11);
		this.#Size           = dc.GetWord(pos + 0x12);
		this.#LoadAddress    = dc.GetWord(pos + 0x14);
		this.#ExecuteAddress = dc.GetWord(pos + 0x16);
		// 日付
		this.#DateTime.setTimeArray(dc.Copy(pos + 0x18, 5));
		// 開始セクタ 3バイト
		this.StartCluster  = dc.GetByte(pos + 0x1d) << 16; // HIGH
		this.StartCluster |= dc.GetByte(pos + 0x1e);       // LOW
		this.StartCluster |= dc.GetByte(pos + 0x1f) << 8;  // MIDDLE
	}

	/**
	 * IBを取得する
	 */
	GetIB()
	{
		const IB = new Uint8Array(0x20);
		this.writeIB(new DataController(IB), 0);
		return IB;
	}

	writeIB(dc, pos)
	{
		dc.SetByte(pos + 0x00, this.GetFileMode());
		this.writeName(dc, pos, this.GetName());
		this.writeExtension(dc, pos, this.GetExtension());
		dc.SetByte(pos + 0x11, this.GetPassword());
		dc.SetWord(pos + 0x12, this.GetSize());
		dc.SetWord(pos + 0x14, this.GetLoadAddress());
		dc.SetWord(pos + 0x16, this.GetExecuteAddress());
		dc.SetCopy(pos + 0x18, this.GetDateTime().getTimeArray()); // 日付
		// 開始セクタ
		this.writeStartCluster(dc, pos, this.GetStartCluster());
	}

	writeName(dc, pos, name)
	{
		for(let i = 0; i < HuFileEntry_InfomationBlock.MaxNameLength; ++i) {
			if(i < name.length) {
				dc.SetByte(pos + 0x01 + i, name[i]);
			} else {
				dc.SetByte(pos + 0x01 + i, 0x20);
			}
		}
	}

	writeExtension(dc, pos, extension)
	{
		for(let i = 0; i < HuFileEntry_InfomationBlock.MaxExtensionLength; ++i) {
			if(i < extension.length) {
				dc.SetByte(pos + 0x0e + i, extension[i]);
			} else {
				dc.SetByte(pos + 0x0e + i, 0x20);
			}
		}
	}

	writeStartCluster(dc, pos, startCluster)
	{
		dc.SetByte(pos + 0x1d, startCluster >> 16); // HIGH
		dc.SetByte(pos + 0x1e, startCluster      ); // LOW
		dc.SetByte(pos + 0x1f, startCluster >>  8); // MIDDLE
	}












	/**
	 * ファイル名と拡張子が同じかどうかをチェックする
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @returns {boolean} 同じなら true を返す
	 */
	isEqualFilename(Name, Extension)
	{
		return this.#memcmp(this.GetName(),      Name,      HuFileEntry_InfomationBlock.MaxNameLength)
			&& this.#memcmp(this.GetExtension(), Extension, HuFileEntry_InfomationBlock.MaxExtensionLength);
	}

	/**
	 * 色々設定する
	 * @param {Uint8Array} Name ファイル名
	 * @param {Uint8Array} Extension 拡張子
	 * @param {number} Size ファイルサイズ
	 * @param {number} LoadAddress 読み込みアドレス
	 * @param {number} ExecuteAddress 実行アドレス
	 * @param {HuDateTime} FileDate 日付
	 * @param {number} FileMode 属性（ファイルモード）
	 * @param {boolean} NoPassword パスワードな無いときは true
	 */
	Set(Name, Extension, Size, LoadAddress, ExecuteAddress, FileDate, FileMode, NoPassword = true)
	{
		// サイズがWORDよりも大きい場合は0にする
		if (Size >= 0x10000) Size = 0x0;

		this.#FileMode = FileMode;
		this.SetFilename(Name, Extension);
		this.#SetNoPassword(NoPassword);
		this.#Size = Size;
		this.#LoadAddress = LoadAddress;
		this.#ExecuteAddress = ExecuteAddress;
		this.#DateTime = FileDate;
	}

	/**
	 * 
	 */
	FileEntryNormalize() {
		// @todo おそらく不要
		if (this.GetName().length > HuFileEntry_InfomationBlock.MaxNameLength) {
			this.#Name = this.GetName().slice(0, HuFileEntry_InfomationBlock.MaxNameLength);
		}
		/*
		if (this.GetExtension().length > 0 && this.#Extension[0] == extensionDelimiter) {
			this.#Extension = this.GetExtension().slice(1);
		}*/
		if (this.GetExtension().length > HuFileEntry_InfomationBlock.MaxExtensionLength) {
			this.#Extension = this.GetExtension().slice(0, HuFileEntry_InfomationBlock.MaxExtensionLength);
		}
	}
}
