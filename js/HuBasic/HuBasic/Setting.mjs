"use strict";

import DiskType from '../Disk/DiskType.mjs';

// Setting
export default class {
	/**
	 * @type {Uint8Array}
	 */
	IplName = new Uint8Array();

	/**
	 * @type {boolean}
	 */
	IplMode = false;
	/**
	 * @type {boolean}
	 */
	X1SMode = false;

	/**
	 * @type {number}
	 */
	ExecuteAddress = 0x00;
	/**
	 * @type {number}
	 */
	LoadAddress = 0x00;

	/**
	 * @type {boolean}
	 */
	FormatImage = false;

	/**
	 * @type {boolean}
	 */
	ForceAsciiMode = false;
	/**
	 * @type {boolean}
	 */
	ForceBinaryMode = false;


	/**
	 * @type {string}
	 */
	EntryName = "";
	/**
	 * @type {string}
	 */
	EntryDirectory = "";

	/**
	 * @type {DiskType}
	 */
	DiskType = new DiskType();

	/**
	 * @type {string}
	 */
	ImageFile;
	/**
	 * @type {string}
	 */
	ImageExtension;

	/**
	 * 
	 * @param {string} Filename 
	 */
	SetImageFilename(Filename) {
		this.ImageFile = Filename;
		this.ImageExtension = this.#ExtractExtension(this.ImageFile);
		this.DiskType.SetTypeFromExtension(this.ImageExtension);
	}

	/**
	 * 
	 * @param {string} Filename 
	 * @returns {string}
	 */
	#ExtractExtension(Filename) {
		let ext = Path.GetExtension(Filename);
		if (ext.startsWith(".")) ext = ext.substring(1);
		ext = ext.toUpperCase();
		return ext;
	}

	/**
	 * メディアタイプを設定する
	 * 
	 * @param {string} Value ディスクのメディアタイプの文字列（2D、2DD、2HD、1D、1DD）
	 * @returns {boolean}
	 */
	SetImageType(Value) {
		return this.DiskType.SetDiskTypeFromOption(Value);
	}
}
