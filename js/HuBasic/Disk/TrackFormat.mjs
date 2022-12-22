import { DiskTypeEnum } from "./DiskTypeEnum.mjs";

// TrackFormat
export default class {
	/**
	 * @type {number}
	 */
	TrackPerSector;
	/**
	 * @type {number}
	 */
	TrackMax;

	/**
	 * 
	 * @param {number} TrackPerSector 
	 * @param {number} TrackMax 
	 */
	SetTrackFormat(TrackPerSector, TrackMax) {
		this.TrackPerSector = TrackPerSector;
		this.TrackMax = TrackMax;
	}

	/**
	 * @type {number}
	 */
	TrackPerSector2D = 16;
	/**
	 * @type {number}
	 */
	TrackPerSector2DD = 16;
	/**
	 * @type {number}
	 */
	TrackPerSector2HD = 26;
	/**
	 * @type {number}
	 */
	TrackMax2D = 80;
	/**
	 * @type {number}
	 */
	TrackMax2DD = 160;
	/**
	 * @type {number}
	 */
	TrackMax2HD = 154;

	/**
	 * 
	 * @param {DiskTypeEnum} ImageType 
	 */
	constructor(ImageType) {
		switch (ImageType) {
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
