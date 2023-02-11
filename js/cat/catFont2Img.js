class CatFont2Img {
	constructor()
	{
	}

	cfg = {
		fontSize: 16,
		scale: 5,

		fontWidthScale: 0.5,
		fontHeightScale: 1,
		offsetX: 2,
		offsetY: 2,
		stepY: 2
	};

	drawMoji(canvas, fontFamily, codePoint)
	{
		const cfg = this.cfg;

		const fontSize = cfg.fontSize;
		const width = fontSize;
		const height = fontSize;
		const scale = cfg.scale;
		const baseLine = height * scale;

		canvas.setAttribute("width", width * scale);
		canvas.setAttribute("height", height * scale);
		const ctxCanvasFont = canvas.getContext('2d', {willReadFrequently: true});  // CanvasRenderingContext2D
		
		ctxCanvasFont.font = (fontSize * scale) + 'px ' + fontFamily;
		ctxCanvasFont.fillStyle = 'rgba(255, 255, 255, 255)';
		const text = String.fromCodePoint(codePoint);
		ctxCanvasFont.fillText(text, 0, baseLine);
		return ctxCanvasFont;
	}

	convertToImage(renderingContext)
	{
		const cfg = this.cfg;

		const fontSize = cfg.fontSize;
		const width = fontSize * cfg.fontWidthScale;
		const height = fontSize * cfg.fontHeightScale;
		const scale = cfg.scale;
		const offsetX = cfg.offsetX;
		const offsetY = cfg.offsetY;
		const stepY = cfg.stepY;

		const pattern = new Uint8Array(24);
		const imgData = renderingContext.getImageData(0, 0, width * scale, height * scale);
		// 各ピクセルの色情報設定（下位8ビット反転）
		//let test = "";
		let yy = 0;
		for (let y = 0; y < height; y += stepY) {
			for (let x = 0; x < width; ++x) {
				const r = imgData.data[(x * scale + offsetX) * 4 + (y * scale + offsetY) * imgData.width * 4];
				const g = imgData.data[(x * scale + offsetX) * 4 + (y * scale + offsetY) * imgData.width * 4 + 1];
				const b = imgData.data[(x * scale + offsetX) * 4 + (y * scale + offsetY) * imgData.width * 4 + 2];
				pattern[yy     ] |= (b > 128) ? (0x80 >> x) : 0;
				pattern[yy +  8] |= (g > 128) ? (0x80 >> x) : 0;
				pattern[yy + 16] |= (r > 128) ? (0x80 >> x) : 0;
				//test += (r > 128) ? "*" : "_";
			}
			yy++;
			//test += "\n";
		}
		//console.log(test);
		return pattern;
	}

	cnv(canvas, fontFamily, codePoint) {
		return this.convertToImage(this.drawMoji(canvas, fontFamily, codePoint));
	}
}