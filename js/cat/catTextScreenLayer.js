/**
 * テキストスクリーンのレイヤ
 * @author 猫大名 ねこ猫
 */
export default class {
	// CatTextScreenLayer

	/**
	 * テキストの配列
	 * @type {number[]}
	 */
	#tram;

	/**
	 * カーソル位置
	 * @type {{x: number, y: number}}
	 */
	#cursor = {x:0, y:0};

	/**
	 * 画面の横幅(キャラクタ単位)
	 * @type {number}
	 */
	#width;

	/**
	 * 画面の高さ(キャラクタ単位)
	 * @type {number}
	 */
	#height;

	/**
	 * 文字の色
	 * @type {number}
	 */
	#color;

	/**
	 * 文字の属性
	 * @type {number}
	 */
	#attr;

	/**
	 * テキストRAM上での１文字のサイズ
	 * コードポイント、色、属性の3要素
	 * @type {number}
	 */
	#letterSize = 3;

	/**
	 * コードポイントのインデックス
	 * @type {number}
	 */
	#codePointIndex = 0;

	/**
	 * 色のインデックス
	 * @type {number}
	 */
	#colorIndex = 1;

	/**
	 * 属性のインデックス
	 * @type {number}
	 */
	#attrIndex = 2;

	/**
	 * 変更されたかどうか。
	 * 変更されている場合は、再描画が必要で、再描画されるとリセットされる。
	 * @type {boolean}
	 */
	#isModified;

	// -----------------------------------------------------------------------------------------------------------
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * テキストスクリーンのTRAMのインデックスを計算する
	 * クリッピングする。
	 * @param {number} x 座標
	 * @param {number} y 座標
	 * @returns {number} TRAMのインデックス
	 */
	#calcTextAddress(x, y)
	{
		const width = this.getScreenWidth();
		const height = this.getScreenHeight();
		if(x < 0) { x = 0; } else if(x >= width) { x = width - 1; }
		if(y < 0) { y = 0; } else if(y >= height) { y = height - 1; }
		return this.#calcTextAddressNoClip(x, y)
	}
	/**
	 * テキストスクリーンのTRAMのインデックスを計算する
	 * クリッピングしない
	 * @param {number} x 座標
	 * @param {number} y 座標
	 * @returns {number} TRAMのインデックス
	 */
	#calcTextAddressNoClip(x, y)
	{
		const width = this.getScreenWidth();
		return (x + y * width) * this.#letterSize;
	}

	/**
	 * 指定位置に文字を出力する
	 * @param {number} x 出力するx座標
	 * @param {number} y 出力するy座標
	 * @param {number} codePoint 出力する文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 */
	#set(x,y,codePoint,color,attr)
	{
		const addr = this.#calcTextAddress(x, y);
		if(this.#isModified || (this.#tram[addr] != codePoint) || (this.#tram[addr + 1] != color) || (this.#tram[addr + 2] != attr)) {
			this.#isModified = true; // 変更フラグセット
			this.#tram[addr + this.#codePointIndex] = codePoint;
			this.#tram[addr + this.#colorIndex] = color;
			this.#tram[addr + this.#attrIndex] = attr;
		}
	}

	/**
	 * 指定位置の文字を取得する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @returns {number} 文字(UTF-32)
	 */
	#get(x,y)
	{
		const addr = this.#calcTextAddress(x, y);
		return this.#tram[addr + this.#codePointIndex];
	}

	/**
	 * １文字文描画するテキストを生成（HTMLに設定する文字列を生成）
	 * @param {number} codePoint 文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 * @param {boolean} cursor カーソルを描画するかどうか
	 * @returns {string} １文字文描画するテキスト
	 */
	#drawLetter(codePoint, color, attr, cursor)
	{
		if(codePoint!=10) {
			if(codePoint==32 || codePoint== 0) {
				if(cursor) {
					return '<span class="cursor">&emsp;</span>';
				} else {
					return '<span>&emsp;</span>';
				}
			} else {
				if(cursor) {
					if((attr & 3) == 1) {
						return '<span class="cursor"><font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot90">' + String.fromCodePoint(codePoint) + '</span></font></span></span>';
					} else if((attr & 3) == 2) {
						return '<span class="cursor"><font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot180">' + String.fromCodePoint(codePoint) + '</span></font></span>';
					} else if((attr & 3) == 3) {
						return '<span class="cursor"><font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot270">' + String.fromCodePoint(codePoint) + '</span></font></span>';
					} else {
						return '<span class="cursor"><font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span>' + String.fromCodePoint(codePoint) + '</span></font></span>';
					}
				} else {
					if((attr & 3) == 1) {
						return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot90">' + String.fromCodePoint(codePoint) + '</span></font>';
					} else if((attr & 3) == 2) {
						return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot180">' + String.fromCodePoint(codePoint) + '</span></font>';
					} else if((attr & 3) == 3) {
						return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot270">' + String.fromCodePoint(codePoint) + '</span></font>';
					} else {
						return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span>' + String.fromCodePoint(codePoint) + '</span></font>';
					}
				}
			}
		} else {
			if(cursor) {
				return '<span class="cursor">&emsp;</span>';
			} else {
				return '<span>&emsp;</span>';
			}
		}
	}

	// -----------------------------------------------------------------------------------------------------------
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * コンストラクタ
	 * @param {number} width 横幅(キャラクタ単位)
	 * @param {number} height 高さ(キャラクタ単位)
	 */
	constructor(width, height)
	{
		this.setColor(0xFFFFFFFF);
		this.setAttr(0);
		this.setCursor(0, 0);
		this.changeScreenSize(width, height)
	}

	/**
	 * スクリーンサイズを変更する
	 * @param {number} width 横幅(キャラクタ単位)
	 * @param {number} height 高さ(キャラクタ単位)
	 */
	changeScreenSize(width, height)
	{
		this.#isModified = true; // 変更フラグセット
		this.#width = width;
		this.#height = height;
		this.#tram = new Array(this.#letterSize * width * height);
		this.clearScreen();
	}

	/**
	 * テキストスクリーンの横幅を取得する
	 * @returns {number} テキストスクリーンの横幅(キャラクタ単位)
	 */
	getScreenWidth() { return this.#width; }

	/**
	 * テキストスクリーンの高さを取得する
	 * @returns {number} テキストスクリーンの高さ(キャラクタ単位)
	 */
	getScreenHeight() { return this.#height; }

	/**
	 * 指定位置に文字を出力する
	 * @param {number} x 出力するx座標(キャラクタ単位)
	 * @param {number} y 出力するy座標(キャラクタ単位)
	 * @param {number} codePoint 出力する文字(UTF-32)
	 */
	setCodePoint(x, y, codePoint) { this.#set(x, y, codePoint, this.getColor(), this.getAttr()); }

	/**
	 * 指定位置の文字を取得する
	 * @param {number} x x座標(キャラクタ単位)
	 * @param {number} y y座標(キャラクタ単位)
	 * @return {number} 文字(UTF-32)
	 */
	getCodePoint(x, y) { return this.#get(x, y); }

	/**
	 * 指定位置の文字の色を設定する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @param {number} color 色
	 */
	setTextColor(x, y, color)
	{
		const addr = this.#calcTextAddress(x, y);
		if(color != this.#tram[addr + this.#colorIndex]) {
			this.#tram[addr + this.#colorIndex] = color;
			this.isModified = true;
		}
	}

	/**
	 * 指定位置の色を取得する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @returns {number} 色
	 */
	getTextColor(x, y)
	{
		const addr = this.#calcTextAddress(x, y);
		return this.#tram[addr + this.#colorIndex];
	}

	/**
	 * 指定位置の文字の属性を設定する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @param {number} attr 属性
	 */
	setTextAttr(x, y, attr)
	{
		const addr = this.#calcTextAddress(x, y);
		if(attr != this.#tram[addr + this.#attrIndex]) {
			this.#tram[addr + this.#attrIndex] = attr;
			this.isModified = true;
		}
	}

	/**
	 * 指定位置の属性を取得する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @returns {number} 属性
	 */
	getTextAttr(x,y)
	{
		const addr = this.#calcTextAddress(x, y);
		return this.#tram[addr + this.#attrIndex];
	}

	/**
	 * 描画（するときに設定するHTML文字列の生成）
	 * @returns {string} HTMLに設定する文字列
	 */
	draw()
	{
		this.#isModified = false; // 変更フラグをリセット

		let text = "";
		let addr = 0;
		for(let y = 0; y < this.#height; ++y) {
			text += "<nobr>";
			for(let x = 0; x < this.#width; ++x) {
				const cursor = (x == this.#cursor.x) && (y == this.#cursor.y);
				text += this.#drawLetter(this.#tram[addr], this.#tram[addr + 1], this.#tram[addr + 2], cursor);
				addr += this.#letterSize;
			}
			text += "</nobr><br>";
		}
		return text;
	}

	/**
	 * 画面クリア
	 */
	clearScreen()
	{
		for(let y = 0; y < this.#height; ++y) {
			for(let x = 0; x < this.#width; ++x) {
				this.#set(x, y, 0, this.#color, this.#attr);
			}
		}
	}

	/**
	 * 描画色を設定する
	 * @param {number} rgba 描画色
	 */
	setColor(rgba) { this.#color = rgba; }

	/**
	 * 描画色を取得する
	 * @returns {number} rgba 描画色
	 */
	getColor() { return this.#color; }

	/**
	 * 文字の属性を設定する
	 * @param {number} attr 文字の属性
	 */
	setAttr(attr) { this.#attr = attr; }

	/**
	 * 文字の属性を取得する
	 * @returns {number} 文字の属性
	 */
	getAttr() { return this.#attr; }
	
	/**
	 * カーソル表示位置を設定する
	 * 範囲外を設定することもある
	 * @param {number} x カーソル表示位置(キャラクタ単位)
	 * @param {number} y カーソル表示位置(キャラクタ単位)
	 */
	setCursor(x, y)
	{
		// if(x >= this.#width) { x = this.#width - 1; }
		// if(y >= this.#height) { y = this.#height - 1; }
		// if(x < 0) { x = 0; }
		// if(y < 0) { y = 0; }

		if(this.#cursor.x != x || this.#cursor.y != y) {
			this.#cursor.x = x;
			this.#cursor.y = y;
			this.#isModified = true; // 変更フラグセット
		}
	}

	/**
	 * カーソル表示位置を取得する
	 * @returns {{x:number, y:number}} カーソル表示位置
	 */
	getCursor() { return {x: this.#cursor.x, y: this.#cursor.y}; }

	/**
	 * テキストが更新されたかどうかを取得する
	 * @returns {boolean} 更新された場合は true を返す
	 */
	isModified() { return this.#isModified; }
	
	/**
	 * １行文スクロールする
	 */
	scroll()
	{
		this.#isModified = true; // 変更フラグセット
		// スクロール
		let dst = 0;
		let src = this.#width * this.#letterSize;
		const end = this.#width * this.#height * this.#letterSize;
		while(src != end) {
			this.#tram[dst++] = this.#tram[src++];
		}
		// 新しく出来た行をクリア
		const color = this.getColor();
		const attr = this.getAttr();
		while(dst != end) {
			this.#tram[dst + this.#codePointIndex] = 0;
			this.#tram[dst + this.#colorIndex] = color;
			this.#tram[dst + this.#attrIndex] = attr;
			dst += this.#letterSize;
		}
	}

	/**
	 * (begin,end]の範囲で、beginを取り除き、空いたところにcodePointの文字を設定する
	 * @param {{x:number, y:number}} begin 範囲の開始位置
	 * @param {{x:number, y:number}} end 範囲の終了位置
	 * @param {number} codePoint 空いたところに設定する文字(UTF-32)
	 */
	removeTop(begin, end, codePoint = 0)
	{
		this.#isModified = true; // 変更フラグセット
		
		let   dstIndex = this.#calcTextAddressNoClip(begin.x, begin.y);
		let   srcIndex = dstIndex + this.#letterSize;
		const endIndex = this.#calcTextAddressNoClip(end.x, end.y);
		while(srcIndex < endIndex) {
			this.#tram[dstIndex++] = this.#tram[srcIndex++];
		}
		this.#tram[dstIndex + this.#codePointIndex] = codePoint;
		this.#tram[dstIndex + this.#colorIndex] = this.getColor();
		this.#tram[dstIndex + this.#attrIndex] = this.getAttr();
	}
}