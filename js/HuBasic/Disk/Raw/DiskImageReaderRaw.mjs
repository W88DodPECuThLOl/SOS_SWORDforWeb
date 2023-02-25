import { SectorData } from '../SectorData.mjs';
import { LogType } from '../../Utils/LogType.mjs';

/**
 * 生ディスクイメージの読み込み
 */
export class DiskImageReaderRaw {
	/**
	 * 生のセクタ読み込み
	 * @param {Stream} fs ファイルストリーム
	 * @returns {boolean} 正常に読み込めたら true を返す
	 */
	#ReadRawSectors(fs, diskImage)
	{
		const Log = diskImage.GetLog();
		const Sectors = diskImage.GetSectors(); // セクタ
		const diskType = diskImage.GetDiskType();

		// 各トラックで読み込む
		const maxTrackSize = diskType.GetMaxTrackSize(); // 最大トラック数
		const trackPerSector = diskType.GetTrackPerSector(); // １トラックあたりのセクタ数
		const density = diskType.GetDensity(); // 記録密度
		const dataSize = diskType.GetDataSize(); // データサイズ
		const sectorSize = dataSize >> 8; // セクタサイズ(N)
		const isDelete = false;
		const status = 0x00;
		// デバッグ
		Log.AddLog(LogType.Debug, "ディスクタイプ:" + diskType.GetImageTypeName());
		Log.AddLog(LogType.Debug, "最大トラック数:" + maxTrackSize);
		Log.AddLog(LogType.Debug, "１トラックあたりのセクタ数:" + trackPerSector);
		Log.AddLog(LogType.Debug, "記録密度:" + density);
		Log.AddLog(LogType.Debug, "データサイズ:" + dataSize + " セクタサイズ(N):" + sectorSize);
		//
		const imageType = diskType.GetImageType();
		if(imageType != 0x00 && imageType != 0x10 && imageType != 0x20) {
			if(imageType == 0x30 || imageType == 0x40) {
				Log.Error("未対応のディスクの種類(1D、1DD)です。header[0x1b]:" + imageType);
			} else {
				Log.Error("ディスクの種類が不正です。0x00か0x10か0x20の値を想定しています。header[0x1b]:" + imageType);
			}
			return false;
		}
		//
		Sectors.length = 0;
		for(let track=0; track < maxTrackSize; ++track) {
			// @todo ここの扱いが不明。トラック＝クラスタではなく、２トラックで１クラスタとなっているっぽい？
			//       表、裏で1クラスタになっているっぽい
			const cylinder = track / 2 | 0; // シリンダ(C)(0～)
			const side = track & 1; // サイド(H)(0:表面 1:裏面)
			for(let i = 1; i <= trackPerSector; ++i) {
				// セクタ読み込み
				let Sector = new SectorData();
				if (!Sector.ReadRaw(fs, cylinder, side, i, sectorSize, trackPerSector, density, isDelete, status, dataSize)) {
					Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ");
					return false;
				}
				Sectors.push(Sector);
			}
		}
		return true;
	}

	/**
	 * 生ディスクイメージを読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {DiskImage} diskImage ディスクイメージ
	 * @returns {boolean} 処理結果 読み込めたら true を返す
	 */
	read(fs, diskImage) {
		// 色々設定
		diskImage.SetDiskName(fs.GetFilename()); // ディスクの名前
		diskImage.SetWriteProtect(false); // ライトプロテクト無し

		// 生のセクタ読み込み
		return this.#ReadRawSectors(fs, diskImage);
	}
}
