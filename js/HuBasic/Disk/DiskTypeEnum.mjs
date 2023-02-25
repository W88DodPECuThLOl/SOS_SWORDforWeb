"use strict";

/**
 * ディスクの種類
 */
export const DiskTypeEnum = {
	/**
	 * 2D 両面倍密度
	 */
	Disk2D: 0x00,

	/**
	 * 2DD 両面倍密度倍トラック
	 */
	Disk2DD: 0x10,
	/**
	 * 2HD 両面高密度倍トラック
	 */
	Disk2HD: 0x20,

	/**
	 * 1D 片面倍密度
	 * 
	 * - PC-6601で用いられているもの
	 * - 6601の場合、35トラック16セクタ256バイトというフォーマットが標準
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 */
	Disk1D: 0x30,

	/**
	 * 1DD 片面倍密度倍トラック
	 *  
	 * - PC-6601SRで用いられているもの
	 * - 66SRの場合、80トラック16セクタ256バイトが標準
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 */
	Disk1DD: 0x40,

	/**
	 * 不明
	 */
	Unknown: 0xFF,
};
