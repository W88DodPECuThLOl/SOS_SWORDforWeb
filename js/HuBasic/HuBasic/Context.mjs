﻿"use strict";

import Setting from './Setting.mjs';
import Log from '../Utils/Log.mjs';

class Encoding {
	/**
	 * @param {Uint8Array} src
	 * @returns {string}
	 */
	GetString(src)
	{
		const len = src.indexOf(0);
		TextDecoder().decode(src);
		for(let i = 0; i < src.length; ++i) {
			
		}

		return "";
	}

	/**
	 * 文字列をUint8Arrayに変換する
	 * @param {string} str 
	 * @returns {Uint8Array}
	 */
	GetUint8Array(str)
	{
		let text = new Uint8Array(str.length() + 1);
		let i = 0;
		for(let ch of str) {
			text[i++] = this.ConvertUTF32ToX1Char(ch.codePointAt(0));
		}
		text[i++] = 0;
		return text;
	}

	tableUTF32toX1CharCode = new Map([
		[0x00A5, 0x5C],	// yen sign
		[0x03C0, 0x7F],	// pi

		[0x2190, 0x1D], // arrowleft
		[0x2191, 0x1E], // arrowup
		[0x2192, 0x1C], // arrowright
		[0x2192, 0x1F], // arrowdown
		[0x21D0, 0x1D], // leftwards double arrow
		[0x21D1, 0x1E], // upwards double arrow
		[0x21D2, 0x1C], // rightwards double arrow
		[0x21D3, 0x1F], // downwards double arrow
		[0x21E6, 0x1D], // leftwards white arrow
		[0x21E7, 0x1E], // upwards white arrow
		[0x21E8, 0x1C], // rightwards white arrow
		[0x21E9, 0x1F], // downwards white arrow

		[0x2581, 0x80], // lower one eighth block
		[0x2582, 0x81], // 
		[0x2583, 0x82], // 
		[0x2584, 0x83], // 
		[0x2585, 0x84], // 
		[0x2586, 0x85], // 
		[0x2587, 0x86], // 
		[0x2588, 0x87], // full block

		[0x258F, 0x88], // 
		[0x258E, 0x89], // 
		[0x258D, 0x8A], // 
		[0x258C, 0x8B], // 
		[0x258B, 0x8C], // 
		[0x258A, 0x8D], // 
		[0x2589, 0x8E], // 
	]);

	ConvertUTF32ToX1Char(codePoint)
	{
		if(this.tableUTF32toX1CharCode.has(codePoint)) {
			return this.tableUTF32toX1CharCode.get(codePoint);
		}
		if(codePoint <= 0xFF) {
			return codePoint;
		}
		return 0x3F; // ?
	}

	/**
	 * 
	 * @param {Uint8Array} x1Text 
	 * @returns {string}
	 */
	Decode(x1Text)
	{
		let result = "";
		for(let x1 of x1Text) {
			result += String.fromCodePoint(this.tblX1toText[x1]);
		}
		return result;
	}

	tblX1toText = [
		0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,  0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
		0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,  0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,

		0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,  0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F,
		0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,  0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,
		0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,  0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,
		0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57,  0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F,
		0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,  0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F,
		0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77,  0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x03C0,
	];
}

// Context
export default class {
	/**
	 * 
	 * @type {string[]}
	 */
	Files;

	/**
	 * 
	 * @type {Setting}
	 */
	Setting;

	/**
	 * 
	 * @type {Log}
	 */
	Log;

	constructor() {
		this.Setting = new Setting();
		this.Log = new Log();
	}

	/**
	 * @returns {Encoding}
	 */
	#GetEncoding() {
		return new Encoding();
	}

	/**
	 * @param {string} Filename
	 */
	SetImageFilename(Filename) {
		this.Setting.SetImageFilename(Filename);
	}
}
