import { DiskTypeEnum } from './DiskTypeEnum.mjs';

//DiskParameter
export default class {
	/**
	 * @type {number}
	 */
	AllocationTableStart;
	/**
	 * @type {number}
	 */
	EntrySectorStart;
	/**
	 * @type {number}
	 */
	MaxCluster;
	/**
	 * @type {number}
	 */
	ClusterPerSector;

	/**
	 * 
	 * @param {number} allocationTableStart 
	 * @param {number} entrySector 
	 * @param {number} maxCluster 
	 * @param {number} clusterPerSector 
	 */
	SetDiskParameter(allocationTableStart, entrySector, maxCluster, clusterPerSector) {
		this.AllocationTableStart = allocationTableStart;
		this.EntrySectorStart = entrySector;
		this.MaxCluster = maxCluster;
		this.ClusterPerSector = clusterPerSector;
	}

	/**
	 * 
	 * @param {DiskTypeEnum} ImageType 
	 */
	constructor(ImageType) {
		switch (ImageType) {
			case DiskTypeEnum.Disk2D:
				this.SetDiskParameter(this.AllocationTable2DSector, this.EntrySectorStart2D, this.MaxCluster2D, this.ClusterPerSector2D);
				break;
			case DiskTypeEnum.Disk2DD:
				this.SetDiskParameter(this.AllocationTable2DDSector, this.EntrySectorStart2DD, this.MaxCluster2DD, this.ClusterPerSector2DD);
				break;
			case DiskTypeEnum.Disk2HD:
				this.SetDiskParameter(this.AllocationTable2HDSector, this.EntrySectorStart2HD, this.MaxCluster2HD, this.ClusterPerSector2HD);
				break;
		}
	}

	/**
	 * @type {number}
	 */
	AllocationTable2DSector = 14;
	/**
	 * @type {number}
	 */
	AllocationTable2DDSector = 14;
	/**
	 * @type {number}
	 */
	AllocationTable2HDSector = 28;

	/**
	 * @type {number}
	 */
	EntrySectorStart2D = 16;
	/**
	 * @type {number}
	 */
	EntrySectorStart2DD = 16;
	/**
	 * @type {number}
	 */
	EntrySectorStart2HD = 32;

	/**
	 * @type {number}
	 */
	MaxCluster2D = 80;
	/**
	 * @type {number}
	 */
	MaxCluster2DD = 160;
	/**
	 * @type {number}
	 */
	MaxCluster2HD = 250;

	/**
	 * @type {number}
	 */
	ClusterPerSector2D = 16;
	/**
	 * @type {number}
	 */
	ClusterPerSector2DD = 16;
	/**
	 * @type {number}
	 */
	ClusterPerSector2HD = 16;
}
