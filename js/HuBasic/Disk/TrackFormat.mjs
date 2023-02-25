"use strict";

import { DiskTypeEnum } from "./DiskTypeEnum.mjs";

/**
 * トラックあたりのセクタ数
 */
const TrackPerSector = {
	/**
	 * 1Dのトラックあたりのセクタ数
	 * 
	 * - 片面倍密度
	 * - PC-6601で用いられているもの
	 * - 6601の場合、35トラック16セクタ256バイト
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 * @type {number}
	 */
	TrackPerSector1D: 16,

	/**
	 * 1DDのトラックあたりのセクタ数
	 * 
	 * - 片面倍密度倍トラック
	 * - PC-6601SRで用いられているもの
	 * - 66SRの場合、80トラック16セクタ256バイト
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 * @type {number}
	 */
	TrackPerSector1DD: 16,

	/**
	 * 2Dのトラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector2D: 16,

	/**
	 * 2DDのトラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector2DD: 16,

	/**
	 * 2HDのトラックあたりのセクタ数
	 * 
	 * X1のフォーマット
	 * - 77*2 = 154
	 * - 1トラックあたり26セクタ
	 * @type {number}
	 */
	TrackPerSector2HD: 26
};

/**
 * 最大トラック数
 */
const TrackMax = {
	/**
	 * 1Dの最大トラック数
	 * 
	 * - 片面倍密度
	 * - PC-6601で用いられているもの  
	 * - 6601の場合、35トラック16セクタ256バイト  
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 * @type {number}
	 */
	TrackMax1D: 35,

	/**
	 * 1DDの最大トラック数
	 * 
	 * - 片面倍密度倍トラック
	 * - PC-6601SRで用いられているもの
	 * - 66SRの場合、80トラック16セクタ256バイト
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 * @type {number}
	 */
	TrackMax1DD: 80,

	/**
	 * 2Dの最大トラック数
	 * @type {number}
	 */
	TrackMax2D: 80,

	/**
	 * 2DDの最大トラック数
	 * @type {number}
	 */
	TrackMax2DD: 160,

	/**
	 * 2HDの最大トラック数
	 * 
	 * X1のフォーマット
	 * - 77*2 = 154
	 * - 1トラックあたり26セクタ
	 * @type {number}
	 */
	TrackMax2HD: 154
};

/**
 * トラックのフォーマット
 * 
 * - 最大トラック数  
 * - トラックあたりのセクタ数
 */
export class TrackFormat {
	/**
	 * トラックあたりのセクタ数
	 * @type {number}
	 */
	#TrackPerSector;

	/**
	 * 最大トラック数
	 * @type {number}
	 */
	#TrackMax;

	/**
	 * 最大トラック数、トラックあたりのセクタ数を設定する
	 * @param {number} TrackPerSector トラックあたりのセクタ数
	 * @param {number} TrackMax 最大トラック数
	 */
	#SetTrackFormat(TrackPerSector, TrackMax) {
		this.#TrackPerSector = TrackPerSector;
		this.#TrackMax = TrackMax;
	}

	// =======================================================
	// 
	// =======================================================

	/**
	 * コンストラクタ
	 * 
	 * ディスクの種類から最大トラック数、トラックあたりのセクタ数を設定する
	 * @param {DiskTypeEnum} ImageType ディスクの種類
	 */
	constructor(ImageType) {
		switch (ImageType) {
			case DiskTypeEnum.Disk1D:
				this.#SetTrackFormat(TrackPerSector.TrackPerSector1D, TrackMax.TrackMax1D);
				break;
			case DiskTypeEnum.Disk1DD:
				this.#SetTrackFormat(TrackPerSector.TrackPerSector1DD, TrackMax.TrackMax1DD);
				break;
			case DiskTypeEnum.Disk2D:
				this.#SetTrackFormat(TrackPerSector.TrackPerSector2D, TrackMax.TrackMax2D);
				break;
			case DiskTypeEnum.Disk2DD:
				this.#SetTrackFormat(TrackPerSector.TrackPerSector2DD, TrackMax.TrackMax2DD);
				break;
			case DiskTypeEnum.Disk2HD:
				this.#SetTrackFormat(TrackPerSector.TrackPerSector2HD, TrackMax.TrackMax2HD);
				break;
		}
	}

	/**
	 * トラックあたりのセクタ数を取得する
	 * @returns {number} トラックあたりのセクタ数
	 */
	GetTrackPerSector() { return this.#TrackPerSector; }

	/**
	 * 最大トラック数を取得する
	 * @returns {number} 最大トラック数
	 */
	GetTrackMax() { return this.#TrackMax; }
}
