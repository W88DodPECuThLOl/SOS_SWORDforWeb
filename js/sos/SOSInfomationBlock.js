"use strict";

/**
 * インフォメーションブロック(IB)のオフセット
 */
class SOSInfomationBlock {
	/**
	 * 属性（ファイルモード)
	 * 
	 * ビットフィールド  
	 *   0: バイナリ  
	 *   1: ベーシック  
	 *   2: アスキー  
	 *   3: ?  
	 *   4: ?  
	 *   5: ?  
	 *   6: ライトプロテクト  
	 *   7: ディレクトリ
	 * @type {number}
	 */
	static ib_attribute      = 0;											// 0x00 0
	static ib_filename       = SOSInfomationBlock.ib_attribute + 1;			// 0x01 1
	static ib_extension      = SOSInfomationBlock.ib_filename + 13;			// 0x0e 14
	static ib_password       = SOSInfomationBlock.ib_extension + 3;			// 0x11 17
	static ib_size           = SOSInfomationBlock.ib_password + 1;			// 0x12 18
	static ib_startAddress   = SOSInfomationBlock.ib_size + 2;				// 0x14 20
	static ib_executeAddress = SOSInfomationBlock.ib_startAddress + 2;		// 0x16 22
	static ib_date           = SOSInfomationBlock.ib_executeAddress + 2;	// 0x18 24
	static ib_cluster_high   = SOSInfomationBlock.ib_date + 5;				// 0x1d 29
	static ib_cluster        = SOSInfomationBlock.ib_cluster_high + 1;		// 0x1e 30
	static ib_cluster_middle = SOSInfomationBlock.ib_cluster + 1;			// 0x1f 31
	/**
	 * インフォメーションブロック(IB)のサイズ
	 * @type {number}
	 */
	static InfomationBlockSize = 0x20;

	/**
	 * ファイル名のサイズ
	 * @type {number}
	 */
	static filename_size = 13;
	/**
	 * 拡張子のサイズ
	 * @type {number}
	 */
	static extension_size = 3;

	/**
	 * 属性を比較するときに使用するマスク
	 * 
	 * このマスクをかけてから、比較をする。  
	 * ディレクトリ、バイナリ、ベーシック、アスキーで、属性が同じかどうかを判定する
	 * @type {number}
	 */
	static attribute_mask = 0x87;

	/**
	 * 属性が同じかどうか
	 * @param {number} lhs 比較する属性
	 * @param {number} rhs 比較する属性
	 * @returns {boolean} 属性が同じなら true を返す
	 */
	static isEquelAttribute(lhs, rhs) {
		return (lhs & SOSInfomationBlock.attribute_mask) == (rhs & SOSInfomationBlock.attribute_mask);
	}

	/**
	 * 属性がバイナリファイルかどうか
	 * @param {*} attribute 調べる属性
	 * @returns {boolean} 属性がバイナリファイルなら true を返す
	 */
	static isBinaryFile(attribute) {
		return (attribute & SOSInfomationBlock.attribute_mask) == 0x01;
	}

	/**
	 * 属性がアスキーファイルかどうか
	 * @param {*} attribute 調べる属性
	 * @returns {boolean} 属性がアスキーファイルなら true を返す
	 */
	static isAsciiFile(attribute) {
		return (attribute & SOSInfomationBlock.attribute_mask) == 0x04;
	}
	
};
