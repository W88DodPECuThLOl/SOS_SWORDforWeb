"use strict";

import { DiskTypeEnum } from "./DiskTypeEnum.mjs";

// TrackFormat
export default class {
	/**
	 * トラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector;
	/**
	 * 最大トラック数
	 * @type {number}
	 */
	TrackMax;

	/**
	 * 最大トラック数、トラックあたりのセクタ数を設定する
	 * @param {number} TrackPerSector トラックあたりのセクタ数
	 * @param {number} TrackMax 最大トラック数
	 */
	SetTrackFormat(TrackPerSector, TrackMax) {
		this.TrackPerSector = TrackPerSector;
		this.TrackMax = TrackMax;
	}

	/**
	 * 1Dのトラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector1D = 16;
	/**
	 * 1DDのトラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector1DD = 16;
	/**
	 * 2Dのトラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector2D = 16;
	/**
	 * 2DDのトラックあたりのセクタ数
	 * @type {number}
	 */
	TrackPerSector2DD = 16;
	/**
	 * 2HDのトラックあたりのセクタ数
	 * 
	 * X1のフォーマット
	 * - 77*2 = 154
	 * - 1トラックあたり26セクタ
	 * @type {number}
	 */
	TrackPerSector2HD = 26;

	/**
	 * 1Dの最大トラック数
	 * @type {number}
	 */
	TrackMax1D = 35;
	/**
	 * 1Dの最大トラック数
	 * @type {number}
	 */
	TrackMax1DD = 80;
	/**
	 * 2Dの最大トラック数
	 * @type {number}
	 */
	TrackMax2D = 80;
	/**
	 * 2DDの最大トラック数
	 * @type {number}
	 */
	TrackMax2DD = 160;
	/**
	 * 2HDの最大トラック数
	 * 
	 * X1のフォーマット
	 * - 77*2 = 154
	 * - 1トラックあたり26セクタ
	 * @type {number}
	 */
	TrackMax2HD = 154;

	/**
	 * ディスクの種類から最大トラック数、トラックあたりのセクタ数を設定する
	 * @param {DiskTypeEnum} ImageType ディスクの種類
	 */
	constructor(ImageType) {
		switch (ImageType) {
			case DiskTypeEnum.Disk1D:
				this.SetTrackFormat(this.TrackPerSector1D, this.TrackMax1D);
				break;
			case DiskTypeEnum.Disk1DD:
				this.SetTrackFormat(this.TrackPerSector1DD, this.TrackMax1DD);
				break;
			case DiskTypeEnum.Disk2D:
				this.SetTrackFormat(this.TrackPerSector2D, this.TrackMax2D);
				break;
			case DiskTypeEnum.Disk2DD:
				this.SetTrackFormat(this.TrackPerSector2DD, this.TrackMax2DD);
				break;
			case DiskTypeEnum.Disk2HD:
				this.SetTrackFormat(this.TrackPerSector2HD, this.TrackMax2HD);
				break;
		}
	}
}
