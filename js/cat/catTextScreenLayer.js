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

	/**
	 * カーソルを描画するかどうかのフラグ
	 * @type {boolean}
	 */
	#display;

	/**
	 * スペース(U+0020)を全角扱いにするかどうか
	 * @type {boolean}
	 */
	isSpaceFull;
	isHalf;

	/**
	 * @type {Map}
	 */
	svgLetter;

	/**
	 * カスタム文字描画
	 */
	#customDrawLetter = null;
	
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
		if(x < 0 || x >= this.getScreenWidth()) { return 0; }
		if(y < 0 || y >= this.getScreenHeight()) { return 0; }
		const addr = this.#calcTextAddress(x, y);
		return this.#tram[addr + this.#codePointIndex];
	}

	/**
	 * １文字文描画するテキストを生成（HTMLに設定する文字列を生成）
	 * デフォルトの実装
	 * @param {number} codePoint 文字(UTF-32)
	 * @param {number} color 色（0～0xFFFFFFFF）
	 * @param {number} attr 属性（0:通常 1:90回転 2:180度回転 3:270度回転）
	 * @param {boolean} cursor カーソルを描画するかどうか
	 * @returns {string} １文字文描画するテキスト
	 */
	#defaultDrawLetter(x, y, width, codePoint, color, attr, cursor)
	{
		if(codePoint != 10) {
			if(codePoint == 32 || codePoint == 0) {
				// 0x00と空白
				// ・消えてしまうので、スペースを表示するようにする
				// ・isSpaceFullで半角と全角のスペースを選べる
				if(cursor) {
					if(this.isSpaceFull) {
						return '<span class="cursor">&emsp;</span>';
					} else {
						return '<span class="cursor">&nbsp;</span>';
					}
				} else {
					if(this.isSpaceFull) {
						return '<span>&emsp;</span>';
					} else {
						return '<span>&nbsp;</span>';
					}
				}
			} else {
				const moji = String.fromCodePoint(codePoint);
				if(cursor) {
					switch(attr & 3) {
						case 0:
							if(color == 0xFFFFFFFF) {
								return '<span class="cursor">' + moji + '</span>';
							} else {
								return '<font class="cursor" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
							}
						case 1:
							return '<span class="cursor"><font class="rot90" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font></span>';
						case 2:
							return '<span class="cursor"><font class="rot180" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font></span>';
						case 3:
							return '<span class="cursor"><font class="rot270" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font></span>';
					}
				} else {
					switch(attr & 3) {
						case 0:
							if(color == 0xFFFFFFFF) {
								return '<span>' + moji + '</span>';
							} else {
								return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
							}
						case 1:
							if(color == 0xFFFFFFFF) {
								return '<span class="rot90">' + moji + '</span>';
							} else {
								return '<font class="rot90" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
							}
						case 2:
							if(color == 0xFFFFFFFF) {
								return '<span class="rot180">' + moji + '</span>';
							} else {
								return '<font class="rot180" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
							}
						case 3:
							if(color == 0xFFFFFFFF) {
								return '<span class="rot270">' + moji + '</span>';
							} else {
								return '<font class="rot270" color="#' + ('00000000' + color.toString(16)).slice(-6) + '">' + moji + '</font>';
							}
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

	/**
	 * １文字文描画するテキストを生成（HTMLに設定する文字列を生成）
	 * @param {number} codePoint 文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 * @param {boolean} cursor カーソルを描画するかどうか
	 * @returns {string} １文字文描画するテキスト
	 */
	#drawLetter(x, y, width, codePoint, color, attr, cursor)
	{
		if(this.#customDrawLetter) {
			// カスタム文字描画
			return this.#customDrawLetter(x, y, width, codePoint, color, attr, cursor);
		} else {
			// デフォルトの文字描画
			return this.#defaultDrawLetter(x, y, width, codePoint, color, attr, cursor);
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
		this.setDisplayCursor(true);
		this.setSpaceFull(true);
		this.setHalf(false);
		this.setCustomDrawLetter(null);
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
			text += '<nobr>';
			for(let x = 0; x < this.#width; ++x) {
				const cursor = this.getDisplayCursor() && (x == this.#cursor.x) && (y == this.#cursor.y);
				text += this.#drawLetter(x, y, this.#width, this.#tram[addr], this.#tram[addr + 1], this.#tram[addr + 2], cursor);
				addr += this.#letterSize;
			}
			text += "</nobr><br>";
		}
		return text;
	}

	/**
	 * 画面クリア
	 * @param {{top: number, left: number, bottom: number, right: number}} range 画面クリアする範囲
	 */
	clearScreen(range)
	{
		if(!range) {
			range = {
				top: 0,
				left: 0,
				bottom: this.#height,
				right: this.#width,
			};
		}
		for(let y = range.top; y < range.bottom; ++y) {
			for(let x = range.left; x < range.right; ++x) {
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
	 * カーソルを表示するかどうかを設定する
	 * @param {boolean} display カーソルを表示するかどうか
	 */
	setDisplayCursor(display) {
		if(this.#display != display) {
			this.#display = display;
			// 変更フラグセット
			this.#isModified = true;
		}
	}
	/**
	 * カーソルを表示するかどうかを取得する
	 * @returns {boolean} カーソルを表示するかどうか
	 */
	getDisplayCursor() { return this.#display; }

	/**
	 * １行文スクロールする
	 * @param {{top: number, left: number, bottom: number, right: number}} range スクロールする範囲
	 */
	scroll(range)
	{
		if(!range) {
			range = {
				top: 0,
				left: 0,
				bottom: this.#height,
				right: this.#width,
			};
		}
		this.#isModified = true; // 変更フラグセット

		// スクロール
		for(let y = range.top; y < range.bottom - 1; ++y) {
			let dst = (range.left +  y      * this.#width) * this.#letterSize;
			let src = (range.left + (y + 1) * this.#width) * this.#letterSize;
			for(let x = range.left; x < range.right; ++x) {
				this.#tram[dst++] = this.#tram[src++];
				this.#tram[dst++] = this.#tram[src++];
				this.#tram[dst++] = this.#tram[src++];
			}
		}
		// 新しく出来た行をクリア
		const color = this.getColor();
		const attr = this.getAttr();
		const y = range.bottom - 1;
		const x = range.left;
		let dst = (x + y * this.#width) * this.#letterSize;
		for(let x = range.left; x < range.right; ++x) {
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

	/**
	 * スペース(U+0020)を全角扱いにするかどうかを設定する
	 * @param {boolean} spaceFull 全角扱いするならtrue
	 */
	setSpaceFull(spaceFull)
	{
		if(this.isSpaceFull != spaceFull) {
			this.#isModified = true; // 変更フラグセット
			this.isSpaceFull = spaceFull;
		}
	}
	setHalf(half)
	{
		if(this.isHalf != half) {
			this.#isModified = true; // 変更フラグセット
			this.isHalf = half;
		}
	}

	/**
	 * 文字を描画する関数を設定する
	 * @param {*} drawLetter 
	 */
	setCustomDrawLetter(drawLetter)
	{
		this.#customDrawLetter = drawLetter;
	}
}
