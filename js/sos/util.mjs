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

/*
export {
    ToStringHex4
};
*/

