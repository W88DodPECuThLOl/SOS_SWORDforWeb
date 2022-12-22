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
	static ib_attribute      = 0;
	static ib_filename       = SOSWorkAddr.ib_attribute + 1;		// 1
	static ib_extension      = SOSWorkAddr.ib_filename + 13;		// 14
	static ib_password       = SOSWorkAddr.ib_extension + 3;		// 17
	static ib_size           = SOSWorkAddr.ib_password + 1;			// 18
	static ib_startAddress   = SOSWorkAddr.ib_size + 2;				// 20
	static ib_executeAddress = SOSWorkAddr.ib_startAddress + 2;		// 22
	static ib_date           = SOSWorkAddr.ib_executeAddress + 2;	// 24
	static ib_cluster        = SOSWorkAddr.ib_date + 6;				// 30

	/**
	 * インフォメーションブロック(IB)のサイズ
	 * @type {number}
	 */
	static InfomationBlockSize = SOSWorkAddr.ib_cluster + 2;		// 32

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
		return (lhs & SOSWorkAddr.attribute_mask) == (rhs & SOSWorkAddr.attribute_mask);
	}
};
