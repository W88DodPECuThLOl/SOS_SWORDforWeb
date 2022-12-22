// LogData
export default class {
	/**
	 * @type {LogType}
	 */
	Type;

	/**
	 * @type {string}
	 */
	Message;

	/**
	 * @param {LogType} type 
	 * @param {string} message 
	 */
	constructor(type, message) {
		this.Type = type;
		this.Message = message;
	}

	/**
	 * @return {string}
	 */
	ToString() { return this.Message; }
}
