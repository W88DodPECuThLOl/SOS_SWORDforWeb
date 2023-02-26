import { D88 } from './D88Types.mjs';
import { DataController } from '../DataController.mjs';
import { SectorData } from '../SectorData.mjs';
import { LogType } from '../../Utils/LogType.mjs';

/**
 * D88形式のディスクイメージの読み込み
 */
export class DiskImageReaderD88 {
	/**
	 * セクタのヘッダ部分を読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @returns {boolean} 読み込めたかどうか
	 */
	#readD88SectorHeader(fs, sector) {
		// ヘッダ部分読み込み
		const header = new Uint8Array(D88.D88SectorHeaderSize);
		if (fs.Read(header, 0, D88.D88SectorHeaderSize) != D88.D88SectorHeaderSize) { return false; }
		// 設定
		const dc = new DataController(header);
		sector.ReadRaw(fs,
			dc.GetByte(0),  // シリンダ(C)(0～)
			dc.GetByte(1),  // サイド(H)(0:表面 1:裏面)
			dc.GetByte(2),  // セクタ(R)(1～) ※注意 １オリジン
			dc.GetByte(3),	// セクタサイズ(N)
			dc.GetWord(4),  // このトラック内に存在するセクタの数
			dc.GetByte(6),	// 記録密度(0x00:倍密度 0x40:単密度 0x01:高密度)
			dc.GetByte(7) != 0x00, // 削除マーク
			dc.GetByte(8), // ステータス
			dc.GetWord(0x0e) // データサイズ（バイト単位）
		);
		return true;
	}

	/**
	 * D88形式のセクタ読み込み
	 * @param {Stream} fs ファイルストリーム
	 * @returns {boolean} 正常に読み込めたら true を返す
	 */
	#readD88Sectors(fs, diskImage, sectors, trackAddress)
	{
		const Log = diskImage.GetLog();
		sectors.length = 0;

		// 各トラック毎にセクタを読み込む
		for(let track=0; track < D88.D88MaxTrack; ++track) {
			// @todo ここの扱いが不明。トラック＝クラスタではなく、２トラックで１クラスタとなっているっぽい？
			//       表、裏で1クラスタになっているっぽい
			const Cylinder = track / 2 | 0; // シリンダ

			const SectorAddress = trackAddress[track]; // セクタの開始位置
			Log.AddLog(LogType.Debug, track + ": トラック部のオフセット:0x" + (SectorAddress).toString(16));
			if(SectorAddress == 0) {
				// トラックが無い
				continue;
			}
			if (SectorAddress < D88.D88HeaderSize) {
				Log.Error("トラック部分のアドレスが不正です。 Track:" + track + " トラック部分のアドレス:0x" + (SectorAddress).toString(16));
				return false;
			}
			// 頭出し
			fs.Seek(SectorAddress);

			// １個目のセクタ読み込み
			let Sector = new SectorData();
			if (!this.#readD88SectorHeader(fs, Sector)) {
				// 読み込み失敗
				Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:トラック最初のセクタ");
				return false;
			}
			if(Cylinder != Sector.GetCylinder()) {
				Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:トラック最初のセクタ クラスタ番号とセクタヘッダ部分のクラスタ番号が不一致 セクタヘッダ部分のクラスタ:" + Sector.GetCylinder());
				return false;
			}
			sectors.push(Sector);

			// デバッグ 読み込んだセクタのヘッダ部分をログに出力
			// Sector.Description();

			// ２個目以降のセクタ読み込み
			const sectorsInTrack = Sector.GetSectorsInTrack(); // 最初のセクタの情報で、トラック内のセクタを読み込むようにしてみる
			for(let i = 1; i < sectorsInTrack; ++i) {
				Sector = new SectorData();
				if (!this.#readD88SectorHeader(fs, Sector)) {
					// 読み込み失敗
					Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ");
				}
				// デバッグ 読み込んだセクタのヘッダ部分をログに出力
				//Sector.Description();
				if(sectorsInTrack != Sector.GetSectorsInTrack()) {
					// セクタヘッダの不一致 トラック中のセクタ数が違う
					Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ セクタヘッダの不一致、トラック中のセクタ数が違う。 sectorsInTrack:" + sectorsInTrack + " " + Sector.GetSectorsInTrack());
					return false;
				}
				if(Cylinder != Sector.GetCylinder()) {
					Log.Error("セクタの読み込みに失敗しました。Track:" + track + " Sector:" + i + "番目のセクタ トラック番号とセクタヘッダ部分のクラスタ番号が不一致 セクタヘッダ部分のクラスタ:" + Sector.GetCylinder());
					return false;
				}
				sectors.push(Sector);
			}
		}
		return true;
	}

	/**
	 * 配列を文字列に変換する
	 * @param {Uint8Array} array 変換する配列
	 * @returns {string} 変換後の文字列
	 */
	#toString(array)
	{
		let text = "";
		for(let ch of array) {
			if(ch == 0) { break; }
			text += String.fromCodePoint(ch);
		}
		return text;
	}

	/**
	 * D88のヘッダ部分を読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {DiskImage} diskImage ディスクイメージ
	 * @return {boolean} 処理結果 読み込めたら true を返す
	 */
	#readD88Header(fs, diskImage, trackAddress) {
		const Log = diskImage.GetLog();

		// --------------------
		// ヘッダ部分読み込み
		// --------------------
		const header = new Uint8Array(D88.D88HeaderSize);
		if(fs.Read(header, 0, D88.D88HeaderSize) != D88.D88HeaderSize) {
			Log.Error("ディスクイメージサイズが不正です。ヘッダ部分を読み込めませんでした。" + fs.GetSize());
			return false;
		}

		let dc = new DataController(header);
		// D88のヘッダ部分に記録されているディスクの名前
		// ・17バイト(16バイト+終端文字1バイト)  
		// ・ディスクの名前(ASCII + '\0')
		diskImage.SetDiskName(this.#toString(dc.Copy(0, 17)));
		// ライトプロテクト 0x00 なし、0x10 あり
		diskImage.SetWriteProtect(dc.GetByte(0x1a) != 0x00);
		// ディスクの種類
		//   2D: 0x00
		//  2DD: 0x10
		//  2HD: 0x20
		//   1D: 0x30
		//  1DD: 0x40
		const diskType = dc.GetByte(0x1b);
		diskImage.GetDiskType().SetImageTypeFromHeader(diskType); // ディスクの種類から色々設定する
		// ディスクのサイズ(4バイト)
		const D88ImageSize = dc.GetLong(0x1c);

		// デバッグ
		Log.AddLog(LogType.Debug, "ディスクの名前:" + diskImage.GetDiskName() + "(" + diskType.toString(16) + ")");
		Log.AddLog(LogType.Debug, "ライトプロテクト:" + dc.GetByte(0x1a));
		Log.AddLog(LogType.Debug, "ディスクの種類:" + diskImage.GetDiskType().GetImageTypeName() + "(diskType:" + diskType + ")");
		Log.AddLog(LogType.Debug, "ディスクのサイズ:" + D88ImageSize);

		// D88ヘッダ部分のチェック
		if(dc.GetByte(16) != 0) {
			Log.Error("ディスクの名前が不正です");
		}
		if(diskType != 0x00 && diskType != 0x10 && diskType != 0x20 && diskType != 0x30 && diskType != 0x40) {
			Log.Error("ディスクの種類が不正です。header[0x1b]:" + diskType);
			return false;
		}
		if(D88ImageSize < fs.GetSize()) {
			Log.Error("ディスクのサイズが不正です。header[0x1c]:" + D88ImageSize + " ディスクイメージのサイズ:" + fs.GetSize());
			return false;
		}

		// トラックのオフセット
		for (let i = 0; i < D88.D88MaxTrack; i++) {
			trackAddress[i] = dc.GetLong(D88.D88TrackOffset + (i * 4));
			// 値のチェック
			if((trackAddress[i] != 0) && (trackAddress[i] < D88.D88HeaderSize)) {
				Log.Error("トラックオフセットが不正です。" + i + "番目 値:" + trackAddress[i]);
				return false;
			}
			if(trackAddress[i] >= D88ImageSize) {
				Log.Error("トラックオフセットが不正です。" + i + "番目 値:" + trackAddress[i]);
				return false;
			}
		}
		return true;
	}

	/**
	 * D88形式のディスクイメージを読み込む
	 * @param {Stream} fs ファイルストリーム
	 * @param {DiskImage} diskImage ディスクイメージ
	 * @returns {boolean} 処理結果 読み込めたら true を返す
	 */
	read(fs, diskImage) {
		// D88のヘッダ部分を読み込む
		const trackAddress = new Array(D88.D88MaxTrack);
		if(!this.#readD88Header(fs, diskImage, trackAddress)) {
			return false; // ヘッダ部分、読み込めなかった
		}
		// D88形式のセクタ読み込み
		return this.#readD88Sectors(fs, diskImage, diskImage.GetSectors(), trackAddress);
	}
}
