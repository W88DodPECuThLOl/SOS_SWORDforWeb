# Change log

## 既知のバグ

- 変なカーソルが表示されてしまう... :crying_cat_face:

## [0.00.03] - 2023-03

- S-OS"SWORD" for Web
  - 音量がPSGやFM音源に反映されていなかったのを修正
  - mzt形式のファイルを読み込めるように
- S-OS標準モニタ
  - ファンクションキー対応
  - Cコマンド
    - ファンクションキーの内容の表示、非表示の切り替え
  - Dコマンド
    - ファイル名部分をSHIFTキーを押下しながらクリックで、ファイルを保存するように
      - SHIFTキーのみのときは、S-OS形式の18バイトヘッダ付きで保存
      - SHIFTキーとCTRLキー両方押下のときは、ヘッダを付けずにそのままでファイルで保存
- S-OS サブルーチン
  - [S-OS #INP](https://github.com/W88DodPECuThLOl/SOS_SWORDforWeb/wiki/S%E2%80%90OS-Subroutines#inp0x202a)
    - 実装
  - [S-OS #OUT](https://github.com/W88DodPECuThLOl/SOS_SWORDforWeb/wiki/S%E2%80%90OS-Subroutines#out0x202d)
    - 実装
  - [S-OS #SDVSW](https://github.com/W88DodPECuThLOl/SOS_SWORDforWeb/wiki/S%E2%80%90OS-Subroutines#sdvsw0x2027)
    - デバイス名に応じて、#DVSWを設定するように修正
  - [S-OS #ERROR](https://github.com/W88DodPECuThLOl/SOS_SWORDforWeb/wiki/S%E2%80%90OS-Subroutines#error0x2033)
    - エラーコードが範囲外であった場合、  
      "Error $xx"のように、エラーコードを16進数2桁で表示するように修正
- Z80 Emu
  - R800の乗算命令（mulub、muluw）を追加
    - (ED C1) mulub a, b   ; hl = a * b
    - (ED C9) mulub a, c   ; hl = a * c
    - (ED D1) mulub a, d   ; hl = a * d
    - (ED D9) mulub a, e   ; hl = a * e
      - フラグの変化 S:0 PV:0 Z:結果が0の時セット C:結果が8ビットに納まらないときセット
      - 14 T states + wait time
    - (ED C3) muluw hl, bc ; de:hl = hl * bc
    - (ED C3) muluw hl, sp ; de:hl = hl * sp
      - フラグの変化 S:0 PV:0 Z:結果が0の時セット C:結果が16ビットに納まらないときセット
      - 36 T states + wait time
- Base Platform
  - X1
    - IO $1Ax3 8255 Control Bit set/reset
      - ビットセットとリセットの部分が間違っていたのを修正
    - IO $0B00 Memory Bank Switch
      - バンクメモリ #0～#15を実装
  - MZ700
    - 実装
      - IO $E0～$E6 Bank Switch
      - IO $F0 Text/PCG Priority
      - IO $F1 Palette
      - MEM VRAM/IO BANK
        - $D000～$D3FF Text VRAM
        - $D400～$D7FF PCG VRAM1
        - $D800～$DBFF Attribute VRAM
        - $DC00～$DFFF PCG VRAM2
        - $E000 8255 Port A KEYSTROBE
        - $E001 8255 Port B
        - $E002 8255 Port C VBLK
        - $E003 8255 Control Bit set/reset
        - $E004～$E007 8253
        - $E008 HBLK
      - MEM CG-ROM BANK
      - MEM PCG-RAM BANK

## [0.00.02] - 2023-02
- S-OS"SWORD" for Web
  - 下部に各種メニューを追加しUIを整理
  - 全画面に切り替えられるように
  - ローカルストレージ対応
    - 参考 https://twitter.com/boyahina/status/1620251286984859648  
    ぼや(@boyahina)様、感謝
  - 使用しているメモリ容量を削減しました
    - 256MiBから16MiBに
  - FireFoxだとX1風フォント、PC8001風フォントが一部正常に描画されない不具合を修正しました
  - S-OS用のフック範囲（0x0100～0x017F）が変更された場合、それ以降S-OSのサブルーチンの処理を行わないようにしました
  - 画面更新のタイミングを調整しました
    - 画面の更新タイミングを約1/60秒単位で行うように
    - 経過時間を元にCPUをエミュレートするようにしました
  - ファイルアクセス（JavaScript側）
    - D88形式のディスク自体のライトプロテクトに対応しました
    - 物凄くリファクタリング
- プラットフォームモニタ
  - メモリ内容を変更するSコマンドを実装
  - 40桁表示時のDコマンド(メモリダンプ)にチェックサムを表示するようにしました
- Z80 Emu
  - ED 00 n ; IN0 B,(n)  
    で停止していたのを、無視するように修正しました
- S-OS サブルーチン
  - S-OS #WOPENおよびS-OS #WRDが、正常に動作しない場合があったのを修正
    - S-OS #FRESCH 空きクラスタを検索するDOS関数で、最初の16個しか検索していなかったのを修正
  - S-OS #2HEX １文字目で変換に失敗したときの挙動を修正
    - １文字目で変換に失敗した場合は、DEレジスタの値を1つだけ加算するように修正
      - 備考）２文字目で失敗した場合は、DEレジスタの値は2つ加算
  - S-OS #HLHEX エラーになった場合のDEレジスタの値を修正
    - １文字目で変換に失敗した場合は、DEレジスタの値を1つだけ加算
    - ２文字目で変換に失敗した場合は、DEレジスタの値を2つだけ加算～以下略
  - S-OS DOS #FRECLU
    - 空きクラスタ検索処理が間違っていたのを修正
  - S-OS DOS #FCGET
    - 空きクラスタ検索処理が間違っていたのを修正
  - S-OS DOS #DEBUFに値を書き込むように修正
    - 参考 https://twitter.com/boyahina/status/1626962925016731650  
    ぼや(@boyahina)様、感謝
  - S-OS DOS #HLBUFに値を書き込むように修正
    - 参考 https://twitter.com/boyahina/status/1626962925016731650  
    ぼや(@boyahina)様、感謝
  - S-OS DOS #NXCLSTに値を書き込むように修正
    - 参考 https://twitter.com/boyahina/status/1626965382094524416  
    ぼや(@boyahina)様、感謝
  - S-OS DISK #DREADを実装
    - Z80側から呼び出せるように修正
  - S-OS DISK #DWRITEを実装
    - Z80側から呼び出せるように修正
- IO
  - PCG定義
    - PCGの定義に対応しました
    - 高速PCG定義に対応しました
    - フォントをCG ROMに設定するようにしました
      - CG ROMからの読み込みができるようになった
  - $2000～$27FF($2800～$2FFF) テキスト属性
    - PCG、反転、色に対応しました
  - $3000～$37FF テキスト
    - 何か書き込まれた場合は、表示するようにしました
  - $1Ax1 bit7
    - 垂直帰線期間信号の処理を変更
      - SLANGのPSGがVSYNCモードで再生されるようになった
  - $1Ax2 bit5
    - 同時アクセスモード実装
  - $1Ax3
    - ビットアクセスモードのみ実装
  - $0700～$0701 $0708～$0709
    - FM音源を実装
  - $070C～$070F
    - Z80 CTCを実装
- 変身セット
  - Eドライブ(RAM DISK)を追加
    - **未フォーマット時**80クラスタ
    - 起動時に自動的にフォーマットされる
    - FAT位置などは2Dディスクと同じ
    - S-OS #DSKCHK Eドライブの対応
    - S-OS #ETRK($20FF)　Eドライブの未フォーマット時のクラスタ数を追加
  - S-OS標準モニタ
    - バッチ処理のコマンド内容を表示するように修正
    - Jコマンド
      - キーボードバッファにコマンドをコピーするように修正
      - DEレジスタに<アドレス>の次のアドレスを設定するように修正  
        例) "#J3000:hogehoge"だったら「:」のアドレス
    - RUNコマンド(スペース)
      - バイナリファイル
        - キーボードバッファにコマンドをコピーするように修正
        - 戻り値でキャリフラグが立っていたら、Aレジスタの値でエラーメッセージを表示するように修正
        - 読み込みアドレスが$3000で、かつ、サイズが$1C00以下の場合、トランジェントする機能を実装
          - Z80からは見えない領域を使用  
            ※オリジナルはRAMディスクの未使用領域を使用していた
          - トランジェントの状態をS-OS #COMF($1F0E)に設定するように
      - アスキーファイル（サブミット）
        - S-OS #GETL バッチ処理に対応（アスキーファイルからの1行入力）
        - S-OS #FLGET バッチ処理に対応（アスキーファイルからの1文字入力）
        - パラメータの置き換えを実装
          - アスキーファイル内の文字"\1"～"\9"を、与えられたパラメータで置き換えます
        - 「\0」の実装
          - "\0"以降の１行を無視し、一時的にユーザ入力を行う
    - AUTO EXECUTEを実装
      - URLパラメータでディスクイメージが設定されていた場合、「AUTOEXEC.BAT」を実行するように
  - S-OS #ERROR Aレジスタが0の場合は、何も表示しないように修正

## [0.00.01] - 2023-01
- IO Z80 CTC $1FA0～$1FA3
  - CPUとCTCのクロックによる同期を修正
    - 「OUT (C),A直後にIN A,(C)」で正しくDownCounterが取得できるようになった
- IO AY-3-8910 $1Bxx～$1Cxx
  - ジョイスティック１（ゲームパッド）に対応
- IO 8255 $1Ax1
  - ポートB 7bit 垂直帰線期間信号 実装中……
- S-OS #DRDSBを呼び出すとフリーズしていたのを修正
- S-OS #ROPENで、IBを設定するように修正
  - IBを参照しているものの対応
- S-OS #GETPCが正常に動作していなかったのを修正
- S-OS #HLが正常に動作していなかったのを修正
- S-OS #HLHEXが正常に動作していなかったのを修正
- S-OS #SCRNで画面外が指定されていた場合、Bad Dataエラーを設定するように変更
- S-OS #SCRNで取得した文字コードが0x20未満の場合、0x20にするように変更
- S-OS #LOCで画面外が指定されていた場合、キャリフラグを立て、Bad Dataエラーを設定するように修正
- S-OS #VER 機種を28hに変更
- S-OS #MON実装
- S-OS #RDVSWが間違っていたのを修正
- S-OS #SDVSWが間違っていたのを修正
- S-OS #MCOM($211B) ※DOS部分のサブルーチン
  - DEレジスタにS-OS標準モニタのコマンド文字列(終端$00)のアドレスを入れ呼び出すと、コマンドを実行する
  - エラー時には、キャリをセットしAレジスタにエラーコードが格納される
- S-OS #BELL実装
  - NRTDRVからBEEP音のファイルを使用させていただきました。感謝。  
  ⇒ http://nrtdrv.sakura.ne.jp/index.cgi?page=FrontPage
- S-OS標準モニタ ファイルアクセス部分の修正
  - メディアタイプが2Dの場合、FATの後半128バイトは無視するように修正
    - Oh!石(@oec_Nibbleslab)様、いろまげんくてい(@stmlad)様、感謝。
  - ※**2Dのみ対応、他のメディアタイプは対応していません**
- S-OS標準モニタ 空白＋ファイル名で、かつ、ファイルがバイナリの場合、  
  DEレジスタに、ファイル名後の文字列のアドレスを設定するように修正  
  「#  HOGE:AAA」のような場合、"AAA"文字列の先頭アドレスがDEに設定され「HOGE」が実行される。
- S-OS"SWORD" for Web
  - ファイル選択で、S-OSヘッダ付きのバイナリファイルを**直接読み込み実行する**ように修正
  - URLのパラメータ、fnt=PC8001でPC8001風のフォントマップに  
    例）https://w88dodpecuthlol.github.io/SOS_SWORDforWeb/?fnt=PC8001
  - URLのパラメータ、exec=イメージのURL を追加
    - ぼや(@boyahina)様、感謝。  
      また、サンプルでゲームをご提供頂きました。  
    例）ヘッダ付きのバイナリファイル  
    https://w88dodpecuthlol.github.io/SOS_SWORDforWeb/?exec=sample/AFTER_BUNER_S.obj  
    例）ディスクイメージのマウント  
    https://w88dodpecuthlol.github.io/SOS_SWORDforWeb/?exec=test/SOS_TEST.d88  
    - セキュリティで同じドメインじゃないと読み込めないかもしれません（@todo)
  - 生の2Dディスクイメージに対応  
    - 拡張子が2Dで、かつ、327,680バイトのファイルであること  
    - 各セクタが順に並んでいること
  - CTRL + a～zなどで、制御コード0x00～0x20が入力できるように
    - ぼや(@boyahina)様、感謝。
  - X1風のフォントに変更しました
    - bugfire2009(@bugfire1)様のフォントを使用しています、感謝。
  - Bドライブにブランクディスクがセットされるように
    - マージ https://twitter.com/boyahina/status/1619139531411959808  ぼや(@boyahina)様
  - GamePad関連のURLのパラメータ、padKeyAssign、padAssignNumPad、padKey、padMapを追加
    - 参考にしてマージ https://twitter.com/boyahina/status/1619222369482186752  ぼや(@boyahina)様
    - padKeyAssign - GamePadをキーに割り当てるかどうか  
      padKeyAssign=1 : 割り当てる  
      padKeyAssign=0 : 割り当てない
    - padAssignNumPad - GamePadをテンキーに割り当てるかどうか  
      padAssignNumPad=0 : 割り当てない  
      padAssignNumPad=1 : 左アナログスティックを割り当てる。（方向で1～9キーになる）
    - padKey + 16進1桁～2桁 - ボタンをキーに割り振る  
      例) padKeyD=0 : エンターキーにGamePadのAボタンを割り当てる
      例) padKey1C=15 : カーソルキー右に、GamePadの右方向ボタンを割り当てる  
    - padMap - あらかじめ定義された設定を使用する  
      padMap=boya : ぼや(@boyahina)様のマッピング

padKeyで設定する値
| 値 | ゲームパッド |
| --- | --- |
| 0 | A |
| 1 | B |
| 2 | X |
| 3 | Y |
| 4 | LB |
| 5 | RB |
| 6 | LT |
| 7 | RT |
| 8 | BACK |
| 9 | START |
| 10 | L3 |
| 11 | R3 |
| 12 | デジタルの方向キーの上 |
| 13 | デジタルの方向キーの下 |
| 14 | デジタルの方向キーの左 |
| 15 | デジタルの方向キーの右 |
| 16 | HOME |
| 28 | 左アナログスティックとデジタルを合わせたもの 右 |
| 29 | 左アナログスティックとデジタルを合わせたもの 左 |
| 30 | 左アナログスティックとデジタルを合わせたもの 上 |
| 31 | 左アナログスティックとデジタルを合わせたもの 下 |
| 49 | 左アナログスティックをテンキーの方向(1)にしたもの 左下 |
| 50 | 左アナログスティックをテンキーの方向(2)にしたもの 下 |
| 51 | 左アナログスティックをテンキーの方向(3)にしたもの 右下 |
| 52 | 左アナログスティックをテンキーの方向(4)にしたもの 左 |
| 54 | 左アナログスティックをテンキーの方向(6)にしたもの 右 |
| 55 | 左アナログスティックをテンキーの方向(7)にしたもの 左上 |
| 56 | 左アナログスティックをテンキーの方向(8)にしたもの 上 |
| 57 | 左アナログスティックをテンキーの方向(9)にしたもの 右上 |

## [0.00.00] - 2022-12
- 最初のリリース
- 表示文字列をS-OS準拠に
- X1のVRAMフォーマットで、0x4000～0xFFFFの内容を出力するように
- S-OS標準モニタでJコマンドが動作しないことがあったのを修正
- S-OS標準モニタでカタカナなどの文字が含まれるファイルが読み込めなかった不具合を修正
- S-OS標準モニタPコマンド実装
- 画面サイス40x25と画面サイス80x25で、キャラクタのサイズを変更するように変更
- S-OS標準モニタの空白コマンド、バイナリファイルに対応
- S-OS標準モニタの空白コマンド、アスキーファイルのバッチ処理を実装  
  ~~テストはしていないので、動作するかどうかは不明~~  
  S-OS標準のモニタコマンドの実行ができるように。  
- S-OS標準モニタのファイルリスト表示部分の16進数を大文字に変更
- カーソルの表示、非表示を制御するように修正
- X1のグラフィックパレットに対応してみたつもり、未テスト
- S-OS #FILEが正常に動作していなかったのを修正
- S-OS #ROPENが正常に動作していなかったのを修正
