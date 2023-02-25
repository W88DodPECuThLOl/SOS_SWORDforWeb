"use strict";

import { DiskTypeEnum } from './DiskTypeEnum.mjs';

/**
 * FATの開始セクタ番号
 * @type {number}
 */
const AllocationTable = {
	/**
	 * 1DのFATの開始セクタ
	 * @type {number}
	 */
	AllocationTable1DSector: 15,

	/**
	 * 1DDのFATの開始セクタ  
	 * 不明
	 * @type {number}
	 */
	//AllocationTable1DDSector: 15,

	/**
	 * 2DのFATの開始セクタ
	 * @type {number}
	 */
	AllocationTable2DSector: 14,

	/**
	 * 2DDのFATの開始セクタ
	 * @type {number}
	 */
	AllocationTable2DDSector: 14,

	/**
	 * 2HDのFATの開始セクタ
	 * @type {number}
	 */
	AllocationTable2HDSector: 28
};

/**
 * ディレクトリの開始セクタ番号
 * @type {number}
 */
const EntrySector = {
	/**
	 * 1Dのディレクトリの開始セクタ
	 * @type {number}
	 */
	EntrySectorStart1D: 16,

	/**
	 * 2Dのディレクトリの開始セクタ
	 * @type {number}
	 */
	EntrySectorStart2D: 16,

	/**
	 * 2DDのディレクトリの開始セクタ
	 * @type {number}
	 */
	EntrySectorStart2DD: 16,

	/**
	 * 2HDのディレクトリの開始セクタ
	 * @type {number}
	 */
	EntrySectorStart2HD: 32
};

/**
 * 最大クラスタ数
 * @type {number}
 */
const MaxCluster = {
	/**
	 * 1Dの最大クラスタ数  
	 * 
	 * - 片面倍密度
	 * - PC-6601で用いられているもの  
	 * - 6601の場合、35トラック16セクタ256バイト  
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 * @type {number}
	 */
	MaxCluster1D: 35,

	/**
	 * 1DDの最大クラスタ数  
	 * 
	 * - 片面倍密度倍トラック
	 * - PC-6601SRで用いられているもの
	 * - 66SRの場合、80トラック16セクタ256バイト
	 * 
	 * http://000.la.coocan.jp/p6/disk.html
	 */
	MaxCluster1DD: 80,

	/**
	 * 2Dの最大クラスタ数
	 * @type {number}
	 */
	MaxCluster2D: 80,

	/**
	 * 2DDの最大クラスタ数
	 * @type {number}
	 */
	MaxCluster2DD: 160,

	/**
	 * 2HDの最大クラスタ数
	 * 
	 * X1
	 * - (77*2)(トラック数) * 26(トラックあたりのセクタ数) / 16
	 * - 1クラスタは16セクタ
	 * @type {number}
	 */
	MaxCluster2HD: 250
};

/**
 * クラスタあたりのセクタ数
 * @type {number}
 */
const ClusterPerSector = {
	/**
	 * 1Dのクラスタあたりのセクタ数
	 * @type {number}
	 */
	ClusterPerSector1D: 16,

	/**
	 * 2Dのクラスタあたりのセクタ数
	 * @type {number}
	 */
	ClusterPerSector2D: 16,

	/**
	 * 2DDのクラスタあたりのセクタ数
	 * @type {number}
	 */
	ClusterPerSector2DD: 16,

	/**
	 * 2HDのクラスタあたりのセクタ数
	 * @type {number}
	 */
	ClusterPerSector2HD: 16
};

/**
 * ディスクパラメータ
 */
export class DiskParameter {
	/**
	 * FATの開始セクタ
	 * @type {number}
	 */
	#AllocationTableStart;

	/**
	 * ディレクトリの開始セクタ
	 * @type {number}
	 */
	#EntrySectorStart;

	/**
	 * 最大クラスタ数
	 * @type {number}
	 */
	#MaxCluster;

	/**
	 * クラスタあたりのセクタ数
	 * @type {number}
	 */
	#ClusterPerSector;

	/**
	 * ディスクパラメータを設定する
	 * @param {number} allocationTableStart FATの開始セクタ番号
	 * @param {number} entrySector ディレクトリの開始セクタ番号
	 * @param {number} maxCluster 最大クラスタ数
	 * @param {number} clusterPerSector クラスタあたりのセクタ数
	 */
	#SetDiskParameter(allocationTableStart, entrySector, maxCluster, clusterPerSector) {
		this.#AllocationTableStart = allocationTableStart;
		this.#EntrySectorStart = entrySector;
		this.#MaxCluster = maxCluster;
		this.#ClusterPerSector = clusterPerSector;
	}

	// =======================================================
	// =======================================================

	/**
	 * コンストラクタ
	 * @param {DiskTypeEnum} ImageType ディスクの種類
	 */
	constructor(ImageType) {
		switch (ImageType) {
			case DiskTypeEnum.Disk2D:
				this.#SetDiskParameter(AllocationTable.AllocationTable2DSector, EntrySector.EntrySectorStart2D, MaxCluster.MaxCluster2D, ClusterPerSector.ClusterPerSector2D);
				break;
			case DiskTypeEnum.Disk2DD:
				this.#SetDiskParameter(AllocationTable.AllocationTable2DDSector, EntrySector.EntrySectorStart2DD, MaxCluster.MaxCluster2DD, ClusterPerSector.ClusterPerSector2DD);
				break;
			case DiskTypeEnum.Disk2HD:
				this.#SetDiskParameter(AllocationTable.AllocationTable2HDSector, EntrySector.EntrySectorStart2HD, MaxCluster.MaxCluster2HD, ClusterPerSector.ClusterPerSector2HD);
				break;

			case DiskTypeEnum.Disk1D:
				this.#SetDiskParameter(AllocationTable.AllocationTable1DSector, EntrySector.EntrySectorStart1D, MaxCluster.MaxCluster1D, ClusterPerSector.ClusterPerSector1D);
				break;
			case DiskTypeEnum.Disk1DD:
				//this.#SetDiskParameter(AllocationTable.AllocationTable1DDSector, EntrySector.EntrySectorStart1DD, MaxCluster.MaxCluster1DD, ClusterPerSector.ClusterPerSector1DD);
				break;
		}
	}

	/**
	 * FATの開始セクタ番号を取得する
	 * @returns {number} FATの開始セクタ番号
	 */
	GetAllocationTableStart() { return this.#AllocationTableStart; }

	/**
	 * ディレクトリの開始セクタ番号を取得する
	 * @returns {number} ディレクトリの開始セクタ番号
	 */
	GetEntrySectorStart() { return this.#EntrySectorStart; }

	/**
	 * 最大クラスタ数を取得する
	 * @returns {number} 最大クラスタ数
	 */
	GetMaxCluster() { return this.#MaxCluster; }

	/**
	 * クラスタあたりのセクタ数を取得する
	 * @returns {number} クラスタあたりのセクタ数
	 */
	GetClusterPerSector() { return this.#ClusterPerSector; }
}
