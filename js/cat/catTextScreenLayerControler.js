/**
 * テキストスクリーンのレイヤの制御
 * @author 猫大名 ねこ猫
 */
export default class {
	CatTextScreenLayerControler;

	/**
	 * コントロールする物
	 * @type {CatTextScreenLayer}
	 */
	#target;

	/**
	 * 改行してから表示した文字数
	 * @type {number}
	 */
	#prcnt;

	/**
	 * 次の行に続いているかどうかのフラグ
	 * @type {boolean[]}
	 */
	#lineContinue;

	/**
	 * カーソル位置
	 * @type {{x: number, y: number}}
	 */
	#cursor;

	/**
	 * 制御文字の処理
	 */
	#controlCharacter = new Map([
		// 文字コード、処理する関数
//		[0x0008, (ctx) => ctx.#backSpaceForLineEdit()], // BS
		[0x0008, (ctx) => ctx.#backSpaceForEdit()], // BS
		[0x000C, (ctx) => ctx.clearScreen()],			// CLS
		[0x000D, (ctx) => ctx.#enter()],				// CR
		//
		['Delete', (ctx) => ctx.#deleteForLineEdit()],    // DEL
		['ArrowRight', (ctx) => ctx.#cursorMoveRight()],
		['ArrowLeft', (ctx) => ctx.#cursorMoveLeft()],
		['ArrowUp', (ctx) => ctx.#cursorMoveUp()],
		['ArrowDown', (ctx) => ctx.#cursorMoveDown()],
		['Home', (ctx) => ctx.#ctrlHome()],
		['End', (ctx) => ctx.#ctrlEnd()],
	]);

	// -----------------------------------------------------------------------------------------------------------
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * 行の終端位置を取得する
	 * @param {number} y 取得したい行
	 * @returns {{x: number, y:number}} 終端位置+1の場所
	 */
	#lineEnd(y)
	{
		if(y < 0) {
			return {x: 0, y: 1};
		}
		const height = this.#target.getScreenHeight();
		while(y < (height - 1) && this.#lineContinue[y]) {
			y++;
		}
		return {x: 0, y: y + 1};
	}

	#lineBegin(y)
	{
		if(y <= 0) {
			return {x: 0, y: 0};
		}
		const height = this.#target.getScreenHeight();
		while(y >= 1 && this.#lineContinue[y - 1]) {
			y--;
		}
		return {x: 0, y: y};
	}

	#lineTextEnd(y)
	{
		const width = this.#target.getScreenWidth();
		const pos = this.#lineBegin(y);
		const end = this.#lineEnd(y);
		let last = {x:pos.x, y:pos.y};
		let x = pos.x;
		y = pos.y;
		while(x != end.x || y != end.y) {
			const hit = this.#target.getCodePoint(x,y);
			x++; if(x >= width) { x=0; y++; }
			if(hit) { last = {x:x, y:y}; }
		}
		return last;
	}


	/**
	 * カーソルを１文字分進める
	 */
	#advanceCursor()
	{
		this.#cursor.x++;
		// 画面右外なら位置を修正
		const width = this.#target.getScreenWidth();
		if(this.#cursor.x >= width) {
			// 次の行に続いているフラグセット
			this.#lineContinue[this.#cursor.y] = true;
			// 次の行の先頭に
			this.#cursor.x = 0;
			this.#cursor.y++;
			// メモ)画面外のスクロールは、ここではしない
		}
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	/**
	 * 
	 * @param {{x, y}} pos 
	 * @param {number} value 
	 * @returns {{x, y}}
	 */
	#addCursor(pos,value)
	{
		const width = this.#target.getScreenWidth();
		const index = pos.x + pos.y * width + value;
		return {x: index % width, y: (index / width) | 0};
	}
	
	#scroll()
	{
		this.#target.scroll();
		// 行の続きフラグをスクロールに合わせて移動
		this.#lineContinue.shift();
		this.#lineContinue.push(false);
	}

	// ---------------------------------------------------------------
	// 制御キーの処理
	// ---------------------------------------------------------------

	/**
	 * 画面クリア
	 */
	clearScreen()
	{
		// カーソル位置を左上に
		this.#cursor.x = 0;
		this.#cursor.y = 0;
		// 画面クリア
		this.#target.clearScreen();
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
		// 行の続きフラグをクリア
		for(let i = 0; i < this.#lineContinue.length; ++i) {
			this.#lineContinue[i] = false;
		}
	}

	/**
	 * 改行
	 */
	#enter()
	{
		// 文字数カウンタクリア
		this.#prcnt = 0;
		// 次の行に続いているフラグをリセット
		this.#lineContinue[this.#cursor.y] = false;
		// 次の行の先頭に移動
		this.#cursor.x = 0;
		this.#cursor.y++;
		// カーソルが画面下外ならスクロールする
		const height = this.#target.getScreenHeight();
		if(this.#cursor.y >= height) {
			this.#scroll();
			this.#cursor.y = height - 1;
		}
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	/**
	 * カーソル右移動
	 */
	#cursorMoveRight()
	{
		const width = this.#target.getScreenWidth();
		this.#cursor.x++;
		if(this.#cursor.x >= width) {
			this.#cursor.x = 0;
			this.#cursor.y++;
			const height = this.#target.getScreenHeight();
			if(this.#cursor.y >= height) {
				this.#cursor.y = height - 1;
			}
		}
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	/**
	 * カーソル左移動
	 */
	#cursorMoveLeft()
	{
		this.#cursor.x--;
		if(this.#cursor.x < 0) {
			// １つ上の行の右端に
			const width = this.#target.getScreenWidth();
			this.#cursor.x = width - 1;
			if(this.#cursor.y > 0) {
				this.#cursor.y--;
			}
		}
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	/**
	 * カーソル上移動
	 */
	#cursorMoveUp()
	{
		if(this.#cursor.y > 0) {
			this.#cursor.y--;
			// カーソル表示位置を設定
			this.#target.setCursor(this.#cursor.x, this.#cursor.y);
		}
	}

	/**
	 * カーソル下移動
	 */
	#cursorMoveDown()
	{
		this.#cursor.y++;
		const height = this.#target.getScreenHeight();
		if(this.#cursor.y >= height) {
			this.#cursor.y = height - 1;
		}
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	/**
	 * １行編集時のバックスペース
	 * @returns 
	 */
	#backSpaceForLineEdit()
	{
		if(this.#cursor.x <= 0) {
			if(this.#cursor.y <= 0) {
				return; // 画面左上の時は何もしない
			}
			if(!this.#lineContinue[this.#cursor.y - 1]) {
				return; // 上の行の続きではないので、何もしない
			}
			this.#cursor.y--;
			this.#cursor.x = this.#target.getScreenWidth();
		}
		this.#cursor.x--;

		this.#deleteForLineEdit();
	}
	#backSpaceForEdit()
	{
//		let begin = this.#lineBegin(this.#cursor.y);
//		const end = this.#lineEnd(this.#cursor.y);
//		const textEnd = this.#lineTextEnd(this.#cursor.y);
//		this.#lineDebug(begin, end, "_".codePointAt(0));
//		this.#lineDebug(begin, textEnd, "*".codePointAt(0));
//return;
		if(this.#cursor.x <= 0) {
			if(this.#cursor.y <= 0) {
				return; // 画面左上の時は何もしない
			}
			if(!this.#lineContinue[this.#cursor.y - 1]) {
				const end = this.#lineTextEnd(this.#cursor.y - 1); // テキスト末尾の位置を取得
this.#lineContinue[this.#cursor.y - 1] = true; // 行を接続しちゃう
while(end.x != this.#cursor.x || end.y != this.#cursor.y) {
	this.#cursor = this.#addCursor(this.#cursor, -1);

	const width = this.#target.getScreenWidth();
	let textEnd = this.#lineTextEnd(this.#cursor.y);
	this.#deleteForLineEdit();
	textEnd = this.#addCursor(textEnd, -1);
	if(textEnd.x == width - 1) {
		this.#lineContinue[textEnd.y] = false;
	}
}
				return; // 上の行の続きではないので、何もしない
			}
			this.#cursor.y--;
			this.#cursor.x = this.#target.getScreenWidth();
		}
		this.#cursor.x--;

		const width = this.#target.getScreenWidth();
		let textEnd = this.#lineTextEnd(this.#cursor.y);
		this.#deleteForLineEdit();
		textEnd = this.#addCursor(textEnd, -1);
		if(textEnd.x == width - 1) {
			this.#lineContinue[textEnd.y] = false;
		}
	}


	#lineDebug(begin,end,codePoint)
	{
		let b = {x:begin.x, y:begin.y};
		while(end.x != b.x || end.y != b.y) {
			this.#target.setCodePoint(b.x, b.y, codePoint);
			b = this.#addCursor(b, 1);
		}
	}
	#lineDebug_End(y,codePoint)
	{
		let begin = this.#lineBegin(y);
		const end = this.#lineEnd(y);
		this.#lineDebug(begin,end);
	}
	#lineDebug_textEnd(y,codePoint)
	{
		let begin = this.#lineBegin(y);
		const end = this.#lineTextEnd(y);
		this.#lineDebug(begin,end);
	}


	/**
	 * １行編集時のデリート
	 */
	#deleteForLineEdit()
	{
		const begin = this.#cursor;			// カーソル位置
		const end = this.#lineEnd(begin.y); // 行の末尾
		this.#target.removeTop(begin, end); // (begin,end]  (カーソル位置,行の末尾]
											// カーソル位置の所を１文字削除
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	/**
	 * 行の先頭へ移動
	 */
	#ctrlHome()
	{
		const begin = this.#lineBegin(this.#cursor.y);
		this.#cursor.x = begin.x;
		this.#cursor.y = begin.y;
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}
	/**
	 * 行の末尾へ移動
	 */
	#ctrlEnd()
	{
		const textEnd = this.#lineTextEnd(this.#cursor.y);
		this.#cursor.x = textEnd.x;
		this.#cursor.y = textEnd.y;
		// カーソル表示位置を設定
		this.#target.setCursor(this.#cursor.x, this.#cursor.y);
	}

	// -----------------------------------------------------------------------------------------------------------
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * コンストラクタ
	 * @param {{CatTextScreenLayer}} target 制御するテキストレイヤ
	 */
	constructor(target)
	{
		this.#target = target;
		this.#prcnt = 0;
		this.#cursor = {x:0, y:0};
		this.#lineContinue = new Array(this.#target.getScreenHeight());
		this.#target.setCursor(0, 0);
	}

	/**
	 * スクリーンサイズを変更する
	 * 
	 * ・カーソル位置は、左上(0,0)に設定される。
	 * ・次の行に続いているかどうかのフラグは、リセットされる
	 * @param {number} width 横幅(キャラクタ単位)
	 * @param {number} height 高さ(キャラクタ単位)
	 */
	changeScreenSize(width, height) {
		this.#target.changeScreenSize(width, height);
		this.#target.setCursor(0, 0);
		this.#prcnt = 0;
		this.#cursor = {x:0, y:0};
		this.#lineContinue = new Array(this.#target.getScreenHeight());
	}

	/**
	 * １文字出力する
	 * @param {number_Or_string} codePoint UTF-32の文字、または、制御文字列
	 */
	putch32(codePoint)
	{
		// 文字数カウンタ更新
		this.#prcnt++;
		// カーソルが画面下外ならスクロールする
		const height = this.#target.getScreenHeight();
		if(this.#cursor.y >= height) {
			this.#cursor.y = height - 1;
			this.#scroll();
		}
		//
		if(!this.#controlCharacter.has(codePoint)) {
			// 通常文字を出力
			this.#target.setCodePoint(this.#cursor.x, this.#cursor.y, codePoint);
			// １文字進める
			this.#advanceCursor();
		} else {
			// 制御文字
			this.#controlCharacter.get(codePoint)(this);
		}
	}

	/**
	 * 指定位置の文字を取得する
	 * @param {number} x x座標(キャラクタ単位)
	 * @param {number} y y座標(キャラクタ単位)
	 * @return {number} 文字(UTF-32)
	 */
	getCodePoint(x, y) { return this.#target.getCodePoint(x, y); }


	/**
	 * 描画（するときに設定するHTML文字列の生成）
	 * @returns {string} HTMLに設定する文字列
	 */
	draw() { return this.#target.draw(); }

	/**
	 * テキストスクリーンの横幅を取得する
	 * @returns {number} テキストスクリーンの横幅(キャラクタ単位)
	 */
	getScreenWidth() { return this.#target.getScreenWidth(); }

	/**
	 * テキストスクリーンの高さを取得する
	 * @returns {number} テキストスクリーンの高さ(キャラクタ単位)
	 */
	getScreenHeight() { return this.#target.getScreenHeight(); }

	/**
	 * カーソル位置を設定する
	 * @param {number} x カーソル位置
	 * @param {number} y カーソル位置
	 */
	setCursor(x, y)
	{
		this.#cursor.x = x;
		this.#cursor.y = y;
		this.#target.setCursor(x, y);
	}

	/**
	 * カーソル位置を取得する
	 * @returns {{x:number, y:number}} カーソル位置
	 */
	getCursor() { return {x: this.#cursor.x, y: this.#cursor.y}; }

	/**
	 * 描画色を設定する
	 * @param {number} rgba 描画色
	 */
	setColor(rgba) { this.#target.setColor(rgba); }

	/**
	 * 描画色を取得する
	 * @returns {number} rgba 描画色
	 */
	getColor() { return this.#target.getColor(); }

	/**
	 * 指定位置の文字の色を設定する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @param {number} color 色
	 */
	setTextColor(x, y, color) { this.#target.setTextColor(x, y, color); }

	/**
	 * 指定位置の色を取得する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @returns {number} 色
	 */
	getTextColor(x, y) { return this.#target.getTextColor(x, y); }

	/**
	 * 文字の属性を設定する
	 * @param {number} attr 文字の属性
	 */
	setAttr(attr) { this.#target.setAttr(attr); }

	/**
	 * 文字の属性を取得する
	 * @returns {number} 文字の属性
	 */
	getAttr() { return this.#target.getAttr(); }

	/**
	 * 指定位置の属性を取得する
	 * @param {number} x x座標
	 * @param {number} y y座標
	 * @returns {number} 属性
	 */
	getTextAttr(x,y) { return this.#target.getTextAttr(x, y); }

	/**
	 * カーソルのある行のテキストを取得する
	 * @param {number} layer レイヤ番号
	 * @returns {string} １行の文字列
	 */
	getLine() {
		const y = this.getCursor().y;
		let begin = this.#lineBegin(y);   // 開始位置
		const end = this.#lineTextEnd(y); // 終了位置
		let text = '';
		while(begin.x != end.x || begin.y != end.y) {
			let codePoint = this.#target.getCodePoint(begin.x, begin.y);
			if(codePoint < 0x20) {
				codePoint = 0x20;
			}
			text += String.fromCodePoint(codePoint);
			begin = this.#addCursor(begin, 1); // 1文字進める
		}
		return text
	}

	/**
	 * テキストが更新されたかどうかを取得する
	 * @returns {boolean} 更新された場合は true を返す
	 */
	isModified() { return this.#target.isModified(); }

	/**
	 * カーソルを表示するかどうかを設定する
	 * @param {boolean} display カーソルを表示するかどうか
	 */
	setDisplayCursor(display) {
		this.#target.setDisplayCursor(display);
	}

	/**
	 * スペース(U+0020)を全角扱いにするかどうかを設定する
	 * @param {boolean} spaceFull 全角扱いするならtrue
	 */
	setSpaceFull(spaceFull)
	{
		this.#target.setSpaceFull(spaceFull);
	}
}
