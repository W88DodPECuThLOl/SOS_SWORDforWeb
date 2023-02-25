"use strict";

import { DiskTypeEnum } from "./DiskTypeEnum.mjs";
import { TrackFormat } from "./TrackFormat.mjs";
import { DiskParameter } from "./DiskParameter.mjs";
import { DiskError, DiskErrorCode } from "./DiskError.mjs";

/**
 * ディスクタイプ
 */
export class DiskType {
	/**
	 * ディスクの種類
	 * @type {DiskTypeEnum}
	 */
	#imageType;





	/**
	 * @type {boolean}
	 */
	#ForceType;

	/**
	 * 生データかどうか（ヘッダがない）
	 * @type {boolean}
	 */
	#PlainFormat;

	/**
	 * ディスクのパラメータ
	 * @type {DiskParameter}
	 */
	DiskParameter;

	/**
	 * トラックフォーマット
	 * 
	 * - 最大トラック数
	 * - トラックあたりのセクタ数
	 * @type {TrackFormat}
	 */
	#CurrentTrackFormat;

	/**
	 * 拡張子でヘッダが必要かどうかを判定する
	 * @param {string} ext 
	 * @returns {boolean} trueならヘッダ必要なし
	 */
	#IsPlainExtension(ext) {
		return (ext == "2D") || (ext == "2DD") || (ext == "2HD") || (ext == "1D") || (ext == "1DD");
	}

	// =======================================================
	// 
	// =======================================================

	/**
	 * コンストラクタ
	 */
	constructor() {
		// 2DでD88ヘッダありに設定
		this.SetImageType(DiskTypeEnum.Disk2D);
		this.SetPlainFormat(false);
	}

	/**
	 * ディスクの種類を取得する
	 * @returns {DiskTypeEnum} ディスクの種類
	 */
	GetImageType() { return this.#imageType; }

	/**
	 * ディスクの種類を設定する
	 * @param {DiskTypeEnum} imageType ディスクの種類
	 */
	SetImageType(imageType) {
		this.#imageType = imageType;
		// ディスクの種類に対応したトラックフォーマットを設定
		this.#CurrentTrackFormat = new TrackFormat(imageType);
		// ディスクの種類に対応したディスクのパラメータを設定
		this.DiskParameter = new DiskParameter(imageType);
	}

	/**
	 * ディスクの最大トラック数を取得する
	 * @returns {number} ディスクの最大トラック数
	 */
	GetMaxTrackSize() { return this.#CurrentTrackFormat.GetTrackMax(); }

	/**
	 * トラックあたりのセクタ数を取得する
	 * @returns {number} トラックあたりのセクタ数
	 */
	GetTrackPerSector() { return this.#CurrentTrackFormat.GetTrackPerSector(); }

	/**
	 * デフォルトのセクタのデータサイズを取得する
	 * @returns {number} デフォルトのセクタのデータサイズ（バイト単位）
	 */
	GetDataSize() { return 256; }

	/**
	 * 最大クラスタ数を取得する
	 * @returns {number} 最大クラスタ数
	 */
	GetMaxCluster() { return this.DiskParameter.GetMaxCluster(); }

	/**
	 * ディレクトリの開始セクタ番号を取得する
	 * @returns {number} ディレクトリの開始セクタ番号
	 */
	GetEntrySectorStart() { return this.DiskParameter.GetEntrySectorStart(); }

	/**
	 * 
	 */
	SetPlainFormat(PlainFormat) { this.#PlainFormat = PlainFormat; }

	/**
	 * 生データかどうか（ヘッダがない）を取得する
	 * @type {boolean} 生データかどうか（ヘッダがない）
	 */
	GetPlainFormat() { return this.#PlainFormat; }

	// =======================================================
	// 
	// =======================================================

	/**
	 * 記録密度を取得する
	 * 
	 * @returns {number} 記録密度
	 * 		- 0x00: 倍密度
	 * 		- 0x40: 単密度
	 * 		- 0x01: 高密度
	 * @throws DiskError()
	 */
	GetDensity() {
		switch (this.GetImageType()) {
			case DiskTypeEnum.Disk2D:
				return 0x00; // 倍密度
			case DiskTypeEnum.Disk2DD:
				return 0x00; // 倍密度
			case DiskTypeEnum.Disk2HD:
				return 0x01; // 高密度
			case DiskTypeEnum.Disk1D:
				return 0x00; // 倍密度
			case DiskTypeEnum.Disk1DD:
				return 0x00; // 倍密度
			default: // 不明
				throw new DiskError(DiskErrorCode.UnknownDiskImageType);
		}
	}

	/**
	 * ディスクイメージタイプが2D以外かどうかを調べる
	 * @returns {boolean} ディスクイメージタイプが2D以外かどうか
	 */
	IsNot2D() { return this.GetImageType() != DiskTypeEnum.Disk2D; }

	/**
	 * オプションからの設定
	 * @param {string} value ディスクの種類の文字列
	 * @returns {boolean}
	 */
	SetDiskTypeFromOption(value) {
		value = value.toUpperCase();
		switch (value) {
			case "2D": this.SetImageType(DiskTypeEnum.Disk2D); break;
			case "2DD": this.SetImageType(DiskTypeEnum.Disk2DD); break;
			case "2HD": this.SetImageType(DiskTypeEnum.Disk2HD); break;
			case "1D": this.SetImageType(DiskTypeEnum.Disk1D); break;
			case "1DD": this.SetImageType(DiskTypeEnum.Disk1DD); break;
			default:
				this.SetImageType(DiskTypeEnum.Unknown);
				break;
		}
		// 強制設定する
		this.#ForceType = this.GetImageType() != DiskTypeEnum.Unknown;
		return this.#ForceType;
	}

	/**
	 * ディスクタイプを文字列で取得する
	 * @returns {string} ディスクタイプの文字列
	 */
	GetImageTypeName() {
		switch (this.GetImageType()) {
			case DiskTypeEnum.Disk2D: return "2D";
			case DiskTypeEnum.Disk2DD: return "2DD";
			case DiskTypeEnum.Disk2HD: return "2HD";
			case DiskTypeEnum.Disk1D: return "1D";
			case DiskTypeEnum.Disk1DD: return "1DD";
			default:
				return "Unknown";
		}
	}

	/**
	 * @param {string} ext
	 */
	SetTypeFromExtension(ext) {
		if (!this.#IsPlainExtension(ext)) {
			this.SetPlainFormat(false); // ヘッダ必要
			return;
		}
		if (!this.#ForceType) {
			if(ext == "2D") {
				SetImageType(DiskTypeEnum.Disk2D);
				this.SetPlainFormat(true); // ヘッダ必要なし
			} else if(ext == "2DD") {
				SetImageType(DiskTypeEnum.Disk2DD);
				this.SetPlainFormat(true); // ヘッダ必要なし
			} else if(ext == "2HD") {
				SetImageType(DiskTypeEnum.Disk2HD);
				this.SetPlainFormat(true); // ヘッダ必要なし
			}
		}
	}

	/**
	 * ディスクイメージの種類から設定する
	 * @param {number} imageType ディスクイメージの種類
	 * @throws DiskError()
	 */
	SetImageTypeFromHeader(imageType) {
		switch(imageType & 0xFF) {
			case 0x40: // 1DD
				this.SetImageType(DiskTypeEnum.Disk1DD);
				break;
			case 0x30: // 1D
				this.SetImageType(DiskTypeEnum.Disk1D);
				break;
			case 0x20: // 2HD
				this.SetImageType(DiskTypeEnum.Disk2HD);
				break;
			case 0x10: // 2DD
				this.SetImageType(DiskTypeEnum.Disk2DD);
				break;
			case 0x00: // 2D 両面倍密度
				this.SetImageType(DiskTypeEnum.Disk2D);
				break;
			default:
				throw new DiskError(DiskErrorCode.UnknownDiskImageType);
		}
	}
}
