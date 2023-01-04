"use strict";

/**
 * S-OSのエラーコード
 * 
 * 引用、参考
 * http://www43.tok2.com/home/cmpslv/Unk/SOS/S-OS%20Sword%20Ver2.0%20(J)(1986-02)(Oh!mz)%20[mz80K][type-in].txt
 */
class SOSErrorCode {
	/**
	 * 入出力時にエラーが発生した
	 * @type {number}
	 */
	static DeviceIOError = 1;

	/**
	 * デバイスがつなかっていない
	 * @type {number}
	 */
	static DeviceOffline = 2;
	
	/**
	 * ファイルディスクリプタが間違っている
	 * @type {number}
	 */
	static BadFileDescripter = 3;

	/**
	 * ライトプロテクトがかかっている　
	 * @type {number}
	 */
	static WriteProtected = 4;

	/**
	 * レコードナンバーに間違いがある
	 * @type {number}
	 */
	static BadRecord = 5;

	/**
	 * アトリビュートが違う
	 * @type {number}
	 */
	static BadFileMode = 6;

	/**
	 * ファットエラー
	 * @type {number}
	 */
	static BadAllocationTable = 7;

	/**
	 * ファイルが見つからない
	 * @type {number}
	 */
	static FileNotFound = 8;

	/**
	 * ディスクが一杯
	 * @type {number}
	 */
	static DeviceFull = 9;

	/**
	 * すでに同名のファイルが登録されている
	 * @type {number}
	 */
	static FileAreadyExists = 10;

	/**
	 * 現在リザーブされている
	 * @type {number}
	 */
	static ReservedFeature = 11;

	/**
	 * ファイルをオープンせずに読み書きしようとした
	 * @type {number}
	 */
	static FileNotOpen = 12;

	/**
	 * 文法間違い
	 * @type {number}
	 */
	static SyntaxError = 13;

	/**
	 * 正しい引き数ではない
	 * @type {number}
	 */
	static BadData = 14;
}
