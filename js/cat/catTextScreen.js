import CatTextScreenLayer from './catTextScreenLayer.js';
import CatTextScreenLayerControler from './catTextScreenLayerControler.js';

/**
 * テキストスクリーン
 * 
 * 複数のレイヤを管理するもの
 * @author 猫大名 ねこ猫
 */
export default class {
	// CatTextScreen

	/**
	 * テキストレイヤの数
	 * @type {number}
	 */
	#textLayerSize;

	/**
	 * デフォルトのレイヤ
	 * @type {number}
	 */
	#defaultLayer;

	/**
	 * テキストレイヤ
	 * @type {CatTextScreenLayer[]}
	 */
	#textLayer;

	/**
	 * テキストレイヤのコントローラ
	 * @type {CatTextScreenLayerControler[]}
	 */
	#textLayerControler;

	/**
	 * 文字変換  
	 * 表示するときに文字コードを変換する関数
	 * @type {引数number、返り値numberの関数}
	 */
	#encoder;
	/**
	 * 文字変換  
	 * 画面から文字を取得した後に、文字コードを変換する関数
	 * @type {引数number、返り値numberの関数}
	 */
	#decoder;

	// -----------------------------------------------------------------------------------------------------------
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * コンストラクタ
	 * @param {number} width 横幅
	 * @param {number} height 高さ
	 * @param {number} textLayerSize テキストレイヤ数
	 */
	constructor(width, height, textLayerSize=1)
	{
		this.#textLayerSize = textLayerSize;
		this.#textLayer = new Array(this.#textLayerSize);
		this.#textLayerControler = new Array(this.#textLayerSize);
		for(let i = 0; i < this.#textLayerSize; ++i) {
			this.#textLayer[i] = new CatTextScreenLayer(width, height);
			this.#textLayerControler[i] = new CatTextScreenLayerControler(this.#textLayer[i]);
		}
		this.setDefaultLayer();
		// 文字コードのコーデック
		this.setCodec((ch32)=>{return ch32}, (ch32)=>{return ch32});
	}

	/**
	 * 文字コードのコーデックを設定する
	 * 
	 * 表示や取得するときに、文字コードを変換するとき呼び出される関数を設定する
	 * @param {*} encoder 表示する文字コードへ変換する
	 * @param {*} decoder 表示している文字コードから元の文字コードへ変換する
	 */
	setCodec(encoder, decoder)
	{
		this.#encoder = encoder;
		this.#decoder = decoder;
	}

	/**
	 * デフォルトのレイヤを設定する
	 * @param {number} defaultLayer レイヤ
	 */
	setDefaultLayer(defaultLayer)
	{
		defaultLayer = (typeof defaultLayer === 'undefined') ? (this.#textLayerSize - 1) : defaultLayer;
		this.#defaultLayer = defaultLayer;
	}

	/**
	 * スクリーンサイズを変更する
	 * @param {number} width 横幅(キャラクタ単位)
	 * @param {number} height 高さ(キャラクタ単位)
	 * @param {number} layer 変更するレイヤ
	 */
	changeScreenSize(width, height, layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		this.#textLayerControler[layer].changeScreenSize(width, height);
	}

	/**
	 * テキストスクリーンの横幅を取得する
	 * @param {number} layer レイヤ
	 * @returns {number} テキストスクリーンの横幅(キャラクタ単位)
	 */
	getScreenWidth(layer) {
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].getScreenWidth();
	}

	/**
	 * テキストスクリーンの高さを取得する
	 * @param {number} layer レイヤ
	 * @returns {number} テキストスクリーンの高さ(キャラクタ単位)
	 */
	getScreenHeight(layer) {
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].getScreenHeight();
	}

	/**
	 * １文字出力する
	 * @param {number_Or_string} codePoint UTF-32の文字、または、制御文字列
	 * @param {number} layer レイヤ番号
	 */
	putch32(codePoint, layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		this.#textLayerControler[layer].putch32(this.#encoder(codePoint));
	}

	/**
	 * 指定位置の文字を取得する
	 * @param {number} x x座標(キャラクタ単位)
	 * @param {number} y y座標(キャラクタ単位)
	 * @param {number} layer レイヤ番号
	 * @return {number} 文字(UTF-32)
	 */
	getCodePoint(x, y, layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#decoder(this.#textLayerControler[layer].getCodePoint(x, y));
	}

	/**
	 * 描画（するときに設定するHTML文字列の生成）
	 * @param {number} layer レイヤ番号
	 * @returns HTMLに設定する文字列
	 */
	draw(layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].draw();
	}

	/**
	 * 画面クリア
	 * @param {number} layer レイヤ番号
	 */
	clearScreen(layer)
	{
		if(typeof layer === 'undefined') {
			for(const ctrl of this.#textLayerControler) {
				ctrl.clearScreen();
			}
		} else {
			this.#textLayerControler[this.#defaultLayer].clearScreen();
		}
	}

	/**
	 * カーソル位置を設定する
	 * @param {number} x カーソル位置
	 * @param {number} y カーソル位置
	 * @param {number} layer レイヤ番号
	 */
	setCursor(x, y, layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		this.#textLayerControler[layer].setCursor(x, y);
	}

	/**
	 * カーソル位置を取得する
	 * @param {number} layer レイヤ番号
	 * @returns {{x:number, y:number}} カーソル位置
	 */
	getCursor(layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].getCursor();
	}

	/**
	 * 描画色を設定する
	 * @param {number} rgba 描画色
	 * @param {number} layer レイヤ番号
	 */
	setColor(rgba, layer)
	{
		if(typeof layer === 'undefined') {
			for(const ctrl of this.#textLayerControler) {
				ctrl.setColor(rgba);
			}
		} else {
			this.#textLayerControler[this.#defaultLayer].setColor(rgba);
		}
	}

	/**
	 * 描画色を取得する
	 * @param {number} layer レイヤ番号
	 */
	getColor(layer)
	{
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].getColor();
	}

	/**
	 * 文字の属性を設定する
	 * @param {number} attr 文字の属性
	 * @param {number} layer レイヤ番号
	 */
	setAttr(attr, layer) {
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		this.#textLayerControler[layer].setAttr(attr);
	}

	/**
	 * 文字の属性を取得する
	 * @param {number} layer レイヤ番号
	 * @returns {number} 文字の属性
	 */
	getAttr(layer) {
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].getAttr();
	}

	/**
	 * カーソルのある行のテキストを取得する
	 * @param {number} layer レイヤ番号
	 * @returns {string} １行の文字列
	 */
	getLine(layer) {
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		return this.#textLayerControler[layer].getLine();
	}

	/**
	 * カーソルのある行のテキストをデコードして取得する
	 * @param {number} layer レイヤ番号
	 * @returns {Array} １行の文字列
	 */
	getLineWithDecode(layer) {
		// デコードする
		const ret = new Array();
		for(let ch of this.getLine(layer)) {
			ret.push(this.#decoder(ch.codePointAt(0)));
		}
		return ret;
	}

	/**
	 * テキストが更新されたかどうかを取得する
	 * @param {number} layer レイヤ番号
	 * @returns {boolean} 更新された場合は true を返す
	 */
	isModified(layer)
	{
		if(typeof layer === 'undefined') {
			for(const ctrl of this.#textLayerControler) {
				if(ctrl.isModified()) {
					return true;
				}
			}
		} else {
			return this.#textLayerControler[layer].isModified();
		}
	}

	/**
	 * カーソルを表示するかどうかを設定する
	 * @param {boolean} display カーソルを表示するかどうか
	 * @param {number} layer	レイヤ番号
	 */
	setDisplayCursor(display, layer) {
		layer = (typeof layer === 'undefined') ? this.#defaultLayer : layer;
		this.#textLayerControler[layer].setDisplayCursor(display);
	}
}
