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
	 * @type {number} DiskTypeEnum
	 */
	#imageType;

	/**
	 * ディスクイメージタイプを取得する
	 * @returns {number} ディスクイメージタイプ(DiskTypeEnumの値)
	 */
	GetImageType() {
		return this.#imageType;
	}

	/**
	 * ディスクイメージを設定する
	 * @param {number} value ディスクイメージタイプ(DiskTypeEnumの値)
	 */
	SetImageType(value) {
		this.#imageType = value;
		this.CurrentTrackFormat = new TrackFormat(value);
		this.DiskParameter = new DiskParameter(value);
	}

	/**
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
	 * @returns {bool} ディスクイメージタイプが2D以外かどうか
	 */
	IsNot2D() {
		return this.GetImageType() == DiskTypeEnum.Disk2DD || this.GetImageType() == DiskTypeEnum.Disk2HD;
	}

	/**
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
		}
		return 0x0;
	}

	/**
	 * オプションからの設定
	 * @param {string} value
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
			default:
				this.SetImageType(DiskTypeEnum.Unknown);
				break;
		}

		// 強制設定する
		this.#ForceType = this.GetImageType() != DiskTypeEnum.Unknown;
		return this.#ForceType;
	}

	/**
	 * 
	 * @returns {string}
	 */
	GetTypeName() {
		switch (this.GetImageType()) {
			case DiskTypeEnum.Disk2D:
				return "2D";
			case DiskTypeEnum.Disk2DD:
				return "2DD";
			case DiskTypeEnum.Disk2HD:
				return "2HD";
			default:
				return "Unknown";
		}
	}

	/**
	 * 
	 */
	SetPlainFormat() {
		this.PlainFormat = true;
	}

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
	 * 
	 * @returns {number}
	 */
	GetTrackPerSector() {
		return this.CurrentTrackFormat.TrackPerSector;
	}

	/**
	 * 
	 * @param {number} t 
	 */
	SetImageTypeFromHeader(t) {
		switch(t & 0xFF) {
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
