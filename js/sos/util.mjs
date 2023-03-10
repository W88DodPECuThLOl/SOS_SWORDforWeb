
/**
 * SOSErrorの例外
 */
class SOSError extends Error {
	#sosErrorCode;
	constructor(sosErrorCode, message)
	{
		super(message)
		this.#sosErrorCode = sosErrorCode;
	}

    GetSOSErrorCode()
    {
        return this.#sosErrorCode;
    }
}

/**
 * 先頭の空白を取り除く
 * 
 * @param {Array<number>} text 文字列の配列
 */
function SpCut(text)
{
    while((text.length > 0) && (text[0] == 0x20)) { text.shift(); }
}

/**
 * 数値を0パディング16進数4桁の大文字の文字列に変換する。
 * 
 * 例）0x12f => "012F"
 * @param {number} value 数値
 * @returns {string} 0パディング16進数4桁の大文字の文字列
 */
function ToStringHex4(value)
{
    return (value & 0xFFFF).toString(16).padStart(4, 0).toUpperCase();
}

/**
 * 数値を0パディング16進数2桁の大文字の文字列に変換する。
 * 
 * 例）0x12f => "2F"
 * @param {number} value 数値
 * @returns {string} 0パディング16進数2桁の大文字の文字列
 */
function ToStringHex2(value)
{
    return (value & 0xFF).toString(16).padStart(2, 0).toUpperCase();
}

/**
 * 値の下位4ビット(0x0～0xF)を16進数の１文字に変換する  
 * @param {number} value 値
 * @returns {number} 16進数の１文字（A～Fは大文字）
 */
function Asc(value)
{
    value &= 0xF;
    if(value <= 9) {
        return value + 0x30; // '0'～'9'
    } else {
        return value + 0x41 - 10; // 'A'～'F'
    }
}

/**
 * アスキーコードを16進数として扱い値に変換する
 * 
 * @param {number} value    文字のアスキーコード  
 *                          受け付ける文字は、0-9A-Fa-f
 * @returns {number}        変換された値(0～0xF)
 * @throws 変換に失敗した場合は、SOSError(SOSErrorCode.BadData)を投げる
 */
function ParseHex(value)
{
    if(0x30 <= value && value <= 0x39) { // 0～9
        return value - 0x30;
    } else if(0x41 <= value && value <= 0x46) { // A～F
        return value - 0x41 + 10;
    } else if(0x61 <= value && value <= 0x66) { // a～f
        return value - 0x61 + 10;
    } else {
        throw new SOSError(SOSErrorCode.BadData); // エラー
    }
}

/**
 * 16進4桁の文字を整数値に変換する
 * 
 * @param {Array} text	変換する値
 * @returns {number}	変換された値
 * @throws 変換に失敗した場合は、SOSError(SOSErrorCode.BadData)の例外を投げる。
 */
function ParseHex4(text)
{
    let value = 0;
    for(let i = 0; i < 4; ++i) {
        value <<= 4;
        if(text.length == 0) {
            // 文字数が足りない
            throw new SOSError(SOSErrorCode.BadData);
        }
        value |= ParseHex(text.shift()); // 変換に失敗したら例外投げる
    }
    return value;
}

/**
 * a-zをA-Zに変換する
 * 
 * @param {number} ch	変換する値
 * @returns {number}	変換された値
 */
function ToUpperCase(ch)
{
    if(0x61 <= ch && ch <= 0x7A) {
        return ch - 0x20;
    } else {
        return ch;
    }
}

/**
 * 文字列を数値の配列に変換する。
 * 末尾に0付ける
 * @param {string} str 
 * @returns number[] 変換された数値の配列
 */
function StringToArray(str)
{
    let res = [];
    for(let ch of str) { res.push(ch.codePointAt(0)); }
    res.push(0);
    return res;
}

/*
export {
    ToStringHex4
};
*/
