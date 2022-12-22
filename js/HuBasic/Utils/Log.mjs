import { LogType } from './LogType.mjs';
import LogData from './LogData.mjs';

//Log
export default class {
	/**
	 * @type {LogData[]}
	 */
	#Data = new Array();

	/**
	 * @type {boolean}
	 */
	#ShowInfo;
	/**
	 * @type {boolean}
	 */
	#ShowDebug;
	/**
	 * @type {boolean}
	 */
	#ShowError;
	/**
	 * @type {boolean}
	 */
	#ShowWarning;
	/**
	 * @type {boolean}
	 */
	#ShowVerbose;

	constructor() {
		this.#ShowError = true;
		this.#ShowWarning = true;
		this.#ShowInfo = true;
	}

	SetQuite() {
		this.#ShowError = false;
		this.#ShowWarning = false;
		this.#ShowInfo = false;
		this.#ShowDebug = false;
	}

	SetVerbose() {
		this.#ShowVerbose = true;
	}

	/**
	 * 
	 * @param {string} v 
	 */
	Info(v) {
		this.AddLog(LogType.Info, v);
	}

	/**
	 * 
	 * @param {string} v 
	 */
	Error(v) {
		this.AddLog(LogType.Error, v);
	}

	/**
	 * 
	 * @param {string} v 
	 */
	Warning(v) {
		this.AddLog(LogType.Warning, v);
	}

	/**
	 * 
	 * @param {string} v 
	 */
	Verbose(v) {
		this.AddLog(LogType.Verbose, v);
	}


	/**
	 * 
	 * @param {LogType} Type 
	 * @returns {boolean}
	 */
	IsShow(Type) {
		switch (Type) {
			case LogType.Error:
				return this.#ShowError;
			case LogType.Warning:
				return this.#ShowWarning;

			case LogType.Info:
				return this.#ShowInfo;
			case LogType.Debug:
				return this.#ShowDebug;

			case LogType.Verbose:
				return this.#ShowVerbose;
		}
		return false;
	}


	/**
	 * 
	 * @param {LogType} Type 
	 * @param {string} Message 
	 */
	AddLog(Type, Message) {
		const m = new LogData(Type, Message);
		this.#Data.push(m);
		this.#ShowLog(m);
	}

	/**
	 * 
	 * @param {LogData} m 
	 */
	#ShowLog(m) {
		if (this.IsShow(m.Type)) console.log(m.ToString());
	}

}
