"use strict";

import { DiskTypeEnum } from "./DiskTypeEnum.mjs";
import TrackFormat from "./TrackFormat.mjs";
import DiskParameter from "./DiskParameter.mjs";

//DiskType
export default class {
	/**
	 * @type {boolean}
	 */
	#ForceType;
	/**
	 * @type {boolean}
	 */
	PlainFormat;
	/**
	 * ディスクの種類
	 * 
	 * 0x00 2D  
	 * 0x10 2DD  
	 * 0x20 2HD  
	 * 
	 * 0x30 1D  
	 * 0x40 1DD
	 * @type {DiskTypeEnum}
	 */
	#imageType;

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
		this.CurrentTrackFormat = new TrackFormat(imageType);
		this.DiskParameter = new DiskParameter(imageType);
	}

	/**
	 * トラックフォーマット
	 * 
	 * 最大トラック数、トラックあたりのセクタ数
	 * @type {TrackFormat}
	 */
	CurrentTrackFormat;
	/**
	 * @type {DiskParameter}
	 */
	DiskParameter;

	/**
	 * コンストラクタ
	 */
	constructor() {
		this.SetImageType(DiskTypeEnum.Disk2D);
	}

	/**
	 * ディスクイメージタイプが2D以外かどうかを調べる
	 * @returns {boolean} ディスクイメージタイプが2D以外かどうか
	 */
	IsNot2D() { return this.GetImageType() != DiskTypeEnum.Disk2D; }

	/**
	 * ディスクの種類の値を取得する
	 * @returns {number} DiskTypeEnum
	 */
	ImageTypeByte() {
		switch (this.GetImageType()) {
			case DiskTypeEnum.Disk2D:
				return 0x00;
			case DiskTypeEnum.Disk2DD:
				return 0x10;
			case DiskTypeEnum.Disk2HD:
				return 0x20;
			case DiskTypeEnum.Disk1D:
				return 0x30;
			case DiskTypeEnum.Disk1DD:
				return 0x40;
		}
		return 0x0;
	}

	/**
	 * オプションからの設定
	 * @param {string} value ディスクの種類の文字列
	 * @returns {boolean}
	 */
	SetDiskTypeFromOption(value) {
		value = value.toUpperCase();
		switch (value) {
			case "2D":
				this.SetImageType(DiskTypeEnum.Disk2D);
				break;
			case "2DD":
				this.SetImageType(DiskTypeEnum.Disk2DD);
				break;
			case "2HD":
				this.SetImageType(DiskTypeEnum.Disk2HD);
				break;
			case "1D":
				this.SetImageType(DiskTypeEnum.Disk1D);
				break;
			case "1DD":
				this.SetImageType(DiskTypeEnum.Disk1DD);
				break;
			default:
				this.SetImageType(DiskTypeEnum.Unknown);
				break;
		}

		// 強制設定する
		this.#ForceType = this.GetImageType() != DiskTypeEnum.Unknown;
		return this.#ForceType;
	}

	/**
	 * ディスクの種類を文字列で取得する
	 * @returns {string} ディスクの種類の文字列
	 */
	GetTypeName() {
		switch (this.GetImageType()) {
			case DiskTypeEnum.Disk2D:
				return "2D";
			case DiskTypeEnum.Disk2DD:
				return "2DD";
			case DiskTypeEnum.Disk2HD:
				return "2HD";
			case DiskTypeEnum.Disk1D:
				return "1D";
			case DiskTypeEnum.Disk1DD:
				return "1DD";
			default:
				return "Unknown";
		}
	}

	/**
	 * 
	 */
	SetPlainFormat() { this.PlainFormat = true; }

	/**
	 * @param {string} ext
	 */
	SetTypeFromExtension(ext) {
		if (this.#IsNotPlainExtension(ext)) return;

		this.SetPlainFormat();
		const TypeFromExtenstion = (ext == "2D") ? DiskTypeEnum.Disk2D : DiskTypeEnum.Disk2HD;
		if (!this.#ForceType) SetImageType(TypeFromExtenstion);
	}

	/**
	 * 
	 * @param {string} ext 
	 * @returns {boolean}
	 */
	#IsNotPlainExtension(ext) {
		return ext != "2D" && ext != "2HD";
	}

	/**
	 * トラックあたりのセクタ数を取得する
	 * @returns {number} トラックあたりのセクタ数
	 */
	GetTrackPerSector() { return this.CurrentTrackFormat.TrackPerSector; }

	/**
	 * 記録密度を取得する
	 * 
	 * @returns {number} 記録密度 0x00:倍密度 0x40:単密度 0x01:高密度
	 */
	GetDensity() { return 0x00; }

	GetMaxTrackSize() { return this.CurrentTrackFormat.TrackMax; }

	GetSectorSize() {
		return 1;
	}

	/**
	 * ディスクの種類から設定する
	 * @param {number} t ディスクの種類
	 */
	SetImageTypeFromHeader(t) {
		switch(t & 0xFF) {
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
			case 0x00: // 2D
			default:
				this.SetImageType(DiskTypeEnum.Disk2D);
				break;
		}
	}
}
