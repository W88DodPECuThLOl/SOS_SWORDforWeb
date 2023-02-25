/**
 * 生ディスクイメージの書き込み
 */
export class DiskImageWriterRaw {
	/**
	 * 生のセクタ書き込み
	 * @param {Stream} fs ファイルストリーム
	 * @returns {boolean} 処理結果
	 */
	#WriteRawSectors(fs, sectors) {
		for(let sector of sectors) {
			const srctorData = sector.GetDataForRead(); // セクタの生データ取得
			fs.Write(srctorData, 0, srctorData.length); // 書き込む
		}
		return true;
	}

	/**
	 * 生ディスクイメージを書き込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {DiskImage} diskImage ディスクイメージ
	 * @returns {boolean} 処理結果 読み込めたら true を返す
	 */
	write(fs, diskImage)
	{
		// 生のセクタを書き込む
		return this.#WriteRawSectors(fs, diskImage.GetSectors());
	}

	/**
	 * 書き出したときのファイルサイズを取得する
	 * @param {DiskType} diskType イメージの種類
	 * @returns {number} 書き出したときのファイルサイズ
	 */
	getDiskImageFileSize(diskType)
	{
		return diskType.GetMaxTrackSize() * diskType.GetTrackPerSector() * diskType.GetDataSize();
	}
}
