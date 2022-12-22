import { OptionType } from '../HuBasic/OptionType.mjs';

export class DefineData {
	/**
	 * @type {OptionType}
	 */
	Type;
	/**
	 * @type {string}
	 */
	Short;
	/**
	 * @type {string}
	 */
	Long;
	/**
	 * @type {boolean}
	 */
	IsNeedArgument;

	/**
	 * 
	 * @param {OptionType} Type 
	 * @param {string} ShortOption 
	 * @param {string} LongOption 
	 * @param {boolean} NeedArgument 
	 */
	constructor(Type, ShortOption, LongOption, NeedArgument) {
		this.Type = Type;
		this.Short = ShortOption;
		this.Long = LongOption;
		this.IsNeedArgument = NeedArgument;
	}
}

class OptionData {
	/**
	 * @type {string}
	 */
	Key;
	/**
	 * @type {string}
	 */
	Value;
	/**
	 * @type {OptionType}
	 */
	Type;
}

//MiniOption
export default class {
	/**
	 * @type {string[]}
	 */
	Files;

	/**
	 * @type {DefineData[]}
	 */
	#DefineList;

	/**
	 * @type {OptionData[]}
	 */
	Result;

	constructor() {
		this.Files = new Array();
		this.Result = new Array();
		this.#DefineList = Array();
	}

	/**
	 * 
	 * @param {DefineData[]} opt 
	 */
	AddOptionDefines(opt) {
		this.#DefineList.concat(opt);
	}

	/**
	 * @type {number}
	 */
	#ParseIndex = 0;
	/**
	 * @type {string}
	 */
	#ParseArgument = null;
	/**
	 * @type {DefineData}
	 */
	#ParseOption = null;

	/**
	 * 
	 * @param {string} OptionText 
	 * @returns {boolean}
	 */
	#CheckLongOption(OptionText) {
		let Key = OptionText.substring(2);
		this.#ParseArgument = null;
		this.#ParseOption = null;
		for (let o of this.#DefineList) {
			if (o.Long != null && Key.startsWith(o.Long)) {
				this.#ParseOption = o;
				this.#ParseArgument = Key.substring(o.Long.length);
				return true;
			}
		}
		console.log("Invalid Option:" + OptionText);
		return false;
	}

	/**
	 * 
	 * @param {string} OptionText 
	 * @returns {boolean}
	 */
	#CheckOption(OptionText) {
		if (OptionText.startsWith("--"))
			return this.#CheckLongOption(OptionText);

		const Key = OptionText.Substring(1);
		this.#ParseArgument = null;
		this.#ParseOption = null;
		for (let o of this.#DefineList) {
			if (o.Short != null && Key.startsWith(o.Short)) {
				this.#ParseOption = o;
				this.#ParseArgument = Key.Substring(o.Short.length);
				return true;
			}
		}
		Console.WriteLine("Invalid Option:" + OptionText);
		return false;
	}

	/**
	 * 
	 * @param {string} OptionText 
	 * @param {string[]} args
	 * @returns {OptionData} 
	 */
	#MakeOption(OptionText, args) {
		const od = new OptionData();
		if (!this.#ParseOption.IsNeedArgument) {
			od.Type = this.#ParseOption.Type;
			od.Key = this.#ParseOption.Short;
			od.Value = null;
			return od;
		}
		if (this.#ParseArgument.length == 0) {
			this.#ParseIndex++;
			if (this.#ParseIndex >= args.Length) {
				Console.WriteLine("Missing Argument:{0}", OptionText);
				return null;
			}
			this.#ParseArgument = args[this.#ParseIndex];
		}
		od.Type = this.#ParseOption.Type;
		od.Key = this.#ParseOption.Short;
		od.Value = this.#ParseArgument;
		return od;
	}

	/**
	 * 
	 * @param {string[]} args 
	 * @returns {boolean}
	 */
	Parse(args) {
		for (this.#ParseIndex = 0; this.#ParseIndex < args.length; this.#ParseIndex++) {
			if (args[this.#ParseIndex] == "-" || !args[this.#ParseIndex].startsWith("-")) {
				this.Files.push(args[this.#ParseIndex]);
				continue;
			}

			if (!this.#CheckOption(args[this.#ParseIndex])) return false;
			const od = this.#MakeOption(args[this.#ParseIndex], args);
			if (od == null) return false;
			this.Result.push(od);
		}
		return true;
	}
}
