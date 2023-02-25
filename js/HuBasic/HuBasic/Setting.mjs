"use strict";

import { DiskType } from '../Disk/DiskType.mjs';

// Setting
export default class {
	/**
	 * @type {boolean}
	 */
	X1SMode = false;

	/**
	 * @type {boolean}
	 */
	FormatImage = false;

	/**
	 * @type {DiskType}
	 */
	DiskType = new DiskType();

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
