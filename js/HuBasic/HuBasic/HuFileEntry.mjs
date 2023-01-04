"use strict";

// HuFileEntry
export default class {
	/**
	 * ファイルモード
	 * @type {number}
	 */
	FileMode;

	/**
	 * ファイル名（X1キャラクタコード）
	 * 
	 * サイズがMaxNameLengthのUint8Array。
	 * ファイル名が短い場合、不足部分は0x20でパディングされる。
	 * @type {Uint8Array}
	 */
	Name;

	/**
	 * 拡張子（X1キャラクタコード）
	 * 
	 * サイズがMaxExtensionLengthのUint8Array。
	 * ファイル名が短い場合、不足部分は0x20でパディングされる。
	 * @type {Uint8Array}
	 */
	Extension;

	/**
	 * パスワード
	 * @type {number}
	 */
	Password;

	/**
	 * サイズ
	 * @type {number}
	 */
	Size;

	/**
	 * 読み込みアドレス
	 * @type {number}
	 */
	LoadAddress;

	/**
	 * 実行アドレス
	 * @type {number}
	 */
	ExecuteAddress;

	/**
	 * 開始クラスタ
	 * @type {number}
	 */
	StartCluster;

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

	/**
	 * ファイル名の最大文字数
	 * @type {number}
	 */
	static MaxNameLength = 13;
	MaxNameLength = 13;

	/**
	 * 拡張子の最大文字数
	 * @type {number}
	 */
	static MaxExtensionLength = 3;
	MaxExtensionLength = 3;

	/**
	 * 日付と時刻
	 * @type {number[]}
	 */
	DateTimeData = new Array(6);

	/**
	 * @type {Uint8Array}
	 */
	IB;

	/**
	 * IPLエントリかどうか
	 * @type {boolean}
	 */
	IsIplEntry;

	// メモ）X1のディレクトリの区切りは スラッシュ
	#directoryDelimiter = 0x2f; // slash
	#extensionDelimiter = 0x2e; // '.'


	/**
	 * 「ファイル名.拡張子」のファイル名を得る
	 * @returns {Uint8Array} 「ファイル名.拡張子」のファイル名（X1キャラクタコード）
	 */
	GetFilename() {
		const filename = new Uint8Array(this.MaxNameLength + this.MaxExtensionLength + 1);
		filename.set(this.Name);
		filename[this.MaxNameLength] = this.#extensionDelimiter;
		filename.set(this.Extension, this.MaxNameLength + 1);
		return filename;
	}

	/**
	 * @param {Encoding} TextEncoding
	 * @returns {string}
	 */
	Description(TextEncoding) {
		let TypeText = this.GetTypeText();
		let LoadAddressText = this.LoadAddress.toString(16).padStart(4,'0').toUpperCase();
		let ExecuteAddressText = this.ExecuteAddress.toString(16).padStart(4,'0').toUpperCase();
		let AddressText = "Load:" + LoadAddressText + " Exec:"  + ExecuteAddressText;
		const filename = TextEncoding.Decode(this.GetFilename());
		let BasicInfoText = filename + " Type:" + TypeText + " Date:" + this.GetDateText() + " Size:" + this.Size;
		return BasicInfoText + " " + AddressText + " Start:" + this.StartCluster;
	}

	/**
	 * 
	 * @returns {string}
	 */
	GetTypeText() {
		if (this.IsDirectory()) return "DIR";
		if (this.IsAscii()) return "ASC";
		if (this.IsBinary()) return "BIN";
		return "FILE";
	}

	/**
	 * @returns {string}
	 */
	GetDateText() {
		let Year = this.ConvertFromBCD(this.DateTimeData[0]);
		Year = (Year < 80) ? (2000 + Year) : (1900 + Year);
		let Month = (this.DateTimeData[1] >> 4) & 0xF;
		let Day = this.ConvertFromBCD(this.DateTimeData[2]);

		let Hour = this.ConvertFromBCD(this.DateTimeData[3]);
		let Min = this.ConvertFromBCD(this.DateTimeData[4]);
		let Sec = this.ConvertFromBCD(this.DateTimeData[5]);

		let r = String(Year) + "-" + String(Month).padStart(2, "0") + "-" + String(Day).padStart(2, "0");
		r += " " + String(Hour).padStart(2, "0") + ":" + String(Min).padStart(2, "0") + ":" + String(Sec).padStart(2, "0");
		return r;
	}

	/**
	 * 
	 * @param {number} val 
	 * @returns {number} 
	 */
	ConvertFromBCD(val) {
		let r = ((val & 0xf0) >> 4) * 10;
		r += (val & 0x0f);
		return r;
	}

	/**
	 * 
	 * @param {number} num 
	 * @returns {number}
	 */
	ConvertToBCD(num) {
		let r = num % 10;
		r |= ((num / 10 | 0) % 10) << 4;
		return r;
	}

	/**
	 * 
	 * @param {DateTime} date 
	 */
	SetTime(date) {
		this.DateTimeData[0] = this.ConvertToBCD(date.Year);
		this.DateTimeData[1] = (date.Month & 0x0f) << 4;
		this.DateTimeData[1] |= date.DayOfWeek & 0x0f;
		this.DateTimeData[2] = this.ConvertToBCD(date.Day);

		this.DateTimeData[3] = this.ConvertToBCD(date.Hour);
		this.DateTimeData[4] = this.ConvertToBCD(date.Minute);
		this.DateTimeData[5] = this.ConvertToBCD(date.Second);
	}

	/**
	 * 
	 */
	SetDelete() {
		this.FileMode = 0x00;
	}

	/**
	 * @returns {boolean}
	 */
	IsDelete() { return this.FileMode == 0x00; }

	#DirectoryFileModeByte = 0x80;

	#BinaryFileModeByte = 0x01;

	#AsciiFileModeByte = 0x04;

	/**
	 * 読み出し専用
	 * @type {number}
	 */
	#ReadOnlyFileModeByte = 0x40;

	// ファイルモードの値 bit:機能
	// 7:ディレクトリ 6:読み出しのみ 5:ベリファイ？ 4:隠しファイル 3:不明 2:アスキー 1:BASIC 0:バイナリ

	/**
	 * returns {boolean}
	 */
	IsDirectory() { return (this.FileMode & this.#DirectoryFileModeByte) != 0x00; }

	/**
	 * returns {boolean}
	 */
	IsAscii() { return (this.FileMode & this.#AsciiFileModeByte) != 0x00; }

	/**
	 * returns {boolean}
	 */
	IsBinary() { return (this.FileMode & this.#BinaryFileModeByte) != 0x00; }

	/**
	 * 読み出し専用かどうか
	 * returns {boolean}
	 */
	IsReadOnly() { return (this.FileMode & this.#ReadOnlyFileModeByte) != 0x00; }
	SetReadOnly() { this.FileMode |= this.#ReadOnlyFileModeByte; }
	ResetReadOnly() { this.FileMode &= ~this.#ReadOnlyFileModeByte; }

	#PasswordNoUseByte = 0x20;


	/**
	 * ファイルエントリの設定
	 * @param {Uint8Array} Filename ファイル名(X1キャラクタコード)
	 * @param {number} Size 
	 * @param {DateTime} FileDate 
	 * @param {number} ExecuteAddress 
	 * @param {number} LoadAddress 
	 * @param {boolean} UseBinaryFileMode 
	 * @param {boolean} NoPassword 
	 */
	Set(Filename, Size, FileDate, ExecuteAddress, LoadAddress,
			UseBinaryFileMode = true, NoPassword = true) {
		this.SetTime(FileDate);
		this.FileMode = UseBinaryFileMode ? this.#BinaryFileModeByte : this.#AsciiFileModeByte;

		// サイズがWORDよりも大きい場合は0にする
		if (Size >= 0x10000) Size = 0x0;
		this.Size = Size;
		this.ExecuteAddress = ExecuteAddress;
		this.LoadAddress = LoadAddress;
		this.SetFilename(Filename);
		this.#SetNoPassword(NoPassword);
	}

	/**
	 * 
	 * @param {Uint8Array} Filename ファイル名(X1キャラクタコード)
	 */
	SetNewDirectoryEntry(Filename) {
		const now = Date.now();
		this.SetTime({
			Year: now.getFullYear() % 100, // 2桁にする
			Month: now.getMonth() + 1, // 1～12
			DayOfWeek: now.getDay(), // Sunday - Saturday : 0 - 6
			Day: now.getDate(), // 1～31
			Hour: now.getHours(), // 0～23
			Minute: now.getMinutes(), // 0～59
			Second: now.getSeconds() // 0～59
		});
		this.FileMode = this.#DirectoryFileModeByte;
		this.SetFilename(Filename);
		this.#SetNoPassword(true);
	}

	/**
	 * 
	 * @param {bool} NoPassword 
	 */
	#SetNoPassword(NoPassword) {
		this.Password = NoPassword ? this.#PasswordNoUseByte : 0x00;
	}

	/**
	 * ファイル名を設定する
	 * @param {Uint8Array} Filename ファイル名(X1キャラクタコード)
	 */
	SetFilename(Filename) {
		// ファイル名と拡張子にわけて設定
		// ファイル名部分の長さは、MaxNameLengthに調整される
		// 拡張子部分の長さは、MaxExtensionLengthに調整される
		this.Name = this.GetFileNameWithoutExtension(Filename);
		this.Extension = this.GetExtension(Filename);
	}
	SetFilename2(Filename, Extension) {
		this.Name = new Uint8Array(this.MaxNameLength);
		this.Name.set(Filename);
		this.Extension = new Uint8Array(this.MaxExtensionLength);
		this.Extension.set(Extension);
	}

	/**
	 * ファイル名から拡張子を取り除いたファイル名を取得する
	 * 
	 * 拡張子を取り除いたファイル名がMaxNameLengthよりも短い場合は、0x20でパディングされる。
	 * @param {Uint8Array} Filename ファイル名(X1キャラクタコード)
	 * @returns {Uint8Array} 拡張子を取り除いたファイル名(X1キャラクタコード)
	 */
	static GetFileNameWithoutExtension(Filename)
	{
		let start = Filename.lastIndexOf(this.#directoryDelimiter);
		if(start < 0) {
			start = 0;
		} else {
			start = start + 1; // 区切り文字の次の文字から
		}
		let end = Filename.lastIndexOf(this.#extensionDelimiter, start);
		if(end < 0) {
			end = Filename.length;
		}
		return this.ResizeUint8Array(Filename.slice(start, end), this.MaxNameLength, 0x20);
	}

	/**
	 * ファイル名から拡張子部分を取得する。
	 * 
	 * 拡張子がMaxExtensionLengthより短い場合は、0x20でパディングされる。
	 * @param {Uint8Array} Filename ファイル名(X1キャラクタコード)
	 * @returns {Uint8Array} 拡張子(X1キャラクタコード)
	 */
	static GetExtension(Filename)
	{
		let start = Filename.lastIndexOf(this.#extensionDelimiter);
		if(start < 0) {
			return new Uint8Array();
		} else {
			start = start + 1;
		}
		return this.ResizeUint8Array(Filename.slice(start), this.MaxExtensionLength, 0x20);
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
	 * 
	 * @param {DataController} dc 
	 * @param {number} sector 
	 * @param {number} pos 
	 * @param {Uint8Array} Name ファイル名（X1のキャラクタコード）
	 * @param {Uint8Array} Extension 拡張子（X1のキャラクタコード）
	 */
	SetEntryFromSector(dc, sector, pos, Name, Extension) {
		this.Name = Name;
		this.Extension = Extension;
		this.EntrySector = sector;
		this.EntryPosition = pos;
		this.FileMode = dc.GetByte(pos);
		this.Password = dc.GetByte(pos + 0x11);
		this.Size = dc.GetWord(pos + 0x12);
		this.LoadAddress = dc.GetWord(pos + 0x14);
		this.ExecuteAddress = dc.GetWord(pos + 0x16);
		this.DateTimeData = dc.Copy(pos + 0x18, 6);
		this.StartCluster = dc.GetByte(pos + 0x1e);
		this.StartCluster |= dc.GetByte(pos + 0x1f) << 7;
		// IB丸ごと
		this.IB = dc.Copy(pos, 0x20);
	}

	isEqualFilename(Filename, Extension)
	{
		for(let i = 0; i < this.MaxNameLength; ++i) {
			if(this.Name[i] != Filename[i]) {
				return false;
			}
		}
		for(let i = 0; i < this.MaxExtensionLength; ++i) {
			if(this.Extension[i] != Extension[i]) {
				return false;
			}
		}
		return true;
	}

	/**
	 * 
	 * @param {Uint8Array} Filename 
	 * @param {Uint8Array} Extension 
	 * @param {number} Size ファイルサイズ
	 * @param {number} LoadAddress 
	 * @param {number} ExecuteAddress 
	 * @param {*} FileDate 
	 * @param {number} FileMode
	 * @param {boolean} NoPassword 
	 */
	Set2(Filename, Extension, Size, LoadAddress, ExecuteAddress, FileDate, FileMode, NoPassword = true)
	{
		this.SetTime(FileDate);
		this.FileMode = FileMode;

		// サイズがWORDよりも大きい場合は0にする
		if (Size >= 0x10000) Size = 0x0;
		this.Size = Size;
		this.ExecuteAddress = ExecuteAddress;
		this.LoadAddress = LoadAddress;
		this.SetFilename2(Filename, Extension);
		this.#SetNoPassword(NoPassword);
	}
}
