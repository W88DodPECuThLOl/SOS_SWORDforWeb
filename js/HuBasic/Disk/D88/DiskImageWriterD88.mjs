import { D88 } from './D88Types.mjs';
import { DataController } from '../DataController.mjs';
import { DiskTypeEnum } from '../DiskTypeEnum.mjs';

/**
 * D88形式のディスクイメージの書き込み
 */
export class DiskImageWriterD88 {
	/**
	 * 文字列を配列に変換する
	 * 
	 * ・配列の最後の要素は0に設定される
	 * @param {string} text 変換する文字列
	 * @param {number} length 配列のサイズ
	 * @returns {Uint8Array} 配列
	 */
	#toArray(text, length)
	{
		const array = new Uint8Array(length);
		for(let i = 0; i < length; ++i) {
			if(i < text.length) {
				array[i] = text.codePointAt(i);
			} else {
				array[i] = 0;
			}
		}
		array[length - 1] = 0;
		return array;
	}

	/**
	 * ディスクの種類の値を取得する
	 * @returns {number} DiskTypeEnum
	 */
	#ConvertD88ImageType(imageType) {
		//   2D: 0x00
		//  2DD: 0x10
		//  2HD: 0x20
		//   1D: 0x30
		//  1DD: 0x40
		switch (imageType) {
			case DiskTypeEnum.Disk2D: return 0x00;
			case DiskTypeEnum.Disk2DD: return 0x10;
			case DiskTypeEnum.Disk2HD: return 0x20;
			case DiskTypeEnum.Disk1D: return 0x30;
			case DiskTypeEnum.Disk1DD: return 0x40;
			default: // 不明
				return 0x00;
		}
	}

	/**
	 * D88のヘッダ部分を書き込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {string} diskName ディスクの名前
	 * @param {boolean} isWriteProtect ライトプロテクトかどうか
	 * @param {SectorData[]} sectors セクタ
	 * @param {DiskType} diskType ディスクの種類
	 * @returns {boolean} 処理結果
	 */
	#WriteD88Header(fs, diskName, isWriteProtect, sectors, diskType) {
		// ディスクイメージのサイズとトラックの位置を設定
		let imageSize = D88.D88HeaderSize; // ディスクイメージのサイズ
		const trackAddress = new Array(); // トラックのディスクイメージ上の位置
		for(let sector of sectors) {
			// 最初のセクタで設定する
			// @todo あってる？
			if(sector.GetSector() == 0x01) { trackAddress.push(imageSize); }
			imageSize += D88.D88SectorHeaderSize + sector.GetDataForRead().length; // ヘッダ＋セクタのデータサイズ
		}
		if(trackAddress.length > D88.D88MaxTrack) {
			return false; // トラックが多い
		}

		// ヘッダ部分
		let header = new Uint8Array(D88.D88HeaderSize);
		const dc = new DataController(header);
		// D88のヘッダ部分に記録されているディスクの名前
		// ・17バイト(16バイト+終端文字1バイト)  
		// ・ディスクの名前(ASCII + '\0')
		dc.SetCopy(0, this.#toArray(diskName,16+1));
		// ライトプロテクト
		dc.SetByte(0x1a, isWriteProtect ? 0x10 : 0x00);
		// ディスクの種類
		dc.SetByte(0x1b, this.#ConvertD88ImageType(diskType.GetImageType()));
		// ディスクイメージのサイズ（バイト単位）
		dc.SetLong(0x1c, imageSize);
		// トラックのアドレス
		for (let i = 0; i < D88.D88MaxTrack; i++) {
			if (i < trackAddress.length) {
				dc.SetLong(D88.D88TrackOffset + (i * 4), trackAddress[i]);
			} else {
				// トラックがないので0
				dc.SetLong(D88.D88TrackOffset + (i * 4), 0);
			}
		}

		// ヘッダ書き込み
		fs.Write(header, 0, header.length);
		return true;
	}

	/**
	 * セクタのヘッダ部分とデータ部分を結合し取得する
	 * @param {SectorData} sector セクタ
	 * @returns {Uint8Array} セクタのヘッダ部分とデータ部分を結合したもの
	 */
	#GetSectorHeaderAndData(sector) {
		const sectorData = sector.GetDataForRead(); // セクタのデータ
		const result = new Uint8Array(D88.D88SectorHeaderSize + sectorData.length);
		// D88セクタのヘッダ部分設定
		const dc = new DataController(result);
		dc.SetByte(0, sector.GetCylinder());
		dc.SetByte(1, sector.GetSide());
		dc.SetByte(2, sector.GetSector());
		dc.SetByte(3, sector.GetSectorSize());
		dc.SetWord(4, sector.GetSectorsInTrack());
		dc.SetByte(6, sector.GetDensity());
		dc.SetByte(7, sector.GetDelete());
		dc.SetByte(8, sector.GetStatus());
		dc.SetWord(0x0e, sector.GetDataSize());
		// セクタのデータ設定
		result.set(sectorData, D88.D88SectorHeaderSize);
		return result;
	}

	/**
	 * D88形式のセクタ書き込み
	 * @param {Stream} fs ファイルストリーム
	 * @param {SectorData[]} sectors セクタ
	 * @returns {boolean} 処理結果
	 */
	#WriteD88Sectors(fs, sectors) {
		sectors.forEach(sector => {
			const srctorData = this.#GetSectorHeaderAndData(sector);
			fs.Write(srctorData, 0, srctorData.length);
		});
		return true;
	}

	/**
	 * D88形式でディスクイメージを書き込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {DiskImage} diskImage ディスクイメージ
	 * @return {boolean} 処理結果
	 */
	write(fs, diskImage)
	{
		// D88のヘッダ部分を書き込む
		if(!this.#WriteD88Header(fs, diskImage.GetDiskName(), diskImage.GetWriteProtect(), diskImage.GetSectors(), diskImage.GetDiskType())) {
			return false;
		}
		// D88形式のセクタを書き込む
		return this.#WriteD88Sectors(fs, diskImage.GetSectors());
	}

	/**
	 * 書き出したときのファイルサイズを取得する
	 * @param {DiskType} diskType イメージの種類
	 * @returns {number} 書き出したときのファイルサイズ
	 */
	getDiskImageFileSize(diskType)
	{
		return D88.D88HeaderSize + diskType.GetMaxTrackSize() * diskType.GetTrackPerSector() * (diskType.GetDataSize() + D88.D88SectorHeaderSize);
	}
}
