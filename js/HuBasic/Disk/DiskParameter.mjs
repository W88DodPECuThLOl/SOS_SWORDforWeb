"use strict";

import { DiskTypeEnum } from './DiskTypeEnum.mjs';

//DiskParameter
export default class {
	/**
	 * FATの開始セクタ
	 * @type {number}
	 */
	AllocationTableStart;
	/**
	 * ディレクトリの開始セクタ
	 * @type {number}
	 */
	EntrySectorStart;
	/**
	 * 最大クラスタ数
	 * @type {number}
	 */
	MaxCluster;
	/**
	 * クラスタあたりのセクタ数
	 * @type {number}
	 */
	ClusterPerSector;

	/**
	 * ディスクパラメータを設定する
	 * @param {number} allocationTableStart 
	 * @param {number} entrySector 
	 * @param {number} maxCluster 
	 * @param {number} clusterPerSector 
	 */
	#SetDiskParameter(allocationTableStart, entrySector, maxCluster, clusterPerSector) {
		this.AllocationTableStart = allocationTableStart;
		this.EntrySectorStart = entrySector;
		this.MaxCluster = maxCluster;
		this.ClusterPerSector = clusterPerSector;
	}

	/**
	 * コンストラクタ
	 * @param {DiskTypeEnum} ImageType ディスクの種類
	 */
	constructor(ImageType) {
		switch (ImageType) {
			case DiskTypeEnum.Disk2D:
				this.#SetDiskParameter(this.#AllocationTable2DSector, this.#EntrySectorStart2D, this.#MaxCluster2D, this.#ClusterPerSector2D);
				break;
			case DiskTypeEnum.Disk2DD:
				this.#SetDiskParameter(this.#AllocationTable2DDSector, this.#EntrySectorStart2DD, this.#MaxCluster2DD, this.#ClusterPerSector2DD);
				break;
			case DiskTypeEnum.Disk2HD:
				this.#SetDiskParameter(this.#AllocationTable2HDSector, this.#EntrySectorStart2HD, this.#MaxCluster2HD, this.#ClusterPerSector2HD);
				break;

			case DiskTypeEnum.Disk1D:
				this.#SetDiskParameter(this.#AllocationTable1DSector, this.#EntrySectorStart1D, this.#MaxCluster1D, this.#ClusterPerSector1D);
				break;
			// 詳細不明
			//case DiskTypeEnum.Disk1DD:
			//	this.#SetDiskParameter(this.#AllocationTable1DDSector, this.#EntrySectorStart1DD, this.#MaxCluster1DD, this.#ClusterPerSector1DD);
			//	break;
		}
	}

	/**
	 * 1DのFATの開始セクタ
	 * @type {number}
	 */
	#AllocationTable1DSector = 15;
	/**
	 * 1DDのFATの開始セクタ  
	 * 不明
	 * @type {number}
	 */
	//#AllocationTable1DDSector = 15;
	/**
	 * 2DのFATの開始セクタ
	 * @type {number}
	 */
	#AllocationTable2DSector = 14;
	/**
	 * 2DDのFATの開始セクタ
	 * @type {number}
	 */
	#AllocationTable2DDSector = 14;
	/**
	 * 2HDのFATの開始セクタ
	 * @type {number}
	 */
	#AllocationTable2HDSector = 28;

	/**
	 * 1Dのディレクトリの開始セクタ
	 * @type {number}
	 */
	#EntrySectorStart1D = 16;
	/**
	 * 2Dのディレクトリの開始セクタ
	 * @type {number}
	 */
	#EntrySectorStart2D = 16;
	/**
	 * 2DDのディレクトリの開始セクタ
	 * @type {number}
	 */
	#EntrySectorStart2DD = 16;
	/**
	 * 2HDのディレクトリの開始セクタ
	 * @type {number}
	 */
	#EntrySectorStart2HD = 32;

	/**
	 * 1Dの最大クラスタ数  
	 * メモ）標準的なトラック数は35
	 * @type {number}
	 */
	#MaxCluster1D = 40;
	/**
	 * 2Dの最大クラスタ数
	 * @type {number}
	 */
	#MaxCluster2D = 80;
	/**
	 * 2DDの最大クラスタ数
	 * @type {number}
	 */
	#MaxCluster2DD = 160;
	/**
	 * 2HDの最大クラスタ数
	 * @type {number}
	 */
	#MaxCluster2HD = 250;

	/**
	 * 1Dのクラスタあたりのセクタ数
	 * @type {number}
	 */
	#ClusterPerSector1D = 16;
	/**
	 * 2Dのクラスタあたりのセクタ数
	 * @type {number}
	 */
	#ClusterPerSector2D = 16;
	/**
	 * 2DDのクラスタあたりのセクタ数
	 * @type {number}
	 */
	#ClusterPerSector2DD = 16;
	/**
	 * 2HDのクラスタあたりのセクタ数
	 * @type {number}
	 */
	#ClusterPerSector2HD = 16;
}
