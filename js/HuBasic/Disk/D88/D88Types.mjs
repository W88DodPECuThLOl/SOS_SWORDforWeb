/**
 * D88形式の定数
 */
export const D88 = {
    /**
	 * D88形式のヘッダサイズ
	 * @type {number}
	 */
	D88HeaderSize: 0x2b0,

    /**
	 * D88形式のヘッダ内のトラックオフセットの位置
	 * 
	 * ヘッダ+0x20にトラックのオフセットがある
	 * @type {number}
	 */
	D88TrackOffset: 0x20,

	/**
	 * D88形式の最大トラック数
	 * @type {number}
	 */
	D88MaxTrack: 164,

	/**
	 * D88形式のセクタヘッダのサイズ(バイト単位)
	 * @type {number}
	 */
	D88SectorHeaderSize: 0x10
};
